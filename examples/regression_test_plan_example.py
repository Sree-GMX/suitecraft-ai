#!/usr/bin/env python3
"""
Comprehensive Example: Regression Test Plan Generation

This script demonstrates how to use the RegressionTestSelector
to generate a comprehensive regression test plan with risk-based analysis.
"""

import json
from typing import List, Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.regression_test_selector import generate_regression_test_plan


# Sample Data: Release Tickets
SAMPLE_RELEASE_TICKETS = [
    # High Priority Stories
    {
        "issue_key": "PROJ-101",
        "summary": "Implement OAuth2 authentication",
        "issue_type": "Story",
        "priority": "High",
        "module": "auth",
        "components": ["backend", "api"],
        "labels": ["security", "authentication"]
    },
    {
        "issue_key": "PROJ-102",
        "summary": "Add payment gateway integration",
        "issue_type": "Story",
        "priority": "Critical",
        "module": "payment",
        "components": ["backend", "payment"],
        "labels": ["payment", "integration"]
    },
    {
        "issue_key": "PROJ-103",
        "summary": "User profile dashboard redesign",
        "issue_type": "Story",
        "priority": "Medium",
        "module": "user",
        "components": ["frontend", "ui"]
    },
    
    # Bugs
    {
        "issue_key": "PROJ-201",
        "summary": "Login redirect fails after password reset",
        "issue_type": "Bug",
        "priority": "Critical",
        "module": "auth",
        "components": ["backend"]
    },
    {
        "issue_key": "PROJ-202",
        "summary": "Session timeout not working correctly",
        "issue_type": "Bug",
        "priority": "High",
        "module": "auth",
        "components": ["backend"]
    },
    {
        "issue_key": "PROJ-203",
        "summary": "Payment confirmation email not sent",
        "issue_type": "Bug",
        "priority": "High",
        "module": "payment",
        "components": ["backend", "notification"]
    },
    {
        "issue_key": "PROJ-204",
        "summary": "User avatar upload fails for large files",
        "issue_type": "Bug",
        "priority": "Medium",
        "module": "user",
        "components": ["backend", "storage"]
    },
    
    # Additional Stories
    {
        "issue_key": "PROJ-104",
        "summary": "Export user data to CSV",
        "issue_type": "Story",
        "priority": "Low",
        "module": "report",
        "components": ["backend"]
    },
    {
        "issue_key": "PROJ-105",
        "summary": "Add notification preferences",
        "issue_type": "Story",
        "priority": "Medium",
        "module": "notification",
        "components": ["backend", "frontend"]
    },
]


