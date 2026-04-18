"""
Add demo data to database
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.models import User, Release, QAOrg
from datetime import datetime, timedelta
import bcrypt

def add_demo_data():
    db = SessionLocal()
    
    try:
        # Create admin user with simple bcrypt hash
        existing_user = db.query(User).filter(User.email == "admin@suitecraft.ai").first()
        if not existing_user:

            # Hash password directly with bcrypt
            password = "admin123"
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
            
            admin_user = User(
                email="admin@suitecraft.ai",
                username="admin",
                full_name="System Admin",
                hashed_password=hashed,
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()

        # Create demo release
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

        # Create demo QA organizations
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

        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_demo_data()
