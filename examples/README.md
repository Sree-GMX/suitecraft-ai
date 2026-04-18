# Regression Test Plan Generator - Examples

This directory contains example scripts and data for the Regression Test Plan Generator.

## Files

### `quick_test.py`
**Purpose**: Quick validation that the regression test selector is working correctly.

**Usage**:
```bash
python quick_test.py
```

**What it does**:
- Creates minimal test data (2 tickets, 104 test cases)
- Generates a regression test plan
- Verifies minimum requirements are met
- Exits with success/failure code

**Expected output**:
```
Running quick test...
Tickets: 2
Test cases: 104

✅ Test plan generated successfully!
   Total available: 104
   Total selected: 100
   Minimum required: 100
   Meets requirements: True
   Coverage: 96.2%

✅ ALL TESTS PASSED!
```

**Runtime**: < 1 second

---

### `regression_test_plan_example.py`
**Purpose**: Comprehensive demonstration with realistic data and detailed output.

**Usage**:
```bash
python regression_test_plan_example.py
```

**What it does**:
- Uses comprehensive sample data (~150 test cases)
- Includes multiple modules (auth, payment, user, notification, report)
- Simulates realistic scenario with:
  - 9 release tickets (stories and bugs)
  - 4 impacted modules
  - Historical failure data
  - Various priority levels
  - E2E and integration tests
- Generates detailed console output with:
  - Summary statistics
  - Selected test cases by priority
  - Detailed test information with risk scores
  - Module coverage report
  - Risk justification
  - Gaps and recommendations
  - Execution strategy
- Saves complete output to `regression_test_plan_output.json`

**Expected output**: Beautiful formatted report with all sections

**Runtime**: < 1 second

---

### `api_request_example.json`
**Purpose**: Sample JSON data for API testing.

**Usage with curl**:
```bash
# Make sure backend is running
cd ../backend
uvicorn app.main:app --reload

# In another terminal
curl -X POST "http://localhost:8000/api/v1/regression-test-plan/generate" \
  -H "Content-Type: application/json" \
  -d @api_request_example.json
```

**Usage with httpie**:
```bash
http POST localhost:8000/api/v1/regression-test-plan/generate < api_request_example.json
```

**Usage with Python requests**:
```python
import requests
import json

with open('api_request_example.json', 'r') as f:
    data = json.load(f)

response = requests.post(
    'http://localhost:8000/api/v1/regression-test-plan/generate',
    json=data
)

print(response.json())
```

**What's included**:
- 5 release tickets (3 stories, 2 bugs)
- 3 impacted modules (auth, payment, notification)
- 19 test cases with various priorities
- Historical failure data for 5 tests
- Mix of unit, integration, and E2E tests

---

## Quick Start

### 1. Verify Installation
```bash
python quick_test.py
```
Should complete successfully in < 1 second.

### 2. See Comprehensive Output
```bash
python regression_test_plan_example.py
```
Review the detailed output and check `regression_test_plan_output.json`.

### 3. Test API Endpoint
```bash
# Terminal 1: Start backend
cd ../backend
uvicorn app.main:app --reload

# Terminal 2: Test API
cd examples
curl -X POST "http://localhost:8000/api/v1/regression-test-plan/generate" \
  -H "Content-Type: application/json" \
  -d @api_request_example.json
```

---

## Customization

### Create Your Own Test Data

```python
# my_test_plan.py
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.services.regression_test_selector import generate_regression_test_plan

# Your release tickets
my_tickets = [
    {
        "id": "JIRA-123",
        "summary": "Add new feature",
        "issue_type": "Story",
        "priority": "High",
        "module": "feature_module"
    },
    # ... more tickets
]

# Your test cases
my_test_cases = [
    {
        "id": "TEST-001",
        "title": "Test feature",
        "priority": "Critical",
        "module": "feature_module",
        "section": "Features > New Feature"
    },
    # ... more test cases
]

# Generate plan
result = generate_regression_test_plan(
    release_tickets=my_tickets,
    impacted_modules=["feature_module"],
    available_test_cases=my_test_cases
)

# Use the results
print(f"Selected {result['summary']['total_selected']} test cases")
print(f"Coverage: {result['summary']['coverage_percentage']}%")
```

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'app'"
**Solution**: Make sure you're running from the examples directory and the import path is correct:
```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
```

### Issue: "Selection doesn't meet minimum requirements"
**Solution**: Ensure you have enough test cases. You need at least:
- 100 test cases, OR
- Test cases covering at least 20% of your total available tests

### Issue: "Module coverage gaps identified"
**Solution**: This is expected if you have impacted modules without test cases. Either:
1. Add test cases for those modules, or
2. Remove them from the impacted_modules list

---

## Output Files

After running `regression_test_plan_example.py`, you'll get:

**`regression_test_plan_output.json`**
- Complete test plan in JSON format
- Can be imported into other tools
- Contains all sections:
  - Summary
  - Selected test cases (by priority)
  - Coverage report
  - Risk justification
  - Gaps and recommendations
  - Execution strategy

---

## Next Steps

1. Review the documentation: `../docs/REGRESSION_TEST_SELECTOR.md`
2. Check the implementation: `../backend/app/services/regression_test_selector.py`
3. Run unit tests: `cd ../backend && pytest tests/test_regression_test_selector.py`
4. Integrate with your CI/CD pipeline
5. Connect to TestRail/Jira for real data

---

## Support

For questions or issues:
1. Check the main documentation
2. Review the implementation summary
3. Run the quick test to verify setup
4. Check unit tests for usage patterns
