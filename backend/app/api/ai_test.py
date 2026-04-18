"""
Test endpoints for AI/Groq functionality
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter(tags=["AI Testing"])

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
        
        ai_backend = "Groq" if settings.USE_GROQ and settings.GROQ_API_KEY else "Ollama"
        model = settings.GROQ_MODEL if ai_backend == "Groq" else settings.OLLAMA_MODEL
        
        return AITestResponse(
            response=response,
            ai_backend=ai_backend,
            model=model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@router.get("/ai/status")
async def get_ai_status():
    """
    Get current AI backend status and configuration
    """
    ai_backend = "Groq" if settings.USE_GROQ and settings.GROQ_API_KEY else "Ollama"
    
    return {
        "ai_backend": ai_backend,
        "model": settings.GROQ_MODEL if ai_backend == "Groq" else settings.OLLAMA_MODEL,
        "use_groq": settings.USE_GROQ,
        "groq_configured": bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY != "your_groq_api_key_here"),
        "ollama_url": settings.OLLAMA_BASE_URL if ai_backend == "Ollama" else None
    }
