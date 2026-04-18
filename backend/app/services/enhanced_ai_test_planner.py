"""
Enhanced AI-Powered Test Plan Generator
Combines deterministic selection with optional AI insights for large datasets
"""

from typing import List, Dict, Any, Optional
from app.services.regression_test_selector import generate_regression_test_plan
from app.services.test_plan_ai_service import TestPlanAIService
import asyncio


class EnhancedAITestPlanGenerator:
    """
    Hybrid approach: Deterministic selection + AI insights
    
    This solves the AI token limit problem by:
    1. Using deterministic algorithm for test selection (handles unlimited tests)
    2. Using AI only for risk analysis on summarized data
    """
    
    def __init__(self):
        self.ai_service = TestPlanAIService()
    
    async def generate_comprehensive_test_plan(
        self,
        release_tickets: List[Dict[str, Any]],
        impacted_modules: List[str],
        available_test_cases: List[Dict[str, Any]],
        historical_failures: Optional[Dict[str, int]] = None,
        use_ai_insights: bool = True
    ) -> Dict[str, Any]:
        """
        Generate test plan with unlimited test cases support.
        
        Works with ANY dataset size:
        - 10 tickets or 10,000 tickets
        - 100 test cases or 100,000 test cases
        
        Args:
            release_tickets: ALL release tickets (unlimited)
            impacted_modules: ALL impacted modules (unlimited)
            available_test_cases: ALL test cases (unlimited)
            historical_failures: Optional failure history
            use_ai_insights: Whether to add AI risk analysis
            
        Returns:
            Complete test plan with ALL tests selected and optional AI insights
        """
        
        # STEP 1: Deterministic selection (handles unlimited data)
        
        base_test_plan = generate_regression_test_plan(
            release_tickets=release_tickets,
            impacted_modules=impacted_modules,
            available_test_cases=available_test_cases,
            historical_failures=historical_failures
        )
        
        
        # STEP 2: Optional AI insights (on summarized data only)
        if use_ai_insights and self.ai_service.llm_available:
            
            ai_insights = await self._generate_ai_insights(
                release_tickets,
                available_test_cases,
                base_test_plan
            )
            
            base_test_plan['ai_insights'] = ai_insights
            base_test_plan['ai_enhanced'] = True
        else:
            base_test_plan['ai_enhanced'] = False
        
        return base_test_plan
    
    async def _generate_ai_insights(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        base_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI insights on SUMMARIZED data (fits within token limits)
        """
        
        # Summarize data for AI (keep within token limits)
        summary = self._create_ai_friendly_summary(tickets, test_cases, base_plan)
        
        # Build prompt (much smaller than full data)
        prompt = f"""
# Risk Analysis Request

## Release Summary
- Total Tickets: {summary['total_tickets']}
- Critical/High Priority: {summary['high_priority_count']}
- Bugs: {summary['bug_count']}
- Test Cases Available: {summary['total_test_cases']}
- Test Cases Selected: {summary['tests_selected']}
- Coverage: {summary['coverage_percentage']}%

## High-Risk Areas Identified (Algorithmic)
{self._format_list(summary['high_risk_modules'])}

## Tickets by Module (Top 5 modules)
{self._format_module_summary(summary['tickets_by_module'])}

## Test Selection Summary
- Critical (P0): {summary['critical_selected']} tests
- High (P1): {summary['high_selected']} tests  
- Medium (P2): {summary['medium_selected']} tests
- Low (P3): {summary['low_selected']} tests

## Coverage Gaps
{self._format_list(summary['coverage_gaps'])}

## Your Task
Provide strategic risk insights:

1. **Release Risk Level**: Overall risk (Low/Medium/High/Critical)
2. **Key Concerns**: Top 3-5 risk factors
3. **Testing Focus Areas**: Where to focus QA effort
4. **Mitigation Strategies**: Specific actions to reduce risk
5. **Additional Tests Needed**: Suggest new test scenarios

Return ONLY valid JSON:
{{
  "risk_level": "low|medium|high|critical",
  "confidence": 0.85,
  "key_concerns": ["concern1", "concern2"],
  "testing_focus": ["area1", "area2"],
  "mitigation_strategies": [
    {{"action": "what to do", "reason": "why", "priority": "high|medium"}}
  ],
  "additional_tests_recommended": [
    {{"scenario": "test description", "priority": "high|medium", "module": "module_name"}}
  ],
  "quality_gates": ["gate1", "gate2"],
  "execution_recommendations": ["rec1", "rec2"]
}}
"""
        
        system_prompt = "You are an expert QA risk analyst. Analyze release risk and provide strategic testing guidance."
        
        try:
            response = await self.ai_service._generate(
                prompt, 
                system_prompt, 
                temperature=0.3,
                max_tokens=2000  # Smaller output, just insights
            )
            
            result = self.ai_service._extract_json(response)
            if result:
                return result
        except Exception:
            pass

        # Fallback: Basic insights
        return self._generate_fallback_insights(summary)
    
    def _create_ai_friendly_summary(
        self,
        tickets: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        base_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a concise summary that fits within AI token limits"""
        
        # Categorize tickets
        bugs = [t for t in tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]
        high_priority = [t for t in tickets if t.get('priority', '').lower() in ['critical', 'high']]
        
        # Group tickets by module (top 5 only)
        tickets_by_module = {}
        for ticket in tickets:
            module = ticket.get('module', 'unknown')
            if module not in tickets_by_module:
                tickets_by_module[module] = []
            tickets_by_module[module].append(ticket)
        
        # Sort by count and take top 5
        top_modules = dict(sorted(
            tickets_by_module.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )[:5])
        
        # Extract high-risk modules from base plan
        coverage = base_plan.get('coverage_report', {})
        high_risk_modules = [
            module for module, data in coverage.get('module_coverage', {}).items()
            if not data.get('covered', False)
        ]
        
        return {
            'total_tickets': len(tickets),
            'bug_count': len(bugs),
            'high_priority_count': len(high_priority),
            'total_test_cases': len(test_cases),
            'tests_selected': base_plan['summary']['total_selected'],
            'coverage_percentage': base_plan['summary']['coverage_percentage'],
            'critical_selected': len(base_plan['selected_test_cases'].get('P0_Critical', [])),
            'high_selected': len(base_plan['selected_test_cases'].get('P1_High', [])),
            'medium_selected': len(base_plan['selected_test_cases'].get('P2_Medium', [])),
            'low_selected': len(base_plan['selected_test_cases'].get('P3_Low', [])),
            'tickets_by_module': {
                module: {
                    'count': len(tix),
                    'bugs': len([t for t in tix if t.get('issue_type', '').lower() in ['bug', 'defect']]),
                    'high_priority': len([t for t in tix if t.get('priority', '').lower() in ['critical', 'high']])
                }
                for module, tix in top_modules.items()
            },
            'high_risk_modules': high_risk_modules,
            'coverage_gaps': base_plan['gaps_and_recommendations'].get('identified_gaps', [])
        }
    
    def _format_list(self, items: List[str]) -> str:
        """Format list for prompt"""
        if not items:
            return "- None"
        return "\n".join([f"- {item}" for item in items[:10]])
    
    def _format_module_summary(self, modules: Dict[str, Dict]) -> str:
        """Format module summary for prompt"""
        lines = []
        for module, data in modules.items():
            lines.append(f"- **{module}**: {data['count']} tickets ({data['bugs']} bugs, {data['high_priority']} high-priority)")
        return "\n".join(lines) if lines else "- No module data"
    
    def _generate_fallback_insights(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic insights without AI"""
        
        # Determine risk level
        if summary['bug_count'] > 20 or summary['high_priority_count'] > 15:
            risk_level = "high"
        elif summary['bug_count'] > 10 or summary['high_priority_count'] > 8:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            'risk_level': risk_level,
            'confidence': 0.7,
            'key_concerns': [
                f"{summary['bug_count']} bugs in this release",
                f"{summary['high_priority_count']} high-priority changes",
                f"Selected {summary['tests_selected']} of {summary['total_test_cases']} available tests"
            ],
            'testing_focus': [
                "Execute Critical (P0) tests first",
                "Focus on modules with bugs",
                "Verify high-priority changes thoroughly"
            ],
            'mitigation_strategies': [
                {
                    'action': "Execute all Critical and High priority tests",
                    'reason': "Ensure core functionality works",
                    'priority': "high"
                },
                {
                    'action': "Add smoke tests for new features",
                    'reason': "Quick validation of basic functionality",
                    'priority': "medium"
                }
            ],
            'additional_tests_recommended': [],
            'quality_gates': [
                "All P0 tests must pass",
                "No Critical/High bugs in production"
            ],
            'execution_recommendations': [
                f"Execute tests in priority order: P0 → P1 → P2 → P3",
                f"Estimated duration: {summary['tests_selected'] * 4 // 60} hours",
                "Consider parallel execution for faster results"
            ],
            'ai_generated': False
        }


# Convenience function
async def generate_ai_enhanced_test_plan(
    release_tickets: List[Dict[str, Any]],
    impacted_modules: List[str],
    available_test_cases: List[Dict[str, Any]],
    historical_failures: Optional[Dict[str, int]] = None,
    use_ai_insights: bool = True
) -> Dict[str, Any]:
    """
    Generate comprehensive test plan with unlimited data support.
    
    Example:
        # Works with ANY dataset size
        plan = await generate_ai_enhanced_test_plan(
            release_tickets=all_1000_tickets,      # Can be unlimited
            impacted_modules=all_50_modules,       # Can be unlimited  
            available_test_cases=all_10000_tests,  # Can be unlimited
            use_ai_insights=True                   # Optional AI analysis
        )
        
        # Returns ALL selected tests (not truncated)
        
        # Plus AI insights
        if plan['ai_enhanced']:
    """
    generator = EnhancedAITestPlanGenerator()
    return await generator.generate_comprehensive_test_plan(
        release_tickets,
        impacted_modules,
        available_test_cases,
        historical_failures,
        use_ai_insights
    )
