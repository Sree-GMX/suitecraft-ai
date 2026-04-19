import { useState } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import {
  ContentPaste as ImportIcon,
  AutoAwesome as GenerateIcon,
  RateReview as ReviewIcon,
  PlayArrow as RunIcon,
  CheckCircle as CompleteIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

interface WorkflowStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  completedSteps: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
    step4: boolean;
  };
  onStepClick: (step: 1 | 2 | 3 | 4) => void;
}

const STEPS = [
  {
    number: 1,
    label: 'Scope Release',
    subtitle: 'Select tickets and confirm coverage.',
    icon: ImportIcon,
    accent: '#2563EB',
  },
  {
    number: 2,
    label: 'Generate Strategy',
    subtitle: 'Build a release-specific test plan.',
    icon: GenerateIcon,
    accent: '#F97316',
  },
  {
    number: 3,
    label: 'Review And Approve',
    subtitle: 'Refine and approve the final plan.',
    icon: ReviewIcon,
    accent: '#DB2777',
  },
  {
    number: 4,
    label: 'Execute And Monitor',
    subtitle: 'Track execution and release health.',
    icon: RunIcon,
    accent: '#059669',
  },
] as const;

export default function WorkflowStepper({
  currentStep,
  completedSteps,
  onStepClick,
}: WorkflowStepperProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const isStepAccessible = (stepNumber: number): boolean => {
    if (stepNumber === 1) return true;
    if (stepNumber === 2) return completedSteps.step1;
    if (stepNumber === 3) return completedSteps.step2;
    if (stepNumber === 4) return completedSteps.step3;
    return false;
  };

  const isStepComplete = (stepNumber: number): boolean => {
    if (stepNumber === 1) return completedSteps.step1;
    if (stepNumber === 2) return completedSteps.step2;
    if (stepNumber === 3) return completedSteps.step3;
    if (stepNumber === 4) return completedSteps.step4;
    return false;
  };

  const getDockScale = (stepNumber: number, isActive: boolean) => {
    const focusStep = hoveredStep ?? currentStep;
    const distance = Math.abs(focusStep - stepNumber);

    if (hoveredStep === null) {
      if (distance === 0) return 1.12;
      if (distance === 1) return 0.9;
      if (distance === 2) return 0.82;
      return 0.76;
    }

    if (distance === 0) return isActive ? 1.2 : 1.1;
    if (distance === 1) return 0.96;
    if (distance === 2) return 0.88;
    return 0.8;
  };

  return (
    <Box
      onMouseLeave={() => setHoveredStep(null)}
      sx={{
        display: 'flex',
        justifyContent: { xs: 'center', lg: 'flex-start' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 0.65,
          px: 1.2,
          py: 1.25,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.64)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(241,245,249,0.18) 100%)',
          backdropFilter: 'blur(24px) saturate(175%)',
          boxShadow: '0 24px 54px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.78)',
        }}
      >
        {STEPS.map((step) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.number;
          const isComplete = isStepComplete(step.number);
          const isAccessible = isStepAccessible(step.number);
          const isHovered = hoveredStep === step.number;
          const showLabel = isHovered;
          const scale = getDockScale(step.number, isActive);

          return (
            <Box
              key={step.number}
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: isActive ? 0.28 : 0.12,
              }}
            >
              <Box
                component="button"
                type="button"
                aria-label={step.label}
                onMouseEnter={() => setHoveredStep(step.number)}
                onFocus={() => setHoveredStep(step.number)}
                onClick={() => isAccessible && onStepClick(step.number as 1 | 2 | 3 | 4)}
                sx={{
                  width: 58,
                  height: 58,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 3.5,
                  border: '1px solid',
                  borderColor: isActive ? `${step.accent}66` : 'rgba(148, 163, 184, 0.22)',
                  bgcolor: isComplete
                    ? step.accent
                    : isActive
                      ? `${step.accent}20`
                      : 'rgba(255,255,255,0.54)',
                  color: isComplete ? '#FFFFFF' : isActive ? step.accent : '#475569',
                  boxShadow: isComplete
                    ? `0 18px 30px ${step.accent}${isActive ? '46' : '32'}`
                    : isActive
                      ? `0 16px 30px ${step.accent}28`
                      : '0 8px 18px rgba(15, 23, 42, 0.08)',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease',
                  cursor: isAccessible ? 'pointer' : 'not-allowed',
                  opacity: isAccessible ? 1 : 0.48,
                  appearance: 'none',
                  m: 0,
                  p: 0,
                  font: 'inherit',
                  outline: 'none',
                  position: 'relative',
                  zIndex: isHovered ? 2 : 1,
                  '&:focus-visible': {
                    boxShadow: `0 0 0 4px ${step.accent}24, ${isComplete ? `0 18px 30px ${step.accent}40` : '0 10px 22px rgba(15, 23, 42, 0.10)'}`,
                  },
                }}
              >
                {isComplete ? <CompleteIcon fontSize="small" /> : <StepIcon fontSize="small" />}
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  left: 78,
                  top: '50%',
                  transform: showLabel ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-8px)',
                  opacity: showLabel ? 1 : 0,
                  pointerEvents: 'none',
                  transition: 'opacity 180ms ease, transform 180ms ease',
                  zIndex: 3,
                  minWidth: 210,
                }}
              >
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.68)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.44) 0%, rgba(248,250,252,0.24) 100%)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.16)',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.45 }}>
                    <Typography variant="body2" fontWeight={800} color="#0F172A">
                      {step.label}
                    </Typography>
                    {isActive ? (
                      <Chip label="Current" size="small" sx={{ bgcolor: `${step.accent}18`, color: step.accent, fontWeight: 700 }} />
                    ) : isComplete ? (
                      <Chip label="Done" size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 }} />
                    ) : isAccessible ? (
                      <Chip label="Ready" size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    ) : (
                      <Chip icon={<LockIcon sx={{ fontSize: 14 }} />} label="Locked" size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    )}
                  </Stack>

                  <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.45, display: 'block' }}>
                    {step.subtitle}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
