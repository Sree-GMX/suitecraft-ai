"""
TestRail Service for reading test cases (READ ONLY)
Connects to TestRail API to fetch test cases based on release tickets
"""

from typing import List, Dict, Optional
from app.services.testrail_client import TestRailClient
from app.core.config import settings

class TestRailService:
    """Service to read test cases from TestRail (READ ONLY)"""
    
    def __init__(self):
        self.url = settings.TESTRAIL_URL
        self.api_key = settings.TESTRAIL_API_KEY
        self.user = settings.TESTRAIL_USER
        self.client = None
        
    def connect(self) -> bool:
        """Connect to TestRail API"""
        if not self.url or not self.api_key or not self.user:

            return False
        
        try:
            self.client = TestRailClient(
                url=self.url,
                email=self.user,
                api_key=self.api_key
            )
            # Test connection by getting projects
            projects = self.client.get_projects()
            return True
        except Exception as e:

            return False
    
    def get_projects(self) -> List[Dict]:
        """Get all projects from TestRail"""
        if not self.client and not self.connect():
            return []
        
        try:
            return self.client.get_projects()
        except Exception as e:

            return []
    
    def get_test_cases(self, project_id: int, suite_id: Optional[int] = None) -> List[Dict]:
        """
        Get test cases from a project
        
        Args:
            project_id: TestRail project ID
            suite_id: Optional test suite ID
            
        Returns:
            List of test case dictionaries
        """
        if not self.client and not self.connect():
            return []
        
        try:
            return self.client.get_cases(project_id, suite_id=suite_id)
        except Exception as e:

            return []
    
    def get_test_suites(self, project_id: int) -> List[Dict]:
        """Get test suites from a project"""
        if not self.client and not self.connect():
            return []
        
        try:
            return self.client.get_suites(project_id)
        except Exception as e:

            return []
    
    
    def search_test_cases_by_title(self, project_id: int, search_term: str, suite_id: Optional[int] = None) -> List[Dict]:
        """
        Search test cases by title
        
        Args:
            project_id: TestRail project ID
            search_term: Search term to match in test case titles
            suite_id: Optional suite ID to limit search
            
        Returns:
            List of matching test cases
        """
        if not self.client and not self.connect():
            return []
        
        try:
            # Get test cases from specific suite if provided, otherwise all cases
            all_cases = self.get_test_cases(project_id, suite_id=suite_id)
            
            # Search for matching cases
            matching_cases = [
                case for case in all_cases
                if search_term.lower() in case.get('title', '').lower()
            ]
            
            # Add priority classification
            for case in matching_cases:
                priority_id = case.get('priority_id', 3)
                if priority_id == 1:
                    case['priority_label'] = 'Critical'
                    case['priority_color'] = '#ff1744'
                elif priority_id == 2:
                    case['priority_label'] = 'High'
                    case['priority_color'] = '#ff9800'
                elif priority_id == 3:
                    case['priority_label'] = 'Medium'
                    case['priority_color'] = '#4caf50'
                else:
                    case['priority_label'] = 'Low'
                    case['priority_color'] = '#9e9e9e'
            
            return matching_cases
        except Exception as e:

            return []
    
    def get_test_cases_for_ticket(self, project_id: int, ticket_key: str, suite_id: Optional[int] = None) -> List[Dict]:
        """
        Get test cases related to a specific ticket (e.g., UCP-2800)
        
        Args:
            project_id: TestRail project ID
            ticket_key: Jira ticket key (e.g., "UCP-2800")
            suite_id: Optional suite ID (e.g., 292 for UCP suite)
            
        Returns:
            List of relevant test cases with priority classification
        """
        return self.search_test_cases_by_title(project_id, ticket_key, suite_id=suite_id)
    
    def get_test_cases_for_release(self, project_id: int, release_version: str) -> List[Dict]:
        """
        Get test cases related to a specific release version
        Searches for test cases with the release version in the title or custom fields
        
        Args:
            project_id: TestRail project ID
            release_version: Release version string (e.g., "2605-Release")
            
        Returns:
            List of relevant test cases
        """
        return self.search_test_cases_by_title(project_id, release_version)

# Singleton instance
testrail_service = TestRailService()
