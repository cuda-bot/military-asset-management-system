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
    const { user, loading } = useAuth();

    const { data, isLoading, error, isSuccess } = useQuery({
        queryKey: ['assets', page, rowsPerPage, sortBy, order, search, baseId, equipmentTypeId],
        queryFn: () => api.get(`/assets?page=${page + 1}&limit=${rowsPerPage}&sortBy=${sortBy}&order=${order}&search=${search}&baseId=${baseId}&equipmentTypeId=${equipmentTypeId}`).then(res => res.data),
        placeholderData: (previousData) => previousData,
    });

    const { data: basesData, refetch: refetchBases, error: basesError } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data?.bases || []),
        enabled: !loading && user?.role === 'admin'
    });

    const { data: equipmentTypesData } = useQuery({
        queryKey: ['equipmentTypes'],
        queryFn: () => api.get('/assets/categories').then(res => res.data),
    });

    // Debug: Log data to check for undefined or duplicate ids
    // console.log('basesData:', basesData);
    // console.log('equipmentTypesData:', equipmentTypesData);
    // if (basesError) {
    //     console.error('basesError:', basesError);
    // }

    const handleSort = (property) => {
        const isAsc = sortBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setSortBy(property);
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    if (loading) {
        // Show a friendly loading message
        return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><CircularProgress /><Typography sx={{ ml: 2 }}>Loading your assets...</Typography></Box>;
    }

    if (error) {
        // Show a more human error message
        return <Alert severity="error">Sorry, we couldn't load your assets right now. Please check your connection or try again in a moment.<br />({error.message})</Alert>;
    }

    // Show a message if there are no assets to display
    const isEmpty = isSuccess && data?.assets?.length === 0;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Welcome to Asset Management</Typography>
            <Typography variant="body1" gutterBottom>
                Here you can browse, search, and manage all your assets. Use the filters below to find exactly what you need.
            </Typography>
            <Paper>
                <Box sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label="Search by Name or Serial Number"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Type to search..."
                                helperText="Find assets by name or serial number."
                            />
                        </Grid>
                        {user?.role === 'admin' && (
                            <Grid item xs={12} sm={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Base</InputLabel>
                                    <Select value={baseId} label="Base" onChange={(e) => setBaseId(e.target.value)}>
                                        <MenuItem key="all-bases" value=""><em>All Bases</em></MenuItem>
                                        {Array.isArray(basesData) && basesData.map((base, idx) => (
                                            <MenuItem key={base._id || base.id || idx} value={base._id || base.id}>{base.name}</MenuItem>
                                        ))}
                                    </Select>
                                    <Typography variant="caption">Filter assets by base location.</Typography>
                                </FormControl>
                            </Grid>
                        )}
                        <Grid item xs={12} sm={3}>
                            <FormControl fullWidth>
                                <InputLabel>Equipment Type</InputLabel>
                                <Select value={equipmentTypeId} label="Equipment Type" onChange={(e) => setEquipmentTypeId(e.target.value)}>
                                    <MenuItem key="all-types" value=""><em>All Types</em></MenuItem>
                                    {Array.isArray(equipmentTypesData) && equipmentTypesData.map(type => (
                                        <MenuItem key={type._id || type.id} value={type._id || type.id}>{type.name}</MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption">Filter by equipment category.</Typography>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={2} sx={{ textAlign: 'right' }}>
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateModalOpen(true)}>
                                Add New Asset
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell onClick={() => handleSort('name')} style={{ cursor: 'pointer' }} title="Sort by Name">Name</TableCell>
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
                            ) : isEmpty ? (
                                <TableRow><TableCell colSpan={6} align="center">No assets found. Try adjusting your filters or add a new asset to get started!</TableCell></TableRow>
                            ) : (
                                data?.assets.map((asset) => (
                                    <TableRow key={asset.id}>
                                        <TableCell>{asset.equipmentType?.name || asset.name}</TableCell>
                                        <TableCell>{asset.serialNumber || asset.serial_number || 'N/A'}</TableCell>
                                        <TableCell>{asset.base?.name || 'N/A'}</TableCell>
                                        <TableCell>{asset.quantity}</TableCell>
                                        <TableCell>{asset.status}</TableCell>
                                        <TableCell>
                                            <Tooltip title="View asset details">
                                                <IconButton onClick={() => { setSelectedAsset(asset); setViewModalOpen(true); }}>
                                                    <ViewIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit this asset">
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
                        labelRowsPerPage="Assets per page:"
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
            {/* Debug: Manual refetch and error display */}
            <Button onClick={() => refetchBases()} variant="outlined" color="secondary" sx={{ mb: 2 }}>
                Refetch Bases (Debug)
            </Button>
            {basesError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Error fetching bases: {basesError.message}
                </Alert>
            )}
        </Box>
    );
};

export default Assets; 