"""
AI Service for Test Plan Generation using Ollama/Llama
Provides intelligent test plan creation for regression suites based on tickets and test cases
"""

from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.services.ai_json_utils import extract_json_payload
import json
import httpx
from datetime import datetime

class TestPlanAIService:
    """Advanced AI service for generating comprehensive test plans"""
    
    def __init__(self):
        # Check if USE_GROQ is enabled in settings
        self.use_groq = getattr(settings, 'USE_GROQ', False)
        
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
    
    @property
    def llm_available(self) -> bool:
        """Check if any LLM service is available"""
        return bool(self.ollama_url or self.groq_client)
    
    async def _call_ollama(
        self, 
        prompt: str, 
        system_prompt: str = "You are an expert QA test planning architect.",
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        """Call Ollama API with extended context"""
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
                            "num_predict": max_tokens,
                            "top_p": 0.9,
                            "top_k": 40
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", "")
                else:

                    return ""
        except Exception as e:

            return ""
    
    async def _call_groq(
        self, 
        prompt: str, 
        system_prompt: str = "You are an expert QA test planning architect.",
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        """Fallback to Groq API"""
        if not self.groq_client:
            return ""
        
        try:
            response = self.groq_client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:

            return ""
    
    async def _generate(
        self, 
        prompt: str, 
        system_prompt: str = "You are an expert QA test planning architect.",
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        """Generate AI response using available service"""
        # Use Groq if configured
        if self.use_groq and self.groq_client:
            response = await self._call_groq(prompt, system_prompt, temperature, max_tokens)
            if response:
                return response
        
        # Otherwise use Ollama
        response = await self._call_ollama(prompt, system_prompt, temperature, max_tokens)
        if response:
            return response
        
        return ""
    
    def _extract_json(self, response: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from AI response"""
        parsed = extract_json_payload(response)
        return parsed if isinstance(parsed, dict) else None
    
    async def _generate_ai_risk_insights(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        stories: List[Dict[str, Any]],
        bugs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Use AI ONLY for risk assessment and recommendations
        Not for test case selection
        """
        
        # Summarize data for AI
        ticket_summary = "\n".join([
            f"- {t.get('issue_key')}: {t.get('summary', 'N/A')} [Priority: {t.get('priority', 'N/A')}, Type: {t.get('issue_type', 'N/A')}]"
            for t in tickets[:30]  # Limit to avoid token overflow
        ])
        
        bug_summary = "\n".join([
            f"- {b.get('issue_key')}: {b.get('summary', 'N/A')} [Priority: {b.get('priority', 'N/A')}]"
            for b in bugs[:20]
        ])
        
        prompt = f"""
# Risk Assessment Request

## Context
- Total Tickets: {len(tickets)}
- Stories: {len(stories)}
- Bugs: {len(bugs)}
- Test Cases: {len(test_cases)}

## Recent Tickets (Sample)
{ticket_summary}

## Bugs in this Release
{bug_summary if bugs else "No bugs"}

## Your Task
Analyze the release and provide:

1. **Risk Assessment**: Identify high-risk areas based on:
   - Bug patterns and frequencies
   - Areas with many changes
   - Critical functionality impacted

2. **Testing Recommendations**: Provide specific testing advice

3. **New Test Scenarios**: Suggest additional test cases not covered by existing suite

4. **Risk Mitigation**: Strategies to reduce release risk

## Output Format (JSON ONLY)
{{
  "risk_assessment": {{
    "high_risk_areas": ["area1", "area2"],
    "critical_concerns": ["concern1"],
    "bug_patterns": ["pattern observed"],
    "impact_summary": "Overall risk summary"
  }},
  "recommendations": [
    "Specific testing recommendation 1",
    "Specific testing recommendation 2"
  ],
  "new_test_scenarios_needed": [
    "New test scenario 1",
    "New test scenario 2"
  ],
  "risk_mitigation": {{
    "critical_scenarios": ["scenario1"],
    "fallback_strategies": ["strategy1"],
    "exploratory_testing_areas": ["area1"]
  }}
}}

Return ONLY valid JSON, no markdown formatting."""
        
        system_prompt = "You are an expert QA risk analyst. Analyze releases and provide actionable risk insights."
        
        response = await self._generate(prompt, system_prompt, temperature=0.5, max_tokens=2000)
        
        if response:
            insights = self._extract_json(response)
            if insights:
                return insights
        
        # Fallback if AI fails
        return {
            "risk_assessment": {
                "high_risk_areas": ["AI analysis unavailable"],
                "critical_concerns": [],
                "bug_patterns": [],
                "impact_summary": f"Release contains {len(tickets)} tickets"
            },
            "recommendations": ["Execute all test suites"],
            "new_test_scenarios_needed": [],
            "risk_mitigation": {
                "critical_scenarios": ["Review all critical tests"],
                "fallback_strategies": ["Manual testing if needed"],
                "exploratory_testing_areas": ["Bug fixes"]
            }
        }
    
    async def generate_deterministic_test_plan(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any],
        priority_focus: str = "all",
        use_ai_for_risk_analysis: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a DETERMINISTIC test plan with consistent results
        
        Test case selection is ALWAYS the same based on:
        - All available test cases from TestRail
        - Grouped by priority levels
        - Tickets are used for risk analysis context
        
        AI is ONLY used for optional risk analysis and recommendations
        
        Returns:
            Consistent, repeatable test plan with ALL test cases organized by priority
        """

        # Categorize test cases by priority (DETERMINISTIC)
        priority_groups = {
            'Critical': [],
            'High': [],
            'Medium': [],
            'Low': []
        }
        
        for tc in test_cases:
            priority = tc.get('priority_label', 'Medium')
            if priority in priority_groups:
                priority_groups[priority].append(tc)
            else:
                priority_groups['Medium'].append(tc)
        
        # Build test suites (ALWAYS THE SAME)
        test_suites = []
        execution_order = 1
        
        for priority_level in ['Critical', 'High', 'Medium', 'Low']:
            priority_tests = priority_groups[priority_level]
            if not priority_tests:
                continue
            
            # Sort alphabetically for consistency
            priority_tests.sort(key=lambda x: x.get('id', ''))
            
            test_suites.append({
                "suite_name": f"{priority_level} Priority Test Suite",
                "suite_type": f"regression_{priority_level.lower()}",
                "priority": priority_level.lower(),
                "description": f"All {priority_level} priority test cases for this release ({len(priority_tests)} tests)",
                "estimated_duration_minutes": len(priority_tests) * 4,
                "test_cases": [
                    {
                        "id": tc.get('id'),
                        "title": tc.get('title'),
                        "section": tc.get('section_hierarchy') or tc.get('section', 'General')
                    }
                    for tc in priority_tests
                ],
                "execution_order": execution_order,
                "parallel_execution": priority_level in ['Medium', 'Low'],
                "must_pass": priority_level in ['Critical', 'High']
            })
            execution_order += 1
        
        # Calculate metrics (DETERMINISTIC)
        total_duration = sum(suite['estimated_duration_minutes'] for suite in test_suites)
        
        tickets_with_tests = len([t for t in tickets if t.get('test_cases_count', 0) > 0])
        tickets_without_tests = len([t for t in tickets if t.get('test_cases_count', 0) == 0])
        
        stories = [t for t in tickets if t.get('issue_type', '').lower() not in ['bug', 'defect']]
        bugs = [t for t in tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]
        
        high_priority_tickets = [t for t in tickets if t.get('priority', '').lower() in ['critical', 'high']]
        
        # Determine risk level (RULE-BASED)
        if len(bugs) > 20 or len(high_priority_tickets) > 15:
            risk_level = "high"
        elif len(bugs) > 10 or len(high_priority_tickets) > 8:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Base test plan (DETERMINISTIC - always the same)
        test_plan = {
            "release_version": release_info.get('release_version', 'N/A'),
            "created_at": datetime.utcnow().isoformat(),
            "overall_risk_level": risk_level,
            "confidence_score": 1.0,  # 100% confidence because it's deterministic
            "ai_generated": False,
            "deterministic": True,
            "test_suites": test_suites,
            "coverage_analysis": {
                "tickets_with_tests": tickets_with_tests,
                "tickets_without_tests": tickets_without_tests,
                "test_coverage_percentage": round((tickets_with_tests / len(tickets) * 100), 1) if tickets else 0,
                "total_test_cases": len(test_cases),
                "critical_tests": len(priority_groups['Critical']),
                "high_tests": len(priority_groups['High']),
                "medium_tests": len(priority_groups['Medium']),
                "low_tests": len(priority_groups['Low']),
                "gaps_identified": [f"{tickets_without_tests} tickets lack test cases"] if tickets_without_tests > 0 else []
            },
            "execution_strategy": {
                "recommended_order": ["critical", "high", "medium", "low"],
                "total_estimated_duration_minutes": total_duration,
                "total_estimated_hours": round(total_duration / 60, 1),
                "parallel_execution_possible": True,
                "resource_requirements": f"{max(2, len(test_suites))} QA engineers recommended"
            }
        }
        
        # Use AI ONLY for risk assessment and recommendations (OPTIONAL)
        if use_ai_for_risk_analysis and self.llm_available:

            try:
                ai_insights = await self._generate_ai_risk_insights(tickets, test_cases, stories, bugs)
                test_plan.update({
                    "risk_assessment": ai_insights.get("risk_assessment", {}),
                    "recommendations": ai_insights.get("recommendations", []),
                    "new_test_scenarios_needed": ai_insights.get("new_test_scenarios_needed", []),
                    "risk_mitigation": ai_insights.get("risk_mitigation", {}),
                    "ai_insights_available": True
                })
            except Exception as e:

                test_plan.update({
                    "ai_insights_available": False
                })
        
        # Add fallback risk assessment if no AI
        if "risk_assessment" not in test_plan:
            test_plan["risk_assessment"] = {
                "high_risk_areas": [f"{len(bugs)} bugs in this release"] if bugs else ["No critical bugs identified"],
                "critical_concerns": [f"{len(high_priority_tickets)} high-priority tickets"] if high_priority_tickets else [],
                "bug_patterns": ["Manual review recommended"],
                "impact_summary": f"Release contains {len(tickets)} tickets ({len(stories)} stories, {len(bugs)} bugs) with {len(test_cases)} test cases"
            }
            test_plan["recommendations"] = [
                f"Execute {len(test_suites)} test suites in priority order",
                f"Total testing time: ~{round(total_duration / 60, 1)} hours",
                "Focus on Critical and High priority suites first",
                f"Add test cases for {tickets_without_tests} tickets without coverage" if tickets_without_tests > 0 else "Test coverage is good"
            ]
            test_plan["risk_mitigation"] = {
                "critical_scenarios": ["All critical priority tests must pass"],
                "fallback_strategies": ["Execute high-priority tests manually if automation fails"],
                "exploratory_testing_areas": ["Areas with bug fixes", "New features"]
            }
            test_plan["new_test_scenarios_needed"] = []
        
        
        return test_plan
    
    async def generate_regression_test_plan(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        release_info: Dict[str, Any],
        priority_focus: str = "all"
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive regression test plan
        
        Args:
            tickets: List of tickets (stories and bugs)
            test_cases: List of test cases from TestRail
            release_info: Release version and metadata
            priority_focus: "critical", "high", "medium", "low", or "all"
        
        Returns:
            Comprehensive test plan with suites, execution order, and risk analysis
        """
        
        # Prepare ticket summary
        stories = [t for t in tickets if t.get('issue_type', '').lower() not in ['bug', 'defect']]
        bugs = [t for t in tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]
        
        # Group tickets by module/area
        ticket_summary = self._generate_ticket_summary(stories, bugs)
        
        # Prepare test case summary
        test_case_summary = self._generate_test_case_summary(test_cases)
        
        # Build comprehensive prompt
        system_prompt = """You are an expert QA Test Planning Architect with deep expertise in:
- Regression test suite design
- Risk-based testing strategies
- Test case prioritization and optimization
- Release impact analysis
- Defect pattern recognition

Your task is to analyze tickets and test cases to create a comprehensive, intelligent test plan."""

        prompt = f"""
# Test Plan Generation Request

## Release Information
- **Release Version**: {release_info.get('release_version', 'N/A')}
- **Total Tickets**: {len(tickets)}
- **Stories**: {len(stories)}
- **Bugs**: {len(bugs)}
- **Available Test Cases**: {len(test_cases)}
- **Priority Focus**: {priority_focus}

## Ticket Analysis
{ticket_summary}

## Test Case Analysis
{test_case_summary}

## Your Task
Create a comprehensive regression test plan that includes:

1. **Risk Assessment**
   - Identify high-risk areas based on tickets
   - Analyze bug patterns and recurring issues
   - Assess impact of new features on existing functionality

2. **Test Suite Organization by Priority**
   CRITICAL REQUIREMENT: Include EVERY SINGLE test case in the appropriate priority suite.
   
   Create ONE suite per priority level. Do NOT create separate Smoke or Sanity suites.
   - **CRITICAL**: "Critical Priority Test Suite" - Include ALL Critical priority test cases (every single one listed)
   - **HIGH**: "High Priority Test Suite" - Include ALL High priority test cases (every single one listed)
   - **MEDIUM**: "Medium Priority Test Suite" - Include ALL Medium priority test cases (every single one listed)
   - **LOW**: "Low Priority Test Suite" - Include ALL Low priority test cases (every single one listed)
   
   Each suite should:
   - Include ALL test case IDs from the provided test case list for that priority
   - Include full test case details (id, title, section) not just IDs
   - Be named clearly with the priority level
   - Have realistic duration estimates: (number of test cases × 4 minutes)
   
3. **Test Selection Strategy**
   - Include ALL test case IDs provided in the Test Case Analysis section
   - Do NOT filter or reduce the test cases - include every single one
   - Group all test cases by their priority level
   - Map test cases to affected tickets when possible
   - Identify gaps in test coverage
   
4. **Execution Plan**
   - Order suites by priority: Critical → High → Medium → Low
   - Parallel vs sequential execution guidance
   - Estimated duration per suite (assume 3-5 minutes per test case)
   
5. **Risk Mitigation**
   - Critical test scenarios that must pass
   - Fallback strategies
   - Recommended exploratory testing areas

## Output Format
Return ONLY valid JSON in this exact structure:

{{
  "test_plan": {{
    "release_version": "{release_info.get('release_version', 'N/A')}",
    "created_at": "{datetime.utcnow().isoformat()}",
    "overall_risk_level": "low|medium|high|critical",
    "confidence_score": 0.85,
    "risk_assessment": {{
      "high_risk_areas": ["area1", "area2"],
      "critical_concerns": ["concern1", "concern2"],
      "bug_patterns": ["pattern1", "pattern2"],
      "impact_summary": "Overall impact description"
    }},
    "test_suites": [
      {{
        "suite_name": "Critical Priority Test Suite",
        "suite_type": "regression_critical",
        "priority": "critical",
        "description": "All Critical priority test cases - must pass before release",
        "estimated_duration_minutes": 90,
        "test_cases": [
          {{
            "id": "C123",
            "title": "Test case title here",
            "section": "Module > SubModule"
          }},
          {{
            "id": "C124",
            "title": "Another test case title",
            "section": "Module > SubModule"
          }}
        ],
        "execution_order": 1,
        "parallel_execution": true,
        "must_pass": true
      }},
      {{
        "suite_name": "High Priority Test Suite",
        "suite_type": "regression_high",
        "priority": "high",
        "description": "All High priority test cases",
        "estimated_duration_minutes": 120,
        "test_cases": [
          {{
            "id": "C200",
            "title": "High priority test case",
            "section": "Module > SubModule"
          }}
        ],
        "execution_order": 2,
        "parallel_execution": true,
        "must_pass": true
      }},
      {{
        "suite_name": "Medium Priority Test Suite",
        "suite_type": "regression_medium",
        "priority": "medium",
        "description": "All Medium priority test cases",
        "estimated_duration_minutes": 180,
        "test_cases": [
          {{
            "id": "C300",
            "title": "Medium priority test case",
            "section": "Module > SubModule"
          }}
        ],
        "execution_order": 3,
        "parallel_execution": true,
        "must_pass": false
      }},
      {{
        "suite_name": "Low Priority Test Suite",
        "suite_type": "regression_low",
        "priority": "low",
        "description": "All Low priority test cases",
        "estimated_duration_minutes": 60,
        "test_cases": [
          {{
            "id": "C400",
            "title": "Low priority test case",
            "section": "Module > SubModule"
          }}
        ],
        "execution_order": 4,
        "parallel_execution": true,
        "must_pass": false
      }}
    ],
    "coverage_analysis": {{
      "tickets_with_tests": 45,
      "tickets_without_tests": 5,
      "test_coverage_percentage": 90,
      "gaps_identified": ["gap1", "gap2"]
    }},
    "execution_strategy": {{
      "recommended_order": ["critical", "high", "medium", "low"],
      "total_estimated_duration_minutes": 450,
      "parallel_execution_possible": true,
      "resource_requirements": "3-5 QA engineers"
    }},
    "new_test_scenarios_needed": [
      {{
        "scenario": "Test scenario description",
        "priority": "high|medium|low",
        "reason": "Why this test is needed",
        "related_tickets": ["UCP-123"]
      }}
    ],
    "risk_mitigation": {{
      "critical_scenarios": ["scenario1", "scenario2"],
      "fallback_strategies": ["strategy1", "strategy2"],
      "exploratory_testing_areas": ["area1", "area2"]
    }},
    "recommendations": [
      "recommendation1",
      "recommendation2"
    ]
  }}
}}

IMPORTANT: Return ONLY the JSON structure above. No additional text, explanations, or markdown.
"""

        # Generate test plan
        response = await self._generate(prompt, system_prompt, temperature=0.2, max_tokens=4000)
        
        # Parse response
        result = self._extract_json(response)
        
        if result and 'test_plan' in result:
            return result['test_plan']
        
        # Fallback: Generate basic test plan
        return self._generate_fallback_test_plan(tickets, test_cases, release_info)
    
    def _generate_ticket_summary(self, stories: List[Dict], bugs: List[Dict]) -> str:
        """Generate a concise summary of tickets"""
        lines = []
        
        # Stories by priority
        lines.append("### Stories")
        for priority in ['Critical', 'High', 'Medium', 'Low']:
            priority_stories = [s for s in stories if s.get('priority', '').lower() == priority.lower()]
            if priority_stories:
                lines.append(f"- **{priority}**: {len(priority_stories)} stories")
                for story in priority_stories[:3]:  # Show first 3
                    lines.append(f"  - {story.get('issue_key')}: {story.get('summary', '')[:80]}")
                if len(priority_stories) > 3:
                    lines.append(f"  - ... and {len(priority_stories) - 3} more")
        
        # Bugs by priority
        lines.append("\n### Bugs")
        for priority in ['Critical', 'High', 'Medium', 'Low']:
            priority_bugs = [b for b in bugs if b.get('priority', '').lower() == priority.lower()]
            if priority_bugs:
                lines.append(f"- **{priority}**: {len(priority_bugs)} bugs")
                for bug in priority_bugs[:3]:
                    lines.append(f"  - {bug.get('issue_key')}: {bug.get('summary', '')[:80]}")
                if len(priority_bugs) > 3:
                    lines.append(f"  - ... and {len(priority_bugs) - 3} more")
        
        return "\n".join(lines)
    
    def _generate_test_case_summary(self, test_cases: List[Dict]) -> str:
        """Generate a detailed summary of test cases organized by priority"""
        lines = []
        
        # Group by priority
        priority_groups = {
            'Critical': [],
            'High': [],
            'Medium': [],
            'Low': []
        }
        
        for tc in test_cases:
            priority = tc.get('priority_label', 'Medium')
            if priority in priority_groups:
                priority_groups[priority].append(tc)
            else:
                priority_groups['Medium'].append(tc)
        
        lines.append("### Test Cases Organized by Priority")
        lines.append("")
        
        # Show test cases for each priority level
        for priority in ['Critical', 'High', 'Medium', 'Low']:
            test_list = priority_groups[priority]
            if test_list:
                lines.append(f"#### {priority} Priority ({len(test_list)} test cases)")
                
                # Show up to 8 test cases per priority
                for tc in test_list[:8]:
                    test_id = tc.get('id', 'N/A')
                    title = tc.get('title', 'Untitled')[:100]
                    section = tc.get('section_hierarchy') or tc.get('section', 'General')
                    lines.append(f"- **[{test_id}]** {title}")
                    lines.append(f"  📁 Section: {section}")
                
                if len(test_list) > 8:
                    lines.append(f"  ... and {len(test_list) - 8} more {priority.lower()} priority test cases")
                
                lines.append("")
        
        # Summary
        total = sum(len(tests) for tests in priority_groups.values())
        lines.append(f"**Total Available Test Cases: {total}**")
        
        return "\n".join(lines)
    
    def _generate_fallback_test_plan(
        self,
        tickets: List[Dict],
        test_cases: List[Dict],
        release_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a basic test plan when AI is unavailable"""
        
        # Categorize test cases by priority
        critical_tests = [tc for tc in test_cases if tc.get('priority_label', '').lower() == 'critical']
        high_tests = [tc for tc in test_cases if tc.get('priority_label', '').lower() == 'high']
        medium_tests = [tc for tc in test_cases if tc.get('priority_label', '').lower() == 'medium']
        low_tests = [tc for tc in test_cases if tc.get('priority_label', '').lower() == 'low']
        
        # Count high-risk tickets
        high_risk_tickets = [t for t in tickets if t.get('priority', '').lower() in ['critical', 'high']]
        
        # Build test suites by priority
        test_suites = []
        execution_order = 1
        
        # Critical Priority Test Suite (unified - no separate smoke suite)
        if critical_tests:
            test_suites.append({
                "suite_name": "Critical Priority Test Suite",
                "suite_type": "regression_critical",
                "priority": "critical",
                "description": f"All Critical priority test cases - must pass before release ({len(critical_tests)} tests)",
                "estimated_duration_minutes": len(critical_tests) * 4,
                "test_cases": [
                    {
                        "id": tc.get('id'),
                        "title": tc.get('title'),
                        "section": tc.get('section_hierarchy') or tc.get('section', 'General')
                    }
                    for tc in critical_tests
                ],
                "execution_order": execution_order,
                "parallel_execution": True,
                "must_pass": True
            })
            execution_order += 1
        
        # High Priority Test Suite
        if high_tests:
            test_suites.append({
                "suite_name": "High Priority Test Suite",
                "suite_type": "regression_high",
                "priority": "high",
                "description": f"All High priority test cases ({len(high_tests)} tests)",
                "estimated_duration_minutes": len(high_tests) * 4,
                "test_cases": [
                    {
                        "id": tc.get('id'),
                        "title": tc.get('title'),
                        "section": tc.get('section_hierarchy') or tc.get('section', 'General')
                    }
                    for tc in high_tests
                ],
                "execution_order": execution_order,
                "parallel_execution": True,
                "must_pass": True
            })
            execution_order += 1
        
        # Medium Priority Test Suite
        if medium_tests:
            test_suites.append({
                "suite_name": "Medium Priority Test Suite",
                "suite_type": "regression_medium",
                "priority": "medium",
                "description": f"All Medium priority test cases ({len(medium_tests)} tests)",
                "estimated_duration_minutes": len(medium_tests) * 4,
                "test_cases": [
                    {
                        "id": tc.get('id'),
                        "title": tc.get('title'),
                        "section": tc.get('section_hierarchy') or tc.get('section', 'General')
                    }
                    for tc in medium_tests
                ],
                "execution_order": execution_order,
                "parallel_execution": True,
                "must_pass": False
            })
            execution_order += 1
        
        # Low Priority Test Suite
        if low_tests:
            test_suites.append({
                "suite_name": "Low Priority Test Suite",
                "suite_type": "regression_low",
                "priority": "low",
                "description": f"All Low priority test cases ({len(low_tests)} tests)",
                "estimated_duration_minutes": len(low_tests) * 4,
                "test_cases": [
                    {
                        "id": tc.get('id'),
                        "title": tc.get('title'),
                        "section": tc.get('section_hierarchy') or tc.get('section', 'General')
                    }
                    for tc in low_tests
                ],
                "execution_order": execution_order,
                "parallel_execution": True,
                "must_pass": False
            })
        
        total_duration = sum(suite['estimated_duration_minutes'] for suite in test_suites)
        
        return {
            "release_version": release_info.get('release_version', 'N/A'),
            "created_at": datetime.utcnow().isoformat(),
            "overall_risk_level": "high" if len(high_risk_tickets) > 10 else "medium",
            "confidence_score": 0.6,
            "ai_generated": False,
            "risk_assessment": {
                "high_risk_areas": ["Feature areas with high priority tickets"],
                "critical_concerns": [f"{len(high_risk_tickets)} high-priority tickets require thorough testing"],
                "bug_patterns": ["AI service unavailable for detailed analysis"],
                "impact_summary": f"Release contains {len(tickets)} tickets affecting multiple areas"
            },
            "test_suites": test_suites,
            "coverage_analysis": {
                "tickets_with_tests": len([t for t in tickets if t.get('test_cases_count', 0) > 0]),
                "tickets_without_tests": len([t for t in tickets if t.get('test_cases_count', 0) == 0]),
                "test_coverage_percentage": round(len([t for t in tickets if t.get('test_cases_count', 0) > 0]) / len(tickets) * 100, 1) if tickets else 0,
                "gaps_identified": ["AI service unavailable for gap analysis"]
            },
            "execution_strategy": {
                "recommended_order": ["critical", "high", "medium", "low"],
                "total_estimated_duration_minutes": total_duration,
                "parallel_execution_possible": True,
                "resource_requirements": "3-5 QA engineers"
            },
            "new_test_scenarios_needed": [
                {
                    "scenario": "Review tickets without test coverage",
                    "priority": "high",
                    "reason": "Some tickets lack associated test cases",
                    "related_tickets": []
                }
            ],
            "risk_mitigation": {
                "critical_scenarios": ["Verify all critical path functionality"],
                "fallback_strategies": ["Manual exploratory testing for high-risk areas"],
                "exploratory_testing_areas": ["New features", "Bug fix areas"]
            },
            "recommendations": [
                "Enable AI service (Ollama/Llama) for detailed test plan generation",
                "Execute test suites in priority order: Critical → High → Medium → Low",
                f"Total estimated testing time: {total_duration} minutes ({total_duration // 60} hours)",
                "Add test cases for tickets without coverage",
                "Consider parallel execution for faster results"
            ]
        }
    
    async def analyze_test_coverage_gaps(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze gaps in test coverage"""
        
        # Find tickets without tests
        tickets_without_tests = [
            t for t in tickets 
            if t.get('test_cases_count', 0) == 0 and 
            t.get('issue_type', '').lower() not in ['bug', 'defect']
        ]
        
        if not tickets_without_tests:
            return {
                "gaps_found": False,
                "message": "All stories have associated test cases",
                "recommendations": []
            }
        
        # Generate gap analysis
        prompt = f"""
Analyze test coverage gaps for the following tickets:

{chr(10).join([f"- {t.get('issue_key')}: {t.get('summary', '')}" for t in tickets_without_tests[:20]])}

Provide:
1. Why test cases might be missing
2. Recommended test scenarios for each ticket
3. Priority for creating these tests

Return ONLY valid JSON:
{{
  "gaps_found": true,
  "total_gaps": {len(tickets_without_tests)},
  "gap_analysis": [
    {{
      "ticket_key": "UCP-123",
      "ticket_summary": "Summary",
      "reason_for_gap": "Why tests are missing",
      "recommended_tests": ["test1", "test2"],
      "priority": "high|medium|low"
    }}
  ],
  "overall_recommendations": ["recommendation1", "recommendation2"]
}}
"""
        
        response = await self._generate(prompt, temperature=0.2, max_tokens=2000)
        result = self._extract_json(response)
        
        if result:
            return result
        
        # Fallback
        return {
            "gaps_found": True,
            "total_gaps": len(tickets_without_tests),
            "gap_analysis": [
                {
                    "ticket_key": t.get('issue_key'),
                    "ticket_summary": t.get('summary', ''),
                    "reason_for_gap": "No test cases linked",
                    "recommended_tests": ["Create functional tests", "Create regression tests"],
                    "priority": "high" if t.get('priority', '').lower() in ['critical', 'high'] else "medium"
                }
                for t in tickets_without_tests[:10]
            ],
            "overall_recommendations": [
                "Create test cases for all high-priority tickets",
                "Review test coverage before release"
            ]
        }

# Singleton instance
test_plan_ai_service = TestPlanAIService()
