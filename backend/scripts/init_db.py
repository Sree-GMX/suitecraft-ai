"""
Setup script for initializing the database and creating demo data
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import engine, Base, SessionLocal
from app.models.models import User, Release, QAOrg
from app.core.security import get_password_hash
from datetime import datetime, timedelta

def init_db():

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    
    try:
        existing_user = db.query(User).filter(User.email == "admin@suitecraft.ai").first()
        if not existing_user:

            admin_user = User(
                email="admin@suitecraft.ai",
                username="admin",
                full_name="System Admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()

        existing_release = db.query(Release).first()
        if not existing_release:

            demo_release = Release(
                release_version="v2024.1",
                release_name="Spring 2024 Release",
                description="Major feature release including new campaign management and API improvements",
                target_date=datetime.now() + timedelta(days=30),
                status="planning",
                created_by=1
            )
            db.add(demo_release)
            db.commit()

        existing_org = db.query(QAOrg).first()
        if not existing_org:

            orgs = [
                QAOrg(
                    org_name="UCP-QA-ORG-1",
                    release_version="v2024.1",
                    enabled_features=["campaign management", "user roles", "API v2"],
                    data_sets_available=["admin users", "test campaigns"],
                    stability_score=0.95,
                    org_url="https://qa-org-1.example.com",
                    is_active=True
                ),
                QAOrg(
                    org_name="UCP-QA-ORG-2",
                    release_version="v2023.4",
                    enabled_features=["basic features", "API v1"],
                    data_sets_available=["standard users"],
                    stability_score=0.75,
                    org_url="https://qa-org-2.example.com",
                    is_active=True
                ),
                QAOrg(
                    org_name="UCP-QA-ORG-3",
                    release_version="v2024.1",
                    enabled_features=["campaign management", "advanced reporting"],
                    data_sets_available=["admin users", "power users", "test campaigns"],
                    stability_score=0.88,
                    org_url="https://qa-org-3.example.com",
                    is_active=True
                )
            ]
            for org in orgs:
                db.add(org)
            db.commit()

    except Exception as e:

        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
