import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Grid,
    Card,
    CardContent,
    Typography,
    Paper,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
} from '@mui/material';
import {
    TrendingUp,
    TrendingDown,
    Inventory,
    Assignment,
    ShoppingCart,
    SwapHoriz,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import CloseIcon from '@mui/icons-material/Close';

const Dashboard = () => {
    const [filters, setFilters] = useState({
        startDate: null,
        endDate: null,
        baseId: '',
        equipmentTypeId: '',
    });

    const [netMovementOpen, setNetMovementOpen] = useState(false);

    // Fetch dashboard metrics
    const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
        queryKey: ['dashboard-metrics', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('start_date', filters.startDate.toISOString().split('T')[0]);
            if (filters.endDate) params.append('end_date', filters.endDate.toISOString().split('T')[0]);
            if (filters.baseId) params.append('base_id', filters.baseId);
            if (filters.equipmentTypeId) params.append('equipment_type_id', filters.equipmentTypeId);

            const response = await api.get(`/dashboard/metrics?${params.toString()}`);
            return response.data;
        }
    });

    // Fetch filters data
    const { data: filtersData } = useQuery({
        queryKey: ['dashboard-filters'],
        queryFn: async () => {
            const response = await api.get('/dashboard/filters');
            return response.data;
        }
    });

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const clearFilters = () => {
        setFilters({
            startDate: null,
            endDate: null,
            baseId: '',
            equipmentTypeId: '',
        });
    };

    const metrics = metricsData?.metrics || {};
    const bases = filtersData?.bases || [];
    const equipmentTypes = filtersData?.equipment_types || [];

    const metricCards = [
        {
            title: 'Opening Balance',
            value: metrics.opening_balance || 0,
            icon: <Inventory color="primary" />,
            color: '#1976d2',
        },
        {
            title: 'Closing Balance',
            value: metrics.closing_balance || 0,
            icon: <Inventory color="primary" />,
            color: '#1976d2',
        },
        {
            title: 'Net Movement',
            value: metrics.net_movement || 0,
            icon: metrics.net_movement >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />,
            color: metrics.net_movement >= 0 ? '#2e7d32' : '#d32f2f',
        },
        {
            title: 'Purchases',
            value: metrics.purchases || 0,
            icon: <ShoppingCart color="primary" />,
            color: '#1976d2',
        },
        {
            title: 'Transfers In',
            value: metrics.transfers_in || 0,
            icon: <SwapHoriz color="success" />,
            color: '#2e7d32',
        },
        {
            title: 'Transfers Out',
            value: metrics.transfers_out || 0,
            icon: <SwapHoriz color="error" />,
            color: '#d32f2f',
        },
        {
            title: 'Assigned',
            value: metrics.assigned || 0,
            icon: <Assignment color="warning" />,
            color: '#ed6c02',
        },
        {
            title: 'Expended',
            value: metrics.expended || 0,
            icon: <Assignment color="error" />,
            color: '#d32f2f',
        },
    ];

    const chartData = [
        { name: 'Opening', value: metrics.opening_balance || 0 },
        { name: 'Purchases', value: metrics.purchases || 0 },
        { name: 'Transfers In', value: metrics.transfers_in || 0 },
        { name: 'Transfers Out', value: metrics.transfers_out || 0 },
        { name: 'Assigned', value: metrics.assigned || 0 },
        { name: 'Expended', value: metrics.expended || 0 },
        { name: 'Closing', value: metrics.closing_balance || 0 },
    ];

    const handleOpenNetMovement = () => setNetMovementOpen(true);
    const handleCloseNetMovement = () => setNetMovementOpen(false);

    // Find the Net Movement card index
    const netMovementIndex = metricCards.findIndex(card => card.title === 'Net Movement');

    if (metricsError) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                Error loading dashboard data: {metricsError.message}
            </Alert>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
                <Typography variant="h4" gutterBottom>
                    Dashboard
                </Typography>

                {/* Filters */}
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Filters
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="Start Date"
                                value={filters.startDate}
                                onChange={(date) => handleFilterChange('startDate', date)}
                                renderInput={(params) => <TextField {...params} fullWidth />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker
                                label="End Date"
                                value={filters.endDate}
                                onChange={(date) => handleFilterChange('endDate', date)}
                                renderInput={(params) => <TextField {...params} fullWidth />}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Base</InputLabel>
                                <Select
                                    value={filters.baseId}
                                    label="Base"
                                    onChange={(e) => handleFilterChange('baseId', e.target.value)}
                                >
                                    <MenuItem value="">All Bases</MenuItem>
                                    {bases.map((base) => (
                                        <MenuItem key={base._id} value={base._id}>
                                            {base.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Equipment Type</InputLabel>
                                <Select
                                    value={filters.equipmentTypeId}
                                    label="Equipment Type"
                                    onChange={(e) => handleFilterChange('equipmentTypeId', e.target.value)}
                                >
                                    <MenuItem value="">All Types</MenuItem>
                                    {equipmentTypes.map((type) => (
                                        <MenuItem key={type._id} value={type._id}>
                                            {type.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                onClick={clearFilters}
                                fullWidth
                            >
                                Clear Filters
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Metrics Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    {metricCards.map((card, index) => (
                        <Grid item xs={12} sm={6} md={3} key={index}>
                            <Card
                                {...(index === netMovementIndex ? { onClick: handleOpenNetMovement, sx: { cursor: 'pointer', boxShadow: 6 } } : {})}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        {card.icon}
                                        <Typography variant="h6" sx={{ ml: 1 }}>
                                            {card.title}
                                        </Typography>
                                    </Box>
                                    {metricsLoading ? (
                                        <CircularProgress size={20} />
                                    ) : (
                                        <Typography variant="h4" sx={{ color: card.color, fontWeight: 'bold' }}>
                                            {card.value.toLocaleString()}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Chart */}
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Asset Movement Overview
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#1976d2" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Summary
                            </Typography>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Net Movement
                                </Typography>
                                <Chip
                                    label={`${metrics.net_movement >= 0 ? '+' : ''}${metrics.net_movement || 0}`}
                                    color={metrics.net_movement >= 0 ? 'success' : 'error'}
                                    variant="outlined"
                                />
                            </Box>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Available Assets
                                </Typography>
                                <Typography variant="h6">
                                    {(metrics.closing_balance || 0) - (metrics.assigned || 0)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Utilization Rate
                                </Typography>
                                <Typography variant="h6">
                                    {metrics.closing_balance ?
                                        `${Math.round(((metrics.assigned || 0) / metrics.closing_balance) * 100)}%` :
                                        '0%'
                                    }
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Net Movement Pop-up Dialog */}
                <Dialog open={netMovementOpen} onClose={handleCloseNetMovement} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        Net Movement Details
                        <IconButton onClick={handleCloseNetMovement} size="small">
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent dividers>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>Breakdown</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography>Purchases</Typography>
                                <Typography color="primary.main">+{metrics.purchases || 0}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography>Transfers In</Typography>
                                <Typography color="success.main">+{metrics.transfers_in || 0}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography>Transfers Out</Typography>
                                <Typography color="error.main">-{metrics.transfers_out || 0}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 1, borderTop: '1px solid #eee' }}>
                                <Typography fontWeight="bold">Net Movement</Typography>
                                <Typography fontWeight="bold" color={metrics.net_movement >= 0 ? 'success.main' : 'error.main'}>
                                    {metrics.net_movement >= 0 ? '+' : ''}{metrics.net_movement || 0}
                                </Typography>
                            </Box>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseNetMovement} color="primary">Close</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </LocalizationProvider>
    );
};

export default Dashboard; 