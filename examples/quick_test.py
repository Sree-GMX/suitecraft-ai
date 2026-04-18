#!/usr/bin/env python3
"""
Quick Test: Regression Test Selector

Run this to verify the regression test selector is working correctly.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.regression_test_selector import generate_regression_test_plan

# Minimal test data
tickets = [
    {"id": "T-1", "summary": "Auth bug", "issue_type": "Bug", "priority": "Critical", "module": "auth"},
    {"id": "T-2", "summary": "Payment feature", "issue_type": "Story", "priority": "High", "module": "payment"},
]

test_cases = [
    {"id": "TC-1", "title": "Login test", "priority": "Critical", "module": "auth"},
    {"id": "TC-2", "title": "Logout test", "priority": "Critical", "module": "auth"},
    {"id": "TC-3", "title": "Payment test", "priority": "High", "module": "payment"},
] + [
    {"id": f"TC-{i}", "title": f"Test {i}", "priority": "Medium", "module": "general"}
    for i in range(4, 105)  # Add enough tests to meet minimum
]

print("Running quick test...")
print(f"Tickets: {len(tickets)}")
print(f"Test cases: {len(test_cases)}")

result = generate_regression_test_plan(
    release_tickets=tickets,
    impacted_modules=["auth", "payment"],
    available_test_cases=test_cases
)

summary = result['summary']
print(f"\n✅ Test plan generated successfully!")
print(f"   Total available: {summary['total_available']}")
print(f"   Total selected: {summary['total_selected']}")
print(f"   Minimum required: {summary['minimum_required']}")
print(f"   Meets requirements: {summary['selection_meets_requirements']}")
print(f"   Coverage: {summary['coverage_percentage']}%")

if summary['selection_meets_requirements']:
    print("\n✅ ALL TESTS PASSED!")
else:
    print("\n❌ TEST FAILED: Minimum requirements not met")
    sys.exit(1)
