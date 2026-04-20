"""
AI Service using Ollama for local AI inference
Provides AI-powered analysis, test generation, and recommendations
"""

from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.ai_errors import ActualAIRequiredError
from app.services.ai_json_utils import extract_json_payload
import json
import httpx
import re
import asyncio
import logging
import time

STEP1_SECTION_CONCURRENCY = 4
STEP1_GEMINI_SECTION_CONCURRENCY = 1
STEP1_SECTION_TIMEOUT_SECONDS = 20
STEP1_OVERVIEW_TIMEOUT_SECONDS = 20
GEMINI_MAX_RETRIES = 2
GEMINI_COOLDOWN_SECONDS = 15 * 60

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        # Provider configuration
        self.use_gemini = getattr(settings, 'USE_GEMINI', False)
        self.use_groq = getattr(settings, 'USE_GROQ', False)
        self.use_ollama = bool(settings.OLLAMA_BASE_URL)
        self._last_provider_issue: Optional[str] = None
        self._gemini_disabled_until: float = 0.0
        
        # Ollama configuration
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
        
        # Groq configuration
        self.groq_client = None
        if settings.GROQ_API_KEY:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
            except:
                pass

        # Gemini configuration
        self.gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
        self.gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-flash-latest')

    def _provider_sequence(self) -> List[str]:
        providers: List[str] = []
        if self.use_gemini and self.gemini_api_key and not self._gemini_temporarily_disabled():
            providers.append("gemini")
        if self.groq_client:
            providers.append("groq")
        if self.use_ollama:
            providers.append("ollama")
        return providers

    def _gemini_temporarily_disabled(self) -> bool:
        return bool(self._gemini_disabled_until and time.monotonic() < self._gemini_disabled_until)

    def _disable_gemini_temporarily(self) -> None:
        self._gemini_disabled_until = time.monotonic() + GEMINI_COOLDOWN_SECONDS

    def _gemini_issue_is_quota_or_rate_limit(self, status_code: int, response_text: str) -> bool:
        text = (response_text or "").lower()
        return status_code == 429 or any(
            marker in text
            for marker in [
                "quota",
                "rate limit",
                "resource exhausted",
                "too many requests",
            ]
        )

    async def _call_gemini(
        self,
        prompt: str,
        system_prompt: str = "You are an expert QA analyst.",
        json_mode: bool = False,
    ) -> str:
        """Call Gemini via the Generative Language REST API."""
        if not self.gemini_api_key or self._gemini_temporarily_disabled():
            return ""

        generation_config: Dict[str, Any] = {
            "temperature": 0.3,
            "maxOutputTokens": 4000,
        }
        if json_mode:
            generation_config["responseMimeType"] = "application/json"

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": generation_config,
        }

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent?key={self.gemini_api_key}"
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for attempt in range(GEMINI_MAX_RETRIES):
                    response = await client.post(url, json=payload)
                    if self._gemini_issue_is_quota_or_rate_limit(response.status_code, response.text):
                        self._last_provider_issue = "gemini_rate_limited"
                        self._disable_gemini_temporarily()
                        logger.warning(
                            "Gemini Step 1 request hit rate limits on attempt %s for model %s",
                            attempt + 1,
                            self.gemini_model,
                        )
                        if attempt < GEMINI_MAX_RETRIES - 1 and not self.groq_client:
                            await asyncio.sleep(1.0 + attempt)
                            continue
                        return ""

                    if response.status_code != 200:
                        self._last_provider_issue = f"gemini_http_{response.status_code}"
                        logger.warning(
                            "Gemini Step 1 request failed with status %s: %s",
                            response.status_code,
                            response.text[:300],
                        )
                        return ""

                    result = response.json()
                    candidates = result.get("candidates", [])
                    if not candidates:
                        self._last_provider_issue = "gemini_empty_candidates"
                        logger.warning("Gemini Step 1 request returned no candidates")
                        return ""

                    parts = candidates[0].get("content", {}).get("parts", [])
                    text_parts = [part.get("text", "") for part in parts if part.get("text")]
                    return "".join(text_parts)
        except Exception:
            logger.exception("Gemini Step 1 request failed")
            return ""
    
    async def _call_ollama(self, prompt: str, system_prompt: str = "You are an expert QA analyst.") -> str:
        """Call Ollama API"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.ollama_model,
                        "prompt": f"{system_prompt}\n\n{prompt}",
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "num_predict": 1000
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result.get("response", "")
                    return content
                else:
                    self._last_provider_issue = f"ollama_http_{response.status_code}"
                    return ""
        except Exception:
            self._last_provider_issue = "ollama_exception"
            return ""
    
    async def _call_groq(
        self,
        prompt: str,
        system_prompt: str = "You are an expert QA analyst.",
        json_mode: bool = False,
    ) -> str:
        """Fallback to Groq API"""
        if not self.groq_client:
            return ""
        
        try:
            request_payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 4000,
            }
            if json_mode:
                request_payload["response_format"] = {"type": "json_object"}
            response = self.groq_client.chat.completions.create(**request_payload)
            content = response.choices[0].message.content
            return content
        except Exception:
            self._last_provider_issue = "groq_exception"
            return ""

    async def _call_provider(
        self,
        provider: str,
        prompt: str,
        system_prompt: str = "You are an expert QA analyst.",
        json_mode: bool = False,
    ) -> str:
        if provider == "gemini":
            return await self._call_gemini(prompt, system_prompt, json_mode=json_mode)
        if provider == "groq":
            return await self._call_groq(prompt, system_prompt, json_mode=json_mode)
        if provider == "ollama":
            return await self._call_ollama(prompt, system_prompt)
        return ""
    
    async def _generate(
        self,
        prompt: str,
        system_prompt: str = "You are an expert QA analyst.",
        json_mode: bool = False,
        preferred_provider: Optional[str] = None,
        skip_providers: Optional[List[str]] = None,
    ) -> str:
        """Generate AI response using available service"""
        self._last_provider_issue = None
        providers = [preferred_provider] if preferred_provider else self._provider_sequence()
        skipped = set(skip_providers or [])

        if not preferred_provider and self._gemini_temporarily_disabled():
            skipped.add("gemini")

        for provider in providers:
            if not provider or provider in skipped:
                continue
            response = await self._call_provider(provider, prompt, system_prompt, json_mode=json_mode)
            if response:
                return response
        
        return ""

    async def _generate_with_retries(
        self,
        prompt: str,
        system_prompt: str,
        attempts: int = 2,
        retry_delay_seconds: float = 0.8,
        json_mode: bool = False,
        preferred_provider: Optional[str] = None,
        skip_providers: Optional[List[str]] = None,
    ) -> str:
        last_response = ""
        for attempt in range(attempts):
            response = await self._generate(
                prompt,
                system_prompt,
                json_mode=json_mode,
                preferred_provider=preferred_provider,
                skip_providers=skip_providers,
            )
            if response and response.strip():
                return response
            last_response = response
            if preferred_provider == "gemini" and (
                self._gemini_temporarily_disabled() or self._last_provider_issue == "gemini_rate_limited"
            ):
                break
            if attempt < attempts - 1:
                await asyncio.sleep(retry_delay_seconds)
        return last_response

    @property
    def llm_available(self) -> bool:
        """Check whether at least one configured LLM client is available."""
        return bool(
            (self.use_gemini and self.gemini_api_key) or
            self.groq_client or
            (self.use_ollama and self.ollama_url)
        )

    def _extract_json_object(self, response: str) -> Optional[Dict[str, Any]]:
        parsed = extract_json_payload(response)
        return parsed if isinstance(parsed, dict) else None

    async def _repair_json_object(
        self,
        raw_response: str,
        schema_hint: str,
        repair_context: str,
        preferred_provider: Optional[str] = None,
        skip_providers: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        if not raw_response.strip():
            return None

        repair_prompt = f"""
