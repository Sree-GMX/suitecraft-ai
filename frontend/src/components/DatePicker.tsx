import { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Popover,
  Typography,
  IconButton,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';
import dayjs, { Dayjs } from 'dayjs';

interface DatePickerProps {
  label: string;
  value: Dayjs | null;
  onChange: (date: Dayjs | null) => void;
  fullWidth?: boolean;
  required?: boolean;
  sx?: any;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DatePicker({ label, value, onChange, fullWidth, required, sx }: DatePickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setCurrentMonth(value);
    }
  }, [value]);

  const handleOpen = () => {
    setAnchorEl(inputRef.current);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDateClick = (date: Dayjs) => {
    onChange(date);
    handleClose();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const getDaysInMonth = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const daysInMonth = endOfMonth.date();
    const startDay = startOfMonth.day();

    const days: (Dayjs | null)[] = [];

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(currentMonth.date(i));
    }

    return days;
  };

  const isToday = (date: Dayjs | null) => {
    if (!date) return false;
    return date.isSame(dayjs(), 'day');
  };

  const isSelected = (date: Dayjs | null) => {
    if (!date || !value) return false;
    return date.isSame(value, 'day');
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <TextField
        ref={inputRef}
        label={label}
        value={value ? value.format('MMM DD, YYYY') : ''}
        onClick={handleOpen}
        required={required}
        fullWidth={fullWidth}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <CalendarIcon 
              sx={{ 
                color: SUITECRAFT_TOKENS.colors.text.secondary,
                cursor: 'pointer',
              }} 
            />
          ),
        }}
        sx={[
          {
            '& .MuiOutlinedInput-root': {
              background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.54) 100%)',
              backdropFilter: SUITECRAFT_TOKENS.effects.glass.sm,
              cursor: 'pointer',
              '&:hover fieldset': {
                borderColor: SUITECRAFT_TOKENS.colors.primaryLight,
              },
              '&.Mui-focused fieldset': {
                borderColor: SUITECRAFT_TOKENS.colors.primaryLight,
              },
            },
            '& input': {
              cursor: 'pointer',
            }
          },
          sx,
        ]}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              ...SUITECRAFT_STYLES.floatingGlass,
              borderRadius: 3,
              overflow: 'visible',
            }
          }
        }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          {/* Header with month/year navigation */}
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            mb={2}
          >
            <IconButton 
              onClick={handlePrevMonth}
              size="small"
              sx={{
                color: SUITECRAFT_TOKENS.colors.primary,
                '&:hover': {
                  background: SUITECRAFT_TOKENS.colors.accent.cyanTint,
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            
            <Typography 
              variant="subtitle1" 
              fontWeight={600}
              sx={{ color: SUITECRAFT_TOKENS.colors.text.primary }}
            >
              {MONTHS[currentMonth.month()]} {currentMonth.year()}
            </Typography>
            
            <IconButton 
              onClick={handleNextMonth}
              size="small"
              sx={{
                color: SUITECRAFT_TOKENS.colors.primary,
                '&:hover': {
                  background: SUITECRAFT_TOKENS.colors.accent.cyanTint,
                }
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Weekday headers */}
          <Box display="flex" gap={0.5} mb={1}>
            {WEEKDAYS.map((day) => (
              <Box
                key={day}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  color: SUITECRAFT_TOKENS.colors.text.secondary,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {day}
              </Box>
            ))}
          </Box>

          {/* Calendar days */}
          <Box 
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 0.5,
            }}
          >
            {getDaysInMonth().map((date, index) => (
              <Box key={index}>
                {date ? (
                  <Box
                    onClick={() => handleDateClick(date)}
                    sx={{
                      width: '100%',
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      color: isSelected(date) 
                        ? 'white' 
                        : SUITECRAFT_TOKENS.colors.text.primary,
                      background: isSelected(date)
                        ? SUITECRAFT_TOKENS.colors.primary
                        : isToday(date)
                        ? 'rgba(51, 65, 85, 0.1)'
                        : 'transparent',
                      border: isToday(date) && !isSelected(date)
                        ? `1px solid ${SUITECRAFT_TOKENS.colors.primary}`
                        : '1px solid transparent',
                      '&:hover': {
                        background: isSelected(date)
                          ? SUITECRAFT_TOKENS.colors.primaryDark
                          : 'rgba(51, 65, 85, 0.15)',
                      },
                    }}
                  >
                    {date.date()}
                  </Box>
                ) : (
                  <Box sx={{ height: 40 }} />
                )}
              </Box>
            ))}
          </Box>

          {/* Today button */}
          <Box 
            display="flex" 
            justifyContent="center" 
            mt={2}
            pt={2}
            borderTop="1px solid rgba(0, 0, 0, 0.06)"
          >
            <Typography
              onClick={() => handleDateClick(dayjs())}
              sx={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: SUITECRAFT_TOKENS.colors.primary,
                cursor: 'pointer',
                py: 0.5,
                px: 2,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'rgba(51, 65, 85, 0.08)',
                }
              }}
            >
              Today
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
