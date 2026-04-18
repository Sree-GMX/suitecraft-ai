import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  RocketLaunch as RocketIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  TrendingUp as TrendingIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { releaseService, Feature } from '../services/api';
import { SUITECRAFT_TOKENS } from '../styles/theme';
import { CollaboratorManager } from '../components/CollaboratorManager';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: '#6B7280', bgcolor: '#F3F4F6' },
  in_progress: { label: 'In Progress', color: '#3B82F6', bgcolor: '#EFF6FF' },
  testing: { label: 'Testing', color: '#F59E0B', bgcolor: '#FFF7ED' },
  ready: { label: 'Ready', color: '#10B981', bgcolor: '#ECFDF5' },
  deployed: { label: 'Deployed', color: '#8B5CF6', bgcolor: '#F5F3FF' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgcolor: '#FEF2F2' },
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#EF4444', bgcolor: '#FEF2F2' },
  high: { label: 'High', color: '#F59E0B', bgcolor: '#FFF7ED' },
  medium: { label: 'Medium', color: '#3B82F6', bgcolor: '#EFF6FF' },
  low: { label: 'Low', color: '#10B981', bgcolor: '#ECFDF5' },
};

export default function ReleaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [showDeleteFeature, setShowDeleteFeature] = useState<number | null>(null);

  // Form State
  const [editForm, setEditForm] = useState({
    release_name: '',
    description: '',
    status: '',
    target_date: '',
  });

  const [newFeature, setNewFeature] = useState({
    ticket_id: '',
    ticket_type: 'feature',
    title: '',
    description: '',
    priority: 'medium',
  });

  // Fetch release
  const { data: release, isLoading } = useQuery({
    queryKey: ['release', id],
    queryFn: async () => {
      const response = await releaseService.getById(Number(id));
      setEditForm({
        release_name: response.data.release_name,
        description: response.data.description || '',
        status: response.data.status,
        target_date: response.data.target_date
          ? new Date(response.data.target_date).toISOString().split('T')[0]
          : '',
      });
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch permissions
  const { data: permissions } = useQuery({
    queryKey: ['permissions', id],
    queryFn: async () => {
      const response = await releaseService.getPermissions(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch features
  const { data: features = [], refetch: refetchFeatures } = useQuery({
    queryKey: ['features', id],
    queryFn: async () => {
      const response = await releaseService.getFeatures(Number(id));
      return response.data;
    },
    enabled: !!id,
  });

  // Update release mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => releaseService.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['release', id] });
      setIsEditing(false);
    },
  });

  // Add feature mutation
  const addFeatureMutation = useMutation({
    mutationFn: (data: any) => releaseService.addFeature(Number(id), data),
    onSuccess: () => {
      refetchFeatures();
      setShowAddFeature(false);
      setNewFeature({
        ticket_id: '',
        ticket_type: 'feature',
        title: '',
        description: '',
        priority: 'medium',
      });
    },
  });

  // Delete feature mutation  
  const deleteFeatureMutation = useMutation({
    mutationFn: (featureId: number) => releaseService.deleteFeature(Number(id), featureId),
    onSuccess: () => {
      refetchFeatures();
      setShowDeleteFeature(null);
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    addFeatureMutation.mutate(newFeature);
  };

  if (isLoading || !release) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography>Loading release details...</Typography>
        </Box>
      </Container>
    );
  }

  const statusConfig = STATUS_CONFIG[release.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
  const canEdit = permissions?.can_edit || permissions?.is_owner;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAFAFA', py: 4 }}>
      <Container maxWidth="xl">
        {/* Back Button */}
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/releases')}
          sx={{
            mb: 3,
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          Back to Releases
        </Button>

        {/* Header Card */}
        <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(0, 0, 0, 0.06)' }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={3}>
              <Box sx={{ flexGrow: 1 }}>
                {isEditing ? (
                  <Stack spacing={2}>
                    <TextField
                      label="Release Name"
                      value={editForm.release_name}
                      onChange={(e) => setEditForm({ ...editForm, release_name: e.target.value })}
                      fullWidth
                    />
                    <TextField
                      label="Description"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      multiline
                      rows={3}
                      fullWidth
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          select
                          label="Status"
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          fullWidth
                        >
                          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                            <MenuItem key={value} value={value}>
                              {config.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          type="date"
                          label="Target Date"
                          value={editForm.target_date}
                          onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  </Stack>
                ) : (
                  <>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                      {release.release_version}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                      {release.release_name}
                    </Typography>
                    {release.description && (
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        {release.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Chip
                        label={statusConfig.label}
                        sx={{
                          bgcolor: statusConfig.bgcolor,
                          color: statusConfig.color,
                          fontWeight: 700,
                        }}
                      />
                      {release.target_date && (
                        <Chip
                          icon={<CalendarIcon sx={{ fontSize: 16 }} />}
                          label={new Date(release.target_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          variant="outlined"
                        />
                      )}
                      {release.owner && (
                        <Chip
                          icon={<PersonIcon sx={{ fontSize: 16 }} />}
                          label={release.owner.username}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </>
                )}
              </Box>

              {/* Actions */}
              <Stack direction="row" spacing={1}>
                {isEditing ? (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={() => setIsEditing(false)}
                      sx={{ textTransform: 'none' }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      sx={{
                        bgcolor: SUITECRAFT_TOKENS.colors.primary,
                        textTransform: 'none',
                      }}
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setIsEditing(true)}
                        sx={{ textTransform: 'none' }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<DashboardIcon />}
                      onClick={() => navigate(`/release-overview/${id}`)}
                      sx={{ textTransform: 'none' }}
                    >
                      Overview
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<TrendingIcon />}
                      onClick={() => navigate(`/unified-workflow/${id}`)}
                      sx={{
                        bgcolor: SUITECRAFT_TOKENS.colors.primary,
                        textTransform: 'none',
                      }}
                    >
                      Workflow
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Left Column - Features */}
          <Grid item xs={12} lg={8}>
            <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                  <Typography variant="h6" fontWeight={700}>
                    Features & Tickets
                  </Typography>
                  {canEdit && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setShowAddFeature(true)}
                      sx={{
                        bgcolor: SUITECRAFT_TOKENS.colors.primary,
                        textTransform: 'none',
                      }}
                    >
                      Add Feature
                    </Button>
                  )}
                </Stack>

                {features.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      No features added yet
                    </Typography>
                    {canEdit && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setShowAddFeature(true)}
                        sx={{ mt: 2, textTransform: 'none' }}
                      >
                        Add First Feature
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {features.map((feature: Feature) => {
                      const priorityConfig = PRIORITY_CONFIG[feature.priority as keyof typeof PRIORITY_CONFIG];
                      return (
                        <Paper
                          key={feature.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            border: '1px solid rgba(0, 0, 0, 0.06)',
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: SUITECRAFT_TOKENS.colors.primary,
                              bgcolor: 'rgba(71, 85, 105, 0.02)',
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ flexGrow: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                <Chip
                                  label={feature.ticket_id}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(71, 85, 105, 0.1)',
                                    color: SUITECRAFT_TOKENS.colors.primary,
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                  }}
                                />
                                <Chip
                                  label={priorityConfig.label}
                                  size="small"
                                  sx={{
                                    bgcolor: priorityConfig.bgcolor,
                                    color: priorityConfig.color,
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                  }}
                                />
                                {(feature.risk_score ?? 0) > 0.7 && (
                                  <Chip
                                    label="High Risk"
                                    size="small"
                                    color="error"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                )}
                              </Stack>
                              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                {feature.title}
                              </Typography>
                              {feature.description && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {feature.description}
                                </Typography>
                              )}
                              {feature.impacted_modules && feature.impacted_modules.length > 0 && (
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                                  {feature.impacted_modules.map((module, idx) => (
                                    <Chip
                                      key={idx}
                                      label={module}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  ))}
                                </Stack>
                              )}
                            </Box>
                            {canEdit && (
                              <IconButton
                                size="small"
                                onClick={() => setShowDeleteFeature(feature.id)}
                                sx={{ color: 'text.secondary' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Details & Team */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              {/* Release Info */}
              <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.06)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Release Information
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <List dense disablePadding>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            VERSION
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                            {release.release_version}
                          </Typography>
                        }
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            STATUS
                          </Typography>
                        }
                        secondary={
                          <Chip
                            label={statusConfig.label}
                            size="small"
                            sx={{
                              mt: 0.5,
                              bgcolor: statusConfig.bgcolor,
                              color: statusConfig.color,
                              fontWeight: 700,
                            }}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            TARGET DATE
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                            {release.target_date
                              ? new Date(release.target_date).toLocaleDateString()
                              : 'Not set'}
                          </Typography>
                        }
                      />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            FEATURES
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                            {features.length} feature{features.length !== 1 ? 's' : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>

              {/* Team & Collaborators */}
              <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.06)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Team & Collaborators
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <CollaboratorManager
                    releaseId={Number(id)}
                    isOwner={permissions?.is_owner || false}
                  />
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {/* Add Feature Dialog */}
        <Dialog
          open={showAddFeature}
          onClose={() => setShowAddFeature(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 2,
              border: '1px solid rgba(0, 0, 0, 0.06)',
            },
          }}
        >
          <form onSubmit={handleAddFeature}>
            <DialogTitle>
              <Typography variant="h6" fontWeight={700}>
                Add Feature / Ticket
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField
                  label="Ticket ID"
                  placeholder="e.g., JIRA-1234"
                  value={newFeature.ticket_id}
                  onChange={(e) => setNewFeature({ ...newFeature, ticket_id: e.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  select
                  label="Type"
                  value={newFeature.ticket_type}
                  onChange={(e) => setNewFeature({ ...newFeature, ticket_type: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="feature">Feature</MenuItem>
                  <MenuItem value="enhancement">Enhancement</MenuItem>
                  <MenuItem value="bug">Bug Fix</MenuItem>
                  <MenuItem value="hotfix">Hotfix</MenuItem>
                </TextField>
                <TextField
                  label="Title"
                  placeholder="Feature title"
                  value={newFeature.title}
                  onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  label="Description"
                  placeholder="Detailed description..."
                  value={newFeature.description}
                  onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                  multiline
                  rows={4}
                  fullWidth
                />
                <TextField
                  select
                  label="Priority"
                  value={newFeature.priority}
                  onChange={(e) => setNewFeature({ ...newFeature, priority: e.target.value })}
                  fullWidth
                >
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <MenuItem key={value} value={value}>
                      {config.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setShowAddFeature(false)} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={addFeatureMutation.isPending}
                sx={{
                  bgcolor: SUITECRAFT_TOKENS.colors.primary,
                  textTransform: 'none',
                  px: 4,
                }}
              >
                {addFeatureMutation.isPending ? 'Adding...' : 'Add Feature'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Delete Feature Confirmation */}
        <Dialog
          open={showDeleteFeature !== null}
          onClose={() => setShowDeleteFeature(null)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 2,
              border: '1px solid rgba(0, 0, 0, 0.06)',
            },
          }}
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight={700}>
              Delete Feature?
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Are you sure you want to remove this feature from the release?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setShowDeleteFeature(null)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => showDeleteFeature && deleteFeatureMutation.mutate(showDeleteFeature)}
              disabled={deleteFeatureMutation.isPending}
              sx={{ textTransform: 'none', px: 4 }}
            >
              {deleteFeatureMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
