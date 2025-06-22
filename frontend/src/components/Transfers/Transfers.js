import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    IconButton,
    Snackbar,
    Alert,
    CircularProgress,
    Tooltip,
    Chip,
} from '@mui/material';
import { Add as AddIcon, Check as ApproveIcon, Close as CancelIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import CreateTransfer from './CreateTransfer';
import ViewTransfer from './ViewTransfer';

const Transfers = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isViewModalOpen, setViewModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['transfers', page, rowsPerPage],
        queryFn: () => api.get(`/transfers?page=${page + 1}&limit=${rowsPerPage}`).then(res => res.data),
        placeholderData: (previousData) => previousData,
    });

    const updateTransferStatusMutation = useMutation({
        mutationFn: ({ transferId, status }) => api.put(`/transfers/${transferId}/status`, { status }),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            handleShowSnackbar(`Transfer ${variables.status} successfully!`);
        },
        onError: (error) => {
            handleShowSnackbar(error.response?.data?.error || 'Failed to update transfer status.', 'error');
        }
    });

    const handleUpdateStatus = (transferId, status) => {
        updateTransferStatusMutation.mutate({ transferId, status });
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const getStatusChip = (status) => {
        const style = {
            pending: { label: 'Pending', color: 'warning' },
            approved: { label: 'Approved', color: 'info' },
            completed: { label: 'Completed', color: 'success' },
            cancelled: { label: 'Cancelled', color: 'error' },
        };
        const { label, color } = style[status] || { label: 'Unknown', color: 'default' };
        return <Chip label={label} color={color} size="small" />;
    };

    if (error) {
        return <Alert severity="error">Error loading transfers: {error.message}</Alert>;
    }

    const canApprove = user?.role === 'admin';

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Asset Transfers</Typography>
            <Paper>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateModalOpen(true)}>
                        New Transfer
                    </Button>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Equipment</TableCell>
                                <TableCell>Quantity</TableCell>
                                <TableCell>From Base</TableCell>
                                <TableCell>To Base</TableCell>
                                <TableCell>Transfer Date</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
                            ) : (
                                data?.transfers.map((transfer) => (
                                    <TableRow key={transfer.id}>
                                        <TableCell>{transfer.equipmentType.name}</TableCell>
                                        <TableCell>{transfer.quantity}</TableCell>
                                        <TableCell>{transfer.fromBase.name}</TableCell>
                                        <TableCell>{transfer.toBase.name}</TableCell>
                                        <TableCell>{new Date(transfer.transferDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{getStatusChip(transfer.status)}</TableCell>
                                        <TableCell>
                                            <Tooltip title="View Details">
                                                <IconButton size="small" onClick={() => { setSelectedTransfer(transfer); setViewModalOpen(true); }}>
                                                    <ViewIcon />
                                                </IconButton>
                                            </Tooltip>
                                            {transfer.status === 'pending' && canApprove && (
                                                <>
                                                    <Tooltip title="Approve">
                                                        <IconButton size="small" onClick={() => handleUpdateStatus(transfer.id, 'approved')} disabled={updateTransferStatusMutation.isLoading}>
                                                            <ApproveIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Cancel">
                                                        <IconButton size="small" onClick={() => handleUpdateStatus(transfer.id, 'cancelled')} disabled={updateTransferStatusMutation.isLoading}>
                                                            <CancelIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={data?.totalTransfers || 0}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Paper>

            <CreateTransfer
                open={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={handleShowSnackbar}
            />
            {selectedTransfer && (
                <ViewTransfer
                    open={isViewModalOpen}
                    onClose={() => setViewModalOpen(false)}
                    transfer={selectedTransfer}
                />
            )}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Transfers; 