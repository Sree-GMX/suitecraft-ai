"""
Test endpoints for AI/Groq functionality
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter(tags=["AI Testing"])


def _provider_status() -> dict:
    gemini_ready = bool(settings.GEMINI_API_KEY)
    groq_ready = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY != "your_groq_api_key_here")
    ollama_ready = bool(settings.OLLAMA_BASE_URL)

    if settings.USE_GEMINI and gemini_ready:
        primary_provider = "Gemini"
        primary_model = settings.GEMINI_MODEL
    elif groq_ready:
        primary_provider = "Groq"
        primary_model = settings.GROQ_MODEL
    else:
        primary_provider = "Ollama"
        primary_model = settings.OLLAMA_MODEL

    fallback_provider = None
    fallback_model = None
    if primary_provider == "Gemini" and groq_ready:
        fallback_provider = "Groq"
        fallback_model = settings.GROQ_MODEL
    elif primary_provider in {"Gemini", "Groq"} and ollama_ready:
        fallback_provider = "Ollama"
        fallback_model = settings.OLLAMA_MODEL

    return {
        "primary_provider": primary_provider,
        "primary_model": primary_model,
        "fallback_provider": fallback_provider,
        "fallback_model": fallback_model,
        "fallback_ready": bool(fallback_provider),
        "gemini_configured": gemini_ready,
        "groq_configured": groq_ready,
        "ollama_configured": ollama_ready,
    }

class AITestRequest(BaseModel):
    prompt: str
    system_prompt: str = "You are a helpful QA assistant."

class AITestResponse(BaseModel):
    response: str
    ai_backend: str
    model: str

@router.post("/ai/test", response_model=AITestResponse)
async def test_ai_generation(request: AITestRequest):
    """
    Test endpoint to verify AI/Groq integration is working
    """
    try:
        response = await ai_service._generate(
            prompt=request.prompt,
            system_prompt=request.system_prompt
        )
        
        provider_status = _provider_status()
        
        return AITestResponse(
            response=response,
            ai_backend=provider_status["primary_provider"],
            model=provider_status["primary_model"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@router.get("/ai/status")
async def get_ai_status():
    """
    Get current AI backend status and configuration
    """
    provider_status = _provider_status()

    return {
        "ai_backend": provider_status["primary_provider"],
        "model": provider_status["primary_model"],
        "primary_provider": provider_status["primary_provider"],
        "primary_model": provider_status["primary_model"],
        "fallback_provider": provider_status["fallback_provider"],
        "fallback_model": provider_status["fallback_model"],
        "fallback_ready": provider_status["fallback_ready"],
        "use_gemini": settings.USE_GEMINI,
        "use_groq": settings.USE_GROQ,
        "gemini_configured": provider_status["gemini_configured"],
        "groq_configured": provider_status["groq_configured"],
        "ollama_configured": provider_status["ollama_configured"],
        "auto_switch_enabled": provider_status["fallback_ready"],
        "ollama_url": settings.OLLAMA_BASE_URL if provider_status["ollama_configured"] else None
    }
