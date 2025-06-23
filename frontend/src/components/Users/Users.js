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
    CircularProgress,
    TextField,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Snackbar,
    Alert,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import api from '../../services/api';
import CreateUser from './CreateUser';
import EditUser from './EditUser';

const roleColors = {
    admin: 'error',
    base_commander: 'warning',
    logistics_officer: 'success',
};

const Users = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filters, setFilters] = useState({ search: '', baseId: '' });
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const { data, isLoading, error } = useQuery({
        queryKey: ['users', page, rowsPerPage, filters],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page + 1,
                limit: rowsPerPage,
                ...filters
            });
            const response = await api.get(`/users?${params.toString()}`);
            return response.data;
        },
        placeholderData: (previousData) => previousData,
    });

    const { data: bases } = useQuery({
        queryKey: ['bases'],
        queryFn: () => api.get('/bases').then(res => res.data?.bases || []),
    });

    if (error) {
        return <Alert severity="error">Sorry, we couldn't load the users right now. Please check your connection or try again in a moment.<br />({error.message})</Alert>;
    }

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleOpenModal = (modal, user = null) => {
        setSelectedUser(user);
        if (modal === 'create') setCreateModalOpen(true);
        else if (modal === 'edit') setEditModalOpen(true);
    };

    const handleCloseModals = () => {
        setSelectedUser(null);
        setCreateModalOpen(false);
        setEditModalOpen(false);
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const users = data?.users || [];
    const total = data?.totalUsers || 0;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Welcome to User Management</Typography>
            <Typography variant="body1" gutterBottom>
                Here you can browse, search, and manage all users. Use the filters below to find exactly who you need.
            </Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Search by username"
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Type a username..."
                            helperText="Find users by their username."
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                            <InputLabel>Base</InputLabel>
                            <Select name="baseId" value={filters.baseId} label="Base" onChange={handleFilterChange}>
                                <MenuItem value=""><em>All Bases</em></MenuItem>
                                {bases?.map((b, idx) => <MenuItem key={b.id || idx} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                            <Typography variant="caption">Filter users by base location.</Typography>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal('create')}>Add New User</Button>
                    </Grid>
                </Grid>
            </Paper>
            <Paper>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Username</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Base</TableCell>
                                <TableCell>Created At</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} align="center"><CircularProgress /><Typography sx={{ ml: 2 }}>Loading users...</Typography></TableCell></TableRow>
                            ) : users.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center">No users found. Try adjusting your filters or add a new user to get started!</TableCell></TableRow>
                            ) : users.map((user, idx) => (
                                <TableRow key={user.id || idx}>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>
                                        <Chip label={user.role.replace('_', ' ')} color={roleColors[user.role]} size="small" />
                                    </TableCell>
                                    <TableCell>{user.base?.name || 'N/A'}</TableCell>
                                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <IconButton size="small" onClick={() => handleOpenModal('edit', user)} title="Edit this user"><EditIcon /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={total}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    labelRowsPerPage="Users per page:"
                />
            </Paper>
            <CreateUser open={isCreateModalOpen} onClose={handleCloseModals} onSuccess={handleShowSnackbar} />
            <EditUser open={isEditModalOpen} onClose={handleCloseModals} onSuccess={handleShowSnackbar} user={selectedUser} />
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

export default Users; 