# Sample Data: Available Test Cases
SAMPLE_TEST_CASES = [
    # Authentication Module - Critical (P0)
    {
        "id": "TC-001",
        "title": "Verify user login with valid credentials",
        "priority": "Critical",
        "module": "auth",
        "section": "Authentication > Login",
        "tags": ["smoke", "critical", "authentication"],
        "estimated_duration": 5
    },
    {
        "id": "TC-002",
        "title": "Verify user logout functionality",
        "priority": "Critical",
        "module": "auth",
        "section": "Authentication > Logout",
        "tags": ["smoke", "critical"],
        "estimated_duration": 3
    },
    {
        "id": "TC-003",
        "title": "Verify password reset flow",
        "priority": "Critical",
        "module": "auth",
        "section": "Authentication > Password Reset",
        "tags": ["critical", "security"],
        "estimated_duration": 8
    },
    
    # Authentication Module - High (P1)
    {
        "id": "TC-010",
        "title": "Verify session timeout after inactivity",
        "priority": "High",
        "module": "auth",
        "section": "Session Management",
        "tags": ["session", "security"],
        "estimated_duration": 10
    },
    {
        "id": "TC-011",
        "title": "Verify OAuth2 login flow",
        "priority": "High",
        "module": "auth",
        "section": "Authentication > OAuth",
        "tags": ["oauth", "integration"],
        "estimated_duration": 12
    },
    {
        "id": "TC-012",
        "title": "Verify multi-factor authentication",
        "priority": "High",
        "module": "auth",
        "section": "Authentication > MFA",
        "tags": ["mfa", "security"],
        "estimated_duration": 15
    },
    
    # Payment Module - Critical (P0)
    {
        "id": "TC-020",
        "title": "Verify payment processing for valid card",
        "priority": "Critical",
        "module": "payment",
        "section": "Payment > Processing",
        "tags": ["smoke", "critical", "payment"],
        "estimated_duration": 10
    },
    {
        "id": "TC-021",
        "title": "Verify payment failure handling",
        "priority": "Critical",
        "module": "payment",
        "section": "Payment > Error Handling",
        "tags": ["critical", "payment"],
        "estimated_duration": 8
    },
    
    # Payment Module - High (P1)
    {
        "id": "TC-030",
        "title": "Verify payment confirmation email",
        "priority": "High",
        "module": "payment",
        "section": "Payment > Notifications",
        "tags": ["notification", "payment"],
        "estimated_duration": 5
    },
    {
        "id": "TC-031",
        "title": "Verify refund processing",
        "priority": "High",
        "module": "payment",
        "section": "Payment > Refunds",
        "tags": ["payment", "refund"],
        "estimated_duration": 12
    },
    
    # User Module - High (P1)
    {
        "id": "TC-040",
        "title": "Verify user profile update",
        "priority": "High",
        "module": "user",
        "section": "User Management > Profile",
        "tags": ["user", "profile"],
        "estimated_duration": 6
    },
    {
        "id": "TC-041",
        "title": "Verify user avatar upload",
        "priority": "High",
        "module": "user",
        "section": "User Management > Avatar",
        "tags": ["user", "upload"],
        "estimated_duration": 8
    },
    {
        "id": "TC-042",
        "title": "Verify user dashboard access",
        "priority": "High",
        "module": "user",
        "section": "User Management > Dashboard",
        "tags": ["user", "dashboard"],
        "estimated_duration": 5
    },
    
    # User Module - Medium (P2)
    {
        "id": "TC-050",
        "title": "Verify user settings persistence",
        "priority": "Medium",
        "module": "user",
        "section": "User Management > Settings",
        "tags": ["user"],
        "estimated_duration": 4
    },
    {
        "id": "TC-051",
        "title": "Verify user activity history",
        "priority": "Medium",
        "module": "user",
        "section": "User Management > History",
        "tags": ["user"],
        "estimated_duration": 6
    },
    
    # Notification Module - High (P1)
    {
        "id": "TC-060",
        "title": "Verify email notification delivery",
        "priority": "High",
        "module": "notification",
        "section": "Notifications > Email",
        "tags": ["notification", "email"],
        "estimated_duration": 5
    },
    {
        "id": "TC-061",
        "title": "Verify notification preferences update",
        "priority": "High",
        "module": "notification",
        "section": "Notifications > Preferences",
        "tags": ["notification", "settings"],
        "estimated_duration": 4
    },
    
    # Notification Module - Medium (P2)
    {
        "id": "TC-070",
        "title": "Verify push notification delivery",
        "priority": "Medium",
        "module": "notification",
        "section": "Notifications > Push",
        "tags": ["notification", "push"],
        "estimated_duration": 7
    },
    
    # Report Module - Medium (P2)
    {
        "id": "TC-080",
        "title": "Verify CSV export functionality",
        "priority": "Medium",
        "module": "report",
        "section": "Reports > Export",
        "tags": ["report", "export"],
        "estimated_duration": 8
    },
    {
        "id": "TC-081",
        "title": "Verify report generation",
        "priority": "Medium",
        "module": "report",
        "section": "Reports > Generation",
        "tags": ["report"],
        "estimated_duration": 10
    },
    
    # Integration Tests (E2E)
    {
        "id": "TC-100",
        "title": "E2E: Complete user registration and login flow",
        "priority": "Critical",
        "module": "auth",
        "section": "End-to-End > User Journey",
        "tags": ["e2e", "critical", "integration"],
        "dependencies": ["TC-001", "TC-002"],
        "estimated_duration": 20
    },
    {
        "id": "TC-101",
        "title": "E2E: Complete purchase flow with payment",
        "priority": "Critical",
        "module": "payment",
        "section": "End-to-End > Purchase",
        "tags": ["e2e", "critical", "integration"],
        "dependencies": ["TC-020", "TC-030"],
        "estimated_duration": 25
    },
    {
        "id": "TC-102",
        "title": "E2E: User profile update and notification",
        "priority": "High",
        "module": "user",
        "section": "End-to-End > Profile",
        "tags": ["e2e", "integration"],
        "dependencies": ["TC-040", "TC-060"],
        "estimated_duration": 15
    },
    
    # Additional test cases to reach 100+ tests
    # (In a real scenario, you would have many more test cases)
]

