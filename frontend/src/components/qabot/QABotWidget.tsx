import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Divider,
  Fade,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddCommentRounded,
  AutoAwesomeRounded,
  CheckCircleOutlineRounded,
  CloseRounded,
  ForumRounded,
  SendRounded,
  SmartToyRounded,
} from '@mui/icons-material';
import {
  QABotActionDescriptor,
  QABotMessage,
  QABotSession,
  qabotService,
} from '../../services/api';
import { SUITECRAFT_TOKENS } from '../../styles/theme';
import { BugIcon } from '../BugIcon';

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 680;
const MOBILE_BREAKPOINT = 720;

const STARTER_PROMPTS = [
  'Show my current releases',
  'Create release version v2.4 called Spring Launch',
  'What changed in release v2.4?',
  'Find test cases for ticket UCP-2800',
  'Show recent test runs',
  'Create org Sandbox West for release v2.4',
];

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

const useIsMobile = () => {
  const getValue = () => (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false);
  const [isMobile, setIsMobile] = useState(getValue);

  useEffect(() => {
    const onResize = () => setIsMobile(getValue());
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return isMobile;
};

export function QABotWidget() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<QABotSession | null>(null);
  const [messages, setMessages] = useState<QABotMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const isMobile = useIsMobile();

  const latestBotMessage = useMemo(
    () => [...messages].reverse().find((message) => message.is_bot),
    [messages],
  );
  const pendingAction = (latestBotMessage?.metadata_json?.pending_action as QABotActionDescriptor | undefined) ?? null;
  const needsConfirmation = Boolean(latestBotMessage?.metadata_json?.requires_confirmation && pendingAction);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    void ensureSession();
  }, [open]);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      if (launcherRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const ensureSession = async () => {
    if (session) {
      return session;
    }

    setBootstrapping(true);
    setError(null);
    try {
      const existing = await qabotService.listSessions();
      let activeSession = existing.data[0] ?? null;
      if (!activeSession) {
        const created = await qabotService.createSession('QAbot Workspace');
        activeSession = created.data;
      }

      const history = await qabotService.getMessages(activeSession.id);
      setSession(activeSession);
      setMessages(history.data);
      return activeSession;
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to open the assistant right now.');
      return null;
    } finally {
      setBootstrapping(false);
    }
  };

  const sendMessage = async (message: string, confirmAction = false, action?: QABotActionDescriptor | null) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const activeSession = await ensureSession();
      if (!activeSession) {
        return;
      }

      const response = await qabotService.sendMessage(activeSession.id, trimmed, confirmAction, action);
      setMessages((current) => [...current, response.data.user_message, response.data.bot_message]);
      setDraft('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'The assistant could not process that request.');
    } finally {
      setLoading(false);
    }
  };

  const createFreshSession = async () => {
    setCreatingSession(true);
    setError(null);
    try {
      const response = await qabotService.createSession(`QAbot ${new Date().toLocaleDateString()}`);
      setSession(response.data);
      setMessages([]);
      setDraft('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to start a new assistant session.');
    } finally {
      setCreatingSession(false);
    }
  };

  const dismissPendingAction = () => {
    setMessages((current) => {
      if (!current.length) {
        return current;
      }

      const last = current[current.length - 1];
      if (!last.is_bot || !last.metadata_json?.requires_confirmation) {
        return current;
      }

      return [
        ...current.slice(0, -1),
        {
          ...last,
          id: Date.now(),
          message: 'Pending action dismissed. Nothing was changed.',
          metadata_json: { mode: 'confirmation_cancelled' },
          created_at: new Date().toISOString(),
        },
      ];
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage(draft);
  };

  const panelPosition = isMobile
    ? {
        left: 12,
        right: 12,
        top: 12,
        bottom: 12,
      }
    : {
        right: 86,
        top: '50%',
        transform: 'translateY(-50%)',
      };

  return (
    <>
      <Fade in={open} timeout={{ enter: 180, exit: 140 }} unmountOnExit>
        <Paper
          ref={panelRef}
          elevation={0}
          sx={{
            position: 'fixed',
            width: isMobile ? 'auto' : PANEL_WIDTH,
            height: isMobile ? 'auto' : PANEL_HEIGHT,
            maxWidth: isMobile ? 'none' : 'calc(100vw - 32px)',
            maxHeight: isMobile ? 'none' : 'calc(100vh - 120px)',
            zIndex: 1200,
            ...panelPosition,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: { xs: 4, md: 5 },
            border: '1px solid rgba(255,255,255,0.62)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(241,246,248,0.20) 100%)',
            backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
            WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
            boxShadow: '0 30px 72px rgba(13, 28, 33, 0.12), 0 6px 20px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.78)',
          }}
        >
          <Box
              sx={{
                px: 2.5,
                py: 2,
                borderBottom: hasMessages ? '1px solid rgba(255,255,255,0.42)' : 'none',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(248,251,252,0.12) 100%)',
              }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 3,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    background: 'linear-gradient(135deg, rgba(15,76,129,0.94) 0%, rgba(22,93,140,0.88) 60%, rgba(31,108,149,0.82) 100%)',
                    boxShadow: '0 12px 24px rgba(15, 76, 129, 0.18)',
                  }}
                >
                  <BugIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F172A' }}>
                    Release Assistant
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5 }}>
                    Ask about releases, orgs, test runs, and controlled record changes.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => void createFreshSession()}
                  disabled={creatingSession}
                  sx={{
                    color: '#334155',
                    border: '1px solid rgba(255,255,255,0.64)',
                    bgcolor: 'rgba(255,255,255,0.36)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {creatingSession ? <CircularProgress size={16} /> : <AddCommentRounded fontSize="small" />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setOpen(false)}
                  sx={{
                    color: '#334155',
                    border: '1px solid rgba(255,255,255,0.64)',
                    bgcolor: 'rgba(255,255,255,0.36)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ mt: 1.75 }}
            >
              <Box
                sx={{
                  px: 1.25,
                  py: 0.9,
                  borderRadius: 2.5,
                  bgcolor: alpha('#0F4C81', 0.05),
                  border: '1px solid rgba(255,255,255,0.38)',
                }}
              >
                <Typography variant="caption" sx={{ display: 'block', color: '#0F4C81', fontWeight: 800 }}>
                  Workspace mode
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  Read-heavy answers with confirmation before destructive actions
                </Typography>
              </Box>
              <Box
                sx={{
                  px: 1.25,
                  py: 0.9,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(255,255,255,0.44)',
                  border: '1px solid rgba(255,255,255,0.42)',
                  minWidth: 0,
                }}
              >
                <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontWeight: 800 }}>
                  Session
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: '#0F172A',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session?.title || 'Secure assistant session'}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box
            ref={messagesRef}
            sx={{
              flex: 1,
              minHeight: 180,
              overflowY: 'auto',
              px: 2.5,
              py: 2,
              bgcolor: 'rgba(241,245,249,0.26)',
            }}
          >
            {bootstrapping ? (
              <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  Loading assistant workspace...
                </Typography>
              </Stack>
            ) : messages.length === 0 ? (
              <Stack spacing={1.5} justifyContent="center" sx={{ minHeight: '100%' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 3.5,
                    border: '1px solid rgba(255,255,255,0.42)',
                    bgcolor: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2.5,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#0F4C81',
                        bgcolor: alpha('#0F4C81', 0.08),
                        flexShrink: 0,
                      }}
                    >
                      <ForumRounded sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
                        Start with a task, not a command
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.65 }}>
                        Ask for release lookups, record creation, updates, or test-run history. The assistant will guide the next step and request confirmation before risky changes.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 800, mb: 1 }}>
                    Try one of these
                  </Typography>
                  <Stack spacing={1}>
                    {STARTER_PROMPTS.slice(0, 4).map((prompt) => (
                      <Button
                        key={prompt}
                        fullWidth
                        variant="outlined"
                        startIcon={<AutoAwesomeRounded sx={{ fontSize: 16 }} />}
                        onClick={() => void sendMessage(prompt)}
                        sx={{
                          justifyContent: 'flex-start',
                          px: 1.4,
                          py: 1,
                          borderRadius: 3,
                          textTransform: 'none',
                          fontWeight: 700,
                          color: '#0F172A',
                          borderColor: 'rgba(255,255,255,0.42)',
                          bgcolor: 'rgba(255,255,255,0.48)',
                          '&:hover': {
                            borderColor: alpha('#0F4C81', 0.34),
                            bgcolor: alpha('#0F4C81', 0.05),
                          },
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, px: 0.25 }}>
                  Conversation
                </Typography>
                {messages.map((message) => {
                  const isBot = message.is_bot;
                  return (
                    <Box
                      key={message.id}
                      sx={{
                        alignSelf: isBot ? 'flex-start' : 'flex-end',
                        width: '100%',
                        display: 'flex',
                        justifyContent: isBot ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '88%',
                          px: 1.75,
                          py: 1.5,
                          borderRadius: 3.5,
                          border: isBot
                            ? '1px solid rgba(203, 213, 225, 0.9)'
                            : '1px solid rgba(15, 76, 129, 0.18)',
                          bgcolor: isBot ? 'rgba(255,255,255,0.54)' : 'rgba(224,242,254,0.58)',
                          boxShadow: isBot
                            ? '0 10px 24px rgba(15, 23, 42, 0.04)'
                            : '0 12px 24px rgba(14, 116, 144, 0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isBot ? '#0F4C81' : '#155E75',
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                            }}
                          >
                            {isBot ? 'Assistant' : 'You'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                            {formatTimestamp(message.created_at)}
                          </Typography>
                        </Stack>

                        <Typography
                          variant="body2"
                          sx={{
                            color: '#0F172A',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.65,
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {message.message}
                        </Typography>

                        {isBot && Array.isArray(message.metadata_json?.sources) && message.metadata_json.sources.length > 0 && (
                          <Stack spacing={0.9} sx={{ mt: 1.35 }}>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800 }}>
                              Supporting records
                            </Typography>
                            {message.metadata_json.sources.slice(0, 4).map((source: any, index: number) => (
                              <Box
                                key={`${message.id}-source-${index}`}
                                sx={{
                                  px: 1.15,
                                  py: 0.95,
                                  borderRadius: 2.5,
                                  bgcolor: 'rgba(248,250,252,0.52)',
                                  border: '1px solid rgba(255,255,255,0.34)',
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'block', color: '#0F172A', fontWeight: 800 }}>
                                  [{index + 1}] {source.title}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#475569', mt: 0.2 }}>
                                  {source.source_type}{source.record_id ? ` • #${source.record_id}` : ''}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', color: '#64748B', mt: 0.3, lineHeight: 1.5 }}>
                                  {source.summary}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  );
                })}

                {loading && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Box
                      sx={{
                        px: 1.5,
                        py: 1.15,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(255,255,255,0.38)',
                        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={14} />
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
                          Assistant is preparing a response...
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                )}
              </Stack>
            )}
          </Box>

          {needsConfirmation && pendingAction && (
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderTop: '1px solid rgba(251, 191, 36, 0.4)',
                bgcolor: 'rgba(255,247,237,0.66)',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <CheckCircleOutlineRounded sx={{ fontSize: 18, color: '#B45309', mt: '2px' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#B45309', fontWeight: 800, mb: 0.5 }}>
                    Confirmation required
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#7C2D12', mb: 1.2, lineHeight: 1.6 }}>
                    {pendingAction.summary}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void sendMessage(`Confirm ${pendingAction.summary}`, true, pendingAction)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2.5,
                        bgcolor: '#B45309',
                        '&:hover': { bgcolor: '#92400E' },
                      }}
                    >
                      Confirm action
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={dismissPendingAction}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2.5,
                        borderColor: 'rgba(180, 83, 9, 0.28)',
                        color: '#92400E',
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          )}

          <Divider />

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              p: 2,
              bgcolor: 'rgba(255,255,255,0.42)',
              borderTop: '1px solid rgba(255,255,255,0.34)',
            }}
          >
            <Stack spacing={1.25}>
              {error && (
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.95,
                    borderRadius: 2.5,
                    bgcolor: 'rgba(254,242,242,0.76)',
                    border: '1px solid rgba(239, 68, 68, 0.16)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#B91C1C', fontWeight: 700 }}>
                    {error}
                  </Typography>
                </Box>
              )}

              <TextField
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask a question or describe the record change you want to make..."
                multiline
                minRows={3}
                maxRows={6}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (!loading && draft.trim()) {
                      void sendMessage(draft);
                    }
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    alignItems: 'flex-start',
                    borderRadius: 3,
                    bgcolor: 'rgba(248,250,252,0.52)',
                    backdropFilter: SUITECRAFT_TOKENS.effects.glass.sm,
                    WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.sm,
                    '& fieldset': {
                      borderColor: 'rgba(255,255,255,0.34)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(15, 76, 129, 0.34)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#0F4C81',
                    },
                  },
                }}
              />

              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.25}>
                <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.5 }}>
                  Press `Enter` to send. Use `Shift+Enter` for a new line.
                </Typography>
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SendRounded />}
                  disabled={loading || !draft.trim()}
                  sx={{
                    minWidth: 110,
                    borderRadius: 2.75,
                    textTransform: 'none',
                    fontWeight: 800,
                    bgcolor: '#0F4C81',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: '#0C3F6C',
                      boxShadow: 'none',
                    },
                  }}
                >
                  Send
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Fade>

      <IconButton
        ref={launcherRef}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        title={open ? 'Close assistant' : 'Open assistant'}
        sx={{
          position: 'fixed',
          right: isMobile ? 24 : 14,
          top: isMobile ? 'auto' : 'calc(50% - 29px)',
          bottom: isMobile ? 92 : 'auto',
          zIndex: 1201,
          width: isMobile ? 56 : 58,
          height: isMobile ? 56 : 58,
          borderRadius: '50%',
          color: isMobile ? '#FFFFFF' : SUITECRAFT_TOKENS.colors.primary,
          background: isMobile
            ? 'linear-gradient(135deg, #0F4C81 0%, #165D8C 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(248,251,252,0.20) 100%)',
          border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.62)',
          boxShadow: isMobile
            ? '0 18px 36px rgba(15, 76, 129, 0.24)'
            : '0 18px 42px rgba(13, 28, 33, 0.10), 0 2px 10px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
          backdropFilter: isMobile ? 'none' : SUITECRAFT_TOKENS.effects.glass.md,
          WebkitBackdropFilter: isMobile ? 'none' : SUITECRAFT_TOKENS.effects.glass.md,
          transition: 'background 160ms ease, border-color 160ms ease',
          '&:hover': {
            background: isMobile
              ? 'linear-gradient(135deg, #0C3F6C 0%, #124E75 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.54) 0%, rgba(248,251,252,0.28) 100%)',
          },
          '&:focus-visible': {
            outline: `2px solid ${alpha(SUITECRAFT_TOKENS.colors.info, 0.5)}`,
            outlineOffset: 3,
          },
        }}
      >
        <BugIcon sx={{ fontSize: 24 }} />
      </IconButton>
    </>
  );
}
