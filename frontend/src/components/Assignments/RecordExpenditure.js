import React, { useState } from 'react';
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
    Box,
    Typography,
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const RecordExpenditure = ({ open, onClose, onSuccess }) => {
    const { handleSubmit, control, formState: { errors }, watch } = useForm();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [selectedBase, setSelectedBase] = useState(user?.bases && user.bases.length > 0 ? user.bases[0] : '');

    const { data: bases } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data.bases),
        enabled: user?.role === 'admin',
    });

    const { data: assetsData, isLoading: assetsLoading } = useQuery({
        queryKey: ['assets', selectedBase],
        queryFn: () => api.get(`/assets/base/${selectedBase}`).then(res => res.data),
        enabled: !!selectedBase,
    });

    const mutation = useMutation({
        mutationFn: (newExpenditure) => api.post('/assignments/expenditures', newExpenditure),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            onSuccess('Expenditure recorded successfully.');
            onClose();
        },
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    const selectedAssetId = watch('assetId');
    const selectedAsset = assetsData?.find(a => a.id === selectedAssetId);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Record New Expenditure</DialogTitle>
                <form id="record-expenditure-form" onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        {mutation.isError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {mutation.error.response?.data?.error || 'An error occurred.'}
                            </Alert>
                        )}
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            {user?.role === 'admin' && (
                                <Grid item xs={12}>
                                    <FormControl fullWidth>
                                        <InputLabel>Base</InputLabel>
                                        <Select
                                            value={selectedBase}
                                            onChange={(e) => setSelectedBase(e.target.value)}
                                            label="Base"
                                        >
                                            {bases?.map((base) => (
                                                <MenuItem key={base.id} value={base.id}>{base.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            )}

                            <Grid item xs={12}>
                                <FormControl fullWidth error={!!errors.assetId} disabled={!selectedBase || assetsLoading}>
                                    <InputLabel>Asset *</InputLabel>
                                    <Controller
                                        name="assetId"
                                        control={control}
                                        rules={{ required: 'Asset is required' }}
                                        render={({ field }) => (
                                            <Select {...field} label="Asset *">
                                                {assetsLoading && <MenuItem value=""><em>Loading...</em></MenuItem>}
                                                {assetsData?.map((asset) => (
                                                    <MenuItem key={asset.id} value={asset.id}>
                                                        {asset.equipmentType.name} ({asset.serialNumber || 'N/A'})
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        )}
                                    />
                                    {errors.assetId && <Typography color="error" variant="caption">{errors.assetId.message}</Typography>}
                                </FormControl>
                                {selectedAsset && (
                                    <Box sx={{ mt: 1, p: 1, border: '1px solid #ccc', borderRadius: 1 }}>
                                        <Typography variant="body2"><strong>Closing Balance:</strong> {selectedAsset.closingBalance}</Typography>
                                    </Box>
                                )}
                            </Grid>

                            <Grid item xs={12}>
                                <Controller
                                    name="quantity"
                                    control={control}
                                    rules={{
                                        required: 'Quantity is required',
                                        valueAsNumber: true,
                                        min: { value: 1, message: 'Quantity must be positive' },
                                        max: { value: selectedAsset?.closingBalance, message: 'Quantity cannot exceed closing balance' }
                                    }}
                                    render={({ field }) => <TextField {...field} label="Quantity *" type="number" fullWidth error={!!errors.quantity} helperText={errors.quantity?.message} />}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Controller
                                    name="reason"
                                    control={control}
                                    rules={{ required: 'Reason is required' }}
                                    render={({ field }) => <TextField {...field} label="Reason *" fullWidth error={!!errors.reason} helperText={errors.reason?.message} />}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Controller
                                    name="expenditureDate"
                                    control={control}
                                    rules={{ required: 'Date is required' }}
                                    render={({ field }) => <DatePicker {...field} label="Expenditure Date *" slotProps={{ textField: { fullWidth: true, error: !!errors.expenditureDate, helperText: errors.expenditureDate?.message } }} />}
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Controller
                                    name="notes"
                                    control={control}
                                    render={({ field }) => <TextField {...field} label="Notes" multiline rows={3} fullWidth />}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={mutation.isLoading}>
                            {mutation.isLoading ? <CircularProgress size={24} /> : 'Record'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </LocalizationProvider>
    );
};

export default RecordExpenditure;