Convert the following model output into a valid JSON object.

Requirements:
- Return exactly one JSON object
- No markdown fences
- No explanations
- Preserve the original meaning
- If a field is missing, add a reasonable empty value that matches the schema

Expected schema:
{schema_hint}

Original output:
{raw_response}
"""

        repaired_response = await self._generate(
            repair_prompt,
            f"You repair {repair_context} into strict JSON. Return only valid JSON.",
            json_mode=True,
            preferred_provider=preferred_provider,
            skip_providers=skip_providers,
        )
        return self._extract_json_object(repaired_response)
    
    async def analyze_release_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a release ticket and extract key information"""
        prompt = f"""
        Analyze the following release ticket and extract key information:
        
        Ticket ID: {ticket_data.get('ticket_id')}
        Title: {ticket_data.get('title')}
        Description: {ticket_data.get('description', '')}
        Type: {ticket_data.get('ticket_type', 'feature')}
        Priority: {ticket_data.get('priority', 'medium')}
        
        Please provide:
        1. Impacted modules (as a list)
        2. Dependencies (other features/tickets this depends on)
        3. Risk score (0.0 to 1.0, where 1.0 is highest risk)
        4. Reasoning for the risk score
        
        Return ONLY valid JSON in this exact format:
        {{
            "impacted_modules": ["module1", "module2"],
            "dependencies": ["dependency1"],
            "risk_score": 0.7,
            "risk_reasoning": "explanation here"
        }}
        """
        
        response = await self._generate(prompt, "You are an expert QA analyst. Return only valid JSON.")
        
        try:
            # Try to parse JSON from response
            # Sometimes the AI might include extra text, so find the JSON
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result
        except Exception as e:
            pass
        
        # Return default values if parsing fails
        return {
            "impacted_modules": ["General"],
            "dependencies": [],
            "risk_score": 0.5,
            "risk_reasoning": "Default analysis - AI service unavailable"
        }
    
    async def generate_test_scenarios(
        self,
        feature: Dict[str, Any],
        historical_defects: List[Dict[str, Any]],
        priority: str = "high"
    ) -> List[Dict[str, Any]]:
        """Generate test scenarios for a feature"""
        historical_context = "\n".join([
            f"- Defect {d.get('defect_id')}: {d.get('title')} (Severity: {d.get('severity')})"
            for d in historical_defects[:5]
        ])
        
        prompt = f"""
        Generate {priority} priority test scenarios for the following feature:
        
        Feature: {feature.get('title')}
        Description: {feature.get('description', '')}
        Impacted Modules: {', '.join(feature.get('impacted_modules', []))}
        
        Historical defects in similar areas:
        {historical_context or 'None'}
        
        Generate 5-8 test cases including:
        - Functional scenarios
        - Edge cases
        - Regression scenarios based on historical defects
        - Integration test scenarios
        
        Return ONLY valid JSON as an array in this exact format:
        [
            {{
                "title": "Test case title",
                "description": "Detailed test steps",
                "priority": "high|medium|low",
                "test_type": "functional|regression|integration|edge_case"
            }}
        ]
        """
        
        response = await self._generate(prompt, "You are an expert QA test designer. Return only valid JSON array.")
        
        try:
            # Extract JSON array
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result if isinstance(result, list) else []
        except Exception as e:
            pass
        
        # Return default test cases
        return [
            {
                "title": f"Verify {feature.get('title')} functionality",
                "description": "Test basic functionality of the feature",
                "priority": priority,
                "test_type": "functional"
            }
        ]
    
    async def recommend_org(
        self,
        release_requirements: Dict[str, Any],
        available_orgs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Recommend QA organizations for testing"""
        orgs_summary = "\n".join([
            f"- {org.get('org_name')}: Version {org.get('release_version')}, "
            f"Features: {', '.join(org.get('enabled_features', [])[:3])}, "
            f"Stability: {org.get('stability_score', 0):.0%}"
            for org in available_orgs
        ])
        
        prompt = f"""
        Recommend the best QA organizations for testing this release:
        
        Release: {release_requirements.get('release_version')}
        Required Features: {', '.join(release_requirements.get('required_features', []))}
        
        Available Organizations:
        {orgs_summary}
        
        Rank the top 3 organizations by:
        1. Feature compatibility
        2. Version compatibility
        3. Stability score
        4. Environment health
        
        Return ONLY valid JSON as an array:
        [
            {{
                "org_name": "org name",
                "confidence_score": 0.95,
                "reasoning": "why this org is suitable",
                "rank": 1
            }}
        ]
        """
        
        response = await self._generate(prompt, "You are an expert QA environment analyst. Return only valid JSON array.")
        
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result if isinstance(result, list) else []
        except Exception as e:
            pass
        
        # Return default recommendations based on stability
        sorted_orgs = sorted(available_orgs, key=lambda x: x.get('stability_score', 0), reverse=True)
        return [
            {
                "org_name": org.get('org_name'),
                "confidence_score": org.get('stability_score', 0.5),
                "reasoning": f"High stability score of {org.get('stability_score', 0):.0%}",
                "rank": idx + 1
            }
            for idx, org in enumerate(sorted_orgs[:3])
        ]
    
    async def calculate_release_confidence(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall release confidence score"""
        prompt = f"""
        Analyze these release metrics and provide a confidence score:
        
        - Total Features: {metrics.get('total_features', 0)}
        - Features with High Risk: {metrics.get('high_risk_features', 0)}
        - Test Coverage: {metrics.get('test_coverage', 0):.0%}
        - Critical Bugs: {metrics.get('critical_bugs', 0)}
        - Open Blockers: {metrics.get('open_blockers', 0)}
        
        Provide:
        1. Overall confidence score (0.0 to 1.0)
        2. Risk level (low/medium/high/critical)
        3. Key concerns
        4. Recommendations
        
        Return ONLY valid JSON:
        {{
            "confidence_score": 0.85,
            "risk_level": "medium",
            "key_concerns": ["concern1", "concern2"],
            "recommendations": ["recommendation1", "recommendation2"]
        }}
        """
        
        response = await self._generate(prompt, "You are an expert release manager. Return only valid JSON.")
        
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result
        except Exception as e:
            pass
        
        # Calculate basic confidence score
        base_score = 1.0
        if metrics.get('high_risk_features', 0) > 0:
            base_score -= 0.1 * min(metrics.get('high_risk_features', 0), 5)
        if metrics.get('critical_bugs', 0) > 0:
            base_score -= 0.15 * min(metrics.get('critical_bugs', 0), 3)
        if metrics.get('open_blockers', 0) > 0:
            base_score -= 0.2 * min(metrics.get('open_blockers', 0), 2)
        
        base_score = max(0.0, min(1.0, base_score))
        
        return {
            "confidence_score": base_score,
            "risk_level": "high" if base_score < 0.6 else "medium" if base_score < 0.8 else "low",
            "key_concerns": ["AI service unavailable - using default calculation"],
            "recommendations": ["Review high-risk features", "Address critical bugs"]
        }
    
    async def assign_test_cases(
        self,
        executions: List[Dict[str, Any]],
        collaborators: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Use AI to intelligently assign test cases to collaborators"""
        executions_summary = "\n".join([
            f"ID {ex['id']}: {ex['title']} (Priority: {ex['priority']})"
            for ex in executions[:20]  # Limit to avoid token overflow
        ])
        
        collaborators_summary = "\n".join([
            f"User {c['id']} ({c['name']}): Role {c['role']}"
            for c in collaborators
        ])
        
        prompt = f"""
        You are a QA lead assigning test cases to team members.
        
        Test Cases to Assign ({len(executions)} total):
        {executions_summary}
        
        Available Collaborators:
        {collaborators_summary}
        
        Assign each test case to the most suitable collaborator based on:
        1. Workload balance (distribute evenly)
        2. Priority (high-priority tests to experienced members)
        3. Specialization (match test type to role/expertise)
        
        Return ONLY valid JSON array with assignments:
        [
            {{
                "execution_id": 1,
                "user_id": 2,
                "reason": "Balanced workload, senior engineer for high-priority test"
            }}
        ]
        """
        
        response = await self._generate(prompt, "You are a QA lead. Return only valid JSON array.")
        
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                if isinstance(result, list):
                    return result
        except Exception as e:
            pass
        
        # Fallback: Round-robin assignment
        assignments = []
        for idx, execution in enumerate(executions):
            collaborator = collaborators[idx % len(collaborators)]
            assignments.append({
                "execution_id": execution['id'],
                "user_id": collaborator['id'],
                "reason": "Round-robin assignment (AI unavailable)"
            })
        
        return assignments
    
    async def recommend_orgs(
        self,
        test_case: Dict[str, Any],
        orgs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Recommend best Salesforce orgs for testing a specific test case"""
        orgs_summary = "\n".join([
            f"Org {org['id']} ({org['name']}): "
            f"Features: {', '.join(org.get('enabled_features', [])[:3])}, "
            f"Stability: {org.get('stability_score', 0):.0%}"
            for org in orgs[:10]
        ])
        
        prompt = f"""
        Recommend the BEST Salesforce org for testing this test case:
        
        Test Case: {test_case.get('title')}
        Description: {test_case.get('description', '')}
        
        Available Orgs:
        {orgs_summary}
        
        Select the single best org based on:
        1. Feature availability (does org have required features enabled?)
        2. Data availability (does org have needed test data?)
        3. Stability (is org reliable?)
        
        Return ONLY valid JSON array with ONE recommendation:
        [
            {{
                "org_id": 1,
                "org_name": "QA Org 1",
                "confidence_score": 0.95,
                "reasons": ["Has required features", "High stability", "Good test data"]
            }}
        ]
        """
        
        response = await self._generate(prompt, "You are a QA infrastructure expert. Return only valid JSON array.")
        
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                if isinstance(result, list) and len(result) > 0:
                    # Return only the first (best) recommendation
                    return [result[0]]
        except Exception as e:
            pass
        
        # Fallback: Return only the most stable org
        sorted_orgs = sorted(orgs, key=lambda x: x.get('stability_score', 0), reverse=True)
        best_org = sorted_orgs[0] if sorted_orgs else None
        if not best_org:
            return []
        return [
            {
                "org_id": best_org['id'],
                "org_name": best_org['name'],
                "confidence_score": best_org.get('stability_score', 0.5),
                "reasons": [f"Highest stability score: {best_org.get('stability_score', 0):.0%}"]
            }
            for org in sorted_orgs[:3]
        ]
    
    async def generate_chat_response(
        self,
        test_case: Dict[str, Any],
        user_message: str,
        chat_history: List[Any]
    ) -> str:
        """Generate AI chat response during test execution"""
        history_summary = "\n".join([
            f"{'User' if not msg.is_ai_response else 'AI'}: {msg.message}"
            for msg in chat_history[-10:]  # Last 10 messages
        ]) if chat_history else "No previous messages"
        
        prompt = f"""
        You are an AI assistant helping a QA engineer test this feature:
        
        Test Case: {test_case.get('title')}
        Description: {test_case.get('description', '')}
        Expected Result: {test_case.get('expected_result', '')}
        
        Chat History:
        {history_summary}
        
        User's Question: {user_message}
        
        Provide a helpful, concise response to guide the tester.
        """
        
        response = await self._generate(
            prompt,
            "You are a helpful QA assistant. Be concise and practical."
        )
        
        return response or "I'm here to help! Could you provide more details about what you're testing?"
    
    async def validate_test_execution(
        self,
        test_case: Dict[str, Any],
        user_notes: str,
        screenshots: List[str] = []
    ) -> Dict[str, Any]:
        """Validate test execution and suggest pass/fail based on user notes"""
        prompt = f"""
        Analyze this test execution and determine if it should pass or fail:
        
        Test Case: {test_case.get('title')}
        Expected Result: {test_case.get('expected_result', '')}
        
        Tester's Notes: {user_notes}
        Screenshots Provided: {len(screenshots)}
        
        Based on the tester's notes, determine:
        1. Should this test PASS or FAIL?
        2. Confidence score (0.0 to 1.0)
        3. Key observations from the notes
        4. Any concerns or red flags
        
        Return ONLY valid JSON:
        {{
            "suggested_status": "passed|failed|blocked",
            "confidence_score": 0.85,
            "summary": "Brief summary of your analysis",
            "observations": ["observation1", "observation2"],
            "concerns": ["concern1"]
        }}
        """
        
        response = await self._generate(
            prompt,
            "You are an expert QA analyst. Return only valid JSON."
        )
        
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                result = json.loads(json_str)
                return result
        except Exception as e:
            pass
        
        # Default response if parsing fails
        return {
            "suggested_status": "passed",
            "confidence_score": 0.5,
            "summary": "Unable to analyze - AI service unavailable",
            "observations": ["Test notes recorded"],
            "concerns": []
        }
    
    async def analyze_test_impact(
        self,
        selected_tickets: List[Dict[str, Any]],
        all_test_cases: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Phase 3: Analyze tickets and recommend additional test cases for regression testing
        Returns test case recommendations grouped by impact area/section
        """

        candidate_cases = self._shortlist_impact_candidates(selected_tickets, all_test_cases)
        candidate_sections = self._group_candidates_by_section(candidate_cases)
        
        if not self.llm_available:
            raise ActualAIRequiredError(
                "Step 1 impact analysis requires a configured AI model. Configure Gemini, Groq, or Ollama and try again."
            )

        if self.use_gemini and self.gemini_api_key:
            overview_result = await self._analyze_release_overview(selected_tickets, candidate_sections)
            section_results = await self._analyze_candidate_sections_parallel(selected_tickets, candidate_sections)
        else:
            overview_result, section_results = await asyncio.gather(
                self._analyze_release_overview(selected_tickets, candidate_sections),
                self._analyze_candidate_sections_parallel(selected_tickets, candidate_sections),
            )

        if not overview_result or not section_results:
            raise ActualAIRequiredError(
                "Step 1 impact analysis did not receive valid AI JSON output. No heuristic fallback is allowed for this workflow."
            )

        valid_candidate_ids = {
            test["id"]
            for meta in candidate_sections.values()
            for test in meta["tests"]
        }
        recommended_sections = []
        additional_test_ids: List[str] = []
        for section_result in section_results:
            recommended_ids = [
                test_id for test_id in section_result.get("recommended_test_ids", [])
                if test_id in valid_candidate_ids
            ]
            extra_ids = [
                test_id for test_id in section_result.get("additional_test_ids", [])
                if test_id in valid_candidate_ids and test_id not in recommended_ids
            ]
            if not recommended_ids:
                continue
            recommended_sections.append({
                "section": section_result.get("section"),
                "risk_level": section_result.get("risk_level", "medium"),
                "reason": section_result.get("reason", "AI-selected based on release impact."),
                "recommended_test_ids": recommended_ids[:4],
            })
            additional_test_ids.extend(extra_ids[:2])

        if not recommended_sections:
            raise ActualAIRequiredError(
                "Step 1 impact analysis returned section responses, but none included valid candidate test IDs."
            )

        return {
            "impacted_areas": overview_result.get("impacted_areas", []),
            "top_risk_tickets": overview_result.get("top_risk_tickets", []),
            "recommended_sections": recommended_sections,
            "additional_test_ids": list(dict.fromkeys(additional_test_ids))[:8],
            "overall_risk": overview_result.get("overall_risk", "medium"),
            "confidence": overview_result.get("confidence", "medium"),
            "summary": overview_result.get("summary", "AI analysis completed using parallel section review."),
            "analysis_mode": "ai",
            "candidate_sections_considered": len(candidate_sections),
            "parallel_section_tasks": len(section_results),
            "parallel_section_limit": (
                STEP1_GEMINI_SECTION_CONCURRENCY
                if self.use_gemini and self.gemini_api_key
                else STEP1_SECTION_CONCURRENCY
            ),
        }

    def _get_test_case_field(self, test_case: Dict[str, Any], *keys: str, default: str = "") -> str:
        for key in keys:
            value = test_case.get(key)
            if value is not None and value != "":
                return str(value)
        return default

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
        stop_words = {"the", "and", "for", "with", "from", "that", "this", "into", "when", "where", "before", "after", "update", "release"}
        return [token for token in tokens if len(token) > 2 and token not in stop_words]

    def _shortlist_impact_candidates(
        self,
        selected_tickets: List[Dict[str, Any]],
        all_test_cases: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        ticket_terms: List[str] = []
        ticket_ids: List[str] = []
        for ticket in selected_tickets:
            ticket_id = str(ticket.get('issue_key', '')).strip()
            if ticket_id:
                ticket_ids.append(ticket_id.lower())
            ticket_terms.extend(self._tokenize(ticket.get('summary', '')))

        scored_candidates = []
        for test_case in all_test_cases:
            test_id = self._get_test_case_field(test_case, 'ID', 'id', default='N/A')
            title = self._get_test_case_field(test_case, 'Title', 'title', default='No title')
            section = self._get_test_case_field(test_case, 'Section Hierarchy', 'section_hierarchy', 'Section', 'section', default='General')
            priority = self._get_test_case_field(test_case, 'Priority', 'priority', 'priority_label', default='Medium')
            haystack = f"{title} {section}".lower()
            hay_tokens = set(self._tokenize(haystack))

            score = 0
            reasons: List[str] = []

            if any(ticket_id in haystack for ticket_id in ticket_ids):
                score += 10
                reasons.append('direct_ticket_link')

            overlap = len(set(ticket_terms) & hay_tokens)
            if overlap:
                score += min(6, overlap * 2)
                reasons.append('summary_overlap')

            priority_key = priority.lower()
            if priority_key == 'critical':
                score += 3
            elif priority_key == 'high':
                score += 2

            if score <= 0:
                continue

            scored_candidates.append({
                "id": test_id,
                "title": title,
                "section": section,
                "priority": priority,
                "score": score,
                "match_reason": ", ".join(reasons) if reasons else "priority_weighted",
            })

        scored_candidates.sort(key=lambda case: (-case['score'], case['section'], case['id']))
        return scored_candidates[:80]

    def _group_candidates_by_section(self, candidate_cases: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        grouped: Dict[str, Dict[str, Any]] = {}
        for candidate in candidate_cases:
            section = candidate['section']
            if section not in grouped:
                grouped[section] = {"count": 0, "tests": [], "max_score": 0}
            grouped[section]["count"] += 1
            grouped[section]["tests"].append(candidate)
            grouped[section]["max_score"] = max(grouped[section]["max_score"], candidate["score"])

        return dict(
            sorted(
                grouped.items(),
                key=lambda item: (-item[1]["max_score"], -item[1]["count"], item[0])
            )
        )

    def _build_heuristic_impact_analysis(
        self,
        selected_tickets: List[Dict[str, Any]],
        candidate_sections: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        top_sections = list(candidate_sections.items())[:5]
        impacted_areas = [section for section, _ in top_sections]
        recommended_sections = []
        additional_test_ids: List[str] = []

        for section, meta in top_sections[:3]:
            top_tests = meta["tests"][:4]
            recommended_sections.append({
                "section": section,
                "risk_level": "high" if meta["max_score"] >= 10 else "medium",
                "reason": f"Heuristic match based on direct ticket links and summary overlap across {meta['count']} candidate tests.",
                "recommended_test_ids": [test["id"] for test in top_tests],
            })
            additional_test_ids.extend([test["id"] for test in meta["tests"][4:6]])

        risk_level = "high" if len(selected_tickets) >= 5 else "medium"
        confidence = "medium" if recommended_sections else "low"

        return {
            "impacted_areas": impacted_areas or ["Scoped release areas"],
            "top_risk_tickets": [ticket.get("issue_key", "N/A") for ticket in selected_tickets[:3]],
            "recommended_sections": recommended_sections,
            "additional_test_ids": additional_test_ids[:8],
            "overall_risk": risk_level,
            "confidence": confidence,
            "summary": (
                "AI analysis was unavailable, so Suitecraft used heuristic scoping based on direct ticket links, "
                "summary overlap, and test priority."
            ),
        }

    async def _run_json_task(
        self,
        prompt: str,
        system_prompt: str,
        schema_hint: str,
        timeout_seconds: float,
    ) -> Optional[Dict[str, Any]]:
        providers = self._provider_sequence()
        for provider in providers:
            try:
                response = await asyncio.wait_for(
                    self._generate_with_retries(
                        prompt,
                        system_prompt,
                        json_mode=True,
                        preferred_provider=provider,
                    ),
                    timeout=timeout_seconds,
                )
            except asyncio.TimeoutError:
                continue

            result = self._extract_json_object(response)
            if result:
                return result

            repair_order = (
                [candidate for candidate in providers if candidate != provider] + [provider]
                if provider == "gemini"
                else [provider] + [candidate for candidate in providers if candidate != provider]
            )
            for repair_provider in repair_order:
                try:
                    repaired = await asyncio.wait_for(
                        self._repair_json_object(
                            response,
                            schema_hint,
                            "step 1 impact analysis output",
                            preferred_provider=repair_provider,
                        ),
                        timeout=timeout_seconds,
                    )
                    if repaired:
                        return repaired
                except asyncio.TimeoutError:
                    continue

            if provider == "gemini" and (
                self._gemini_temporarily_disabled() or self._last_provider_issue == "gemini_rate_limited"
            ):
                continue

            try:
                fallback_response = await asyncio.wait_for(
                    self._generate_with_retries(
                        prompt,
                        system_prompt,
                        json_mode=False,
                        preferred_provider=provider,
                    ),
                    timeout=timeout_seconds,
                )
            except asyncio.TimeoutError:
                continue

            fallback_result = self._extract_json_object(fallback_response)
            if fallback_result:
                return fallback_result

            for repair_provider in repair_order:
                try:
                    repaired = await asyncio.wait_for(
                        self._repair_json_object(
                            fallback_response,
                            schema_hint,
                            "step 1 impact analysis output",
                            preferred_provider=repair_provider,
                        ),
                        timeout=timeout_seconds,
                    )
                    if repaired:
                        return repaired
                except asyncio.TimeoutError:
                    continue

        if self._last_provider_issue == "gemini_rate_limited" and not self.groq_client:
            raise ActualAIRequiredError(
                "Gemini is currently rate limited for Step 1. Wait a minute and retry, or configure Groq as a fallback provider."
            )

        return None

    async def _analyze_release_overview(
        self,
        selected_tickets: List[Dict[str, Any]],
        candidate_sections: Dict[str, Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        tickets_summary = "\n".join([
            f"- {t.get('issue_key', 'N/A')}: {t.get('summary', 'No summary')} "
            f"(Type: {t.get('issue_type', 'N/A')}, Priority: {t.get('priority', 'N/A')}, Status: {t.get('status', 'N/A')})"
            for t in selected_tickets[:8]
        ])
        sections_summary = "\n".join([
            f"- {section}: {meta['count']} candidate tests, strongest score {meta['max_score']}"
            for section, meta in list(candidate_sections.items())[:6]
        ])

        prompt = f"""
You are an expert QA Manager analyzing the overall regression risk for a release.

SELECTED TICKETS:
{tickets_summary}

TOP CANDIDATE TEST SECTIONS:
{sections_summary}

Return ONLY valid JSON:
{{
  "impacted_areas": ["Module/Area 1", "Module/Area 2"],
  "top_risk_tickets": ["TICKET-123", "TICKET-456"],
  "overall_risk": "high|medium|low",
  "confidence": "high|medium|low",
  "summary": "Brief summary of testing strategy"
}}
"""

        return await self._run_json_task(
            prompt,
            "You are an expert QA Manager focused on release-level regression risk. Return only valid JSON.",
            """
{
  "impacted_areas": ["Module/Area 1", "Module/Area 2"],
  "top_risk_tickets": ["TICKET-123", "TICKET-456"],
  "overall_risk": "high|medium|low",
  "confidence": "high|medium|low",
  "summary": "Brief summary of testing strategy"
}
            """.strip(),
            STEP1_OVERVIEW_TIMEOUT_SECONDS,
        )

    async def _analyze_candidate_section(
        self,
        section: str,
        meta: Dict[str, Any],
        selected_tickets: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        ticket_context = "\n".join([
            f"- {ticket.get('issue_key', 'N/A')}: {ticket.get('summary', 'No summary')}"
            for ticket in selected_tickets[:4]
        ])
        test_context = "\n".join([
            f"- {test['id']}: {test['title']} [priority={test['priority']}, match={test['match_reason']}, score={test['score']}]"
            for test in meta['tests'][:4]
        ])

        prompt = f"""
You are an expert QA Manager reviewing one candidate regression section.

SELECTED TICKETS:
{ticket_context}

SECTION UNDER REVIEW:
- Section: {section}
- Candidate tests: {meta['count']}
- Strongest score: {meta['max_score']}

TOP TESTS:
{test_context}

Return ONLY valid JSON:
{{
  "section": "{section}",
  "risk_level": "high|medium|low",
  "reason": "Why this section is impacted",
  "recommended_test_ids": ["C123", "C456"],
  "additional_test_ids": ["C789"]
}}
"""

        return await self._run_json_task(
            prompt,
            "You are an expert QA Manager selecting the highest-value tests for one impacted section. Return only valid JSON.",
            """
{
  "section": "Section Name",
  "risk_level": "high|medium|low",
  "reason": "Why this section is impacted",
  "recommended_test_ids": ["C123", "C456"],
  "additional_test_ids": ["C789"]
}
            """.strip(),
            STEP1_SECTION_TIMEOUT_SECONDS,
        )

    async def _analyze_candidate_sections_parallel(
        self,
        selected_tickets: List[Dict[str, Any]],
        candidate_sections: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        max_parallel_tasks = (
            STEP1_GEMINI_SECTION_CONCURRENCY
            if self.use_gemini and self.gemini_api_key
            else STEP1_SECTION_CONCURRENCY
        )
        semaphore = asyncio.Semaphore(max_parallel_tasks)

        async def run(section: str, meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            async with semaphore:
                return await self._analyze_candidate_section(section, meta, selected_tickets)

        tasks = [
            run(section, meta)
            for section, meta in list(candidate_sections.items())[:6]
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [result for result in results if isinstance(result, dict)]
    
    async def generate_test_plan(
        self,
        selected_tickets: List[Dict[str, Any]],
        selected_test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate ENTERPRISE-GRADE regression test plan for release management
        
        Designed for Product Owners, Release Managers, and QA Managers
        Returns a comprehensive test plan with:
        - Executive summary & risk assessment
        - Test coverage analysis by module/priority
        - Resource planning & effort estimation
        - Quality gates & success criteria
        - All selected test cases organized by business area
        """
        # Build context - limit to avoid token overflow
        max_tickets_in_prompt = 10  # Reduced to stay under token limits
        max_test_cases_in_prompt = 15  # Reduced to stay under token limits
        
        tickets_summary = "\n".join([
            f"- {t.get('issue_key', 'N/A')}: {t.get('summary', 'No summary')} "
            f"(Type: {t.get('issue_type', 'N/A')}, Priority: {t.get('priority', 'N/A')})"
            for t in selected_tickets[:max_tickets_in_prompt]
        ])
        
        test_cases_summary = "\n".join([
            f"- {tc.get('id', 'N/A')}: {tc.get('title', 'No title')} "
            f"(Priority: {tc.get('priority_label', 'N/A')}, Section: {tc.get('section', 'N/A')[:50]}...)"
            for tc in selected_test_cases[:max_test_cases_in_prompt]
        ])
        
        # Analyze ticket types and priorities for business context
        ticket_types = {}
        ticket_priorities = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
        for t in selected_tickets:
            t_type = t.get('issue_type', 'Other')
            t_priority = t.get('priority', 'Medium')
            ticket_types[t_type] = ticket_types.get(t_type, 0) + 1
            if t_priority in ticket_priorities:
                ticket_priorities[t_priority] += 1
        
        # Analyze test case distribution
        section_distribution = {}
        priority_distribution = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
        for tc in selected_test_cases:
            section = tc.get('Section') or tc.get('section') or 'General'
            section_distribution[section] = section_distribution.get(section, 0) + 1
            tc_priority = tc.get('Priority') or tc.get('priority') or 'Medium'
            if tc_priority in priority_distribution:
                priority_distribution[tc_priority] += 1
        
        
        # Build test coverage by module string for prompt
        module_coverage_entries = []
        for module_name, test_count in sorted(section_distribution.items(), key=lambda x: x[1], reverse=True)[:10]:
            priority_val = "high" if test_count > len(selected_test_cases) * 0.15 else "medium"
            hours_val = round(test_count * 0.167, 1)
            module_coverage_entries.append(
                f'"{module_name}": {{"module_name": "{module_name}", "test_case_count": {test_count}, '
                f'"priority": "{priority_val}", "estimated_hours": {hours_val}, '
                f'"risk_level": "{priority_val}", "test_case_ids": []}}'
            )
        module_coverage_str = ',\n                '.join(module_coverage_entries) if module_coverage_entries else '"General": {"module_name": "General", "test_case_count": 0, "priority": "medium", "estimated_hours": 0, "risk_level": "medium", "test_case_ids": []}'
        
        prompt = f"""You are a QA Manager creating an enterprise test plan.

Release: {release_info.get('release_name', 'N/A')} v{release_info.get('release_version', 'N/A')}
Tickets: {len(selected_tickets)} ({', '.join(f"{k}:{v}" for k, v in ticket_types.items())})
Test Cases: {len(selected_test_cases)} across {len(section_distribution)} modules
Priorities: High={ticket_priorities['High']}, Medium={ticket_priorities['Medium']}, Low={ticket_priorities['Low']}

Sample Tickets (top 3):
{chr(10).join([f"- {t.get('issue_key', 'N/A')}: {t.get('summary', 'No summary')[:60]}..." for t in selected_tickets[:3]])}

Top Modules:
{chr(10).join([f"- {k}: {v} tests" for k, v in sorted(section_distribution.items(), key=lambda x: x[1], reverse=True)[:5]])}

Create a comprehensive JSON test plan with these sections:
1. plan_metadata (name, version, date, owner, status)
2. executive_summary (overview, key_changes, business_impact, test_coverage_summary)
3. release_objectives (3-4 goals as array)
4. scope (in_scope array, out_of_scope array, tickets_included, test_cases_included, modules_covered)
5. risk_assessment (high_risk_areas array, medium_risk_areas array, mitigation_strategies array)
6. test_strategy (approach, entry_criteria array, exit_criteria array, testing_types array)
7. test_execution_phases (5 phases, each with: phase, name, description, test_case_count, estimated_hours, key_activities array)
8. resource_plan (total_team_size, roles array with role/count/responsibilities, estimated_effort_hours, estimated_duration_days, buffer_percentage)
9. test_coverage_by_module (object with top 5 modules, each with: module_name, test_case_count, priority, estimated_hours, risk_level)
10. quality_gates (must_pass_criteria array, go_decision_criteria array, acceptable_thresholds object)
11. timeline (start_date, end_date, key_milestones array with date/milestone/status)
12. dependencies_and_assumptions (dependencies array, assumptions array, constraints array)
13. defect_management (defect_priorities object, triage_process, escalation_criteria array)
14. reporting (daily_standup, weekly_status, metrics_tracked array)
15. sign_off (approvers array with role/name/status)
16. summary_metrics (total_tickets, total_test_cases, total_modules, critical_tickets, high_priority_tickets, estimated_hours, estimated_days, team_size, risk_level, confidence_level, test_coverage_target)

CRITICAL: Base all hour estimates on {len(selected_test_cases)} test cases at 0.167 hours each (10 min/test).
Total base hours = {round(len(selected_test_cases) * 0.167, 1)}. Add 30h overhead, then 20% buffer.

Return ONLY valid JSON (no markdown, no explanations).
        {{
        """
        
        response = await self._generate(
            prompt,
            "You are an expert QA Manager with deep knowledge of test planning and quality assurance best practices. Return only valid JSON."
        )
        
        
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                # Try to fix common JSON issues
                # Remove trailing commas before closing braces/brackets
                import re
                json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
                # Remove comments
                json_str = re.sub(r'//.*?$', '', json_str, flags=re.MULTILINE)
                result = json.loads(json_str)
                return result
        except Exception:
            pass

        # Analyze ticket and test case distribution for fallback
        ticket_types_fallback = {}
        ticket_priorities_fallback = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
        for t in selected_tickets:
            t_type = t.get('issue_type', 'Other')
            t_priority = t.get('priority', 'Medium')
            ticket_types_fallback[t_type] = ticket_types_fallback.get(t_type, 0) + 1
            if t_priority in ticket_priorities_fallback:
                ticket_priorities_fallback[t_priority] += 1
        
        section_dist_fallback = {}
        for tc in selected_test_cases:
            section = tc.get('Section') or tc.get('section') or 'General'
            section_dist_fallback[section] = section_dist_fallback.get(section, 0) + 1
        
        # Build the final test plan structure
        total_test_case_hours = len(selected_test_cases) * 0.167  # 10 min per test case
        total_hours_with_buffer = total_test_case_hours + 30  # Add overhead
        total_days = round(total_hours_with_buffer / 40, 1)
        
        # Group test cases by section with full details
        test_coverage_by_module = {}
        for section, count in sorted(section_dist_fallback.items(), key=lambda x: x[1], reverse=True):
            test_coverage_by_module[section] = {
                "module_name": section,
                "test_case_count": count,
                "priority": "high" if count > len(selected_test_cases) * 0.15 else "medium",
                "estimated_hours": round(count * 0.167, 1),
                "risk_level": "high" if count > len(selected_test_cases) * 0.15 else "medium",
                "test_case_ids": [
                    tc.get('ID') or tc.get('id') or f"TC-{i}"
                    for i, tc in enumerate(selected_test_cases)
                    if (tc.get('Section') or tc.get('section') or 'General') == section
                ]
            }
        
        result = {
            "plan_metadata": {
                "plan_name": f"Release {release_info.get('release_version', 'N/A')} - Regression Test Plan",
                "release_version": release_info.get('release_version', 'N/A'),
                "created_date": "2024-01-15",
                "owner": "QA Manager",
                "status": "Draft"
            },
            
            "executive_summary": {
                "overview": f"Comprehensive regression test plan for Release {release_info.get('release_version', 'N/A')} covering {len(selected_tickets)} tickets and {len(selected_test_cases)} test cases.",
                "key_changes": [
                    f"{ticket_types_fallback.get('Story', 0)} new features",
                    f"{ticket_types_fallback.get('Bug', 0)} bug fixes",
                    "Core functionality enhancements"
                ],
                "business_impact": "Ensures quality and stability of production release through comprehensive regression testing",
                "test_coverage_summary": f"Testing {len(selected_tickets)} tickets with {len(selected_test_cases)} test cases across {len(section_dist_fallback)} modules"
            },
            
            "release_objectives": [
                f"Verify all {len(selected_tickets)} release tickets are working as expected",
                "Execute comprehensive regression testing to prevent production issues",
                "Validate integration points and end-to-end workflows",
                "Ensure no degradation in existing functionality"
            ],
            
            "scope": {
                "in_scope": list(section_dist_fallback.keys())[:5] + ["Regression testing of existing functionality"],
                "out_of_scope": [
                    "Performance testing (separate plan)",
                    "Security testing (separate plan)",
                    "Load testing"
                ],
                "tickets_included": len(selected_tickets),
                "test_cases_included": len(selected_test_cases),
                "modules_covered": len(section_dist_fallback)
            },
            
            "risk_assessment": {
                "high_risk_areas": [
                    {
                        "area": list(section_dist_fallback.keys())[0] if section_dist_fallback else "Core functionality",
                        "risk_level": "high",
                        "impact": "Critical business workflows affected if failures occur",
                        "likelihood": "medium",
                        "mitigation": "Prioritize in smoke testing, assign senior testers"
                    },
                    {
                        "area": "Integration points",
                        "risk_level": "medium",
                        "impact": "Data sync or third-party integration failures",
                        "likelihood": "low",
                        "mitigation": "Dedicated integration testing phase"
                    }
                ],
                "overall_risk_level": "medium",
                "mitigation_summary": "Phased testing approach with early smoke testing to catch critical issues"
            },
            
            "test_strategy": {
                "approach": "Risk-based phased regression testing with comprehensive coverage",
                "testing_types": ["Smoke Testing", "Functional Testing", "Regression Testing", "Integration Testing", "E2E Testing"],
                "entry_criteria": [
                    "Build deployed to test environment",
                    "Test data prepared and validated",
                    "All P0 blockers resolved",
                    "Test environment stable and accessible"
                ],
                "exit_criteria": [
                    "All critical and high priority test cases passed",
                    "No open P0/P1 defects",
                    "Test coverage >= 95%",
                    "All quality gates met",
                    "Sign-off from QA Manager and Product Owner"
                ],
                "test_environment": "Staging environment with production-like configuration"
            },
            
            "test_execution_phases": [
                {
                    "phase": 1,
                    "name": "Smoke Testing",
                    "description": "Critical path validation - verify build is stable and testable",
                    "entry_criteria": ["Build deployed to staging", "Environment health check passed"],
                    "test_focus": ["User login", "Core workflows", "Critical APIs", "Database connectivity"],
                    "estimated_duration_hours": 2,
                    "exit_criteria": ["All smoke tests pass", "No P0 blockers", "Build declared testable"]
                },
                {
                    "phase": 2,
                    "name": "Feature Acceptance Testing",
                    "description": "Validate new features and changes from tickets",
                    "entry_criteria": ["Smoke tests passed", "Feature documentation available"],
                    "test_focus": ["New feature functionality", "Business requirements validation", "User acceptance criteria"],
                    "estimated_duration_hours": 16,
                    "exit_criteria": ["All feature tests pass", "Requirements met", "UAT sign-off received"]
                },
                {
                    "phase": 3,
                    "name": "Regression Testing",
                    "description": f"Execute comprehensive regression suite - ALL {len(selected_test_cases)} test cases",
                    "entry_criteria": ["Feature testing complete", "Test data prepared"],
                    "test_focus": list(section_dist_fallback.keys()),
                    "test_case_count": len(selected_test_cases),
                    "estimated_duration_hours": round(total_test_case_hours, 1),
                    "exit_criteria": ["95%+ test cases passed", "All P0/P1 defects resolved", "Coverage goals met"]
                },
                {
                    "phase": 4,
                    "name": "Integration & E2E Testing",
                    "description": "End-to-end workflows and cross-module integration verification",
                    "entry_criteria": ["Regression testing complete", "Integration environment ready"],
                    "test_focus": ["Cross-module workflows", "Data flow validation", "Third-party integrations", "API contracts"],
                    "estimated_duration_hours": 8,
                    "exit_criteria": ["All E2E scenarios pass", "Integration points validated", "Data integrity confirmed"]
                },
                {
                    "phase": 5,
                    "name": "Final Validation & Sign-off",
                    "description": "Verification of fixes, final sanity checks, and stakeholder approval",
                    "entry_criteria": ["All testing phases complete", "All defects addressed"],
                    "test_focus": ["Defect re-verification", "Sanity testing", "Release notes validation", "Rollback plan review"],
                    "estimated_duration_hours": 4,
                    "exit_criteria": ["All exit criteria met", "No open blockers", "Stakeholder sign-off obtained", "Release ready"]
                }
            ],
            
            "resource_plan": {
                "team_composition": [
                    {"role": "QA Lead", "count": 1, "responsibilities": "Test plan execution, team coordination, stakeholder reporting, risk management"},
                    {"role": "Senior QA Engineer", "count": 2, "responsibilities": "Complex test scenarios, automation, high-risk area testing, technical guidance"},
                    {"role": "QA Engineer", "count": 3, "responsibilities": "Test case execution, defect logging, documentation, regression testing"},
                    {"role": "Automation Engineer", "count": 1, "responsibilities": "Automated test suite maintenance, CI/CD integration, test reporting"}
                ],
                "total_team_size": 7,
                "estimated_effort_hours": round(total_hours_with_buffer, 1),
                "estimated_duration_days": total_days,
                "buffer_percentage": 20
            },
            
            "test_coverage_by_module": test_coverage_by_module,
            
            "quality_gates": {
                "must_pass_criteria": [
                    "100% of Critical priority test cases passed",
                    "95%+ of High priority test cases passed",
                    "No open P0 (Blocker) defects",
                    "No open P1 (Critical) defects affecting core workflows"
                ],
                "go_decision_criteria": [
                    "All must-pass criteria met",
                    "Test coverage >= 95%",
                    "Defect density within acceptable limits",
                    "Performance benchmarks met (if applicable)",
                    "QA Manager and Product Owner formal sign-off"
                ],
                "no_go_triggers": [
                    "Any open P0 defects",
                    "More than 3 open P1 defects",
                    "Critical functionality broken",
                    "Test coverage below 90%",
                    "Unresolved security vulnerabilities"
                ]
            },
            
            "timeline": {
                "total_duration_days": total_days,
                "milestones": [
                    {"name": "Test Plan Approval", "day": 0, "description": "Stakeholder review and sign-off on test plan"},
                    {"name": "Smoke Testing Complete", "day": 1, "description": "Build validated and stable for full testing"},
                    {"name": "Feature Testing Complete", "day": 3, "description": "All new features validated and accepted"},
                    {"name": "Regression Testing Complete", "day": round(total_test_case_hours / 8), "description": f"All {len(selected_test_cases)} test cases executed"},
                    {"name": "Integration Testing Complete", "day": round(total_test_case_hours / 8) + 1, "description": "E2E and integration scenarios verified"},
                    {"name": "Final Sign-off", "day": total_days, "description": "Release approved for production deployment"}
                ]
            },
            
            "dependencies_and_assumptions": {
                "dependencies": [
                    "Test environment available and stable throughout testing cycle",
                    "Test data prepared by development/DevOps team",
                    "All features code-complete before testing starts",
                    "Access to required tools, licenses, and third-party systems",
                    "Development team available for defect triage and fixes"
                ],
                "assumptions": [
                    "No major scope changes during testing cycle",
                    "Test environment configuration matches production",
                    "Team members available full-time for dedicated testing",
                    "Defect fix turnaround within defined SLAs",
                    "Stakeholders available for sign-off reviews"
                ],
                "blockers": [
                    "Test environment instability or downtime",
                    "Incomplete features or missing dependencies",
                    "Missing or incorrect test data",
                    "Resource unavailability",
                    "Third-party system outages"
                ]
            },
            
            "defect_management": {
                "priority_definitions": {
                    "P0": "Blocker - Complete system failure, no workaround, testing cannot proceed",
                    "P1": "Critical - Major feature broken, severe impact, workaround may exist",
                    "P2": "High - Important functionality affected, moderate business impact",
                    "P3": "Medium - Minor issues, low business impact, cosmetic defects",
                    "P4": "Low - Trivial issues, enhancements, future improvements"
                },
                "sla": {
                    "P0": "Fix within 4 hours",
                    "P1": "Fix within 24 hours",
                    "P2": "Fix within 3 days",
                    "P3": "Fix before release or defer to next sprint",
                    "P4": "Backlog for future consideration"
                }
            },
            
            "reporting": {
                "frequency": "Daily status updates to stakeholders",
                "metrics_tracked": [
                    "Test cases executed vs planned (progress tracking)",
                    "Pass/Fail/Blocked percentage (quality metrics)",
                    "Defect counts by priority and status (risk assessment)",
                    "Test coverage percentage (completeness metric)",
                    "Testing velocity (productivity tracking)",
                    "Defect density and trend analysis"
                ],
                "stakeholders": [
                    "Product Owner (business perspective)",
                    "Release Manager (deployment decisions)",
                    "Development Manager (defect resolution)",
                    "QA Manager (quality oversight)",
                    "Project Management Office (timeline tracking)"
                ]
            },
            
            "sign_off": {
                "approvers": [
                    {"role": "QA Manager", "name": "TBD", "status": "Pending", "date": None},
                    {"role": "Product Owner", "name": "TBD", "status": "Pending", "date": None},
                    {"role": "Release Manager", "name": "TBD", "status": "Pending", "date": None},
                    {"role": "Development Manager", "name": "TBD", "status": "Pending", "date": None}
                ]
            },
            
            "summary_metrics": {
                "total_tickets": len(selected_tickets),
                "total_test_cases": len(selected_test_cases),
                "total_modules": len(section_dist_fallback),
                "critical_tickets": ticket_priorities_fallback.get('Critical', 0),
                "high_priority_tickets": ticket_priorities_fallback.get('High', 0),
                "estimated_hours": round(total_hours_with_buffer, 1),
                "estimated_days": total_days,
                "team_size": 7,
                "risk_level": "medium",
                "confidence_level": "high",
                "test_coverage_target": 95
            }
        }
        
        
        return result

# Singleton instance
ai_service = AIService()