# Generate additional test cases programmatically to reach 100+
for i in range(200, 350):
    module = ["auth", "payment", "user", "notification", "report", "api"][i % 6]
    priority = ["Critical", "High", "Medium", "Low"][(i // 10) % 4]
    
    SAMPLE_TEST_CASES.append({
        "id": f"TC-{i}",
        "title": f"Test case {i}: Verify {module} functionality",
        "priority": priority,
        "module": module,
        "section": f"{module.capitalize()} > Test Suite",
        "tags": [module],
        "estimated_duration": 4
    })


# Sample historical failure data
SAMPLE_HISTORICAL_FAILURES = {
    "TC-010": 8,  # Session timeout has failed 8 times
    "TC-011": 5,  # OAuth flow has failed 5 times
    "TC-030": 12,  # Payment email has failed 12 times (very unstable!)
    "TC-041": 6,  # Avatar upload has failed 6 times
    "TC-070": 4,  # Push notifications have failed 4 times
    "TC-101": 3,  # E2E purchase flow has failed 3 times
}


# Impacted modules for this release
IMPACTED_MODULES = [
    "auth",
    "payment",
    "user",
    "notification"
]


def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_summary(test_plan: Dict[str, Any]):
    """Print test plan summary"""
    summary = test_plan['summary']
    
    print_section("SUMMARY")
    print(f"Total Test Cases Available:  {summary['total_available']}")
    print(f"Total Test Cases Selected:   {summary['total_selected']}")
    print(f"Minimum Required:            {summary['minimum_required']}")
    print(f"Coverage Percentage:         {summary['coverage_percentage']}%")
    print(f"Meets Requirements:          {'✅ YES' if summary['selection_meets_requirements'] else '❌ NO'}")
    print(f"Impacted Modules:            {summary['impacted_modules_count']}")
    print(f"Fully Covered Modules:       {summary['fully_covered_modules']}")
    print(f"Estimated Duration:          {summary['estimated_duration_hours']} hours")


def print_selected_tests(test_plan: Dict[str, Any]):
    """Print selected test cases grouped by priority"""
    selected = test_plan['selected_test_cases']
    
    print_section("SELECTED TEST CASES")
    
    for priority in ['P0_Critical', 'P1_High', 'P2_Medium', 'P3_Low']:
        test_ids = selected[priority]
        if test_ids:
            priority_label = priority.replace('_', ' ')
            print(f"\n{priority_label}: {len(test_ids)} tests")
            print("-" * 40)
            
            # Show first 5 test IDs
            for test_id in test_ids[:5]:
                print(f"  • {test_id}")
            
            if len(test_ids) > 5:
                print(f"  ... and {len(test_ids) - 5} more")


def print_detailed_tests(test_plan: Dict[str, Any], priority: str, limit: int = 5):
    """Print detailed information for tests of a specific priority"""
    detailed = test_plan['selected_test_cases']['detailed_by_priority'].get(priority, [])
    
    if not detailed:
        return
    
    print(f"\n{priority} Priority Tests (Top {min(limit, len(detailed))}):")
    print("-" * 80)
    
    for i, test in enumerate(detailed[:limit]):
        print(f"\n{i+1}. [{test['id']}] {test['title']}")
        print(f"   Module: {test['module']}")
        print(f"   Risk Score: {test['risk_score']} ({test['risk_level']} Risk)")
        if test['historical_failures'] > 0:
            print(f"   Historical Failures: {test['historical_failures']}")
        if test['risk_reasons']:
            print(f"   Risk Reasons:")
            for reason in test['risk_reasons'][:3]:
                print(f"     - {reason}")


def print_coverage_report(test_plan: Dict[str, Any]):
    """Print module coverage report"""
    coverage = test_plan['coverage_report']
    
    print_section("COVERAGE REPORT")
    
    print("Module Coverage:")
    print("-" * 80)
    
    module_coverage = coverage['module_coverage']
    for module, data in sorted(module_coverage.items()):
        status = "✅ Covered" if data['covered'] else "❌ Not Covered"
        test_count = data['test_count']
        print(f"{module:20s} → {status} ({test_count} test cases)")
        
        # Show some test IDs
        if data['test_ids'] and len(data['test_ids']) <= 5:
            print(f"{'':20s}   Tests: {', '.join(data['test_ids'])}")
        elif data['test_ids']:
            print(f"{'':20s}   Tests: {', '.join(data['test_ids'][:3])}, ... ({len(data['test_ids'])} total)")
    
    print("\nRisk Distribution:")
    print("-" * 40)
    risk_dist = coverage['risk_distribution']
    total_risk_tests = sum(risk_dist.values())
    for risk_level in ['High', 'Medium', 'Low']:
        count = risk_dist[risk_level]
        percentage = (count / total_risk_tests * 100) if total_risk_tests > 0 else 0
        print(f"{risk_level:10s}: {count:3d} tests ({percentage:5.1f}%)")


def print_risk_justification(test_plan: Dict[str, Any]):
    """Print risk justification"""
    risk = test_plan['risk_justification']
    
    print_section("RISK JUSTIFICATION")
    
    print("Selection Criteria:")
    for i, criterion in enumerate(risk['selection_criteria'], 1):
        print(f"{i}. {criterion}")
    
    print("\nRisk Factors Considered:")
    for i, factor in enumerate(risk['risk_factors_considered'], 1):
        print(f"{i}. {factor}")
    
    print("\nRelease Risk Indicators:")
    print("-" * 40)
    indicators = risk['release_risk_indicators']
    print(f"Total Tickets:              {indicators['total_tickets']}")
    print(f"Bug Count:                  {indicators['bug_count']}")
    print(f"High Priority Changes:      {indicators['high_priority_changes']}")
    print(f"Impacted Modules:           {indicators['impacted_modules']}")
    print(f"High Risk Tests Selected:   {indicators['high_risk_tests_selected']}")
    print(f"\nConfidence Level:           {risk['confidence_level']}")


def print_gaps_and_recommendations(test_plan: Dict[str, Any]):
    """Print gaps and recommendations"""
    gaps_rec = test_plan['gaps_and_recommendations']
    
    print_section("GAPS & RECOMMENDATIONS")
    
    # Gaps
    gaps = gaps_rec['identified_gaps']
    if gaps:
        print("Identified Gaps:")
        for i, gap in enumerate(gaps, 1):
            print(f"{i}. {gap}")
    else:
        print("✅ No coverage gaps identified")
    
    # Recommendations
    print("\nRecommendations:")
    for i, rec in enumerate(gaps_rec['recommendations'], 1):
        print(f"{i}. {rec}")
    
    # New test scenarios
    new_scenarios = gaps_rec['new_test_scenarios_needed']
    if new_scenarios:
        print("\nNew Test Scenarios Needed:")
        for i, scenario in enumerate(new_scenarios[:5], 1):
            print(f"\n{i}. {scenario['scenario']}")
            print(f"   Priority: {scenario['priority']}")
            print(f"   Reason: {scenario['reason']}")
            if scenario['related_tickets']:
                print(f"   Related Tickets: {', '.join(scenario['related_tickets'][:3])}")


def print_execution_strategy(test_plan: Dict[str, Any]):
    """Print execution strategy"""
    strategy = test_plan['execution_strategy']
    
    print_section("EXECUTION STRATEGY")
    
    print(f"Recommended Order:          {' → '.join(strategy['recommended_order'])}")
    print(f"Total Duration:             {strategy['total_estimated_hours']} hours ({strategy['total_estimated_duration_minutes']} minutes)")
    print(f"Parallel Execution:         {'✅ Recommended' if strategy['parallel_execution_recommended'] else '❌ Not Recommended'}")
    print(f"Suggested Resources:        {strategy['suggested_resources']} QA engineers")


def save_to_json(test_plan: Dict[str, Any], filename: str):
    """Save test plan to JSON file"""
    with open(filename, 'w') as f:
        json.dump(test_plan, f, indent=2)
    print(f"\n✅ Test plan saved to: {filename}")


def main():
    """Main execution function"""
    print("\n" + "=" * 80)
    print("  REGRESSION TEST PLAN GENERATOR")
    print("  Risk-Based Test Suite Selection")
    print("=" * 80)
    
    print(f"\nInput Data:")
    print(f"  • Release Tickets: {len(SAMPLE_RELEASE_TICKETS)}")
    print(f"  • Available Test Cases: {len(SAMPLE_TEST_CASES)}")
    print(f"  • Impacted Modules: {len(IMPACTED_MODULES)}")
    print(f"  • Historical Failure Data: {len(SAMPLE_HISTORICAL_FAILURES)} test cases")
    
    print("\nGenerating regression test plan...")
    
    # Generate test plan
    test_plan = generate_regression_test_plan(
        release_tickets=SAMPLE_RELEASE_TICKETS,
        impacted_modules=IMPACTED_MODULES,
        available_test_cases=SAMPLE_TEST_CASES,
        historical_failures=SAMPLE_HISTORICAL_FAILURES
    )
    
    # Print results
    print_summary(test_plan)
    print_selected_tests(test_plan)
    
    # Print detailed tests for P0 and P1
    print("\n" + "-" * 80)
    print_detailed_tests(test_plan, 'P0', limit=5)
    print_detailed_tests(test_plan, 'P1', limit=5)
    
    print_coverage_report(test_plan)
    print_risk_justification(test_plan)
    print_gaps_and_recommendations(test_plan)
    print_execution_strategy(test_plan)
    
    # Save to file
    output_file = 'regression_test_plan_output.json'
    save_to_json(test_plan, output_file)
    
    print("\n" + "=" * 80)
    print("  Generation Complete!")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
