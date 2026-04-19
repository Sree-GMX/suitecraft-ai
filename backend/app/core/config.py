from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    APP_NAME: str = "SuiteCraft.AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str
    STARTUP_CREATE_SCHEMA: bool = False
    
    # AI Configuration - Supports Ollama (local), Groq, and Gemini
    USE_GROQ: bool = False
    USE_GEMINI: bool = False
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-flash-latest"
    
    # CSV Data (Hackathon simplified - no Google Sheets needed)
    # Data is loaded directly from CSV files
    
    # TestRail Integration (READ ONLY - optional, currently using CSV)
    TESTRAIL_URL: Optional[str] = None
    TESTRAIL_API_KEY: Optional[str] = None
    TESTRAIL_USER: Optional[str] = None
    TESTRAIL_PROJECT_ID: int = 1
    TESTRAIL_SUITE_ID: int = 292
    
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    FRONTEND_URL: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_TLS: bool = True
    
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    JIRA_API_URL: str = ""
    JIRA_CLOUD_ID: str = ""
    JIRA_API_EMAIL: str = ""
    JIRA_API_TOKEN: str = ""
    AZURE_DEVOPS_ORG: str = ""
    AZURE_DEVOPS_PAT: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
