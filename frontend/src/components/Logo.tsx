import React from 'react';
import { Box } from '@mui/material';
import { SUITECRAFT_TOKENS } from '../styles/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'default' | 'white';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'medium',
  color = 'default',
  className = '',
}) => {
  const isWhite = color === 'white';

  const sizeConfig = {
    small: {
      fontSize: '1.18rem',
      iconBox: 38,
      iconSvg: 28,
      gap: 0.64,
    },
    medium: {
      fontSize: '1.45rem',
      iconBox: 44,
      iconSvg: 32,
      gap: 0.78,
    },
    large: {
      fontSize: '2.32rem',
      iconBox: 58,
      iconSvg: 44,
      gap: 1.02,
    },
  } as const;

  const config = sizeConfig[size];

  return (
    <Box
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: config.gap,
        fontFamily: '"Space Grotesk", "Inter", system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: config.iconBox,
          height: config.iconBox,
          borderRadius: '18px',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: isWhite ? 'rgba(255,255,255,0.12)' : SUITECRAFT_TOKENS.colors.brand.ink,
          border: isWhite ? '1px solid rgba(255,255,255,0.30)' : '1px solid rgba(56, 213, 219, 0.18)',
          boxShadow: isWhite ? 'none' : '0 10px 24px rgba(13, 28, 33, 0.18)',
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 48 48"
          sx={{
            width: config.iconSvg,
            height: config.iconSvg,
            position: 'relative',
            zIndex: 1,
            display: 'block',
          }}
        >
          <circle
            cx="25"
            cy="21"
            r={size === 'small' ? '9.6' : '8.8'}
            fill="none"
            stroke={isWhite ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.brand.cyan}
            strokeWidth={size === 'small' ? '3.4' : '3'}
          />
          <path
            d="M 31.4 27.4 L 38.8 34.8"
            fill="none"
            stroke={isWhite ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.brand.cyan}
            strokeWidth={size === 'small' ? '3.4' : '3'}
            strokeLinecap="round"
          />

          <path
            d="M 12.8 31.8 C 17.2 28.8, 21.6 27.2, 25.8 26.2"
            fill="none"
            stroke={isWhite ? 'rgba(255,255,255,0.84)' : SUITECRAFT_TOKENS.colors.brand.ember}
            strokeWidth={size === 'small' ? '2.6' : '2.2'}
            strokeLinecap="round"
          />
          <circle cx="12.8" cy="31.8" r={size === 'small' ? '2.5' : '2.2'} fill={isWhite ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.brand.ember} />

          <circle cx="25" cy="21" r={size === 'small' ? '4.3' : '4'} fill={isWhite ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.brand.emberSoft} />
          <path
            d="M 21.8 17.8 L 28.2 24.2"
            stroke={isWhite ? SUITECRAFT_TOKENS.colors.brand.ink : SUITECRAFT_TOKENS.colors.brand.ink}
            strokeWidth={size === 'small' ? '1.8' : '1.6'}
            strokeLinecap="round"
          />
          <path
            d="M 28.2 17.8 L 21.8 24.2"
            stroke={isWhite ? SUITECRAFT_TOKENS.colors.brand.ink : SUITECRAFT_TOKENS.colors.brand.ink}
            strokeWidth={size === 'small' ? '1.8' : '1.6'}
            strokeLinecap="round"
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 0.2,
          letterSpacing: '-0.035em',
          lineHeight: 1,
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: config.fontSize,
            fontWeight: 700,
            color: isWhite ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.text.primary,
            textTransform: 'lowercase',
          }}
        >
          suitecraft
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: config.fontSize,
            fontWeight: 700,
            color: isWhite ? 'rgba(255,255,255,0.96)' : SUITECRAFT_TOKENS.colors.brand.ember,
            textTransform: 'lowercase',
          }}
        >
          .ai
        </Box>
      </Box>
    </Box>
  );
};

export default Logo;
