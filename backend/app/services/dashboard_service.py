from sqlalchemy.orm import Session
from typing import Dict, Any
from app.models.models import Release, Feature, Defect, QAOrg, TestSuite
from datetime import datetime, timezone, timedelta
from sqlalchemy import func

class DashboardService:
    CACHE_TTL_SECONDS = 300
    _dashboard_cache: Dict[int, Dict[str, Any]] = {}

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _serialize_timestamp(value):
        return value.isoformat() if value else None

    def _build_cache_fingerprint(
        self,
        release: Release,
        feature_stats,
        test_suite_stats,
        critical_bugs: int,
        org_stats,
    ):
        return (
            release.status,
            self._serialize_timestamp(release.target_date),
            self._serialize_timestamp(release.updated_at),
            feature_stats.total or 0,
            self._serialize_timestamp(feature_stats.latest_update),
            test_suite_stats.total or 0,
            test_suite_stats.total_cases or 0,
            self._serialize_timestamp(test_suite_stats.latest_update),
            critical_bugs,
            org_stats.total or 0,
            self._serialize_timestamp(org_stats.latest_update),
        )

    def _get_cached_dashboard(self, release_id: int, fingerprint):
        cached_entry = self._dashboard_cache.get(release_id)
        now = datetime.now(timezone.utc)
        if not cached_entry:
            return None
        if cached_entry["expires_at"] <= now:
            self._dashboard_cache.pop(release_id, None)
            return None
        if cached_entry["fingerprint"] != fingerprint:
            return None
        return cached_entry["payload"]

    def _set_cached_dashboard(self, release_id: int, fingerprint, payload):
        self._dashboard_cache[release_id] = {
            "fingerprint": fingerprint,
            "payload": payload,
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=self.CACHE_TTL_SECONDS),
        }

    def _recommend_org_name(self, orgs, release_version: str):
        if not orgs:
            return None

        matching_orgs = [org for org in orgs if org.release_version == release_version]
        candidate_orgs = matching_orgs or orgs
        best_org = max(candidate_orgs, key=lambda org: (org.stability_score or 0, org.org_name.lower()))
        return best_org.org_name

    def _calculate_release_confidence(
        self,
        total_features: int,
        high_risk_count: int,
        coverage_percentage: float,
        critical_bugs: int,
        avg_org_stability: float,
        days_until_release: int,
    ) -> Dict[str, Any]:
        concerns = []
        recommendations = []
        score = 100.0

        if total_features > 0:
            high_risk_ratio = high_risk_count / total_features
            score -= min(high_risk_ratio * 30, 30)
            if high_risk_count:
                concerns.append(f"{high_risk_count} high-risk feature areas still need close attention.")
                recommendations.append("Review the highest-risk features before sign-off.")

        if coverage_percentage < 80:
            score -= min((80 - coverage_percentage) * 0.35, 25)
            concerns.append(f"Regression coverage is only {round(coverage_percentage, 1)}%.")
            recommendations.append("Increase regression coverage for critical workflows.")

        if critical_bugs > 0:
            score -= min(critical_bugs * 12, 36)
            concerns.append(f"{critical_bugs} critical bugs remain open.")
            recommendations.append("Resolve or triage critical defects before release.")

        if avg_org_stability < 0.75:
            score -= min((0.75 - avg_org_stability) * 30, 15)
            concerns.append("Active QA environments show below-target stability.")
            recommendations.append("Use the most stable orgs for validation and reruns.")

        if days_until_release <= 3:
            score -= 8
            concerns.append("Release timeline is tight.")
            recommendations.append("Prioritize smoke and high-risk validation immediately.")

        score = max(0.0, min(score, 100.0))
        if score >= 85:
            risk_level = "low"
        elif score >= 70:
            risk_level = "medium"
        elif score >= 50:
            risk_level = "high"
        else:
            risk_level = "critical"

        if not concerns:
            concerns = ["No major delivery blockers are visible in the current release data."]
        if not recommendations:
            recommendations = ["Continue planned execution and monitor for new blockers."]

        return {
            "confidence_score": round(score, 1),
            "risk_level": risk_level,
            "key_concerns": concerns,
            "recommendations": recommendations,
            "summary": (
                f"Confidence is {round(score, 1)} with {risk_level} delivery risk based on "
                f"coverage, open critical bugs, feature risk, org stability, and release timing."
            ),
        }
    
    async def get_dashboard_metrics(self, release_id: int) -> Dict[str, Any]:
        release = self.db.query(Release).filter(Release.id == release_id).first()
        if not release:
            raise ValueError(f"Release {release_id} not found")
        
        features = self.db.query(Feature).filter(Feature.release_id == release_id).all()

        test_suites = self.db.query(TestSuite).filter(TestSuite.release_id == release_id).all()

        total_test_cases = sum(len(suite.test_cases or []) for suite in test_suites)

        feature_stats = type("FeatureStats", (), {
            "total": len(features),
            "latest_update": max((feature.updated_at for feature in features if feature.updated_at), default=None),
        })()
        test_suite_stats = type("TestSuiteStats", (), {
            "total": len(test_suites),
            "total_cases": total_test_cases,
            "latest_update": max((suite.updated_at for suite in test_suites if suite.updated_at), default=None),
        })()
        
        high_risk_features = [f for f in features if f.risk_score >= 0.7]
        medium_risk_features = [f for f in features if 0.4 <= f.risk_score < 0.7]
        low_risk_features = [f for f in features if f.risk_score < 0.4]
        
        critical_bugs = self.db.query(Defect).join(
            Feature,
            Defect.feature_id == Feature.id,
        ).filter(
            Feature.release_id == release_id,
            Defect.severity == "critical",
            Defect.status.in_(["open", "in_progress"])
        ).count()

        orgs = self.db.query(QAOrg).filter(QAOrg.is_active == True).all()
        org_stats = type("OrgStats", (), {
            "total": len(orgs),
            "latest_update": max((org.updated_at for org in orgs if org.updated_at), default=None),
        })()

        cache_fingerprint = self._build_cache_fingerprint(
            release,
            feature_stats,
            test_suite_stats,
            critical_bugs,
            org_stats,
        )
        cached_payload = self._get_cached_dashboard(release_id, cache_fingerprint)
        if cached_payload:
            return cached_payload
        
        high_priority_suite = next(
            (s for s in test_suites if s.suite_type == "high_priority"),
            None
        )
        high_priority_tests = len(high_priority_suite.test_cases or []) if high_priority_suite else 0
        
        coverage_percentage = min(
            (total_test_cases / (len(features) * 5)) * 100 if features else 0,
            100
        )
        
        avg_org_stability = sum(org.stability_score for org in orgs) / len(orgs) if orgs else 0.5
        
        days_until_release = (
            (release.target_date - datetime.now(release.target_date.tzinfo)).days
            if release.target_date
            else 30
        )
        
        confidence_analysis = self._calculate_release_confidence(
            total_features=len(features),
            high_risk_count=len(high_risk_features),
            coverage_percentage=coverage_percentage,
            critical_bugs=critical_bugs,
            avg_org_stability=avg_org_stability,
            days_until_release=max(days_until_release, 0),
        )
        
        risk_heatmap = {
            "authentication": sum(1 for f in features if "auth" in str(f.impacted_modules).lower()) / len(features) if features else 0,
            "api": sum(1 for f in features if "api" in str(f.impacted_modules).lower()) / len(features) if features else 0,
            "ui": sum(1 for f in features if "ui" in str(f.impacted_modules).lower()) / len(features) if features else 0,
            "database": sum(1 for f in features if "db" in str(f.impacted_modules).lower() or "database" in str(f.impacted_modules).lower()) / len(features) if features else 0,
            "integration": sum(1 for f in features if "integration" in str(f.impacted_modules).lower()) / len(features) if features else 0
        }
        
        org_health_status = {}
        for org in orgs[:5]:
            if org.stability_score >= 0.8:
                status = "healthy"
            elif org.stability_score >= 0.6:
                status = "warning"
            else:
                status = "critical"
            org_health_status[org.org_name] = status
        
        payload = {
            "release_confidence_score": confidence_analysis.get("confidence_score", 50),
            "regression_coverage_percentage": round(coverage_percentage, 2),
            "critical_bug_count": critical_bugs,
            "recommended_org": self._recommend_org_name(orgs, release.release_version),
            "risk_heatmap": risk_heatmap,
            "org_health_status": org_health_status,
            "release_details": {
                "version": release.release_version,
                "name": release.release_name,
                "status": release.status,
                "target_date": release.target_date.isoformat() if release.target_date else None,
                "days_remaining": max(days_until_release, 0)
            },
            "feature_breakdown": {
                "total": len(features),
                "high_risk": len(high_risk_features),
                "medium_risk": len(medium_risk_features),
                "low_risk": len(low_risk_features)
            },
            "test_suite_summary": {
                "total_suites": len(test_suites),
                "total_test_cases": total_test_cases,
                "high_priority_tests": high_priority_tests
            },
            "ai_insights": {
                "risk_level": confidence_analysis.get("risk_level", "medium"),
                "key_concerns": confidence_analysis.get("key_concerns", []),
                "recommendations": confidence_analysis.get("recommendations", []),
                "summary": confidence_analysis.get("summary", "")
            }
        }

        self._set_cached_dashboard(release_id, cache_fingerprint, payload)
        return payload
