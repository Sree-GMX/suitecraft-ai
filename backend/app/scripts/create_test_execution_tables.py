"""
Database migration script to create test execution tables
Run this to create the new tables: python -m app.scripts.create_test_execution_tables
"""
from app.core.database import engine, Base
from app.models import test_execution_models

def create_tables():
    Base.metadata.create_all(bind=engine)
    
    # Print created tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()

if __name__ == "__main__":
    create_tables()
