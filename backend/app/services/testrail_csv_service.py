"""
TestRail CSV Service for reading test cases from CSV file
Temporary solution until TestRail API is properly configured
"""

import csv
import re
from pathlib import Path
from typing import Dict, List, Optional, Set

class TestRailCSVService:
    """Service to read test cases from CSV file"""

    MAX_RELATED_RESULTS = 40
    MATCH_STOP_WORDS: Set[str] = {
        'ucp', 'server', 'client', 'performance', 'test', 'tests', 'story', 'bug',
        'regression', 'release', 'page', 'service', 'update', 'new', 'only', 'available',
        'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'via', 'is', 'are',
        'was', 'were', 'when', 'where', 'your', 'their', 'has', 'have', 'had', 'not',
        'all', 'any', 'can', 'should', 'would', 'could', 'may', 'main'
    }
    
    def __init__(self, csv_path: str = None):
        """
        Initialize CSV service
        
        Args:
            csv_path: Path to the TestRail CSV file
        """
        if csv_path is None:
            # Prefer a CSV placed under backend/ for local app usage,
            # and fall back to the historical project-root location.
            project_root = Path(__file__).parent.parent.parent.parent
            backend_root = project_root / "backend"
            backend_csv = backend_root / "testrail_testcases.csv"
            project_csv = project_root / "testrail_testcases.csv"

            if backend_csv.exists():
                csv_path = backend_csv
            else:
                csv_path = project_csv
        
        self.csv_path = Path(csv_path)
        self.test_cases = []
        self._search_rows: List[Dict] = []
        self._cases_by_id: Dict[str, Dict] = {}
        self._load_test_cases()
    
    def _load_test_cases(self):
        """Load test cases from CSV file"""
        if not self.csv_path.exists():

            return
        
        try:
            with open(self.csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                self.test_cases = list(reader)

            self._build_search_index()
            
        except Exception as e:

            self.test_cases = []
            self._search_rows = []
            self._cases_by_id = {}

    def _build_search_index(self):
        """Precompute normalized search text for faster heuristic matching."""
        self._search_rows = []
        self._cases_by_id = {}

        for case in self.test_cases:
            case_id = case.get('ID', '')
            title = case.get('Title', '')
            section = case.get('Section', '')
            section_hierarchy = case.get('Section Hierarchy', '')
            section_description = case.get('Section Description', '')

            search_text = ' | '.join([
                title,
                section,
                section_hierarchy,
                section_description,
            ]).lower()

            normalized_text = self._normalize_text(search_text)
            tokens = set(self._tokenize(search_text))

            indexed_case = {
                'case': case,
                'search_text': search_text,
                'normalized_text': normalized_text,
                'tokens': tokens,
            }
            self._search_rows.append(indexed_case)
            if case_id:
                self._cases_by_id[case_id] = case

    def _normalize_text(self, text: str) -> str:
        return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r'[a-z0-9]+', text.lower())
        return [token for token in tokens if len(token) >= 3]

    def _extract_summary_terms(self, summary: str) -> List[str]:
        bracket_terms = re.findall(r'\[([^\]]+)\]', summary or '')
        cleaned_summary = re.sub(r'\[[^\]]+\]', ' ', summary or '')

        raw_terms = []
        for bracket_term in bracket_terms:
            raw_terms.extend(self._tokenize(bracket_term))
        raw_terms.extend(self._tokenize(cleaned_summary))

        unique_terms = []
        seen = set()
        for term in raw_terms:
            if term in self.MATCH_STOP_WORDS or term in seen:
                continue
            seen.add(term)
            unique_terms.append(term)

        return unique_terms[:8]

    def _format_case(self, case: Dict, score: Optional[int] = None, match_type: Optional[str] = None) -> Dict:
        priority = case.get('Priority', 'Medium')

        if priority.lower() == 'critical':
            priority_id = 1
            priority_color = '#ff1744'
        elif priority.lower() == 'high':
            priority_id = 2
            priority_color = '#ff9800'
        elif priority.lower() == 'medium':
            priority_id = 3
            priority_color = '#4caf50'
        else:
            priority_id = 4
            priority_color = '#9e9e9e'

        formatted = {
            'id': case.get('ID', ''),
            'title': case.get('Title', ''),
            'priority_id': priority_id,
            'priority_label': priority.title(),
            'priority_color': priority_color,
            'section': case.get('Section', ''),
            'section_hierarchy': case.get('Section Hierarchy', ''),
            'section_description': case.get('Section Description', '')
        }

        if score is not None:
            formatted['match_score'] = score
        if match_type is not None:
            formatted['match_type'] = match_type

        return formatted
    
    def get_all_test_cases(self) -> List[Dict]:
        """Get all test cases from CSV"""
        return self.test_cases
    
    def search_test_cases_by_title(self, search_term: str) -> List[Dict]:
        """
        Search test cases by title
        
        Args:
            search_term: Search term to match in test case titles
            
        Returns:
            List of matching test cases
        """
        if not search_term:
            return []
        
        search_term = search_term.lower()
        matching_cases = [
            case for case in self.test_cases
            if search_term in case.get('Title', '').lower()
            or search_term in case.get('Section', '').lower()
            or search_term in case.get('Section Hierarchy', '').lower()
        ]
        
        return matching_cases
    
    def get_test_cases_for_ticket(self, ticket_key: str, ticket_summary: str = '') -> List[Dict]:
        """
        Get test cases related to a specific ticket (e.g., UCP-2800)
        
        Args:
            ticket_key: Jira ticket key (e.g., "UCP-2800")
            ticket_summary: Optional ticket summary used for heuristic matching
            
        Returns:
            List of relevant test cases with formatted data
        """
        if not ticket_key:
            return []

        ticket_key_lower = ticket_key.lower()
        direct_matches = []

        for indexed_case in self._search_rows:
            if ticket_key_lower in indexed_case['search_text']:
                direct_matches.append(indexed_case['case'])

        if direct_matches:
            return [self._format_case(case, match_type='direct_ticket_match') for case in direct_matches]

        summary_terms = self._extract_summary_terms(ticket_summary)
        if not summary_terms:
            return []

        scored_matches = []
        for indexed_case in self._search_rows:
            score = 0
            tokens = indexed_case['tokens']
            case = indexed_case['case']
            title_text = self._normalize_text(case.get('Title', ''))
            section_text = self._normalize_text(case.get('Section', ''))
            hierarchy_text = self._normalize_text(case.get('Section Hierarchy', ''))

            for term in summary_terms:
                if term in hierarchy_text:
                    score += 5
                elif term in section_text:
                    score += 4
                elif term in title_text:
                    score += 3
                elif term in tokens:
                    score += 2

            # Reward multi-term overlap so results are more specific.
            overlap = sum(1 for term in summary_terms if term in tokens)
            if overlap >= 2:
                score += overlap * 2
            if overlap >= 3:
                score += 4

            if score >= 6:
                scored_matches.append((score, case))

        scored_matches.sort(
            key=lambda item: (
                -item[0],
                self._priority_rank(item[1].get('Priority', 'Medium')),
                item[1].get('Title', '')
            )
        )

        deduped = []
        seen_ids = set()
        for score, case in scored_matches:
            case_id = case.get('ID', '')
            if case_id in seen_ids:
                continue
            seen_ids.add(case_id)
            deduped.append(self._format_case(case, score=score, match_type='summary_keyword_match'))
            if len(deduped) >= self.MAX_RELATED_RESULTS:
                break

        return deduped
    
    def get_test_cases_for_tickets(self, ticket_keys: List[str]) -> Dict[str, List[Dict]]:
        """
        Get test cases for multiple tickets
        
        Args:
            ticket_keys: List of Jira ticket keys
            
        Returns:
            Dictionary mapping ticket keys to their test cases
        """
        results = {}
        for ticket_key in ticket_keys:
            results[ticket_key] = self.get_test_cases_for_ticket(ticket_key)
        
        return results

    def get_test_cases_by_ids(self, test_case_ids: List[str]) -> List[Dict]:
        """Resolve a list of test case IDs to formatted test case objects."""
        results = []
        for test_case_id in test_case_ids:
            case = self._cases_by_id.get(test_case_id)
            if case:
                results.append(self._format_case(case))
        return results

    def _priority_rank(self, priority: str) -> int:
        priority_lower = str(priority).lower()
        if priority_lower == 'critical':
            return 0
        if priority_lower == 'high':
            return 1
        if priority_lower == 'medium':
            return 2
        return 3
    
    def get_stats(self) -> Dict:
        """Get statistics about test cases"""
        priority_counts = {
            'Critical': 0,
            'High': 0,
            'Medium': 0,
            'Low': 0
        }
        
        for case in self.test_cases:
            priority = case.get('Priority', 'Medium').title()
            if priority in priority_counts:
                priority_counts[priority] += 1
        
        return {
            'total_test_cases': len(self.test_cases),
            'priority_breakdown': priority_counts
        }

# Singleton instance
testrail_csv_service = TestRailCSVService()
