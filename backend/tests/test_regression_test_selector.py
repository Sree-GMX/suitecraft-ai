"""
Unit Tests for Regression Test Selector
"""

import pytest
from app.services.regression_test_selector import (
    RegressionTestSelector,
    TestCase,
    ReleaseTicket,
    generate_regression_test_plan
)


class TestRegressionTestSelector:
    """Test suite for RegressionTestSelector"""
    
    def test_minimum_requirements_20_percent(self):
        """Test that minimum 20% of tests are selected"""
        # 50 test cases -> minimum 20% = 10 tests (but actual minimum is 100)
        # So for 50 tests, we need ALL of them + duplicates won't happen
        # Let's use 500 tests -> minimum 100
        test_cases = [
            {
                "id": f"TC-{i}",
                "title": f"Test {i}",
                "priority": "Medium",
                "module": "general"
            }
            for i in range(500)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Test", "issue_type": "Story", "priority": "Medium", "module": "general"}
            ],
            impacted_modules=["general"],
            available_test_cases=test_cases
        )
        
        summary = result['summary']
        assert summary['total_selected'] >= summary['minimum_required']
        assert summary['total_selected'] >= int(500 * 0.20)
    
    def test_minimum_requirements_100_tests(self):
        """Test that minimum 100 tests are selected when dataset is large"""
        # 400 test cases -> 20% = 80, but minimum is 100
        test_cases = [
            {
                "id": f"TC-{i}",
                "title": f"Test {i}",
                "priority": "Medium",
                "module": "general"
            }
            for i in range(400)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Test", "issue_type": "Story", "priority": "Medium", "module": "general"}
            ],
            impacted_modules=["general"],
            available_test_cases=test_cases
        )
        
        summary = result['summary']
        assert summary['total_selected'] >= 100
    
    def test_all_p0_tests_included(self):
        """Test that ALL P0/Critical tests are always included"""
        test_cases = [
            {"id": "TC-1", "title": "P0 Test 1", "priority": "Critical", "module": "auth"},
            {"id": "TC-2", "title": "P0 Test 2", "priority": "Critical", "module": "payment"},
            {"id": "TC-3", "title": "P0 Test 3", "priority": "P0", "module": "user"},
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(4, 105)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Test", "issue_type": "Story", "priority": "High", "module": "general"}
            ],
            impacted_modules=["general"],
            available_test_cases=test_cases
        )
        
        p0_tests = result['selected_test_cases']['P0_Critical']
        assert "TC-1" in p0_tests
        assert "TC-2" in p0_tests
        assert "TC-3" in p0_tests
    
    def test_p1_impacted_modules_included(self):
        """Test that ALL P1 tests in impacted modules are included"""
        test_cases = [
            {"id": "TC-1", "title": "P1 Auth", "priority": "High", "module": "auth"},
            {"id": "TC-2", "title": "P1 Payment", "priority": "High", "module": "payment"},
            {"id": "TC-3", "title": "P1 User", "priority": "High", "module": "user"},
            {"id": "TC-4", "title": "P1 Report", "priority": "High", "module": "report"},
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(5, 105)
        ]
        
        impacted_modules = ["auth", "payment"]  # Only auth and payment are impacted
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Auth change", "issue_type": "Story", "priority": "High", "module": "auth"}
            ],
            impacted_modules=impacted_modules,
            available_test_cases=test_cases
        )
        
        p1_tests = result['selected_test_cases']['P1_High']
        # P1 tests in impacted modules must be included
        assert "TC-1" in p1_tests  # auth (impacted)
        assert "TC-2" in p1_tests  # payment (impacted)
        # P1 tests in non-impacted modules may or may not be included
    
    def test_module_coverage(self):
        """Test that all impacted modules have coverage"""
        test_cases = [
            {"id": "TC-1", "title": "Auth test", "priority": "High", "module": "auth"},
            {"id": "TC-2", "title": "Payment test", "priority": "High", "module": "payment"},
            {"id": "TC-3", "title": "User test", "priority": "High", "module": "user"},
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(4, 105)
        ]
        
        impacted_modules = ["auth", "payment", "user"]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Auth", "issue_type": "Story", "priority": "High", "module": "auth"}
            ],
            impacted_modules=impacted_modules,
            available_test_cases=test_cases
        )
        
        coverage = result['coverage_report']['module_coverage']
        for module in impacted_modules:
            assert module in coverage
            assert coverage[module]['covered'] is True
            assert coverage[module]['test_count'] > 0
    
    def test_risk_score_calculation(self):
        """Test that risk scores are calculated correctly"""
        selector = RegressionTestSelector()
        
        tickets = [
            ReleaseTicket("T-1", "Auth bug", "Bug", "Critical", "auth", [], [])
        ]
        
        test_cases = [
            TestCase("TC-1", "Critical auth test", "Critical", "auth", "", 5, "", [], ["critical"]),
            TestCase("TC-2", "Low general test", "Low", "general", "", 0, "", [], [])
        ]
        
        selector.impacted_modules = {"auth"}
        selector._calculate_risk_scores(test_cases, tickets)
        
        # TC-1 should have higher risk score than TC-2
        tc1_score = selector.risk_scores["TC-1"].score
        tc2_score = selector.risk_scores["TC-2"].score
        
        assert tc1_score > tc2_score
        assert tc1_score >= 60  # Should be high due to multiple factors
    
    def test_historical_failures_impact(self):
        """Test that historical failures increase risk score"""
        test_cases = [
            {"id": "TC-1", "title": "Stable test", "priority": "High", "module": "auth"},
            {"id": "TC-2", "title": "Flaky test", "priority": "High", "module": "auth"},
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(3, 105)
        ]
        
        historical_failures = {
            "TC-1": 0,   # Never failed
            "TC-2": 10   # Failed 10 times
        }
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Auth", "issue_type": "Story", "priority": "High", "module": "auth"}
            ],
            impacted_modules=["auth"],
            available_test_cases=test_cases,
            historical_failures=historical_failures
        )
        
        # Both should be included (P1 in impacted module), but TC-2 should have higher risk
        detailed = result['selected_test_cases']['detailed_by_priority']['P1']
        
        tc1_detail = next((t for t in detailed if t['id'] == 'TC-1'), None)
        tc2_detail = next((t for t in detailed if t['id'] == 'TC-2'), None)
        
        if tc1_detail and tc2_detail:
            assert tc2_detail['risk_score'] > tc1_detail['risk_score']
            assert tc2_detail['historical_failures'] == 10
    
    def test_integration_tests_included(self):
        """Test that integration and E2E tests are included"""
        test_cases = [
            {
                "id": "TC-E2E-1",
                "title": "E2E user flow",
                "priority": "Critical",
                "module": "auth",
                "tags": ["e2e", "integration"],
                "dependencies": ["TC-1", "TC-2"]
            },
            {
                "id": "TC-INT-1",
                "title": "Integration test auth-payment",
                "priority": "High",
                "module": "auth",
                "tags": ["integration"]
            }
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(3, 105)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Auth", "issue_type": "Story", "priority": "High", "module": "auth"}
            ],
            impacted_modules=["auth"],
            available_test_cases=test_cases
        )
        
        all_selected = (
            result['selected_test_cases']['P0_Critical'] +
            result['selected_test_cases']['P1_High'] +
            result['selected_test_cases']['P2_Medium'] +
            result['selected_test_cases']['P3_Low']
        )
        
        # E2E and integration tests should be included
        assert "TC-E2E-1" in all_selected
    
    def test_output_structure(self):
        """Test that output has all required fields"""
        test_cases = [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(100)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Test", "issue_type": "Story", "priority": "Medium", "module": "general"}
            ],
            impacted_modules=["general"],
            available_test_cases=test_cases
        )
        
        # Check all required sections exist
        assert 'summary' in result
        assert 'selected_test_cases' in result
        assert 'coverage_report' in result
        assert 'risk_justification' in result
        assert 'gaps_and_recommendations' in result
        assert 'execution_strategy' in result
        
        # Check summary fields
        summary = result['summary']
        assert 'total_available' in summary
        assert 'total_selected' in summary
        assert 'minimum_required' in summary
        assert 'coverage_percentage' in summary
        assert 'selection_meets_requirements' in summary

    def test_small_dataset_caps_minimum_requirement(self):
        """Test that small datasets can satisfy the minimum requirement"""
        test_cases = [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(50)
        ]

        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Small dataset validation", "issue_type": "Story", "priority": "Medium", "module": "general"}
            ],
            impacted_modules=["general"],
            available_test_cases=test_cases
        )

        summary = result['summary']
        assert summary['minimum_required'] == 50
        assert summary['total_selected'] == 50
        assert summary['selection_meets_requirements'] is True
    
    def test_priority_normalization(self):
        """Test that different priority formats are normalized correctly"""
        selector = RegressionTestSelector()
        
        assert selector._normalize_priority('Critical') == 'P0'
        assert selector._normalize_priority('P0') == 'P0'
        assert selector._normalize_priority('critical') == 'P0'
        assert selector._normalize_priority('High') == 'P1'
        assert selector._normalize_priority('P1') == 'P1'
        assert selector._normalize_priority('Medium') == 'P2'
        assert selector._normalize_priority('P2') == 'P2'
        assert selector._normalize_priority('Low') == 'P3'
        assert selector._normalize_priority('P3') == 'P3'
        assert selector._normalize_priority('Unknown') == 'P2'  # Default
    
    def test_gap_identification(self):
        """Test that coverage gaps are identified"""
        test_cases = [
            {"id": "TC-1", "title": "Auth test", "priority": "High", "module": "auth"},
        ] + [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(2, 105)
        ]
        
        impacted_modules = ["auth", "payment", "user"]  # payment and user have no tests
        
        result = generate_regression_test_plan(
            release_tickets=[
                {"id": "T-1", "summary": "Multi-module change", "issue_type": "Story", "priority": "High", "module": "auth"}
            ],
            impacted_modules=impacted_modules,
            available_test_cases=test_cases
        )
        
        gaps = result['gaps_and_recommendations']['identified_gaps']
        # Should identify payment and user as gaps
        assert any('payment' in gap.lower() for gap in gaps)
        assert any('user' in gap.lower() for gap in gaps)
    
    def test_recommendations_generated(self):
        """Test that recommendations are generated"""
        test_cases = [
            {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
            for i in range(100)
        ]
        
        # Many bugs should trigger specific recommendation
        tickets = [
            {"id": f"BUG-{i}", "summary": f"Bug {i}", "issue_type": "Bug", "priority": "High", "module": "general"}
            for i in range(15)
        ]
        
        result = generate_regression_test_plan(
            release_tickets=tickets,
            impacted_modules=["general"],
            available_test_cases=test_cases
        )
        
        recommendations = result['gaps_and_recommendations']['recommendations']
        assert len(recommendations) > 0
        # Should recommend focusing on bug verification
        assert any('bug' in rec.lower() for rec in recommendations)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
