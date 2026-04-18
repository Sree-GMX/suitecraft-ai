import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Person as PersonIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collaboratorService, usersService, UserSummary, User } from '../services/api';

interface CollaboratorManagerProps {
  releaseId: number;
  isOwner: boolean;
}

export const CollaboratorManager: React.FC<CollaboratorManagerProps> = ({ releaseId, isOwner }) => {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch collaborators
  const { data: collaborators = [], isLoading: loadingCollaborators } = useQuery({
    queryKey: ['collaborators', releaseId],
    queryFn: async () => {
      const response = await collaboratorService.getAll(releaseId);
      return response.data;
    },
  });
  
  // Fetch all users for search
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users', searchQuery],
    queryFn: async () => {
      const response = await usersService.search(searchQuery);
      return response.data;
    },
    enabled: addDialogOpen,
  });
  
  // Add collaborator mutation
  const addMutation = useMutation({
    mutationFn: (userId: number) => collaboratorService.add(releaseId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', releaseId] });
      queryClient.invalidateQueries({ queryKey: ['release', releaseId] });
      setAddDialogOpen(false);
      setSelectedUser(null);
    },
  });
  
  // Remove collaborator mutation
  const removeMutation = useMutation({
    mutationFn: (userId: number) => collaboratorService.remove(releaseId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', releaseId] });
      queryClient.invalidateQueries({ queryKey: ['release', releaseId] });
    },
  });
  
  const handleAddCollaborator = () => {
    if (selectedUser) {
      addMutation.mutate(selectedUser.id);
    }
  };
  
  const handleRemoveCollaborator = (userId: number) => {
    if (window.confirm('Are you sure you want to remove this collaborator?')) {
      removeMutation.mutate(userId);
    }
  };
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          Collaborators ({collaborators.length})
        </Typography>
        {isOwner && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Collaborator
          </Button>
        )}
      </Box>
      
      {loadingCollaborators ? (
        <CircularProgress />
      ) : collaborators.length === 0 ? (
        <Alert severity="info">
          No collaborators added yet. {isOwner && 'Click "Add Collaborator" to invite team members.'}
        </Alert>
      ) : (
        <List>
          {collaborators.map((collab) => (
            <ListItem
              key={collab.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {collab.full_name || collab.username}
                    <Chip label={collab.email} size="small" variant="outlined" />
                  </Box>
                }
                secondary={`Username: @${collab.username}`}
              />
              {isOwner && (
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={() => handleRemoveCollaborator(collab.id)}
                    disabled={removeMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      )}
      
      {/* Add Collaborator Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Collaborator</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Autocomplete
              options={allUsers.filter(
                (user) => !collaborators.find((c) => c.id === user.id)
              )}
              getOptionLabel={(option) => `${option.full_name || option.username} (${option.email})`}
              value={selectedUser}
              onChange={(_, newValue) => setSelectedUser(newValue)}
              onInputChange={(_, newInputValue) => setSearchQuery(newInputValue)}
              loading={loadingUsers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search users"
                  placeholder="Type to search by name, username, or email"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUsers && <CircularProgress size={20} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            
            {addMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {(() => {
                  const errorData = (addMutation.error as any)?.response?.data;
                  if (typeof errorData?.detail === 'string') {
                    return errorData.detail;
                  }
                  if (Array.isArray(errorData?.detail)) {
                    return errorData.detail.map((err: any) => err.msg).join(', ');
                  }
                  return 'Failed to add collaborator';
                })()}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddCollaborator}
            disabled={!selectedUser || addMutation.isPending}
          >
            {addMutation.isPending ? 'Adding...' : 'Add Collaborator'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
