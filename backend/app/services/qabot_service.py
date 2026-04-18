import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.api.dependencies import check_release_access, check_release_owner
from app.models.models import AuditLog, QAChatMessage, QAChatSession, QAOrg, Release, User
from app.models.schemas import (
    QABotActionDescriptor,
    QABotMessageCreate,
    ReleaseCreate,
    ReleaseUpdate,
    QAOrgCreate,
    QAOrgUpdate,
)
from app.models.test_execution_models import TestRun
from app.models.test_execution_schemas import TestRunCreate, TestRunUpdate
from app.services.org_service import OrgService
from app.services.qabot_knowledge_service import QABotKnowledgeService
from app.services.release_service import ReleaseService
from app.services.test_execution_service import TestExecutionService


class QABotService:
    def __init__(self, db: Session, current_user: User):
        self.db = db
        self.current_user = current_user
        self.release_service = ReleaseService(db)
        self.org_service = OrgService(db)
        self.test_execution_service = TestExecutionService(db)
        self.knowledge_service = QABotKnowledgeService(db, current_user)

    def list_sessions(self) -> List[QAChatSession]:
        return (
            self.db.query(QAChatSession)
            .filter(QAChatSession.user_id == self.current_user.id)
            .order_by(QAChatSession.updated_at.desc(), QAChatSession.created_at.desc())
            .all()
        )

    def create_session(self, title: Optional[str] = None) -> QAChatSession:
        session = QAChatSession(
            user_id=self.current_user.id,
            title=(title or "New QAbot chat")[:255],
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(self, session_id: int) -> QAChatSession:
        session = (
            self.db.query(QAChatSession)
            .filter(
                QAChatSession.id == session_id,
                QAChatSession.user_id == self.current_user.id,
            )
            .first()
        )
        if not session:
            raise ValueError("QAbot session not found")
        return session

    def get_messages(self, session_id: int) -> List[QAChatMessage]:
        self.get_session(session_id)
        return (
            self.db.query(QAChatMessage)
            .filter(QAChatMessage.session_id == session_id)
            .order_by(QAChatMessage.created_at.asc(), QAChatMessage.id.asc())
            .all()
        )

    async def handle_message(self, session_id: int, payload: QABotMessageCreate) -> Tuple[QAChatMessage, QAChatMessage]:
        session = self.get_session(session_id)
        user_message = self._save_message(
            session_id=session.id,
            user_id=self.current_user.id,
            is_bot=False,
            message=payload.message.strip(),
            metadata_json=None,
        )

        bot_text, bot_metadata = await self._route_message(payload)
        bot_message = self._save_message(
            session_id=session.id,
            user_id=None,
            is_bot=True,
            message=bot_text,
            metadata_json=bot_metadata,
        )

        if session.title == "New QAbot chat" and payload.message.strip():
            session.title = payload.message.strip()[:255]
        session.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user_message)
        self.db.refresh(bot_message)
        return user_message, bot_message

    async def _route_message(self, payload: QABotMessageCreate) -> Tuple[str, Dict[str, Any]]:
        text = payload.message.strip()
        if not text:
            return (
                "QAbot is ready. Ask me to create, list, update, or delete releases, orgs, and test runs.",
                {"mode": "help"},
            )

        if payload.confirm_action and payload.pending_action:
            return await self._execute_confirmed_action(payload.pending_action)

        parsed = self._parse_action(text)
        if parsed:
            if parsed["operation"] == "delete":
                descriptor = QABotActionDescriptor(
                    operation=parsed["operation"],
                    resource_type=parsed["resource_type"],
                    resource_id=parsed.get("resource_id"),
                    summary=parsed["summary"],
                    payload=parsed.get("payload"),
                )
                return (
                    f"Please confirm before I {parsed['summary'].lower()}.",
                    {
                        "mode": "confirmation",
                        "requires_confirmation": True,
                        "pending_action": descriptor.model_dump(),
                    },
                )
            return await self._execute_action(parsed)

        return await self._answer_from_knowledge(text)

    async def _execute_confirmed_action(self, action: QABotActionDescriptor) -> Tuple[str, Dict[str, Any]]:
        return await self._execute_action(action.model_dump())

    async def _execute_action(self, parsed: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        operation = parsed["operation"]
        resource_type = parsed["resource_type"]

        if resource_type == "release":
            return self._handle_release_action(operation, parsed)
        if resource_type == "org":
            return self._handle_org_action(operation, parsed)
        if resource_type == "test_run":
            return await self._handle_test_run_action(operation, parsed)

        return ("I recognized the request, but that record type is not enabled yet.", {"mode": "unsupported"})

    def _handle_release_action(self, operation: str, parsed: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        if operation == "list":
            releases = self.release_service.get_accessible_releases(self.current_user.id, limit=10)
            if not releases:
                return ("No releases found yet.", {"mode": "query", "resource_type": "release", "records": []})
            records = [
                {
                    "id": release.id,
                    "release_name": release.release_name,
                    "release_version": self._clean_release_version(release.release_version),
                    "status": release.status,
                }
                for release in releases
            ]
            text = "Recent releases:\n" + "\n".join(
                f"- #{record['id']} {record['release_name']} ({record['release_version']}) [{record['status']}]"
                for record in records
            )
            return (text, {"mode": "query", "resource_type": "release", "records": records})

        if operation == "create":
            data = ReleaseCreate(**parsed["payload"])
            release = self.release_service.create_release(data, self.current_user.id)
            self._log_action("create", "release", release.id, parsed["payload"])
            return (
                f"Created release #{release.id}: {release.release_name} ({release.release_version}).",
                {"mode": "action_result", "resource_type": "release", "operation": "create", "record": {
                    "id": release.id,
                    "release_name": release.release_name,
                    "release_version": self._clean_release_version(release.release_version),
                    "status": release.status,
                }},
            )

        release_id = parsed.get("resource_id")
        release = self.release_service.get_release(release_id) if release_id else None
        if not release:
            return ("I couldn't find that release.", {"mode": "error", "resource_type": "release"})

        if operation == "update":
            if not check_release_access(release.id, self.current_user, self.db):
                return ("You don't have permission to update that release.", {"mode": "error", "resource_type": "release"})
            updated = self.release_service.update_release(release.id, ReleaseUpdate(**parsed["payload"]))
            self._log_action("update", "release", release.id, parsed["payload"])
            return (
                f"Updated release #{updated.id}. Current status: {updated.status}.",
                {"mode": "action_result", "resource_type": "release", "operation": "update", "record": {
                    "id": updated.id,
                    "release_name": updated.release_name,
                    "release_version": self._clean_release_version(updated.release_version),
                    "status": updated.status,
                }},
            )

        if operation == "delete":
            if not check_release_owner(release.id, self.current_user, self.db):
                return ("Only the release owner can delete that release.", {"mode": "error", "resource_type": "release"})
            self.release_service.delete_release(release.id)
            self._log_action("delete", "release", release.id, {"release_version": release.release_version})
            return (
                f"Deleted release #{release.id} ({release.release_version}).",
                {"mode": "action_result", "resource_type": "release", "operation": "delete", "record": {"id": release.id}},
            )

        return ("That release action is not supported yet.", {"mode": "unsupported"})

    def _handle_org_action(self, operation: str, parsed: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        if operation == "list":
            orgs = self.org_service.get_orgs(limit=10, active_only=False)
            records = [
                {
                    "id": org.id,
                    "org_name": org.org_name,
                    "release_version": org.release_version,
                    "stability_score": org.stability_score,
                    "is_active": org.is_active,
                }
                for org in orgs
            ]
            if not records:
                return ("No orgs found yet.", {"mode": "query", "resource_type": "org", "records": []})
            text = "Available orgs:\n" + "\n".join(
                f"- #{record['id']} {record['org_name']} | release {record['release_version'] or 'n/a'} | stability {record['stability_score']}"
                for record in records
            )
            return (text, {"mode": "query", "resource_type": "org", "records": records})

        if operation == "create":
            data = QAOrgCreate(**parsed["payload"])
            org = self.org_service.create_org(data)
            self._log_action("create", "org", org.id, parsed["payload"])
            return (
                f"Created org #{org.id}: {org.org_name}.",
                {"mode": "action_result", "resource_type": "org", "operation": "create", "record": {
                    "id": org.id,
                    "org_name": org.org_name,
                    "release_version": org.release_version,
                    "stability_score": org.stability_score,
                }},
            )

        org_id = parsed.get("resource_id")
        org = self.org_service.get_org(org_id) if org_id else None
        if not org:
            return ("I couldn't find that org.", {"mode": "error", "resource_type": "org"})

        if operation == "update":
            updated = self.org_service.update_org(org.id, QAOrgUpdate(**parsed["payload"]))
            self._log_action("update", "org", org.id, parsed["payload"])
            return (
                f"Updated org #{updated.id}: {updated.org_name}.",
                {"mode": "action_result", "resource_type": "org", "operation": "update", "record": {
                    "id": updated.id,
                    "org_name": updated.org_name,
                    "release_version": updated.release_version,
                    "stability_score": updated.stability_score,
                }},
            )

        if operation == "delete":
            self.org_service.delete_org(org.id)
            self._log_action("delete", "org", org.id, {"org_name": org.org_name})
            return (
                f"Deleted org #{org.id}: {org.org_name}.",
                {"mode": "action_result", "resource_type": "org", "operation": "delete", "record": {"id": org.id}},
            )

        return ("That org action is not supported yet.", {"mode": "unsupported"})

    async def _handle_test_run_action(self, operation: str, parsed: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        if operation == "list":
            runs = [
                run
                for run in self.test_execution_service.get_test_runs(limit=100)
                if check_release_access(run.release_id, self.current_user, self.db)
            ][:10]
            records = [
                {
                    "id": run.id,
                    "name": run.name,
                    "release_id": run.release_id,
                    "status": run.status.value if hasattr(run.status, "value") else run.status,
                    "total_test_cases": run.total_test_cases,
                }
                for run in runs
            ]
            if not records:
                return ("No test runs found yet.", {"mode": "query", "resource_type": "test_run", "records": []})
            text = "Recent test runs:\n" + "\n".join(
                f"- #{record['id']} {record['name']} | release #{record['release_id']} | {record['status']}"
                for record in records
            )
            return (text, {"mode": "query", "resource_type": "test_run", "records": records})

        if operation == "create":
            release_id = parsed["payload"].get("release_id")
            if not release_id:
                return (
                    "Please tell me which release to use before I create a test run. For example: `Create test run Smoke Sweep for release 12`.",
                    {"mode": "clarification_required", "resource_type": "test_run"},
                )
            if not check_release_access(release_id, self.current_user, self.db):
                return (
                    "You don't have permission to create a test run for that release.",
                    {"mode": "error", "resource_type": "test_run"},
                )
            data = TestRunCreate(**parsed["payload"])
            created = await self.test_execution_service.create_test_run(data, self.current_user.id)
            self._log_action("create", "test_run", created.id, parsed["payload"])
            return (
                f"Created test run #{created.id}: {created.name}.",
                {"mode": "action_result", "resource_type": "test_run", "operation": "create", "record": {
                    "id": created.id,
                    "name": created.name,
                    "release_id": created.release_id,
                    "status": created.status,
                }},
            )

        run_id = parsed.get("resource_id")
        run = self.db.query(TestRun).filter(TestRun.id == run_id).first() if run_id else None
        if not run:
            return ("I couldn't find that test run.", {"mode": "error", "resource_type": "test_run"})
        if not check_release_access(run.release_id, self.current_user, self.db):
            return (
                "You don't have permission to access that test run.",
                {"mode": "error", "resource_type": "test_run"},
            )

        if operation == "update":
            updated = self.test_execution_service.update_test_run(run.id, TestRunUpdate(**parsed["payload"]))
            self._log_action("update", "test_run", run.id, parsed["payload"])
            return (
                f"Updated test run #{updated.id}: {updated.name}.",
                {"mode": "action_result", "resource_type": "test_run", "operation": "update", "record": {
                    "id": updated.id,
                    "name": updated.name,
                    "release_id": updated.release_id,
                    "status": updated.status,
                }},
            )

        if operation == "delete":
            self.test_execution_service.delete_test_run(run.id)
            self._log_action("delete", "test_run", run.id, {"name": run.name})
            return (
                f"Deleted test run #{run.id}: {run.name}.",
                {"mode": "action_result", "resource_type": "test_run", "operation": "delete", "record": {"id": run.id}},
            )

        return ("That test run action is not supported yet.", {"mode": "unsupported"})

    async def _answer_from_knowledge(self, text: str) -> Tuple[str, Dict[str, Any]]:
        result = await self.knowledge_service.answer(text)
        return result["answer"], {
            "mode": result["mode"],
            "sources": result.get("sources", []),
            "context": {"query": text},
        }

    def _parse_action(self, text: str) -> Optional[Dict[str, Any]]:
        normalized = re.sub(r"\s+", " ", text.strip()).lower()
        if not normalized:
            return None

        for resource_type, aliases in {
            "release": ["release", "releases"],
            "org": ["org", "orgs", "organization", "organizations"],
            "test_run": ["test run", "testrun", "test-run", "test runs"],
        }.items():
            if any(alias in normalized for alias in aliases):
                operation = self._detect_operation(normalized)
                if not operation:
                    return None
                return self._build_action(operation, resource_type, text)
        return None

    def _detect_operation(self, normalized: str) -> Optional[str]:
        if any(word in normalized for word in ["create", "add", "new"]):
            return "create"
        if any(word in normalized for word in ["list", "show all", "all ", "view all"]):
            return "list"
        if any(word in normalized for word in ["update", "edit", "change", "set"]):
            return "update"
        if any(word in normalized for word in ["delete", "remove"]):
            return "delete"
        if any(word in normalized for word in ["show", "view", "get"]):
            return "list"
        return None

    def _build_action(self, operation: str, resource_type: str, raw_text: str) -> Dict[str, Any]:
        text = re.sub(r"\s+", " ", raw_text.strip())
        resource_id = self._extract_id(text)
        payload: Dict[str, Any] = {}

        if resource_type == "release":
            if operation == "create":
                version = self._extract_release_version_for_create(text) or self._extract_semver(text)
                name = self._extract_named_value(text) or f"Release {version or datetime.utcnow().strftime('%Y-%m-%d')}"
                status = self._extract_after_keywords(text, ["status"]) or "planning"
                payload = {"release_version": version or f"v{datetime.utcnow().strftime('%Y.%m.%d')}", "release_name": name, "status": status}
            elif operation == "update":
                payload = self._extract_release_update_fields(text)
            summary = f"{operation} release" + (f" #{resource_id}" if resource_id else "")

        elif resource_type == "org":
            if operation == "create":
                name = self._extract_org_name_for_create(text) or self._extract_named_value(text) or "New QA Org"
                release_version = self._extract_release_version_reference(text) or self._extract_semver(text)
                stability_score = self._extract_float(text)
                payload = {"org_name": name, "release_version": release_version, "stability_score": stability_score or 0.0}
            elif operation == "update":
                payload = self._extract_org_update_fields(text)
            summary = f"{operation} org" + (f" #{resource_id}" if resource_id else "")

        else:
            if operation == "create":
                release_id = resource_id or self._extract_number_after_keyword(text, "release")
                name = self._extract_test_run_name_for_create(text) or self._extract_named_value(text) or "New Test Run"
                payload = {"release_id": release_id, "name": name}
            elif operation == "update":
                payload = self._extract_test_run_update_fields(text)
            summary = f"{operation} test run" + (f" #{resource_id}" if resource_id else "")

        return {
            "operation": operation,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "payload": payload,
            "summary": summary,
        }

    def _extract_release_update_fields(self, text: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        name = self._extract_named_value(text) or self._extract_after_keywords(text, ["name"])
        status = self._extract_after_keywords(text, ["status"])
        description = self._extract_after_keywords(text, ["description"])
        version = self._extract_release_version_for_create(text)
        if name:
            payload["release_name"] = name
        if status:
            payload["status"] = status.lower().replace(" ", "_")
        if description:
            payload["description"] = description
        if version:
            payload["release_version"] = version
        return payload

    def _extract_org_update_fields(self, text: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        name = self._extract_named_value(text) or self._extract_after_keywords(text, ["name"])
        release_version = self._extract_release_version_reference(text) or self._extract_semver(text)
        stability_score = self._extract_float(text)
        active = self._extract_boolean_state(text)
        if name:
            payload["org_name"] = name
        if release_version:
            payload["release_version"] = release_version
        if stability_score is not None:
            payload["stability_score"] = stability_score
        if active is not None:
            payload["is_active"] = active
        return payload

    def _extract_test_run_update_fields(self, text: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        name = self._extract_named_value(text) or self._extract_after_keywords(text, ["name"])
        status = self._extract_after_keywords(text, ["status"])
        description = self._extract_after_keywords(text, ["description"])
        if name:
            payload["name"] = name
        if status:
            payload["status"] = status.lower().replace(" ", "_")
        if description:
            payload["description"] = description
        return payload

    def _extract_after_keywords(self, text: str, keywords: List[str]) -> Optional[str]:
        for keyword in keywords:
            pattern = rf"{re.escape(keyword)}\s+(.+)"
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip(" .")
        return None

    def _extract_named_value(self, text: str) -> Optional[str]:
        match = re.search(r"(?:called|named)\s+['\"]?(.+?)['\"]?(?:\s+status\b|\s+for\s+release\b|$)", text, flags=re.IGNORECASE)
        return match.group(1).strip(" .") if match else None

    def _extract_release_version_for_create(self, text: str) -> Optional[str]:
        match = re.search(r"(?:release\s+version|version)\s+([A-Za-z0-9._-]+)", text, flags=re.IGNORECASE)
        return match.group(1).strip(" .") if match else None

    def _extract_release_version_reference(self, text: str) -> Optional[str]:
        match = re.search(r"(?:for\s+release|release)\s+([A-Za-z0-9._-]+)", text, flags=re.IGNORECASE)
        return match.group(1).strip(" .") if match else None

    def _extract_org_name_for_create(self, text: str) -> Optional[str]:
        match = re.search(
            r"(?:create|add|new)\s+(?:org|organization)\s+(.+?)(?:\s+for\s+release\b|\s+with\b|\s+stability\b|$)",
            text,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip(" .") if match else None

    def _extract_test_run_name_for_create(self, text: str) -> Optional[str]:
        match = re.search(
            r"(?:create|add|new)\s+test\s*run\s+(.+?)(?:\s+for\s+release\b|\s+for\b|\s+status\b|$)",
            text,
            flags=re.IGNORECASE,
        )
        return match.group(1).strip(" .") if match else None

    def _clean_release_version(self, value: Optional[str]) -> str:
        if not value:
            return ""
        cleaned = re.sub(r"\s+(called|named)\s+.+$", "", value, flags=re.IGNORECASE).strip()
        return cleaned or value

    def _extract_id(self, text: str) -> Optional[int]:
        match = re.search(r"#?(\d+)", text)
        return int(match.group(1)) if match else None

    def _extract_number_after_keyword(self, text: str, keyword: str) -> Optional[int]:
        match = re.search(rf"{re.escape(keyword)}\s+#?(\d+)", text, flags=re.IGNORECASE)
        return int(match.group(1)) if match else None

    def _extract_semver(self, text: str) -> Optional[str]:
        match = re.search(r"\bv?\d+(?:\.\d+){1,3}\b", text, flags=re.IGNORECASE)
        return match.group(0) if match else None

    def _extract_float(self, text: str) -> Optional[float]:
        match = re.search(r"\b(0(?:\.\d+)?|1(?:\.0+)?)\b", text)
        return float(match.group(1)) if match else None

    def _extract_boolean_state(self, text: str) -> Optional[bool]:
        lowered = text.lower()
        if "inactive" in lowered or "disable" in lowered:
            return False
        if "active" in lowered or "enable" in lowered:
            return True
        return None

    def _save_message(
        self,
        session_id: int,
        user_id: Optional[int],
        is_bot: bool,
        message: str,
        metadata_json: Optional[Dict[str, Any]],
    ) -> QAChatMessage:
        row = QAChatMessage(
            session_id=session_id,
            user_id=user_id,
            is_bot=is_bot,
            message=message,
            metadata_json=metadata_json,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def _log_action(self, action: str, resource_type: str, resource_id: int, details: Dict[str, Any]) -> None:
        audit = AuditLog(
            user_id=self.current_user.id,
            action=f"qabot_{action}",
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        )
        self.db.add(audit)
        self.db.commit()
