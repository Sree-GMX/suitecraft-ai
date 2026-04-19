"""
Enterprise-Grade AI Test Plan Generator
Simulates multiple stakeholder perspectives for comprehensive test planning
"""

from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.ai_errors import ActualAIRequiredError
from app.services.ai_json_utils import extract_json_payload
import json
import httpx
import hashlib
from datetime import datetime
import asyncio
import logging

STEP2_CONCURRENT_BATCHES = 3
STEP2_GEMINI_CONCURRENT_BATCHES = 1
STEP2_TASK_TIMEOUT_SECONDS = 25
GEMINI_MAX_RETRIES = 2

logger = logging.getLogger(__name__)

class EnterpriseAIService:
    """
    Enterprise AI Service that simulates multiple stakeholder perspectives:
    - Product Owner: Business value and user stories
    - Product Manager: Feature scope and requirements
    - QA Manager: Test strategy and risk assessment
    - Test Engineers: Detailed test scenarios and edge cases
    """
    
    def __init__(self):
        self.use_gemini = getattr(settings, 'USE_GEMINI', False)
        self.use_groq = getattr(settings, 'USE_GROQ', False)
        self.use_ollama = bool(settings.OLLAMA_BASE_URL)
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
        self._plan_cache: Dict[str, Dict[str, Any]] = {}
        self._last_provider_issue: Optional[str] = None
        
        # Initialize Groq client if available
        self.groq_client = None
        if settings.GROQ_API_KEY:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception:
                self.groq_client = None
        self.gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
        self.gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-flash-latest')

    async def _call_gemini(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        json_mode: bool = True,
    ) -> str:
        if not self.gemini_api_key:
            return ""

        generation_config: Dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
        if json_mode:
            generation_config["responseMimeType"] = "application/json"

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent?key={self.gemini_api_key}"
        )
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                for attempt in range(GEMINI_MAX_RETRIES):
                    response = await client.post(url, json=payload)
                    if response.status_code == 429:
                        self._last_provider_issue = "gemini_rate_limited"
                        logger.warning(
                            "Gemini Step 2 request hit rate limits on attempt %s for model %s",
                            attempt + 1,
                            self.gemini_model,
                        )
                        if attempt < GEMINI_MAX_RETRIES - 1:
                            await asyncio.sleep(1.0 + attempt)
                            continue
                        return ""

                    if response.status_code != 200:
                        self._last_provider_issue = f"gemini_http_{response.status_code}"
                        logger.warning(
                            "Gemini Step 2 request failed with status %s: %s",
                            response.status_code,
                            response.text[:300],
                        )
                        return ""

                    result = response.json()
                    candidates = result.get("candidates", [])
                    if not candidates:
                        self._last_provider_issue = "gemini_empty_candidates"
                        logger.warning("Gemini Step 2 request returned no candidates")
                        return ""
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return "".join(part.get("text", "") for part in parts if part.get("text"))
        except Exception:
            logger.exception("Gemini Step 2 request failed")
            return ""

    async def _call_ai(
        self, 
        prompt: str, 
        system_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        json_mode: bool = True,
    ) -> str:
        """Unified AI call method that tries Groq first, then Ollama"""
        self._last_provider_issue = None
        if self.use_gemini and self.gemini_api_key:
            result = await self._call_gemini(
                prompt,
                system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
            )
            if result:
                return result
        
        # Try Groq first if configured
        if self.groq_client:
            try:
                request_payload = {
                    "model": settings.GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if json_mode:
                    request_payload["response_format"] = {"type": "json_object"}
                response = self.groq_client.chat.completions.create(**request_payload)
                result = response.choices[0].message.content
                return result
            except Exception:
                pass

        # Fallback to Ollama
        if not self.use_ollama:
            return ""
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": f"{system_prompt}\n\n{prompt}",
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json().get("response", "")
                    return result
        except Exception:
            pass

        return ""

    async def _call_ai_with_retries(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 4000,
        attempts: int = 2,
        retry_delay_seconds: float = 0.8,
        json_mode: bool = True,
    ) -> str:
        last_response = ""
        for attempt in range(attempts):
            response = await self._call_ai(
                prompt,
                system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
            )
            if response and response.strip():
                return response
            last_response = response
            if attempt < attempts - 1:
                await asyncio.sleep(retry_delay_seconds)
        return last_response
    
    def _extract_json(self, response: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from AI response"""
        parsed = extract_json_payload(response)
        return parsed if isinstance(parsed, dict) else None

    async def _repair_json(
        self,
        raw_response: str,
        schema_hint: str,
        step_name: str,
    ) -> Optional[Dict[str, Any]]:
        if not raw_response.strip():
            return None

        repair_prompt = f"""
Convert the following model output into one valid JSON object.

Rules:
- Return JSON only
- No markdown fences
- Keep the original intent
- Fill any missing fields with empty arrays, empty strings, or nulls as appropriate

Expected schema:
{schema_hint}

Original output:
{raw_response}
"""

        repaired = await self._call_ai_with_retries(
            repair_prompt,
            f"You repair Step 2 {step_name} output into strict JSON. Return only valid JSON.",
            temperature=0.0,
            max_tokens=4000,
        )
        return self._extract_json(repaired)

    async def _require_json(self, response: str, step_name: str, schema_hint: str) -> Dict[str, Any]:
        result = self._extract_json(response)
        if not result:
            result = await self._repair_json(response, schema_hint, step_name)
        if result:
            return result
        raise ActualAIRequiredError(
            f"Step 2 {step_name} did not receive valid AI JSON output. No hardcoded fallback is allowed for this workflow."
        )

    async def _coerce_json_result(
        self,
        response: str,
        step_name: str,
        schema_hint: str,
    ) -> Optional[Dict[str, Any]]:
        result = self._extract_json(response)
        if result:
            return result
        return await self._repair_json(response, schema_hint, step_name)

    async def _run_json_analysis(
        self,
        prompt: str,
        system_prompt: str,
        step_name: str,
        schema_hint: str,
        temperature: float = 0.1,
        max_tokens: int = 2500,
        timeout_seconds: float = STEP2_TASK_TIMEOUT_SECONDS,
    ) -> Dict[str, Any]:
        try:
            response = await asyncio.wait_for(
                self._call_ai_with_retries(
                    prompt,
                    system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=True,
                ),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise ActualAIRequiredError(
                f"Step 2 {step_name} timed out while waiting for AI output. The active provider did not finish in time."
            ) from exc

        json_result = await self._coerce_json_result(response, step_name, schema_hint)
        if json_result:
            return json_result

        try:
            fallback_response = await asyncio.wait_for(
                self._call_ai_with_retries(
                    prompt,
                    system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=False,
                ),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise ActualAIRequiredError(
                f"Step 2 {step_name} timed out while retrying AI output recovery."
            ) from exc

        fallback_result = await self._coerce_json_result(fallback_response, step_name, schema_hint)
        if fallback_result:
            return fallback_result

        if self._last_provider_issue == "gemini_rate_limited" and not self.groq_client:
            raise ActualAIRequiredError(
                "Gemini is currently rate limited for Step 2. Wait a minute and retry, or configure Groq as a fallback provider."
            )

        raise ActualAIRequiredError(
            f"Step 2 {step_name} did not receive valid AI JSON output after retrying with structured and plain-text recovery."
        )
    
    async def generate_enterprise_test_plan(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any],
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Generate a release test plan by consulting multiple stakeholders.
        
        Flow:
        1. Product Owner: Define business value and acceptance criteria
        2. Product Manager: Identify scope and feature dependencies
        3. QA Manager: Assess risks and create test strategy
        4. Test Engineers: Generate detailed test scenarios
        5. Synthesize: Combine all perspectives into comprehensive plan
        """
        if not (
            (self.use_gemini and self.gemini_api_key) or
            self.groq_client or
            (self.use_ollama and self.ollama_url)
        ):
            raise ActualAIRequiredError(
                "Step 2 strategy generation requires a configured AI model. Configure Gemini, Groq, or Ollama and try again."
            )

        cache_key = self._build_plan_cache_key(tickets, test_cases, release_info)
        cached_plan = self._plan_cache.get(cache_key)
        if cached_plan and not force_refresh:
            cached_response = json.loads(json.dumps(cached_plan))
            cached_response["generation_metadata"] = {
                "input_key": cache_key,
                "mode": "cached",
                "scope_locked": True,
                "actual_ai_used": True,
            }
            return cached_response
        
        # Prepare context
        context = self._prepare_context(tickets, test_cases, release_info)
        
        # Gemini free-tier is prone to throttling on simultaneous JSON calls, so
        # keep the richer parallel path for other providers and use a safer
        # sequential path when Gemini is the active backend.
        if self.use_gemini and self.gemini_api_key:
            po_analysis = await self._product_owner_analysis(context)
            pm_analysis = await self._product_manager_analysis(context)
            parallel_product_tracks = 1
        else:
            po_analysis, pm_analysis = await asyncio.gather(
                self._product_owner_analysis(context),
                self._product_manager_analysis(context),
            )
            parallel_product_tracks = 2
        
        # Step 3: QA Manager Perspective
        qa_analysis = await self._qa_manager_analysis(context, po_analysis, pm_analysis)
        
        # Step 4: Test Engineers Perspective
        test_scenarios = await self._test_engineer_analysis(context, qa_analysis)
        
        # Step 5: Synthesize comprehensive test plan
        final_plan = self._synthesize_test_plan(
            context, po_analysis, pm_analysis, qa_analysis, test_scenarios
        )
        

        final_plan["deterministic_input_key"] = cache_key
        final_plan["generation_metadata"] = {
            "input_key": cache_key,
            "mode": "fresh" if force_refresh else "new",
            "scope_locked": True,
            "actual_ai_used": True,
            "parallel_product_tracks": parallel_product_tracks,
        }
        self._plan_cache[cache_key] = json.loads(json.dumps(final_plan))
        return final_plan

    def _build_plan_cache_key(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any]
    ) -> str:
        """Build a stable cache key so the same Step 1 scope yields the same Step 2 plan."""

        normalized_tickets = sorted([
            {
                "issue_key": ticket.get("issue_key", ticket.get("key", "")),
                "summary": ticket.get("summary", ""),
                "issue_type": ticket.get("issue_type", ticket.get("type", "")),
                "priority": ticket.get("priority", ""),
                "status": ticket.get("status", ""),
            }
            for ticket in tickets
        ], key=lambda item: (item["issue_key"], item["summary"]))

        normalized_test_cases = sorted([
            {
                "id": test_case.get("ID", test_case.get("id", "")),
                "title": test_case.get("Title", test_case.get("title", "")),
                "section": test_case.get("Section Hierarchy", test_case.get("section_hierarchy", test_case.get("Section", test_case.get("section", "")))),
                "priority": test_case.get("Priority", test_case.get("priority", test_case.get("priority_label", ""))),
            }
            for test_case in test_cases
        ], key=lambda item: (str(item["id"]), item["title"]))

        normalized_release = {
            "release_name": release_info.get("release_name", ""),
            "release_version": release_info.get("release_version", ""),
        }

        serialized = json.dumps(
            {
                "tickets": normalized_tickets,
                "test_cases": normalized_test_cases,
                "release": normalized_release,
            },
            sort_keys=True,
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    
    def _prepare_context(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Prepare context for AI analysis"""
        
        # Categorize tickets
        stories = [t for t in tickets if t.get('issue_type', '').lower() not in ['bug', 'defect']]
        bugs = [t for t in tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]
        
        # Helper to get priority (handles both CSV and formatted formats)
        def get_priority(tc):
            return (tc.get('Priority') or tc.get('priority') or 
                    tc.get('priority_label') or 'Medium')
        
        # Categorize test cases by priority
        priority_breakdown = {
            'Critical': len([tc for tc in test_cases if get_priority(tc).lower() == 'critical']),
            'High': len([tc for tc in test_cases if get_priority(tc).lower() == 'high']),
            'Medium': len([tc for tc in test_cases if get_priority(tc).lower() == 'medium']),
            'Low': len([tc for tc in test_cases if get_priority(tc).lower() == 'low'])
        }
        
        # Group test cases by section (handles both formats)
        sections = {}
        for tc in test_cases:
            section = tc.get('Section') or tc.get('section') or 'General'
            if section not in sections:
                sections[section] = []
            sections[section].append(tc)
        
        return {
            'release_name': release_info.get('release_name', release_info.get('release_version', 'Unknown')),
            'release_version': release_info.get('release_version', 'Unknown'),
            'total_tickets': len(tickets),
            'stories': stories,
            'bugs': bugs,
            'test_cases': test_cases,
            'priority_breakdown': priority_breakdown,
            'sections': sections,
            'total_test_cases': len(test_cases)
        }
    
    async def _product_owner_analysis(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Product Owner: Define business value and acceptance criteria"""
        
        stories = context['stories'][:10]  # Limit for token management
        
        stories_summary = "\n".join([
            f"- {s.get('issue_key')}: {s.get('summary', 'N/A')} (Priority: {s.get('priority', 'N/A')})"
            for s in stories
        ])
        
        prompt = f"""
You are a PRODUCT OWNER responsible for defining business value and acceptance criteria.

RELEASE: {context['release_version']}
STORIES ({len(context['stories'])} total, showing first 10):
{stories_summary}

BUGS: {len(context['bugs'])} defects to fix

YOUR TASK:
1. What is the PRIMARY BUSINESS VALUE of this release?
2. Which features are CRITICAL for business success?
3. What are the KEY ACCEPTANCE CRITERIA?
4. What would cause you to REJECT this release?

Return ONLY valid JSON:
{{
    "business_value": "Primary business value statement",
    "critical_features": ["Feature 1", "Feature 2"],
    "acceptance_criteria": ["Must complete X", "Should complete Y"],
    "rejection_criteria": ["Show stopper 1", "Show stopper 2"]
}}
"""
        
        return await self._run_json_analysis(
            prompt,
            "You are a Product Owner focused on business value and user needs. Return only valid JSON.",
            "product-owner analysis",
            """
{
  "business_value": "Primary business value statement",
  "critical_features": ["Feature 1", "Feature 2"],
  "acceptance_criteria": ["Must complete X", "Should complete Y"],
  "rejection_criteria": ["Show stopper 1", "Show stopper 2"]
}
            """.strip(),
            temperature=0.0,
            max_tokens=1200,
        )
    
    async def _product_manager_analysis(
        self,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Product Manager: Identify scope and feature dependencies"""
        
        stories = context['stories'][:10]
        stories_summary = "\n".join([
            f"- {s.get('issue_key')}: {s.get('summary', 'N/A')}"
            for s in stories
        ])
        
        prompt = f"""
You are a PRODUCT MANAGER responsible for feature scope and dependencies.

RELEASE: {context['release_version']}
RELEASE NAME: {context.get('release_name', context['release_version'])}

FEATURES:
{stories_summary}

YOUR TASK:
1. What MODULES/COMPONENTS are impacted?
2. What are the FEATURE DEPENDENCIES?
3. What is IN SCOPE vs OUT OF SCOPE?
4. What are the INTEGRATION POINTS?

Return ONLY valid JSON:
{{
    "impacted_modules": ["Module 1", "Module 2"],
    "feature_dependencies": [
        {{"feature": "Feature A", "depends_on": ["Feature B", "Feature C"]}}
    ],
    "scope": {{
        "in_scope": ["Item 1", "Item 2"],
        "out_of_scope": ["Item 3", "Item 4"]
    }},
    "integration_points": ["External System A", "API B"]
}}
"""
        
        return await self._run_json_analysis(
            prompt,
            "You are a Product Manager focused on scope and technical dependencies. Return only valid JSON.",
            "product-manager analysis",
            """
{
  "impacted_modules": ["Module 1", "Module 2"],
  "feature_dependencies": [
    {"feature": "Feature A", "depends_on": ["Feature B", "Feature C"]}
  ],
  "scope": {
    "in_scope": ["Item 1", "Item 2"],
    "out_of_scope": ["Item 3", "Item 4"]
  },
  "integration_points": ["External System A", "API B"]
}
            """.strip(),
            temperature=0.1,
        )
    
    async def _qa_manager_analysis(
        self,
        context: Dict[str, Any],
        po_analysis: Dict[str, Any],
        pm_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """QA Manager: Assess risks and create test strategy"""
        
        prompt = f"""
You are a QA MANAGER responsible for test strategy and risk assessment.

RELEASE: {context['release_version']}
STORIES: {len(context['stories'])}
BUGS: {len(context['bugs'])}
TEST CASES AVAILABLE: {context['total_test_cases']}

BUSINESS VALUE: {po_analysis.get('business_value', 'N/A')}
IMPACTED MODULES: {', '.join(pm_analysis.get('impacted_modules', [])[:5])}

CRITICAL FEATURES:
{chr(10).join(['- ' + f for f in po_analysis.get('critical_features', [])[:5]])}

YOUR TASK as QA Manager:
1. What is the RISK LEVEL (high/medium/low)?
2. What is your TEST STRATEGY?
3. Which TEST PHASES are needed?
4. What are the KEY RISK AREAS?
5. What TEST COVERAGE is required?
6. Where is coverage already STRONG vs still THIN?
7. What should run FIRST vs later if time is tight?
8. What staffing guidance would you give the release team?

Return ONLY valid JSON:
{{
    "risk_level": "high|medium|low",
    "risk_score": 7.5,
    "risk_narrative": "Why this release is risky in plain language",
    "key_risks": [
        {{"area": "Risk area", "severity": "high|medium|low", "mitigation": "Strategy"}}
    ],
    "test_strategy": {{
        "approach": "Strategy description",
        "test_phases": [
            {{"phase": "Smoke Testing", "duration_hours": 2, "mandatory": true}},
            {{"phase": "Regression Testing", "duration_hours": 40, "mandatory": true}},
            {{"phase": "Integration Testing", "duration_hours": 16, "mandatory": true}}
        ],
        "coverage_target": 90,
        "automation_percentage": 70
    }},
    "coverage_analysis": {{
        "confidence_label": "strong|moderate|watch closely",
        "strengths": ["What is already covered well"],
        "gaps": ["What still looks thin or risky"],
        "confidence_reason": "Why the current confidence level makes sense"
    }},
    "execution_guidance": {{
        "critical_path": ["What must run first"],
        "high_risk_regression": ["What must run next"],
        "broader_regression": ["What strengthens confidence after critical paths pass"],
        "optional_extended_coverage": ["What can run if time allows"]
    }},
    "resource_requirements": {{
        "qa_engineers": 4,
        "test_environments": 2,
        "estimated_days": 5
    }},
    "staffing_guidance": {{
        "recommended_team_size": 4,
        "parallel_execution_possible": true,
        "bottleneck": "What is most likely to slow signoff",
        "assignment_hint": "How to assign the team"
    }},
    "go_live_concerns": ["Main concerns before signoff"]
}}
"""

        return await self._run_json_analysis(
            prompt,
            "You are a QA Manager expert in risk assessment and test strategy. Return only valid JSON.",
            "qa-manager analysis",
            """
{
  "risk_level": "high|medium|low",
  "risk_score": 7.5,
  "risk_narrative": "Why this release is risky in plain language",
  "key_risks": [
    {"area": "Risk area", "severity": "high|medium|low", "mitigation": "Strategy"}
  ],
  "test_strategy": {
    "approach": "Strategy description",
    "test_phases": [
      {"phase": "Smoke Testing", "duration_hours": 2, "mandatory": true}
    ],
    "coverage_target": 90,
    "automation_percentage": 70
  },
  "coverage_analysis": {
    "confidence_label": "strong|moderate|watch closely",
    "strengths": ["What is already covered well"],
    "gaps": ["What still looks thin or risky"],
    "confidence_reason": "Why the current confidence level makes sense"
  },
  "execution_guidance": {
    "critical_path": ["What must run first"],
    "high_risk_regression": ["What must run next"],
    "broader_regression": ["What strengthens confidence after critical paths pass"],
    "optional_extended_coverage": ["What can run if time allows"]
  },
  "resource_requirements": {
    "qa_engineers": 4,
    "test_environments": 2,
    "estimated_days": 5
  },
  "staffing_guidance": {
    "recommended_team_size": 4,
    "parallel_execution_possible": true,
    "bottleneck": "What is most likely to slow signoff",
    "assignment_hint": "How to assign the team"
  },
  "go_live_concerns": ["Main concerns before signoff"]
}
            """.strip(),
            temperature=0.1,
        )
    
    async def _test_engineer_analysis(
        self,
        context: Dict[str, Any],
        qa_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Test Engineers: Generate detailed test scenarios in parallel section batches."""

        section_items = list(context['sections'].items())[:8]
        section_batches = [
            section_items[index:index + 3]
            for index in range(0, len(section_items), 3)
        ]
        risk_areas = [r.get('area', 'N/A') for r in qa_analysis.get('key_risks', [])[:5]]
        schema_hint = """
{
  "new_scenarios": [
    {
      "title": "Scenario title",
      "priority": "critical|high|medium|low",
      "related_tickets": ["TICKET-123"],
      "why_needed": "Why this scenario is needed for this release",
      "risk_addressed": "What risk or gap it addresses",
      "scenario_group": "Critical Path|Integration|Data Integrity|Optional Coverage",
      "estimated_time_minutes": 20,
      "steps": ["Step 1", "Step 2"],
      "expected_result": "Expected outcome",
      "test_data": "Data needed"
    }
  ],
  "existing_test_selection": [
    {
      "section": "Section name",
      "test_count": 10,
      "priority": "critical|high|medium|low",
      "rationale": "Why these tests"
    }
  ],
  "edge_cases": ["Edge case 1", "Edge case 2"],
  "negative_scenarios": ["Negative test 1", "Negative test 2"]
}
        """.strip()

        max_parallel_batches = (
            STEP2_GEMINI_CONCURRENT_BATCHES
            if self.use_gemini and self.gemini_api_key
            else STEP2_CONCURRENT_BATCHES
        )
        semaphore = asyncio.Semaphore(max_parallel_batches)

        async def run_batch(batch_index: int, batch: List[Any]) -> Dict[str, Any]:
            sections_info = "\n".join([
                f"- {section}: {len(test_cases)} tests available"
                for section, test_cases in batch
            ])
            prompt = f"""
You are a SENIOR TEST ENGINEER designing detailed test scenarios for one slice of the release.

RELEASE: {context['release_version']}
TOTAL TEST CASES: {context['total_test_cases']}

TEST CASE SECTIONS IN THIS BATCH:
{sections_info}

RISK AREAS: {', '.join(risk_areas)}

YOUR TASK:
1. Design NEW TEST SCENARIOS for this release slice
2. Select EXISTING TEST SECTIONS to execute
3. Identify EDGE CASES and NEGATIVE SCENARIOS
4. Define TEST DATA requirements
5. Explain WHY each new scenario is needed

Return ONLY valid JSON:
{schema_hint}
"""
            async with semaphore:
                return await self._run_json_analysis(
                    prompt,
                    "You are a Senior Test Engineer expert in test design. Return only valid JSON.",
                    f"test-engineer analysis batch {batch_index + 1}",
                    schema_hint,
                    temperature=0.15,
                    timeout_seconds=STEP2_TASK_TIMEOUT_SECONDS,
                )

        batch_results = await asyncio.gather(
            *(run_batch(index, batch) for index, batch in enumerate(section_batches)),
            return_exceptions=True,
        )

        successful_batches = [result for result in batch_results if isinstance(result, dict)]
        if not successful_batches:
            raise ActualAIRequiredError(
                "Step 2 test-engineer analysis did not receive valid AI JSON output from any parallel batch."
            )

        return {
            "new_scenarios": [
                scenario
                for result in successful_batches
                for scenario in result.get("new_scenarios", [])
            ][:12],
            "existing_test_selection": [
                selection
                for result in successful_batches
                for selection in result.get("existing_test_selection", [])
            ][:8],
            "edge_cases": list(dict.fromkeys([
                edge_case
                for result in successful_batches
                for edge_case in result.get("edge_cases", [])
            ]))[:8],
            "negative_scenarios": list(dict.fromkeys([
                scenario
                for result in successful_batches
                for scenario in result.get("negative_scenarios", [])
            ]))[:8],
            "parallel_batch_count": len(successful_batches),
            "parallel_batch_limit": max_parallel_batches,
        }
    
    def _synthesize_test_plan(
        self,
        context: Dict[str, Any],
        po_analysis: Dict[str, Any],
        pm_analysis: Dict[str, Any],
        qa_analysis: Dict[str, Any],
        test_scenarios: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Synthesize all perspectives into comprehensive test plan"""
        
        # Build test suites based on all test cases
        test_suites = self._build_test_suites(context)
        enriched_scenarios = self._enrich_new_scenarios(
            test_scenarios.get('new_scenarios', []),
            context,
            qa_analysis,
            pm_analysis
        )
        
        # Calculate totals
        total_duration = sum(suite['estimated_duration_minutes'] for suite in test_suites)
        total_test_cases = sum(len(suite['test_cases']) for suite in test_suites)
        execution_buckets = self._build_execution_buckets(test_suites)
        coverage_confidence = self._build_coverage_confidence(
            context,
            qa_analysis,
            enriched_scenarios,
            test_suites
        )
        team_guidance = self._build_team_guidance(qa_analysis, execution_buckets)
        strategy_insights = self._build_strategy_insights(
            context,
            po_analysis,
            pm_analysis,
            qa_analysis,
            enriched_scenarios,
            test_suites,
            coverage_confidence,
            execution_buckets,
            team_guidance
        )
        
        # Build comprehensive test plan
        test_plan = {
            "release_version": context['release_version'],
            "release_name": context.get('release_name'),
            "created_at": datetime.utcnow().isoformat(),
            "generation_method": "enterprise_stakeholder_consultation",
            "grounding_status": "validated_against_step1_scope",
            
            # Product Owner perspective
            "business_context": {
                "business_value": po_analysis.get('business_value'),
                "critical_features": po_analysis.get('critical_features', []),
                "acceptance_criteria": po_analysis.get('acceptance_criteria', []),
                "rejection_criteria": po_analysis.get('rejection_criteria', [])
            },
            
            # Product Manager perspective
            "scope_analysis": {
                "impacted_modules": pm_analysis.get('impacted_modules', []),
                "feature_dependencies": pm_analysis.get('feature_dependencies', []),
                "in_scope": pm_analysis.get('scope', {}).get('in_scope', []),
                "out_of_scope": pm_analysis.get('scope', {}).get('out_of_scope', []),
                "integration_points": pm_analysis.get('integration_points', [])
            },
            
            # QA Manager perspective
            "risk_assessment": {
                "overall_risk_level": qa_analysis.get('risk_level', 'medium'),
                "risk_score": qa_analysis.get('risk_score', 6.0),
                "risk_narrative": qa_analysis.get('risk_narrative'),
                "key_risks": qa_analysis.get('key_risks', []),
                "mitigation_strategies": [r.get('mitigation') for r in qa_analysis.get('key_risks', [])]
            },
            
            "test_strategy": qa_analysis.get('test_strategy', {}),
            
            # Test Engineers perspective
            "new_test_scenarios": enriched_scenarios,
            "edge_cases": test_scenarios.get('edge_cases', []),
            "negative_scenarios": test_scenarios.get('negative_scenarios', []),
            
            # Existing test cases organized by priority
            "test_suites": test_suites,
            
            # Execution plan
            "execution_plan": {
                "test_phases": qa_analysis.get('test_strategy', {}).get('test_phases', []),
                "total_duration_minutes": total_duration,
                "total_duration_hours": round(total_duration / 60, 1),
                "total_duration_days": round(total_duration / 60 / 8, 1),
                "parallel_execution_possible": True,
                "recommended_team_size": qa_analysis.get('resource_requirements', {}).get('qa_engineers', 3)
            },
            "execution_strategy": execution_buckets,
            
            # Coverage metrics
            "coverage_metrics": {
                "total_tickets": context['total_tickets'],
                "stories": len(context['stories']),
                "bugs": len(context['bugs']),
                "total_test_cases": total_test_cases,
                "new_scenarios": len(test_scenarios.get('new_scenarios', [])),
                "priority_breakdown": context['priority_breakdown'],
                "coverage_target": qa_analysis.get('test_strategy', {}).get('coverage_target', 85),
                "automation_target": qa_analysis.get('test_strategy', {}).get('automation_percentage', 60)
            },
            "coverage_confidence": coverage_confidence,
            "team_guidance": team_guidance,
            "strategy_insights": strategy_insights,
            
            # Recommendations
            "recommendations": self._generate_recommendations(
                context, po_analysis, pm_analysis, qa_analysis, test_scenarios
            )
        }
        
        return test_plan

    def _enrich_new_scenarios(
        self,
        scenarios: List[Dict[str, Any]],
        context: Dict[str, Any],
        qa_analysis: Dict[str, Any],
        pm_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Add rationale and release context to AI-generated scenarios."""

        stories = context.get('stories', [])
        bugs = context.get('bugs', [])
        scoped_tickets = stories + bugs
        ticket_ids = [ticket.get('issue_key') for ticket in scoped_tickets if ticket.get('issue_key')]
        ticket_id_set = set(ticket_ids)
        scoped_summaries = [str(ticket.get('summary', '')).strip() for ticket in scoped_tickets if ticket.get('summary')]
        primary_summary = scoped_summaries[0] if scoped_summaries else "Scoped release scenario"
        key_risks = qa_analysis.get('key_risks', [])
        impacted_modules = pm_analysis.get('impacted_modules', [])

        enriched = []
        for index, scenario in enumerate(scenarios):
            risk_item = key_risks[index % len(key_risks)] if key_risks else {}
            risk_area = risk_item.get('area') if isinstance(risk_item, dict) else risk_item
            raw_related_tickets = scenario.get('related_tickets') or []
            related_tickets = [ticket for ticket in raw_related_tickets if ticket in ticket_id_set]
            if not related_tickets and ticket_ids:
                related_tickets = [ticket_ids[index % len(ticket_ids)]]

            title = str(scenario.get("title") or "").strip()
            if not title:
                title = primary_summary
            elif related_tickets:
                for ticket in raw_related_tickets:
                    if ticket not in ticket_id_set and ticket:
                        title = title.replace(ticket, related_tickets[0])

            expected_result = scenario.get("expected_result")
            description = scenario.get("description")
            if not description:
                description = f"Validate {primary_summary.lower()} with release-focused regression coverage."

            enriched.append({
                **scenario,
                "id": scenario.get("id") or f"NS-{index + 1:03d}",
                "title": title,
                "description": description,
                "related_tickets": related_tickets,
                "risk_addressed": scenario.get("risk_addressed") or risk_area or (impacted_modules[0] if impacted_modules else "Release-specific behavior"),
                "why_needed": scenario.get("why_needed") or (
                    f"Added to cover behavior around {related_tickets[0] if related_tickets else 'the scoped release changes'} "
                    f"where existing regression coverage may be thin."
                ),
                "scenario_group": self._normalize_scenario_group(
                    scenario.get("scenario_group"),
                    risk_area or (impacted_modules[0] if impacted_modules else ""),
                ),
                "expected_result": expected_result or "The scoped release behavior works as expected without regressions.",
            })

        return enriched

    def _normalize_scenario_group(self, scenario_group: Any, fallback_signal: str) -> str:
        value = str(scenario_group or "").strip().lower()
        if "critical" in value:
            return "Critical Path"
        if "integration" in value:
            return "Integration"
        if "data" in value:
            return "Data Integrity"
        if "optional" in value:
            return "Optional Coverage"
        fallback_value = str(fallback_signal or "").strip().lower()
        if "integration" in fallback_value or "api" in fallback_value:
            return "Integration"
        return "Critical Path"

    def _build_execution_buckets(self, test_suites: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Categorize suites into decision-friendly execution buckets."""

        critical_path = [
            suite for suite in test_suites
            if suite.get('must_pass') and str(suite.get('priority', '')).lower() == 'critical'
        ]
        high_risk = [
            suite for suite in test_suites
            if suite.get('must_pass') and str(suite.get('priority', '')).lower() == 'high'
        ]
        broader = [
            suite for suite in test_suites
            if str(suite.get('priority', '')).lower() == 'medium'
        ]
        optional = [
            suite for suite in test_suites
            if str(suite.get('priority', '')).lower() == 'low'
        ]

        return {
            "critical_path": critical_path,
            "high_risk_regression": high_risk,
            "broader_regression": broader,
            "optional_extended_coverage": optional,
        }

    def _build_coverage_confidence(
        self,
        context: Dict[str, Any],
        qa_analysis: Dict[str, Any],
        enriched_scenarios: List[Dict[str, Any]],
        test_suites: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Summarize how trustworthy the current selected coverage looks."""

        selected_test_count = context.get('total_test_cases', 0)
        scoped_ticket_count = context.get('total_tickets', 0)
        risk_level = qa_analysis.get('risk_level', 'medium')
        density = (selected_test_count / scoped_ticket_count) if scoped_ticket_count else 0
        gap_pressure = len(enriched_scenarios)
        confidence_score = 0

        if density >= 6:
            confidence_score += 2
        elif density >= 3:
            confidence_score += 1

        if len(test_suites) >= 3:
            confidence_score += 1

        if risk_level == 'high':
            confidence_score -= 2
        elif risk_level == 'medium':
            confidence_score -= 1

        if gap_pressure > max(2, scoped_ticket_count / 3 if scoped_ticket_count else 2):
            confidence_score -= 1

        if confidence_score >= 2:
            label = "Strong"
            tone = "good"
            short_reason = "Existing selected regression coverage already looks broad for this release."
        elif confidence_score >= 0:
            label = "Moderate"
            tone = "watch"
            short_reason = "Coverage is workable, but some confidence still depends on new scenarios."
        else:
            label = "Watch Closely"
            tone = "risk"
            short_reason = "The current scope still looks thin for the risk level involved."

        qa_coverage_analysis = qa_analysis.get('coverage_analysis', {})
        full_reason = qa_coverage_analysis.get('confidence_reason') or (
            f"Built from {selected_test_count} selected tests across {scoped_ticket_count} scoped tickets. "
            f"The release is currently rated {risk_level.upper()} risk and needed {len(enriched_scenarios)} new scenarios "
            f"beyond the selected regression base."
        )

        return {
            "label": label,
            "tone": tone,
            "short_reason": short_reason,
            "full_reason": full_reason,
            "selected_test_count": selected_test_count,
            "scoped_ticket_count": scoped_ticket_count,
            "new_scenario_count": len(enriched_scenarios),
        }

    def _build_team_guidance(
        self,
        qa_analysis: Dict[str, Any],
        execution_buckets: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Create operational guidance for staffing and sequencing."""

        qa_engineers = qa_analysis.get('resource_requirements', {}).get('qa_engineers', 0)
        staffing_guidance = qa_analysis.get('staffing_guidance', {})
        critical_count = len(execution_buckets.get('critical_path', []))
        high_risk_count = len(execution_buckets.get('high_risk_regression', []))
        total_parallel_tracks = sum(
            1 for bucket in ['critical_path', 'high_risk_regression', 'broader_regression']
            if execution_buckets.get(bucket)
        )

        bottleneck = (
            f"{critical_count} critical-path suite{'s' if critical_count != 1 else ''} should gate signoff first."
            if critical_count else
            "No singular critical-path bottleneck was isolated."
        )

        assignment_hint = (
            "Assign the strongest testers to critical-path and high-risk suites first, then fan broader regression across the team."
            if critical_count or high_risk_count else
            "Start with the highest-priority suites, then spread remaining coverage across available testers."
        )

        return {
            "recommended_team_size": staffing_guidance.get('recommended_team_size', qa_engineers),
            "team_size_label": (
                f"{staffing_guidance.get('recommended_team_size', qa_engineers)} testers"
                if staffing_guidance.get('recommended_team_size', qa_engineers) else "TBD"
            ),
            "parallel_execution_possible": staffing_guidance.get('parallel_execution_possible', total_parallel_tracks > 1),
            "parallel_label": staffing_guidance.get('parallel_label') or (
                f"Yes — up to {total_parallel_tracks} parallel workstreams are visible."
                if total_parallel_tracks > 1 else
                "Mostly sequential based on the current suite mix."
            ),
            "bottleneck_label": staffing_guidance.get('bottleneck', bottleneck),
            "assignment_hint": staffing_guidance.get('assignment_hint', assignment_hint),
        }

    def _build_strategy_insights(
        self,
        context: Dict[str, Any],
        po_analysis: Dict[str, Any],
        pm_analysis: Dict[str, Any],
        qa_analysis: Dict[str, Any],
        enriched_scenarios: List[Dict[str, Any]],
        test_suites: List[Dict[str, Any]],
        coverage_confidence: Dict[str, Any],
        execution_buckets: Dict[str, List[Dict[str, Any]]],
        team_guidance: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build richer Step 2 strategy insights for the UI."""

        key_risks = qa_analysis.get('key_risks', [])
        risk_items = []
        for risk in key_risks[:5]:
            if isinstance(risk, dict):
                risk_items.append({
                    "area": risk.get("area", "Unknown risk area"),
                    "severity": risk.get("severity", "medium"),
                    "mitigation": risk.get("mitigation", "Review in approval step"),
                })
            elif risk:
                risk_items.append({
                    "area": str(risk),
                    "severity": "medium",
                    "mitigation": "Review in approval step",
                })

        impacted_modules = pm_analysis.get('impacted_modules', [])
        integration_points = pm_analysis.get('integration_points', [])
        critical_features = po_analysis.get('critical_features', [])

        risk_narrative = qa_analysis.get('risk_narrative') or (
            f"{qa_analysis.get('risk_level', 'medium').upper()} risk because {', '.join([item['area'] for item in risk_items[:3]]) or 'the scoped release changes'} "
            f"need confidence before signoff. The strategy uses {context.get('total_test_cases', 0)} selected regression tests and "
            f"{len(enriched_scenarios)} new scenarios to close likely release-specific gaps."
        )

        qa_coverage_analysis = qa_analysis.get('coverage_analysis', {})
        coverage_strengths = list(qa_coverage_analysis.get('strengths', []))
        if test_suites:
            coverage_strengths.append(
                f"{sum(len(suite.get('test_cases', [])) for suite in test_suites)} selected regression tests already anchor the plan."
            )
        if impacted_modules:
            coverage_strengths.append(
                f"Coverage spans impacted areas such as {', '.join(impacted_modules[:3])}."
            )

        coverage_gaps = list(qa_coverage_analysis.get('gaps', []))
        if enriched_scenarios:
            coverage_gaps.append(
                f"{len(enriched_scenarios)} new scenarios were needed because selected coverage did not fully explain release-specific behavior."
            )
        if integration_points:
            coverage_gaps.append(
                f"Integration points still need careful validation: {', '.join(integration_points[:3])}."
            )

        go_live_concerns = qa_analysis.get('go_live_concerns', [])[:3] or po_analysis.get('rejection_criteria', [])[:3]
        if not go_live_concerns and risk_items:
            go_live_concerns = [f"Unmitigated failure in {risk_items[0]['area']}"]

        return {
            "risk_narrative": risk_narrative,
            "top_risks": risk_items,
            "coverage_strengths": coverage_strengths,
            "coverage_gaps": coverage_gaps,
            "critical_path_tests": qa_analysis.get('execution_guidance', {}).get('critical_path', []) or [suite.get("suite_name") for suite in execution_buckets.get("critical_path", [])],
            "optional_tests": qa_analysis.get('execution_guidance', {}).get('optional_extended_coverage', []) or [suite.get("suite_name") for suite in execution_buckets.get("optional_extended_coverage", [])],
            "execution_order": qa_analysis.get('execution_guidance', {}).get('execution_order', [
                "Critical Path",
                "High-Risk Regression",
                "Broader Regression",
                "Optional Extended Coverage",
            ]),
            "staffing_recommendation": team_guidance.get("assignment_hint"),
            "go_live_concerns": go_live_concerns,
            "coverage_confidence_reason": coverage_confidence.get("full_reason"),
            "top_impacted_areas": impacted_modules[:5] or critical_features[:5],
            "input_audit": {
                "scoped_tickets": context.get("total_tickets", 0),
                "selected_tests": context.get("total_test_cases", 0),
                "stories": len(context.get("stories", [])),
                "bugs": len(context.get("bugs", [])),
            },
        }
    
    def _build_test_suites(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build test suites from all available test cases"""
        
        test_cases = context['test_cases']
        
        # Helper functions to get fields (handles both CSV and formatted formats)
        def get_id(tc):
            return tc.get('ID') or tc.get('id') or 'N/A'
        
        def get_title(tc):
            return tc.get('Title') or tc.get('title') or 'No title'
        
        def get_priority(tc):
            return (tc.get('Priority') or tc.get('priority') or 
                    tc.get('priority_label') or 'Medium').title()
        
        def get_section(tc):
            return (tc.get('Section Hierarchy') or tc.get('section_hierarchy') or
                    tc.get('Section') or tc.get('section') or 'General')
        
        # Group by priority
        priority_groups = {
            'Critical': [],
            'High': [],
            'Medium': [],
            'Low': []
        }
        
        for tc in test_cases:
            priority = get_priority(tc)
            if priority in priority_groups:
                priority_groups[priority].append(tc)
            else:
                priority_groups['Medium'].append(tc)
        
        # Build suites
        test_suites = []
        execution_order = 1
        
        suite_configs = [
            ('Critical', 'Must pass - Critical path validation', True, True),
            ('High', 'Must pass - Core functionality validation', True, True),
            ('Medium', 'Recommended - Comprehensive coverage', False, True),
            ('Low', 'Optional - Extended coverage', False, True)
        ]
        
        for priority, description, must_pass, parallel in suite_configs:
            tests = priority_groups[priority]
            if not tests:
                continue
            
            # Sort for consistency
            tests.sort(key=lambda x: get_id(x))
            
            test_suites.append({
                "suite_name": f"{priority} Priority Test Suite",
                "suite_type": f"regression_{priority.lower()}",
                "priority": priority.lower(),
                "description": f"{description} ({len(tests)} tests)",
                "estimated_duration_minutes": len(tests) * 4,
                "test_cases": [
                    {
                        "id": get_id(tc),
                        "title": get_title(tc),
                        "section": get_section(tc),
                        "priority": get_priority(tc)
                    }
                    for tc in tests
                ],
                "execution_order": execution_order,
                "parallel_execution": parallel,
                "must_pass": must_pass
            })
            execution_order += 1
        
        return test_suites
    
    def _generate_recommendations(
        self,
        context: Dict[str, Any],
        po_analysis: Dict[str, Any],
        pm_analysis: Dict[str, Any],
        qa_analysis: Dict[str, Any],
        test_scenarios: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations"""
        
        recommendations = []
        
        # From Product Owner
        if po_analysis.get('critical_features'):
            recommendations.append(
                f"✓ Focus testing on {len(po_analysis['critical_features'])} critical business features"
            )
        
        # From Product Manager
        if pm_analysis.get('impacted_modules'):
            recommendations.append(
                f"✓ Prioritize {len(pm_analysis['impacted_modules'])} impacted modules for regression"
            )
        
        # From QA Manager
        risk_level = qa_analysis.get('risk_level', 'medium')
        if risk_level == 'high':
            recommendations.append("⚠️ HIGH RISK: Recommend additional QA resources and extended testing")
        
        recommendations.append(
            f"✓ Execute {len(qa_analysis.get('test_strategy', {}).get('test_phases', []))} test phases systematically"
        )
        
        # From Test Engineers
        recommendations.append(
            f"✓ Create {len(test_scenarios.get('new_scenarios', []))} new test scenarios for new functionality"
        )
        
        recommendations.append(
            f"✓ Execute {context['total_test_cases']} existing regression tests"
        )
        
        # Coverage
        coverage_target = qa_analysis.get('test_strategy', {}).get('coverage_target', 85)
        recommendations.append(
            f"✓ Target {coverage_target}% test coverage across all modules"
        )
        
        return recommendations

# Singleton instance
enterprise_ai_service = EnterpriseAIService()
