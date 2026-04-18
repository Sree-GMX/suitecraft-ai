"""
Hybrid Jira ticket service.

Despite the historical module name, this service now prefers live Jira API
ingestion when credentials are configured and falls back to the local CSV when
the API is unavailable.
"""

from __future__ import annotations

import base64
import csv
import logging
import os
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class GoogleSheetsService:
    """Backward-compatible Jira service with live API + CSV fallback."""

    SEARCH_FIELDS = "summary,status,priority,issuetype,fixVersions"
    CACHE_TTL_SECONDS = 300

    def __init__(self):
        self.local_csv = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "jira_data.csv"
        )
        self._cached_records: List[Dict] = []
        self._cached_mtime: Optional[float] = None
        self._last_source: str = "csv"
        self._last_live_error: Optional[str] = None
        self._result_cache: Dict[Tuple[str, Optional[str]], Tuple[float, List]] = {}
        logger.info("Jira ticket service initialized")
        logger.info("CSV fallback path: %s", self.local_csv)

    def _get_cached_result(self, cache_key: Tuple[str, Optional[str]]) -> Optional[List]:
        cached_entry = self._result_cache.get(cache_key)
        if not cached_entry:
            return None
        expires_at, value = cached_entry
        if expires_at <= time.monotonic():
            self._result_cache.pop(cache_key, None)
            return None
        return list(value)

    def _set_cached_result(self, cache_key: Tuple[str, Optional[str]], value: List) -> List:
        self._result_cache[cache_key] = (
            time.monotonic() + self.CACHE_TTL_SECONDS,
            list(value),
        )
        return list(value)

    def _normalize_api_base_url(self) -> str:
        cloud_id = (settings.JIRA_CLOUD_ID or "").strip()
        if cloud_id:
            return f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3"

        raw = (settings.JIRA_API_URL or "").strip()
        if not raw:
            return ""

        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            base = f"{parsed.scheme}://{parsed.netloc}"
        else:
            base = raw.rstrip("/")

        if raw.rstrip("/").endswith("/rest/api/3"):
            return raw.rstrip("/")
        return f"{base}/rest/api/3"

    def _is_jira_api_configured(self) -> bool:
        return bool(
            self._normalize_api_base_url()
            and settings.JIRA_API_EMAIL.strip()
            and settings.JIRA_API_TOKEN.strip()
        )

    def _build_auth_headers(self) -> Dict[str, str]:
        token = base64.b64encode(
            f"{settings.JIRA_API_EMAIL}:{settings.JIRA_API_TOKEN}".encode("utf-8")
        ).decode("utf-8")
        return {
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
        }

    def _normalize_csv_ticket(self, record: Dict) -> Dict:
        return {
            "issue_type": record.get("Issue Type", ""),
            "issue_key": record.get("Issue key", ""),
            "summary": record.get("Summary", ""),
            "status": record.get("Status", ""),
            "priority": record.get("Priority", ""),
            "fix_versions": record.get("Fix versions", ""),
        }

    def _normalize_jira_issue(self, issue: Dict) -> Dict:
        fields = issue.get("fields") or {}
        fix_versions = ", ".join(
            version.get("name", "") for version in (fields.get("fixVersions") or []) if version.get("name")
        )
        return {
            "issue_type": (fields.get("issuetype") or {}).get("name", ""),
            "issue_key": issue.get("key", ""),
            "summary": fields.get("summary", ""),
            "status": (fields.get("status") or {}).get("name", ""),
            "priority": (fields.get("priority") or {}).get("name", ""),
            "fix_versions": fix_versions,
        }

    def get_csv_data(self) -> List[Dict]:
        """Read Jira data from the local CSV fallback."""
        try:
            if not os.path.exists(self.local_csv):
                logger.warning("Jira CSV fallback not found: %s", self.local_csv)
                return []

            current_mtime = os.path.getmtime(self.local_csv)
            if self._cached_mtime == current_mtime and self._cached_records:
                return list(self._cached_records)

            with open(self.local_csv, "r", encoding="utf-8") as file_handle:
                reader = csv.DictReader(file_handle)
                self._cached_records = list(reader)
                self._cached_mtime = current_mtime
                logger.info("Loaded %s Jira tickets from CSV fallback", len(self._cached_records))
                return list(self._cached_records)
        except Exception as exc:
            logger.error("Error reading Jira CSV fallback: %s", exc)
            return []

    def _get_release_tickets_from_csv(self, release_version: Optional[str] = None) -> List[Dict]:
        records = self.get_csv_data()
        if not records:
            logger.warning("No Jira CSV fallback data available")
            return []

        tickets: List[Dict] = []
        for record in records:
            if not record.get("Issue key"):
                continue
            if release_version and record.get("Fix versions") != release_version:
                continue
            tickets.append(self._normalize_csv_ticket(record))
        return tickets

    def _build_search_jql(self, release_version: Optional[str] = None) -> str:
        if release_version:
            safe_release = release_version.replace('"', '\\"')
            return f'fixVersion = "{safe_release}" ORDER BY created DESC'
        return "ORDER BY created DESC"

    def _fetch_issues_from_jira(self, release_version: Optional[str] = None) -> List[Dict]:
        api_base = self._normalize_api_base_url()
        if not self._is_jira_api_configured():
            return []

        headers = self._build_auth_headers()
        max_results = 100
        issues: List[Dict] = []
        next_page_token: Optional[str] = None
        seen_page_tokens: set[str] = set()
        jql = self._build_search_jql(release_version)

        with httpx.Client(timeout=20.0) as client:
            while True:
                params = {
                    "jql": jql,
                    "fields": self.SEARCH_FIELDS,
                    "maxResults": max_results,
                }
                if next_page_token:
                    params["nextPageToken"] = next_page_token

                response = client.get(
                    f"{api_base}/search/jql",
                    headers=headers,
                    params=params,
                )
                if response.status_code >= 400:
                    body = {
                        "jql": jql,
                        "fields": self.SEARCH_FIELDS.split(","),
                        "maxResults": max_results,
                    }
                    if next_page_token:
                        body["nextPageToken"] = next_page_token
                    response = client.post(
                        f"{api_base}/search/jql",
                        headers=headers,
                        json=body,
                    )
                response.raise_for_status()
                payload = response.json()
                page_issues = payload.get("issues") or []
                issues.extend(page_issues)

                next_page_token = payload.get("nextPageToken")
                if not page_issues or not next_page_token:
                    break
                if next_page_token in seen_page_tokens:
                    logger.warning("Jira search pagination returned a repeated nextPageToken; stopping to avoid a loop")
                    break
                seen_page_tokens.add(next_page_token)

        return issues

    def _get_release_tickets_from_jira(self, release_version: Optional[str] = None) -> List[Dict]:
        issues = self._fetch_issues_from_jira(release_version)
        return [self._normalize_jira_issue(issue) for issue in issues if issue.get("key")]

    def _get_releases_from_jira(self) -> List[str]:
        issues = self._fetch_issues_from_jira()
        releases = set()
        for issue in issues:
            for version in issue.get("fields", {}).get("fixVersions") or []:
                name = (version or {}).get("name", "").strip()
                if name:
                    releases.add(name)
        return sorted(releases)

    def _with_fallback(self, live_fetcher, csv_fetcher) -> Tuple[List, str]:
        if self._is_jira_api_configured():
            try:
                live_data = live_fetcher()
                if live_data:
                    self._last_source = "jira_api"
                    self._last_live_error = None
                    return live_data, "jira_api"
                logger.warning("Live Jira returned no data, falling back to CSV")
                self._last_live_error = "Live Jira returned no data"
            except Exception as exc:
                self._last_live_error = str(exc)
                logger.warning("Live Jira fetch failed, falling back to CSV: %s", exc)

        csv_data = csv_fetcher()
        self._last_source = "csv"
        return csv_data, "csv"

    def get_release_tickets(self, release_version: Optional[str] = None) -> List[Dict]:
        """
        Get release tickets from live Jira when configured, otherwise from CSV.
        """
        cache_key = ("tickets", release_version)
        cached_value = self._get_cached_result(cache_key)
        if cached_value is not None:
            return cached_value

        tickets, _source = self._with_fallback(
            lambda: self._get_release_tickets_from_jira(release_version),
            lambda: self._get_release_tickets_from_csv(release_version),
        )
        return self._set_cached_result(cache_key, tickets)

    def get_all_tickets(self) -> List[Dict]:
        """Get all tickets from live Jira when configured, otherwise CSV fallback."""
        return self.get_release_tickets(None)

    def get_releases(self) -> List[str]:
        """
        Get unique release versions from live Jira when configured, otherwise from CSV.
        """
        cache_key = ("releases", None)
        cached_value = self._get_cached_result(cache_key)
        if cached_value is not None:
            return cached_value

        releases, _source = self._with_fallback(
            self._get_releases_from_jira,
            self._get_releases_from_csv,
        )
        return self._set_cached_result(cache_key, releases)

    def _get_releases_from_csv(self) -> List[str]:
        records = self.get_csv_data()
        if not records:
            return []

        releases = set()
        for record in records:
            fix_version = record.get("Fix versions", "").strip()
            if fix_version:
                releases.add(fix_version)
        return sorted(releases)

    def is_configured(self) -> bool:
        """True when live Jira or CSV fallback is available."""
        return self._is_jira_api_configured() or (
            os.path.exists(self.local_csv) and len(self.get_csv_data()) > 0
        )

    def is_live_api_enabled(self) -> bool:
        return self._is_jira_api_configured()

    def get_last_source(self) -> str:
        return self._last_source

    def get_last_live_error(self) -> Optional[str]:
        return self._last_live_error

    def get_connection_status(self) -> Dict[str, object]:
        live_configured = self._is_jira_api_configured()
        csv_available = os.path.exists(self.local_csv) and len(self.get_csv_data()) > 0

        if not live_configured:
            return {
                "configured": False,
                "connected": csv_available,
                "source": "csv" if csv_available else "none",
                "status": "fallback" if csv_available else "not_configured",
                "csv_fallback_available": csv_available,
                "error": None,
            }

        try:
            self._fetch_issues_from_jira()
            self._last_live_error = None
            self._last_source = "jira_api"
            return {
                "configured": True,
                "connected": True,
                "source": "jira_api",
                "status": "connected",
                "csv_fallback_available": csv_available,
                "error": None,
            }
        except Exception as exc:
            self._last_live_error = str(exc)
            logger.warning("Live Jira connection test failed: %s", exc)
            return {
                "configured": True,
                "connected": csv_available,
                "source": "csv" if csv_available else "jira_api",
                "status": "fallback" if csv_available else "error",
                "csv_fallback_available": csv_available,
                "error": str(exc),
            }


# Singleton instance kept under the historical import name for compatibility.
google_sheets_service = GoogleSheetsService()
