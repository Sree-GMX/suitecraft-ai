"""
Custom TestRail API Client
Direct implementation using requests to avoid proxy issues
"""

import requests
import base64
from typing import List, Dict, Optional
import json

class TestRailClient:
    """Custom TestRail API client using requests"""
    
    def __init__(self, url: str, email: str, api_key: str):
        """
        Initialize TestRail client
        
        Args:
            url: TestRail base URL (e.g., "https://targetx.testrail.com")
            email: TestRail user email
            api_key: TestRail API key
        """
        self.url = url.rstrip('/')
        self.email = email
        self.api_key = api_key
        
        # Create auth token
        auth_str = f"{email}:{api_key}"
        auth_bytes = auth_str.encode('utf-8')
        auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
        
        self.headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/json'
        }
        
        # Disable proxy to avoid connection issues
        self.proxies = {
            'http': None,
            'https': None
        }
    
    def _api_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """
        Make API request to TestRail
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (e.g., "get_projects")
            data: Optional request payload
            
        Returns:
            API response as dictionary
        """
        api_url = f"{self.url}/index.php?/api/v2/{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(
                    api_url, 
                    headers=self.headers,
                    proxies=self.proxies,
                    timeout=30
                )
            elif method.upper() == 'POST':
                response = requests.post(
                    api_url,
                    headers=self.headers,
                    json=data,
                    proxies=self.proxies,
                    timeout=30
                )
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Log response status for debugging

            response.raise_for_status()
            
            # Handle empty responses
            if not response.content:
                return {}
            
            return response.json()
            
        except requests.exceptions.HTTPError as e:

            raise
        except requests.exceptions.RequestException as e:

            raise
    
    def get_user(self) -> Dict:
        """Get current user info to test authentication"""
        try:
            return self._api_request('GET', 'get_user')
        except Exception as e:

            return {}
    
    def get_projects(self) -> List[Dict]:
        """Get all projects"""
        try:
            projects = self._api_request('GET', 'get_projects')
            return projects if isinstance(projects, list) else [projects]
        except Exception as e:

            return []
    
    def get_suites(self, project_id: int) -> List[Dict]:
        """Get all suites for a project"""
        try:
            suites = self._api_request('GET', f'get_suites/{project_id}')
            return suites if isinstance(suites, list) else [suites]
        except Exception as e:

            return []
    
    def get_cases(self, project_id: int, suite_id: Optional[int] = None) -> List[Dict]:
        """
        Get test cases
        
        Args:
            project_id: TestRail project ID
            suite_id: Optional suite ID to filter
            
        Returns:
            List of test cases
        """
        try:
            if suite_id:
                endpoint = f'get_cases/{project_id}&suite_id={suite_id}'
            else:
                endpoint = f'get_cases/{project_id}'
            
            cases = self._api_request('GET', endpoint)
            
            # Handle both list and dict responses
            if isinstance(cases, dict) and 'cases' in cases:
                return cases['cases']
            elif isinstance(cases, list):
                return cases
            else:
                return []
                
        except Exception as e:

            return []
    
    def add_result_for_case(self, run_id: int, case_id: int, status_id: int, 
                           comment: Optional[str] = None, elapsed: Optional[str] = None) -> Dict:
        """
        Add test result for a case
        
        Args:
            run_id: Test run ID
            case_id: Test case ID
            status_id: Status ID (1=Passed, 5=Failed)
            comment: Optional comment
            elapsed: Optional elapsed time (e.g., "5m" or "1h 30m")
            
        Returns:
            Result data
        """
        try:
            data = {
                'status_id': status_id
            }
            
            if comment:
                data['comment'] = comment
            if elapsed:
                data['elapsed'] = elapsed
            
            result = self._api_request('POST', f'add_result_for_case/{run_id}/{case_id}', data)
            return result
            
        except Exception as e:

            raise
