import re
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.models import QAOrg, Release, SavedTestPlan, User
from app.models.test_execution_models import TestExecution, TestExecutionComment, TestRun
from app.services.ai_service import AIService
from app.services.google_sheets_service import google_sheets_service
from app.services.testrail_csv_service import testrail_csv_service


class QABotKnowledgeService:
    GREETING_PATTERNS = {
        "hi", "hello", "hey", "yo", "hola", "good morning", "good afternoon", "good evening",
    }
    STOP_WORDS = {
        "the", "and", "for", "with", "from", "this", "that", "into", "your", "their",
        "what", "which", "when", "where", "why", "how", "can", "could", "should", "would",
        "about", "show", "tell", "give", "find", "list", "please", "release", "releases",
        "test", "tests", "plan", "plans", "run", "runs", "org", "orgs", "qa", "bot",
    }

    def __init__(self, db: Session, current_user: User):
        self.db = db
        self.current_user = current_user
        self.ai_service = AIService()

    def _get_accessible_releases(self) -> List[Release]:
        return (
            self.db.query(Release)
            .filter(
                or_(
                    Release.created_by == self.current_user.id,
                    Release.collaborators.any(User.id == self.current_user.id),
                )
            )
            .order_by(Release.created_at.desc())
            .limit(50)
            .all()
        )

    async def answer(self, query: str) -> Dict[str, Any]:
        fast_response = self._fast_path_response(query)
        if fast_response:
            return fast_response

        documents = self._collect_documents()
        ranked = self._rank_documents(query, documents)
        top_docs = ranked[:6]

        if not top_docs:
            return {
                "answer": "I couldn't find grounded platform knowledge for that question yet. Try naming a release, org, ticket, saved plan, or test case area.",
                "sources": [],
                "mode": "knowledge_empty",
            }

        ai_answer = await self._synthesize_answer(query, top_docs)
        if not ai_answer:
            ai_answer = self._fallback_answer(query, top_docs)

        return {
            "answer": ai_answer,
            "sources": [
                {
                    "title": doc["title"],
                    "source_type": doc["source_type"],
                    "record_id": doc.get("record_id"),
                    "summary": doc["summary"],
                    "score": doc["score"],
                }
                for doc in top_docs
            ],
            "mode": "knowledge_answer",
        }

    def _fast_path_response(self, query: str) -> Optional[Dict[str, Any]]:
        normalized = re.sub(r"\s+", " ", (query or "").strip().lower())
        if not normalized:
            return {
                "answer": "QAbot is ready. Ask me about releases, orgs, saved plans, tickets, or test cases.",
                "sources": [],
                "mode": "knowledge_help",
            }

        if normalized in self.GREETING_PATTERNS:
            return {
                "answer": "Hi. I can help with releases, orgs, test runs, tickets, saved plans, and test cases. Try `list releases` or `what changed in release v2.4?`",
                "sources": [],
                "mode": "knowledge_greeting",
            }

        if len(normalized) <= 3:
            return {
                "answer": "Ask me about a release, org, ticket, saved plan, or test case area and I’ll look it up.",
                "sources": [],
                "mode": "knowledge_short_query",
            }

        return None

    def _collect_documents(self) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        accessible_releases = self._get_accessible_releases()
        accessible_release_ids = [release.id for release in accessible_releases]
        accessible_release_versions = {
            release.release_version for release in accessible_releases if release.release_version
        }

        for release in accessible_releases:
            docs.append({
                "source_type": "release",
                "record_id": release.id,
                "title": f"Release #{release.id} {release.release_name}",
                "summary": f"Version {release.release_version}, status {release.status}, description {release.description or 'n/a'}",
                "content": " ".join(filter(None, [
                    release.release_name,
                    release.release_version,
                    release.status,
                    release.description or "",
                ])),
            })

        org_query = self.db.query(QAOrg).order_by(QAOrg.created_at.desc())
        if accessible_release_versions:
            org_query = org_query.filter(QAOrg.release_version.in_(list(accessible_release_versions)))
        else:
            org_query = org_query.filter(QAOrg.id == -1)
        for org in org_query.limit(50).all():
            docs.append({
                "source_type": "org",
                "record_id": org.id,
                "title": f"Org #{org.id} {org.org_name}",
                "summary": f"Release {org.release_version or 'n/a'}, stability {org.stability_score}, active {org.is_active}",
                "content": " ".join([
                    org.org_name,
                    org.release_version or "",
                    " ".join(org.enabled_features or []),
                    " ".join(org.data_sets_available or []),
                    " ".join(org.known_issues or []),
                    org.org_url or "",
                ]),
            })

        for saved_plan in (
            self.db.query(SavedTestPlan)
            .filter(SavedTestPlan.created_by == self.current_user.id)
            .order_by(SavedTestPlan.created_at.desc())
            .limit(40)
            .all()
        ):
            plan_summary = self._summarize_saved_plan(saved_plan.test_plan_data)
            docs.append({
                "source_type": "saved_test_plan",
                "record_id": saved_plan.id,
                "title": f"Saved Plan #{saved_plan.id} {saved_plan.test_plan_name or saved_plan.release_versions}",
                "summary": f"Releases {saved_plan.release_versions}; {plan_summary}",
                "content": " ".join(filter(None, [
                    saved_plan.test_plan_name or "",
                    saved_plan.release_versions,
                    saved_plan.priority_focus or "",
                    plan_summary,
                ])),
            })

        if accessible_release_ids:
            test_runs = (
                self.db.query(TestRun)
                .filter(TestRun.release_id.in_(accessible_release_ids))
                .order_by(TestRun.created_at.desc())
                .limit(40)
                .all()
            )
        else:
            test_runs = []

        for run in test_runs:
            docs.append({
                "source_type": "test_run",
                "record_id": run.id,
                "title": f"Test Run #{run.id} {run.name}",
                "summary": f"Release {run.release_id}, status {run.status}, total {run.total_test_cases}, passed {run.passed_count}, failed {run.failed_count}",
                "content": " ".join(filter(None, [
                    run.name,
                    str(run.release_id),
                    str(run.status),
                    run.description or "",
                ])),
            })

        test_run_ids = [run.id for run in test_runs]
        execution_query = self.db.query(TestExecution).order_by(TestExecution.created_at.desc())
        if test_run_ids:
            execution_query = execution_query.filter(TestExecution.test_run_id.in_(test_run_ids))
        else:
            execution_query = execution_query.filter(TestExecution.id == -1)

        for execution in execution_query.limit(40).all():
            docs.append({
                "source_type": "test_execution",
                "record_id": execution.id,
                "title": f"Execution #{execution.id} {execution.test_case_id}",
                "summary": f"{execution.test_case_title} | status {execution.status} | priority {execution.priority}",
                "content": " ".join(filter(None, [
                    execution.test_case_id,
                    execution.test_case_title,
                    execution.test_case_description or "",
                    execution.expected_result or "",
                    execution.actual_result or "",
                    execution.tester_notes or "",
                ])),
            })

        comment_query = self.db.query(TestExecutionComment).order_by(TestExecutionComment.created_at.desc())
        if test_run_ids:
            comment_query = (
                comment_query.join(TestExecution, TestExecutionComment.test_execution_id == TestExecution.id)
                .filter(TestExecution.test_run_id.in_(test_run_ids))
            )
        else:
            comment_query = comment_query.filter(TestExecutionComment.id == -1)

        for comment in comment_query.limit(40).all():
            docs.append({
                "source_type": "execution_chat",
                "record_id": comment.id,
                "title": f"Execution Chat #{comment.id}",
                "summary": comment.message[:180],
                "content": comment.message,
            })

        for ticket in google_sheets_service.get_all_tickets()[:200]:
            issue_key = ticket.get("issue_key", ticket.get("Issue key", ""))
            summary = ticket.get("summary", ticket.get("Summary", ""))
            docs.append({
                "source_type": "jira_ticket",
                "record_id": None,
                "title": f"Ticket {issue_key}",
                "summary": f"{summary} | status {ticket.get('status', ticket.get('Status', ''))} | priority {ticket.get('priority', ticket.get('Priority', ''))} | release {ticket.get('fix_versions', ticket.get('Fix versions', ''))}",
                "content": " ".join(filter(None, [
                    issue_key,
                    ticket.get("issue_type", ticket.get("Issue Type", "")),
                    summary,
                    ticket.get("status", ticket.get("Status", "")),
                    ticket.get("priority", ticket.get("Priority", "")),
                    ticket.get("fix_versions", ticket.get("Fix versions", "")),
                ])),
            })

        for test_case in testrail_csv_service.get_all_test_cases()[:300]:
            docs.append({
                "source_type": "testrail_case",
                "record_id": None,
                "title": f"Test Case {test_case.get('ID', '')}",
                "summary": f"{test_case.get('Title', '')} | {test_case.get('Section Hierarchy', '')}",
                "content": " ".join(filter(None, [
                    test_case.get("ID", ""),
                    test_case.get("Title", ""),
                    test_case.get("Section", ""),
                    test_case.get("Section Hierarchy", ""),
                    test_case.get("Section Description", ""),
                    test_case.get("Priority", ""),
                ])),
            })

        return docs

    def _rank_documents(self, query: str, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        query_tokens = self._tokenize(query)
        ranked: List[Dict[str, Any]] = []
        lowered_query = query.lower()

        for doc in documents:
            haystack = f"{doc['title']} {doc['summary']} {doc['content']}".lower()
            hay_tokens = set(self._tokenize(haystack))
            overlap = len(set(query_tokens) & hay_tokens)
            exact_bonus = 0

            for phrase in self._extract_identifiers(query):
                if phrase.lower() in haystack:
                    exact_bonus += 10

            title_bonus = sum(2 for token in query_tokens if token in doc["title"].lower())
            score = overlap * 3 + title_bonus + exact_bonus
            if overlap == 0 and exact_bonus == 0:
                continue

            ranked.append({**doc, "score": score})

        ranked.sort(key=lambda doc: (-doc["score"], doc["title"]))
        return ranked

    async def _synthesize_answer(self, query: str, documents: List[Dict[str, Any]]) -> str:
        context = "\n\n".join(
            f"[{index + 1}] {doc['title']}\nType: {doc['source_type']}\nSummary: {doc['summary']}\nContent: {doc['content'][:900]}"
            for index, doc in enumerate(documents)
        )

        prompt = f"""
Answer the user's question using only the provided knowledge context. If the context is incomplete, say so briefly.
Mention the most relevant sources using bracketed source numbers like [1] or [2].

User question:
{query}

Knowledge context:
{context}
"""

        response = await self.ai_service._generate(
            prompt,
            "You are QAbot, an enterprise QA operations assistant. Give grounded, concise answers using only the supplied context.",
        )
        return response.strip()

    def _fallback_answer(self, query: str, documents: List[Dict[str, Any]]) -> str:
        lines = [f"I found {len(documents)} relevant sources for: {query}"]
        for index, doc in enumerate(documents[:4], start=1):
            lines.append(f"[{index}] {doc['title']}: {doc['summary']}")
        return "\n".join(lines)

    def _summarize_saved_plan(self, test_plan_data: Any) -> str:
        if isinstance(test_plan_data, dict):
            plan = test_plan_data.get("test_plan", test_plan_data)
            suites = plan.get("test_suites", [])
            suite_names = [suite.get("suite_name", "") for suite in suites[:3] if isinstance(suite, dict)]
            return f"{len(suites)} suites" + (f" including {', '.join(filter(None, suite_names))}" if suite_names else "")
        if isinstance(test_plan_data, list):
            return f"{len(test_plan_data)} plan entries"
        return str(test_plan_data)[:160]

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"[a-z0-9._-]+", (text or "").lower())
        return [token for token in tokens if len(token) > 2 and token not in self.STOP_WORDS]

    def _extract_identifiers(self, text: str) -> List[str]:
        patterns = [
            r"\b[A-Z]{2,}-\d+\b",
            r"\bC\d+\b",
            r"\bv?\d+(?:\.\d+){1,3}\b",
            r"\b#\d+\b",
        ]
        values: List[str] = []
        for pattern in patterns:
            values.extend(re.findall(pattern, text, flags=re.IGNORECASE))
        return values
