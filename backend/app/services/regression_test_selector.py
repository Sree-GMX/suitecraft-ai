"""
Regression Test Suite Selector with Risk-Based Analysis
Implements strict selection rules for comprehensive test coverage
"""

from typing import List, Dict, Any, Set, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass(frozen=True)
class TestCase:
    """Test case with metadata"""
    id: str
    title: str
    priority: str  # P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
    module: str
    section: str = ""
    historical_failures: int = 0
    last_failed: str = ""
    dependencies: Tuple[str, ...] = field(default_factory=tuple)
    tags: Tuple[str, ...] = field(default_factory=tuple)
    estimated_duration_min: int = 4
    
    @property
    def priority_numeric(self) -> int:
        """Convert priority to numeric value for sorting"""
        priority_map = {
            'P0': 0, 'Critical': 0,
            'P1': 1, 'High': 1,
            'P2': 2, 'Medium': 2,
            'P3': 3, 'Low': 3
        }
        return priority_map.get(self.priority, 2)


@dataclass(frozen=True)
class ReleaseTicket:
    """Release ticket/change"""
    id: str
    summary: str
    issue_type: str  # Story, Bug, Task, etc.
    priority: str
    module: str
    components: Tuple[str, ...] = field(default_factory=tuple)
    labels: Tuple[str, ...] = field(default_factory=tuple)


@dataclass
class RiskScore:
    """Risk assessment for a test case"""
    test_case_id: str
    score: float  # 0-100
    risk_level: str  # High, Medium, Low
    reasons: List[str] = field(default_factory=list)
    
    @staticmethod
    def calculate_risk_level(score: float) -> str:
        """Determine risk level from score"""
        if score >= 70:
            return "High"
        elif score >= 40:
            return "Medium"
        else:
            return "Low"


