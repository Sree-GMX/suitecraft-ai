import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/**
 * Formatting utility functions
 * Consistent formatting throughout the application
 */

/**
 * Format date string to readable format
 * @param dateString - ISO date string or Date object
 * @param formatStr - date-fns format string (default: 'MMM dd, yyyy')
 */
export const formatDate = (dateString: string | Date | null | undefined, formatStr = 'MMM dd, yyyy'): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return 'Invalid date';
    return format(date, formatStr);
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return 'Invalid date';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Invalid date';
  }
};

/**
 * Format datetime to readable format with time
 */
export const formatDateTime = (dateString: string | Date | null | undefined): string => {
  return formatDate(dateString, 'MMM dd, yyyy h:mm a');
};

/**
 * Format duration in minutes to human-readable format
 * @param minutes - Duration in minutes
 */
export const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes == null || minutes === 0) return 'N/A';
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Format number with commas (e.g., 1000 -> "1,000")
 */
export const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return '0';
  return num.toLocaleString();
};

/**
 * Format percentage
 * @param value - Number between 0 and 1 (or 0-100 if absolute is true)
 * @param decimals - Number of decimal places (default: 0)
 * @param absolute - If true, treats value as already in percentage form (default: false)
 */
export const formatPercentage = (
  value: number | null | undefined,
  decimals = 0,
  absolute = false
): string => {
  if (value == null) return '0%';
  
  const percentage = absolute ? value : value * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes == null || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 */
export const truncateText = (text: string | null | undefined, maxLength = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Format test case ID with prefix
 * @param id - Test case ID number
 * @param prefix - Prefix to add (default: 'TC')
 */
export const formatTestCaseId = (id: number | string, prefix = 'TC'): string => {
  return `${prefix}-${id}`;
};

/**
 * Format ticket ID with project key
 * @param id - Ticket ID number or string
 * @param projectKey - Project key (e.g., 'JIRA')
 */
export const formatTicketId = (id: number | string, projectKey?: string): string => {
  if (projectKey) {
    return `${projectKey}-${id}`;
  }
  return String(id);
};

/**
 * Pluralize word based on count
 * @param count - Number to check
 * @param singular - Singular form of the word
 * @param plural - Plural form (optional, defaults to singular + 's')
 */
export const pluralize = (count: number, singular: string, plural?: string): string => {
  const pluralForm = plural || `${singular}s`;
  return count === 1 ? singular : pluralForm;
};

/**
 * Format test execution summary
 * @param passed - Number of passed tests
 * @param total - Total number of tests
 */
export const formatTestSummary = (passed: number, total: number): string => {
  if (total === 0) return 'No tests';
  return `${passed}/${total} ${pluralize(total, 'test')} passed`;
};

/**
 * Convert snake_case to Title Case
 */
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Convert camelCase or PascalCase to Title Case
 */
export const camelToTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
};

/**
 * Format currency
 * @param amount - Amount in dollars
 * @param currency - Currency code (default: 'USD')
 */
export const formatCurrency = (amount: number | null | undefined, currency = 'USD'): string => {
  if (amount == null) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};
