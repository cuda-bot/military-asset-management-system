import React, { useState, useEffect } from 'react';
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

const CreatePurchase = ({ open, onClose, onSuccess }) => {
    const { handleSubmit, control, watch, setValue, formState: { errors }, reset } = useForm();
    const queryClient = useQueryClient();

    const { data: equipmentTypes, isLoading: typesLoading } = useQuery({
        queryKey: ['equipmentTypes'],
        queryFn: () => api.get('/assets/categories').then(res => res.data),
    });

    const { data: bases, isLoading: basesLoading } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data.bases),
    });

    const createPurchaseMutation = useMutation({
        mutationFn: (newPurchase) => api.post('/purchases', newPurchase),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            onSuccess(`Purchase for ${data.data.quantity}x ${data.data.equipmentType.name} recorded successfully!`);
            handleClose();
        },
        onError: (error) => {
            console.error('Error creating purchase:', error);
        }
    });

    const onSubmit = (data) => {
        const payload = {
            ...data,
            unitPrice: parseFloat(data.unitPrice),
            totalAmount: parseFloat(data.quantity) * parseFloat(data.unitPrice),
        };
        createPurchaseMutation.mutate(payload);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Record New Purchase</DialogTitle>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogContent>
                        {createPurchaseMutation.isError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {createPurchaseMutation.error.response?.data?.error || 'An error occurred.'}
                            </Alert>
                        )}
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth error={!!errors.baseId}>
                                    <InputLabel>Base</InputLabel>
                                    <Controller
                                        name="baseId"
                                        control={control}
                                        defaultValue=""
                                        rules={{ required: 'Base is required' }}
                                        render={({ field }) => (
                                            <Select {...field} label="Base" disabled={basesLoading}>
                                                {basesLoading ? <MenuItem><em>Loading...</em></MenuItem> :
                                                    bases?.map((base) => (
                                                        <MenuItem key={base.id} value={base.id}>{base.name}</MenuItem>
                                                    ))}
                                            </Select>
                                        )}
                                    />
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth error={!!errors.equipmentTypeId}>
                                    <InputLabel>Equipment Type</InputLabel>
                                    <Controller
                                        name="equipmentTypeId"
                                        control={control}
                                        defaultValue=""
                                        rules={{ required: 'Equipment type is required' }}
                                        render={({ field }) => (
                                            <Select {...field} label="Equipment Type" disabled={typesLoading}>
                                                {typesLoading ? <MenuItem><em>Loading...</em></MenuItem> :
                                                    equipmentTypes?.map((type) => (
                                                        <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                                                    ))}
                                            </Select>
                                        )}
                                    />
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="supplier"
                                    control={control}
                                    defaultValue=""
                                    render={({ field }) => <TextField {...field} label="Supplier/Vendor" fullWidth />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="quantity"
                                    control={control}
                                    defaultValue=""
                                    rules={{
                                        required: 'Quantity is required',
                                        valueAsNumber: true,
                                        min: { value: 1, message: 'Quantity must be at least 1' }
                                    }}
                                    render={({ field }) => <TextField {...field} type="number" label="Quantity" fullWidth error={!!errors.quantity} helperText={errors.quantity?.message} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="unitPrice"
                                    control={control}
                                    defaultValue=""
                                    rules={{
                                        required: 'Unit price is required',
                                        valueAsNumber: true,
                                        min: { value: 0, message: 'Price cannot be negative' }
                                    }}
                                    render={({ field }) => <TextField {...field} type="number" label="Unit Price" fullWidth error={!!errors.unitPrice} helperText={errors.unitPrice?.message} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="purchaseDate"
                                    control={control}
                                    rules={{ required: 'Purchase date is required' }}
                                    render={({ field }) => <DatePicker {...field} label="Purchase Date" slotProps={{ textField: { fullWidth: true, error: !!errors.purchaseDate, helperText: errors.purchaseDate?.message } }} />}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="invoiceNumber"
                                    control={control}
                                    defaultValue=""
                                    render={({ field }) => <TextField {...field} label="Invoice Number" fullWidth />}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Controller
                                    name="notes"
                                    control={control}
                                    defaultValue=""
                                    render={({ field }) => <TextField {...field} label="Notes" multiline rows={3} fullWidth />}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={createPurchaseMutation.isLoading}>
                            {createPurchaseMutation.isLoading ? <CircularProgress size={24} /> : 'Create Purchase'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </LocalizationProvider>
    );
};

export default CreatePurchase; 