class RegressionTestSelector:
    """
    Intelligent regression test suite selector using risk-based analysis.
    
    Implements strict selection rules:
    - Minimum 20% of total test cases OR 100 test cases (whichever is higher)
    - ALL P0 (Critical) test cases MUST be included
    - ALL P1 (High) test cases related to impacted modules MUST be included
    - Coverage of ALL impacted modules
    - Integration and end-to-end flows
    """
    
    def __init__(self):
        self.selected_tests: List[TestCase] = []
        self.risk_scores: Dict[str, RiskScore] = {}
        self.impacted_modules: Set[str] = set()
        self.coverage_map: Dict[str, List[str]] = defaultdict(list)
        
    def select_regression_suite(
        self,
        release_tickets: List[Dict[str, Any]],
        impacted_modules: List[str],
        available_test_cases: List[Dict[str, Any]],
        historical_failures: Dict[str, int] = None
    ) -> Dict[str, Any]:
        """
        Select regression test suite using risk-based analysis.
        
        Args:
            release_tickets: List of release tickets/changes
            impacted_modules: List of impacted modules/components
            available_test_cases: All available test cases with metadata
            historical_failures: Optional dict mapping test_id -> failure_count
            
        Returns:
            Comprehensive test plan with selected test cases, coverage analysis, and risk justification
        """
        
        # Parse input data
        tickets = self._parse_tickets(release_tickets)
        self.impacted_modules = set(impacted_modules)
        test_cases = self._parse_test_cases(available_test_cases, historical_failures or {})
        
        # Calculate minimum required test cases
        total_tests = len(test_cases)
        min_required = self._calculate_min_required(total_tests)
        
        # Step 1: Calculate risk scores for all test cases
        self._calculate_risk_scores(test_cases, tickets)
        
        # Step 2: Mandatory selection (P0 + P1 in impacted modules)
        mandatory_tests = self._select_mandatory_tests(test_cases)
        
        # Step 3: Select additional tests to meet minimum requirements and coverage
        additional_tests = self._select_additional_tests(
            test_cases,
            mandatory_tests,
            min_required
        )
        
        # Step 4: Ensure integration and E2E coverage
        integration_tests = self._select_integration_tests(test_cases, mandatory_tests, additional_tests)
        
        # Combine all selected tests
        self.selected_tests = list(set(mandatory_tests + additional_tests + integration_tests))
        
        # Step 5: Verify minimum requirements
        if len(self.selected_tests) < min_required:
            # Add more tests based on risk scores
            self.selected_tests = self._expand_selection(
                test_cases,
                self.selected_tests,
                min_required
            )
        
        # Step 6: Build coverage map
        self._build_coverage_map(self.selected_tests)
        
        # Step 7: Generate comprehensive report
        return self._generate_report(
            tickets,
            test_cases,
            total_tests,
            min_required
        )

    def _calculate_min_required(self, total_tests: int) -> int:
        """
        Determine the minimum suite size without exceeding available inventory.

        Small datasets should still be able to satisfy the requirement when every
        available test is selected.
        """
        if total_tests <= 0:
            return 0
        return min(total_tests, max(int(total_tests * 0.20), 100))
    
    def _parse_tickets(self, raw_tickets: List[Dict[str, Any]]) -> List[ReleaseTicket]:
        """Parse raw ticket data into ReleaseTicket objects"""
        tickets = []
        for t in raw_tickets:
            ticket = ReleaseTicket(
                id=t.get('issue_key', t.get('id', 'UNKNOWN')),
                summary=t.get('summary', ''),
                issue_type=t.get('issue_type', 'Story'),
                priority=t.get('priority', 'Medium'),
                module=t.get('module', self._infer_module_from_summary(t.get('summary', ''))),
                components=tuple(t.get('components', [])),
                labels=tuple(t.get('labels', []))
            )
            tickets.append(ticket)
        return tickets
    
    def _parse_test_cases(
        self,
        raw_tests: List[Dict[str, Any]],
        historical_failures: Dict[str, int]
    ) -> List[TestCase]:
        """Parse raw test case data into TestCase objects"""
        test_cases = []
        for tc in raw_tests:
            test_id = tc.get('id', tc.get('case_id', 'UNKNOWN'))
            test_case = TestCase(
                id=test_id,
                title=tc.get('title', tc.get('name', '')),
                priority=self._normalize_priority(tc.get('priority', tc.get('priority_label', 'Medium'))),
                module=tc.get('module', tc.get('section', 'General')),
                section=tc.get('section_hierarchy', tc.get('section', '')),
                historical_failures=historical_failures.get(test_id, 0),
                last_failed=tc.get('last_failed', ''),
                dependencies=tuple(tc.get('dependencies', [])),
                tags=tuple(tc.get('tags', [])),
                estimated_duration_min=tc.get('estimated_duration', 4)
            )
            test_cases.append(test_case)
        return test_cases
    
    def _normalize_priority(self, priority: str) -> str:
        """Normalize priority labels to P0/P1/P2/P3 format"""
        priority_lower = str(priority).lower()
        if 'critical' in priority_lower or 'p0' in priority_lower:
            return 'P0'
        elif 'high' in priority_lower or 'p1' in priority_lower:
            return 'P1'
        elif 'medium' in priority_lower or 'p2' in priority_lower:
            return 'P2'
        elif 'low' in priority_lower or 'p3' in priority_lower:
            return 'P3'
        return 'P2'  # Default to Medium
    
    def _infer_module_from_summary(self, summary: str) -> str:
        """Infer module from ticket summary using keywords"""
        summary_lower = summary.lower()
        
        # Common module patterns
        module_keywords = {
            'auth': ['login', 'authentication', 'auth', 'password', 'session'],
            'payment': ['payment', 'checkout', 'billing', 'invoice'],
            'user': ['user', 'profile', 'account'],
            'api': ['api', 'endpoint', 'service'],
            'ui': ['ui', 'frontend', 'interface', 'page', 'screen'],
            'database': ['database', 'db', 'migration', 'schema'],
            'notification': ['notification', 'email', 'alert', 'message'],
            'report': ['report', 'dashboard', 'analytics', 'export'],
        }
        
        for module, keywords in module_keywords.items():
            if any(kw in summary_lower for kw in keywords):
                return module
        
        return 'general'
    
    def _calculate_risk_scores(
        self,
        test_cases: List[TestCase],
        tickets: List[ReleaseTicket]
    ):
        """Calculate risk score for each test case"""
        
        # Build impacted areas from tickets
        ticket_modules = set(t.module for t in tickets)
        bug_modules = set(t.module for t in tickets if t.issue_type.lower() == 'bug')
        high_priority_modules = set(t.module for t in tickets if t.priority.lower() in ['critical', 'high'])
        
        for tc in test_cases:
            score = 0.0
            reasons = []
            
            # Factor 1: Priority (30 points max)
            priority_scores = {'P0': 30, 'P1': 25, 'P2': 15, 'P3': 5}
            priority_score = priority_scores.get(tc.priority, 15)
            score += priority_score
            if tc.priority in ['P0', 'P1']:
                reasons.append(f"{tc.priority} priority test")
            
            # Factor 2: Module impact (25 points max)
            if tc.module in self.impacted_modules:
                score += 25
                reasons.append(f"Module '{tc.module}' directly impacted")
            elif tc.module in ticket_modules:
                score += 15
                reasons.append(f"Module '{tc.module}' has changes")
            
            # Factor 3: Historical failures (20 points max)
            if tc.historical_failures > 5:
                score += 20
                reasons.append(f"High failure rate ({tc.historical_failures} failures)")
            elif tc.historical_failures > 2:
                score += 10
                reasons.append(f"Moderate failure history ({tc.historical_failures} failures)")
            
            # Factor 4: Bug-prone areas (15 points max)
            if tc.module in bug_modules:
                score += 15
                reasons.append(f"Module has bugs in this release")
            
            # Factor 5: Business criticality (10 points max)
            critical_tags = ['critical', 'smoke', 'sanity', 'e2e', 'integration']
            if any(tag.lower() in critical_tags for tag in tc.tags):
                score += 10
                reasons.append("Business critical test")
            
            # Factor 6: High-priority change areas (extra 5 points)
            if tc.module in high_priority_modules:
                score += 5
                reasons.append("High-priority changes in module")
            
            # Cap score at 100
            score = min(score, 100)
            
            risk_level = RiskScore.calculate_risk_level(score)
            
            self.risk_scores[tc.id] = RiskScore(
                test_case_id=tc.id,
                score=score,
                risk_level=risk_level,
                reasons=reasons
            )
    
    def _select_mandatory_tests(self, test_cases: List[TestCase]) -> List[TestCase]:
        """Select mandatory test cases (ALL P0 + ALL P1 in impacted modules)"""
        mandatory = []
        
        for tc in test_cases:
            # ALL P0 tests are mandatory
            if tc.priority == 'P0':
                mandatory.append(tc)
            # ALL P1 tests in impacted modules
            elif tc.priority == 'P1' and tc.module in self.impacted_modules:
                mandatory.append(tc)
        
        return mandatory
    
    def _select_additional_tests(
        self,
        all_tests: List[TestCase],
        already_selected: List[TestCase],
        min_required: int
    ) -> List[TestCase]:
        """Select additional tests to meet minimum requirements and ensure module coverage"""
        
        selected_ids = {tc.id for tc in already_selected}
        additional = []
        
        # Get remaining tests sorted by risk score (descending)
        remaining_tests = [tc for tc in all_tests if tc.id not in selected_ids]
        remaining_tests.sort(key=lambda tc: self.risk_scores[tc.id].score, reverse=True)
        
        # First pass: Ensure each impacted module has coverage
        for module in self.impacted_modules:
            module_tests = [tc for tc in remaining_tests if tc.module == module]
            if module_tests:
                # Take top 3 highest risk tests per impacted module
                for tc in module_tests[:3]:
                    if tc not in additional:
                        additional.append(tc)
                        selected_ids.add(tc.id)
        
        # Second pass: Add high-risk tests until minimum is met
        current_count = len(already_selected) + len(additional)
        for tc in remaining_tests:
            if current_count >= min_required:
                break
            if tc.id not in selected_ids:
                additional.append(tc)
                selected_ids.add(tc.id)
                current_count += 1
        
        return additional
    
    def _select_integration_tests(
        self,
        all_tests: List[TestCase],
        mandatory: List[TestCase],
        additional: List[TestCase]
    ) -> List[TestCase]:
        """Select integration and E2E tests"""
        
        selected_ids = {tc.id for tc in mandatory + additional}
        integration_tests = []
        
        # Look for integration and E2E tests
        integration_keywords = ['integration', 'e2e', 'end-to-end', 'workflow', 'flow']
        
        for tc in all_tests:
            if tc.id in selected_ids:
                continue
            
            # Check if test is integration/E2E
            is_integration = (
                any(keyword in tc.title.lower() for keyword in integration_keywords) or
                any(keyword in tc.tags for keyword in integration_keywords) or
                len(tc.dependencies) > 0  # Tests with dependencies are likely integration tests
            )
            
            if is_integration:
                integration_tests.append(tc)
        
        # Take top 15% of integration tests by risk score
        integration_tests.sort(key=lambda tc: self.risk_scores[tc.id].score, reverse=True)
        return integration_tests[:max(len(integration_tests) // 7, 5)]
    
    def _expand_selection(
        self,
        all_tests: List[TestCase],
        current_selection: List[TestCase],
        min_required: int
    ) -> List[TestCase]:
        """Expand selection to meet minimum requirements"""
        
        selected_ids = {tc.id for tc in current_selection}
        expanded = list(current_selection)
        
        # Get remaining tests sorted by risk
        remaining = [tc for tc in all_tests if tc.id not in selected_ids]
        remaining.sort(key=lambda tc: self.risk_scores[tc.id].score, reverse=True)
        
        # Add tests until minimum is met
        for tc in remaining:
            if len(expanded) >= min_required:
                break
            expanded.append(tc)
        
        return expanded
    
    def _build_coverage_map(self, selected_tests: List[TestCase]):
        """Build coverage map showing which modules are covered"""
        self.coverage_map.clear()
        for tc in selected_tests:
            self.coverage_map[tc.module].append(tc.id)
    
    def _generate_report(
        self,
        tickets: List[ReleaseTicket],
        all_test_cases: List[TestCase],
        total_tests: int,
        min_required: int
    ) -> Dict[str, Any]:
        """Generate comprehensive regression test plan report"""
        
        # Group selected tests by priority
        selected_by_priority = {
            'P0': [],
            'P1': [],
            'P2': [],
            'P3': []
        }
        
        for tc in self.selected_tests:
            selected_by_priority[tc.priority].append(tc.id)
        
        # Calculate coverage percentages
        total_selected = len(self.selected_tests)
        coverage_percentage = round((total_selected / total_tests * 100), 1)
        
        # Module coverage analysis
        module_coverage = {}
        for module in self.impacted_modules:
            test_ids = self.coverage_map.get(module, [])
            module_coverage[module] = {
                'covered': len(test_ids) > 0,
                'test_count': len(test_ids),
                'test_ids': test_ids
            }
        
        # Risk distribution
        risk_distribution = {'High': 0, 'Medium': 0, 'Low': 0}
        for tc in self.selected_tests:
            risk_level = self.risk_scores[tc.id].risk_level
            risk_distribution[risk_level] += 1
        
        # Identify gaps
        gaps = []
        for module in self.impacted_modules:
            if not module_coverage.get(module, {}).get('covered'):
                gaps.append(f"Module '{module}' has no test coverage")
        
        # Calculate estimated duration
        total_duration = sum(tc.estimated_duration_min for tc in self.selected_tests)
        
        # Build detailed test case list
        detailed_tests = {}
        for priority in ['P0', 'P1', 'P2', 'P3']:
            detailed_tests[priority] = [
                {
                    'id': tc.id,
                    'title': tc.title,
                    'module': tc.module,
                    'section': tc.section,
                    'risk_score': round(self.risk_scores[tc.id].score, 1),
                    'risk_level': self.risk_scores[tc.id].risk_level,
                    'risk_reasons': self.risk_scores[tc.id].reasons,
                    'historical_failures': tc.historical_failures
                }
                for tc in self.selected_tests if tc.priority == priority
            ]
        
        # Generate recommendations
        recommendations = self._generate_recommendations(tickets, gaps)
        
        # Generate risk justification
        risk_justification = self._generate_risk_justification(tickets)
        
        return {
            'summary': {
                'total_available': total_tests,
                'total_selected': total_selected,
                'minimum_required': min_required,
                'coverage_percentage': coverage_percentage,
                'selection_meets_requirements': total_selected >= min_required,
                'impacted_modules_count': len(self.impacted_modules),
                'fully_covered_modules': sum(1 for m in module_coverage.values() if m['covered']),
                'estimated_duration_hours': round(total_duration / 60, 1),
                'generation_timestamp': datetime.utcnow().isoformat()
            },
            'selected_test_cases': {
                'P0_Critical': selected_by_priority['P0'],
                'P1_High': selected_by_priority['P1'],
                'P2_Medium': selected_by_priority['P2'],
                'P3_Low': selected_by_priority['P3'],
                'detailed_by_priority': detailed_tests
            },
            'coverage_report': {
                'impacted_modules': list(self.impacted_modules),
                'module_coverage': module_coverage,
                'risk_distribution': risk_distribution
            },
            'risk_justification': risk_justification,
            'gaps_and_recommendations': {
                'identified_gaps': gaps,
                'recommendations': recommendations,
                'new_test_scenarios_needed': self._suggest_new_tests(tickets, gaps)
            },
            'execution_strategy': {
                'recommended_order': ['P0', 'P1', 'P2', 'P3'],
                'total_estimated_duration_minutes': total_duration,
                'total_estimated_hours': round(total_duration / 60, 1),
                'parallel_execution_recommended': total_duration > 480,  # > 8 hours
                'suggested_resources': max(2, min(6, total_selected // 50))
            }
        }
    
    def _generate_recommendations(
        self,
        tickets: List[ReleaseTicket],
        gaps: List[str]
    ) -> List[str]:
        """Generate testing recommendations"""
        recommendations = []
        
        # Priority-based recommendations
        recommendations.append("Execute test cases in priority order: P0 → P1 → P2 → P3")
        
        # Bug-related recommendations
        bug_count = sum(1 for t in tickets if t.issue_type.lower() == 'bug')
        if bug_count > 10:
            recommendations.append(f"High bug count ({bug_count} bugs) - increase focus on defect verification")
        
        # Coverage gaps
        if gaps:
            recommendations.append(f"Address {len(gaps)} coverage gaps before release")
        
        # Module-specific
        if len(self.impacted_modules) > 5:
            recommendations.append("Large surface area impacted - consider staged release approach")
        
        # Historical failures
        high_failure_tests = [
            tc for tc in self.selected_tests if tc.historical_failures > 3
        ]
        if high_failure_tests:
            recommendations.append(f"Monitor {len(high_failure_tests)} historically unstable tests closely")
        
        return recommendations
    
    def _generate_risk_justification(self, tickets: List[ReleaseTicket]) -> Dict[str, Any]:
        """Generate risk-based justification for test selection"""
        
        # Categorize tickets
        bugs = [t for t in tickets if t.issue_type.lower() == 'bug']
        high_priority = [t for t in tickets if t.priority.lower() in ['critical', 'high']]
        
        # Count tests by risk
        high_risk_count = sum(1 for tc in self.selected_tests 
                             if self.risk_scores[tc.id].risk_level == 'High')
        
        return {
            'selection_criteria': [
                'ALL P0 (Critical) test cases included (mandatory)',
                'ALL P1 (High) test cases in impacted modules included (mandatory)',
                'Risk-based selection for remaining test cases',
                'Minimum 20% coverage or 100 test cases enforced',
                'Integration and E2E test coverage ensured'
            ],
            'risk_factors_considered': [
                'Test case priority level',
                'Module impact from release changes',
                'Historical failure rates',
                'Bug-prone areas in this release',
                'Business criticality',
                'Integration and dependency complexity'
            ],
            'release_risk_indicators': {
                'total_tickets': len(tickets),
                'bug_count': len(bugs),
                'high_priority_changes': len(high_priority),
                'impacted_modules': len(self.impacted_modules),
                'high_risk_tests_selected': high_risk_count
            },
            'confidence_level': 'High' if len(self.selected_tests) >= 100 else 'Medium'
        }
    
    def _suggest_new_tests(
        self,
        tickets: List[ReleaseTicket],
        gaps: List[str]
    ) -> List[Dict[str, Any]]:
        """Suggest new test scenarios based on gaps"""
        suggestions = []
        
        # Gaps in impacted modules
        for gap in gaps:
            if 'Module' in gap:
                module = gap.split("'")[1] if "'" in gap else 'Unknown'
                suggestions.append({
                    'scenario': f"Create test coverage for {module} module",
                    'priority': 'High',
                    'reason': f"No existing test cases for impacted module: {module}",
                    'related_tickets': [t.id for t in tickets if t.module == module]
                })
        
        # Bug-related areas without coverage
        bug_modules = set(t.module for t in tickets if t.issue_type.lower() == 'bug')
        uncovered_bug_modules = bug_modules - set(self.coverage_map.keys())
        
        for module in uncovered_bug_modules:
            suggestions.append({
                'scenario': f"Add regression tests for bug fixes in {module}",
                'priority': 'High',
                'reason': f"Bug fixes in {module} without regression coverage",
                'related_tickets': [t.id for t in tickets if t.module == module and t.issue_type.lower() == 'bug']
            })
        
        return suggestions


# Convenience function for easy usage
def generate_regression_test_plan(
    release_tickets: List[Dict[str, Any]],
    impacted_modules: List[str],
    available_test_cases: List[Dict[str, Any]],
    historical_failures: Dict[str, int] = None
) -> Dict[str, Any]:
    """
    Generate a comprehensive regression test plan.
    
    Args:
        release_tickets: List of release tickets/changes
        impacted_modules: List of impacted modules/components
        available_test_cases: All available test cases with metadata
        historical_failures: Optional dict mapping test_id -> failure_count
        
    Returns:
        Comprehensive test plan with selected test cases, coverage analysis, and risk justification
    """
    selector = RegressionTestSelector()
    return selector.select_regression_suite(
        release_tickets,
        impacted_modules,
        available_test_cases,
        historical_failures
    )
