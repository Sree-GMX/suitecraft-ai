from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api import releases, orgs, dashboard, integrations, test_plans, auth, test_execution, ai_test, regression_test_plan, ai_enhanced_test_plan, qabot
from app.models import models, test_execution_models  # Import models so they register with Base
from app.services.google_sheets_service import google_sheets_service

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise-grade AI-assisted QA Intelligence Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(releases.router, prefix="/api/v1")
app.include_router(orgs.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")
app.include_router(test_plans.router, prefix="/api/v1")
app.include_router(test_execution.router, prefix="/api/v1")
app.include_router(qabot.router, prefix="/api/v1")
app.include_router(ai_test.router, prefix="/api/v1")
app.include_router(regression_test_plan.router, prefix="/api/v1/regression-test-plan", tags=["Regression Test Planning"])
app.include_router(ai_enhanced_test_plan.router, prefix="/api/v1/ai-enhanced-test-plan", tags=["AI-Enhanced Test Planning"])


@app.on_event("startup")
def startup_tasks():
    if settings.STARTUP_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    gemini_ready = bool(settings.GEMINI_API_KEY)
    groq_ready = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY != "your_groq_api_key_here")
    ollama_ready = bool(settings.OLLAMA_BASE_URL)

    if settings.USE_GEMINI and gemini_ready:
        ai_backend = "Gemini"
        ai_model = settings.GEMINI_MODEL
        fallback_provider = "Groq" if groq_ready else ("Ollama" if ollama_ready else None)
    elif groq_ready:
        ai_backend = "Groq"
        ai_model = settings.GROQ_MODEL
        fallback_provider = "Ollama" if ollama_ready else None
    else:
        ai_backend = "Ollama"
        ai_model = settings.OLLAMA_MODEL
        fallback_provider = None
    jira_source = "live_jira_api" if google_sheets_service.is_live_api_enabled() else "csv_fallback"
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "ai_backend": ai_backend,
        "ai_model": ai_model,
        "ai_routing": {
            "primary_provider": ai_backend,
            "primary_model": ai_model,
            "fallback_provider": fallback_provider,
            "fallback_ready": bool(fallback_provider),
        },
        "data_sources": {
            "jira": jira_source,
            "testrail_csv": "testrail_testcases.csv"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
