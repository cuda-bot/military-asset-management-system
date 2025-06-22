import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '@mui/material';
import { Add as AddIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import CreatePurchase from './CreatePurchase';
import ViewPurchase from './ViewPurchase';

const Purchases = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isViewModalOpen, setViewModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const { data: purchasesData, isLoading, error, isPlaceholderData } = useQuery({
        queryKey: ['purchases', page, rowsPerPage],
        queryFn: async () => {
            const response = await api.get(`/purchases?page=${page + 1}&limit=${rowsPerPage}`);
            return response.data;
        },
        placeholderData: (previousData) => previousData,
    });

    const purchases = purchasesData?.purchases || [];
    const totalPurchases = purchasesData?.totalPurchases || 0;

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenViewModal = (purchase) => {
        setSelectedPurchase(purchase);
        setViewModalOpen(true);
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
    };

    if (error) {
        return <Alert severity="error">Error loading purchases: {error.message}</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Purchases</Typography>
                {(user?.role === 'admin' || user?.role === 'logistics_officer') && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateModalOpen(true)}
                    >
                        New Purchase
                    </Button>
                )}
            </Box>

            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Equipment Type</TableCell>
                                <TableCell>Quantity</TableCell>
                                <TableCell>Base</TableCell>
                                <TableCell>Supplier</TableCell>
                                <TableCell>Total Cost</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center"><CircularProgress /></TableCell>
                                </TableRow>
                            ) : purchases.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">No purchases found</TableCell>
                                </TableRow>
                            ) : (
                                purchases.map((purchase) => (
                                    <TableRow key={purchase.id} hover>
                                        <TableCell>{new Date(purchase.purchaseDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{purchase.equipmentType.name}</TableCell>
                                        <TableCell>{purchase.quantity}</TableCell>
                                        <TableCell>{purchase.base.name}</TableCell>
                                        <TableCell>{purchase.supplier || 'N/A'}</TableCell>
                                        <TableCell>${purchase.totalAmount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Tooltip title="View Details">
                                                <IconButton size="small" onClick={() => handleOpenViewModal(purchase)}>
                                                    <ViewIcon />
                                                </IconButton>
                                            </Tooltip>
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
                    count={totalPurchases}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Paper>
            <CreatePurchase
                open={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={handleShowSnackbar}
            />
            <ViewPurchase
                open={isViewModalOpen}
                onClose={() => setViewModalOpen(false)}
                purchase={selectedPurchase}
            />
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

export default Purchases; 