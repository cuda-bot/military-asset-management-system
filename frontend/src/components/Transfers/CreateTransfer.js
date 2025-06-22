import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    CircularProgress,
    Alert,
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const CreateTransfer = ({ open, onClose, onSuccess }) => {
    const { handleSubmit, control, formState: { errors } } = useForm();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: basesData, isLoading: basesLoading } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data.bases),
    });

    const { data: equipmentTypesData, isLoading: equipmentTypesLoading } = useQuery({
        queryKey: ['equipmentTypes'],
        queryFn: () => api.get('/assets/categories').then(res => res.data),
    });

    const mutation = useMutation({
        mutationFn: (newTransfer) => api.post('/transfers', newTransfer),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            onSuccess('Transfer request created successfully.');
            onClose();
        },
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    const userBaseId = user?.bases && user.bases.length > 0 ? user.bases[0] : null;

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Transfer Request</DialogTitle>
                <form id="create-transfer-form" onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        {mutation.isError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {mutation.error.response?.data?.error || 'An error occurred.'}
                            </Alert>
                        )}
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12}>
                                <FormControl fullWidth error={!!errors.equipmentTypeId}>
                                    <InputLabel>Equipment Type *</InputLabel>
                                    <Controller
                                        name="equipmentTypeId"
                                        control={control}
                                        rules={{ required: 'Equipment type is required' }}
                                        render={({ field }) => (
                                            <Select {...field} label="Equipment Type *" disabled={equipmentTypesLoading}>
                                                {equipmentTypesLoading && <MenuItem value=""><em>Loading...</em></MenuItem>}
                                                {equipmentTypesData?.map((type) => (
                                                    <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                                                ))}
                                            </Select>
                                        )}
                                    />
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="quantity"
                                    control={control}
                                    rules={{ required: 'Quantity is required', min: { value: 1, message: 'Quantity must be at least 1' } }}
                                    render={({ field }) => <TextField {...field} label="Quantity *" type="number" fullWidth error={!!errors.quantity} helperText={errors.quantity?.message} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>From Base</InputLabel>
                                    <Select
                                        value={userBaseId || ''}
                                        label="From Base"
                                        disabled
                                    >
                                        <MenuItem value={userBaseId}>{basesData?.find(b => b.id === userBaseId)?.name}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth error={!!errors.toBaseId}>
                                    <InputLabel>To Base *</InputLabel>
                                    <Controller
                                        name="toBaseId"
                                        control={control}
                                        rules={{ required: 'Destination base is required' }}
                                        render={({ field }) => (
                                            <Select {...field} label="To Base *" disabled={basesLoading}>
                                                {basesLoading && <MenuItem value=""><em>Loading...</em></MenuItem>}
                                                {basesData?.filter(b => b.id !== userBaseId).map((base) => (
                                                    <MenuItem key={base.id} value={base.id}>{base.name}</MenuItem>
                                                ))}
                                            </Select>
                                        )}
                                    />
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="transferDate"
                                    control={control}
                                    rules={{ required: 'Transfer date is required' }}
                                    render={({ field }) => <DatePicker {...field} label="Transfer Date *" slotProps={{ textField: { fullWidth: true, error: !!errors.transferDate, helperText: errors.transferDate?.message } }} />}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="notes"
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Notes" multiline rows={4} fullWidth />}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={mutation.isLoading}>
                            {mutation.isLoading ? <CircularProgress size={24} /> : 'Create Request'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </LocalizationProvider>
    );
};

export default CreateTransfer; 