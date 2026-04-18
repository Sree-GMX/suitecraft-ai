import { SUITECRAFT_TOKENS as DESIGN_TOKENS } from '../styles/theme';

/**
 * Color utility functions - SuiteCraft.AI Design System
 * Single source of truth for color mapping logic
 */

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none' | string;
export type Priority = 'critical' | 'high' | 'medium' | 'low' | string;
export type TestStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'in progress' | 'running' | 'pending' | 'not run' | string;
export type ChipColor = 'error' | 'warning' | 'info' | 'success' | 'default';

/**
 * Get color for risk level
 */
export const getRiskColor = (risk: RiskLevel): string => {
  if (!risk) return DESIGN_TOKENS.colors.risk.none;
  
  switch (risk.toLowerCase().trim()) {
    case 'critical':
      return DESIGN_TOKENS.colors.risk.critical;
    case 'high':
      return DESIGN_TOKENS.colors.risk.high;
    case 'medium':
      return DESIGN_TOKENS.colors.risk.medium;
    case 'low':
      return DESIGN_TOKENS.colors.risk.low;
    case 'none':
    case 'no risk':
      return DESIGN_TOKENS.colors.risk.none;
    default:
      return DESIGN_TOKENS.colors.risk.none;
  }
};

/**
 * Get color for priority level
 */
export const getPriorityColor = (priority: Priority): string => {
  if (!priority) return DESIGN_TOKENS.colors.text.tertiary;
  
  switch (priority.toLowerCase().trim()) {
    case 'critical':
    case 'p0':
      return DESIGN_TOKENS.colors.risk.critical;
    case 'high':
    case 'p1':
      return DESIGN_TOKENS.colors.risk.high;
    case 'medium':
    case 'p2':
      return DESIGN_TOKENS.colors.risk.medium;
    case 'low':
    case 'p3':
      return DESIGN_TOKENS.colors.risk.low;
    default:
      return DESIGN_TOKENS.colors.text.tertiary;
  }
};

/**
 * Get MUI chip color variant for priority
 */
export const getPriorityChipColor = (priority: Priority): ChipColor => {
  if (!priority) return 'default';
  
  switch (priority.toLowerCase().trim()) {
    case 'critical':
    case 'p0':
      return 'error';
    case 'high':
    case 'p1':
      return 'warning';
    case 'medium':
    case 'p2':
      return 'info';
    case 'low':
    case 'p3':
      return 'success';
    default:
      return 'default';
  }
};

/**
 * Get color for test execution status
 */
export const getStatusColor = (status: TestStatus): string => {
  if (!status) return DESIGN_TOKENS.colors.text.tertiary;
  
  switch (status.toLowerCase().trim()) {
    case 'passed':
    case 'pass':
    case 'success':
      return DESIGN_TOKENS.colors.status.passed;
    case 'failed':
    case 'fail':
    case 'failure':
      return DESIGN_TOKENS.colors.status.failed;
    case 'blocked':
      return DESIGN_TOKENS.colors.status.blocked;
    case 'skipped':
    case 'skip':
      return DESIGN_TOKENS.colors.status.skipped;
    case 'in progress':
    case 'running':
    case 'in_progress':
      return DESIGN_TOKENS.colors.status.running;
    case 'pending':
      return DESIGN_TOKENS.colors.status.pending;
    case 'not run':
    case 'not_run':
    case 'untested':
      return DESIGN_TOKENS.colors.text.tertiary;
    default:
      return DESIGN_TOKENS.colors.text.tertiary;
  }
};

/**
 * Get MUI chip color variant for test status
 */
export const getStatusChipColor = (status: TestStatus): ChipColor => {
  if (!status) return 'default';
  
  switch (status.toLowerCase().trim()) {
    case 'passed':
    case 'pass':
    case 'success':
      return 'success';
    case 'failed':
    case 'fail':
    case 'failure':
      return 'error';
    case 'blocked':
      return 'warning';
    case 'skipped':
    case 'skip':
      return 'default';
    case 'in progress':
    case 'running':
    case 'in_progress':
      return 'info';
    case 'not run':
    case 'not_run':
    case 'untested':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get background color with opacity for status badges
 */
export const getStatusBackgroundColor = (status: TestStatus): string => {
  const color = getStatusColor(status);
  // Extract RGB values and add opacity
  const opacity = '0.1';
  
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get appropriate text color (light/dark) based on background color
 * Useful for ensuring readable text on colored backgrounds
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

/**
 * Get severity level numeric value for sorting
 */
export const getRiskSeverity = (risk: RiskLevel): number => {
  switch (risk?.toLowerCase().trim()) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    case 'none':
    case 'no risk':
      return 0;
    default:
      return 0;
  }
};

/**
 * Get priority numeric value for sorting
 */
export const getPrioritySeverity = (priority: Priority): number => {
  switch (priority?.toLowerCase().trim()) {
    case 'critical':
    case 'p0':
      return 4;
    case 'high':
    case 'p1':
      return 3;
    case 'medium':
    case 'p2':
      return 2;
    case 'low':
    case 'p3':
      return 1;
    default:
      return 0;
  }
};
