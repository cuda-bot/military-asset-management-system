import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    CircularProgress,
    Alert,
    TextField,
} from '@mui/material';
import api from '../../services/api';

const roleOptions = ['admin', 'base_commander', 'logistics_officer'];

const EditUser = ({ open, onClose, onSuccess, user }) => {
    const { handleSubmit, control, formState: { errors }, reset } = useForm();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (user) {
            reset({
                username: user.username,
                role: user.role,
                base_id: user.base_id || '',
            });
        }
    }, [user, reset]);

    const { data: bases } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data.bases)
    });

    const editUserMutation = useMutation({
        mutationFn: (updatedUser) => api.put(`/users/${user.id}`, updatedUser),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onSuccess('User updated successfully!');
            onClose();
        },
    });

    const onSubmit = (data) => {
        // Don't send empty password
        if (data.password === '') {
            delete data.password;
        }
        editUserMutation.mutate(data);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit User</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    {editUserMutation.isError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {editUserMutation.error.response?.data?.error || 'An error occurred.'}
                        </Alert>
                    )}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <Controller
                                name="username"
                                control={control}
                                rules={{ required: 'Username is required' }}
                                render={({ field }) => <TextField {...field} label="Username" fullWidth error={!!errors.username} helperText={errors.username?.message} />}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Controller
                                name="password"
                                control={control}
                                defaultValue=""
                                rules={{ minLength: { value: 6, message: 'Password must be at least 6 characters' } }}
                                render={({ field }) => <TextField {...field} type="password" label="New Password (optional)" fullWidth error={!!errors.password} helperText={errors.password?.message} />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.role}>
                                <InputLabel>Role</InputLabel>
                                <Controller
                                    name="role"
                                    control={control}
                                    rules={{ required: 'Role is required' }}
                                    render={({ field }) => (
                                        <Select {...field} label="Role">
                                            {roleOptions.map((role) => (
                                                <MenuItem key={role} value={role}>
                                                    {role.replace('_', ' ')}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.base_id}>
                                <InputLabel>Base (optional)</InputLabel>
                                <Controller
                                    name="base_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Select {...field} label="Base (optional)">
                                            <MenuItem value=""><em>None</em></MenuItem>
                                            {bases?.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                                        </Select>
                                    )}
                                />
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={editUserMutation.isLoading}>
                        {editUserMutation.isLoading ? <CircularProgress size={24} /> : 'Save Changes'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default EditUser; 