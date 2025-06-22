import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid,
    Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import CreateAsset from './CreateAsset';
import EditAsset from './EditAsset';
import ViewAsset from './ViewAsset';

const Assets = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('name');
    const [order, setOrder] = useState('asc');
    const [search, setSearch] = useState('');
    const [baseId, setBaseId] = useState('');
    const [equipmentTypeId, setEquipmentTypeId] = useState('');

    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isViewModalOpen, setViewModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const { user } = useAuth();

    const { data, isLoading, error, isSuccess } = useQuery({
        queryKey: ['assets', page, rowsPerPage, sortBy, order, search, baseId, equipmentTypeId],
        queryFn: () => api.get(`/assets?page=${page + 1}&limit=${rowsPerPage}&sortBy=${sortBy}&order=${order}&search=${search}&baseId=${baseId}&equipmentTypeId=${equipmentTypeId}`).then(res => res.data),
        placeholderData: (previousData) => previousData,
    });

    const { data: basesData } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data.bases),
        enabled: user?.role === 'admin'
    });

    const { data: equipmentTypesData } = useQuery({
        queryKey: ['equipmentTypes'],
        queryFn: () => api.get('/assets/categories').then(res => res.data),
    });

    const handleSort = (property) => {
        const isAsc = sortBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setSortBy(property);
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    if (error) {
        return <Alert severity="error">Error loading assets: {error.message}</Alert>;
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Asset Management</Typography>
            <Paper>
                <Box sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Search by Name/Serial"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </Grid>
                        {user?.role === 'admin' && (
                            <Grid item xs={12} sm={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Base</InputLabel>
                                    <Select value={baseId} label="Base" onChange={(e) => setBaseId(e.target.value)}>
                                        <MenuItem value=""><em>All Bases</em></MenuItem>
                                        {basesData?.map(base => (
                                            <MenuItem key={base.id} value={base.id}>{base.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}
                        <Grid item xs={12} sm={3}>
                            <FormControl fullWidth>
                                <InputLabel>Equipment Type</InputLabel>
                                <Select value={equipmentTypeId} label="Equipment Type" onChange={(e) => setEquipmentTypeId(e.target.value)}>
                                    <MenuItem value=""><em>All Types</em></MenuItem>
                                    {equipmentTypesData?.map(type => (
                                        <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={2} sx={{ textAlign: 'right' }}>
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateModalOpen(true)}>
                                New Asset
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell onClick={() => handleSort('name')}>Name</TableCell>
                                <TableCell>Serial Number</TableCell>
                                <TableCell>Base</TableCell>
                                <TableCell>Quantity</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                            ) : (
                                data?.assets.map((asset) => (
                                    <TableRow key={asset.id}>
                                        <TableCell>{asset.equipmentType.name}</TableCell>
                                        <TableCell>{asset.serialNumber || 'N/A'}</TableCell>
                                        <TableCell>{asset.base.name}</TableCell>
                                        <TableCell>{asset.quantity}</TableCell>
                                        <TableCell>{asset.status}</TableCell>
                                        <TableCell>
                                            <Tooltip title="View Details">
                                                <IconButton onClick={() => { setSelectedAsset(asset); setViewModalOpen(true); }}>
                                                    <ViewIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit Asset">
                                                <IconButton onClick={() => { setSelectedAsset(asset); setEditModalOpen(true); }}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                {isSuccess && (
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={data.totalAssets}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                    />
                )}
            </Paper>
            <CreateAsset
                open={isCreateModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={handleShowSnackbar}
            />
            {selectedAsset && (
                <EditAsset
                    open={isEditModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    asset={selectedAsset}
                    onSuccess={handleShowSnackbar}
                />
            )}
            {selectedAsset && (
                <ViewAsset
                    open={isViewModalOpen}
                    onClose={() => setViewModalOpen(false)}
                    asset={selectedAsset}
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

export default Assets; 