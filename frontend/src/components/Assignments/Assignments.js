import React, { useState, useEffect } from 'react';
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
    Tabs,
    Tab,
    Tooltip,
} from '@mui/material';
import { Add as AddIcon, KeyboardReturn as ReturnIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import CreateAssignment from './CreateAssignment';
import RecordExpenditure from './RecordExpenditure';

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const Assignments = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [tabIndex, setTabIndex] = useState(0);
    const [isCreateAssignmentModalOpen, setCreateAssignmentModalOpen] = useState(false);
    const [isRecordExpenditureModalOpen, setRecordExpenditureModalOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
        setPage(0);
    };

    const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useQuery({
        queryKey: ['assignments', page, rowsPerPage, tabIndex],
        queryFn: async () => {
            const endpoint = tabIndex === 0 ? '/assignments' : '/assignments/expenditures';
            const response = await api.get(`${endpoint}?page=${page + 1}&limit=${rowsPerPage}`);
            return response.data;
        },
        placeholderData: (previousData) => previousData,
    });


    const returnAssignmentMutation = useMutation({
        mutationFn: ({ assignmentId, notes }) => api.put(`/assignments/${assignmentId}/return`, { notes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            handleShowSnackbar('Assignment returned successfully!');
        },
        onError: (error) => {
            handleShowSnackbar(error.response?.data?.error || 'Failed to return assignment.', 'error');
        }
    });

    const handleReturnAssignment = (assignmentId) => {
        const notes = window.prompt('Enter any notes for this return (optional):');
        if (notes !== null) { // Proceed if user didn't cancel prompt
            returnAssignmentMutation.mutate({ assignmentId, notes });
        }
    };

    const handleShowSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const data = assignmentsData;
    const isLoading = assignmentsLoading;
    const error = assignmentsError;

    const items = tabIndex === 0 ? data?.assignments : data?.expenditures;
    const totalItems = tabIndex === 0 ? data?.totalAssignments : data?.totalExpenditures;


    if (error) {
        return <Alert severity="error">Error loading data: {error.message}</Alert>;
    }

    const canPerformActions = user?.role === 'admin' || user?.role === 'base_commander';

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Assignments & Expenditures</Typography>
            <Paper>
                <Tabs value={tabIndex} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
                    <Tab label="Active Assignments" />
                    <Tab label="Expenditure Records" />
                </Tabs>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    {tabIndex === 0 && canPerformActions && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateAssignmentModalOpen(true)}>New Assignment</Button>
                    )}
                    {tabIndex === 1 && canPerformActions && (
                        <Button variant="contained" startIcon={<ReceiptIcon />} onClick={() => setRecordExpenditureModalOpen(true)}>Record Expenditure</Button>
                    )}
                </Box>
                <TableContainer>
                    <Table>
                        {tabIndex === 0 && (
                            <>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Asset</TableCell>
                                        <TableCell>Serial Number</TableCell>
                                        <TableCell>Assigned To</TableCell>
                                        <TableCell>Assigned By</TableCell>
                                        <TableCell>Assignment Date</TableCell>
                                        <TableCell>Expected Return</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={8} align="center"><CircularProgress /></TableCell></TableRow>
                                    ) : items?.map(a => (
                                        <TableRow key={a.id} hover>
                                            <TableCell>{a.asset.equipmentType.name}</TableCell>
                                            <TableCell>{a.asset.serialNumber}</TableCell>
                                            <TableCell>{a.assignedTo}</TableCell>
                                            <TableCell>{a.assignedBy.username}</TableCell>
                                            <TableCell>{new Date(a.assignmentDate).toLocaleDateString()}</TableCell>
                                            <TableCell>{a.expectedReturnDate ? new Date(a.expectedReturnDate).toLocaleDateString() : 'N/A'}</TableCell>
                                            <TableCell>{a.status}</TableCell>
                                            <TableCell>
                                                {a.status === 'active' && canPerformActions &&
                                                    <Tooltip title="Return Assignment">
                                                        <IconButton size="small" onClick={() => handleReturnAssignment(a.id)} disabled={returnAssignmentMutation.isLoading}>
                                                            <ReturnIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </>
                        )}
                        {tabIndex === 1 && (
                            <>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Asset</TableCell>
                                        <TableCell>Quantity</TableCell>
                                        <TableCell>Reason</TableCell>
                                        <TableCell>Expenditure Date</TableCell>
                                        <TableCell>Recorded By</TableCell>
                                        <TableCell>Approved By</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                                    ) : items?.map(e => (
                                        <TableRow key={e.id} hover>
                                            <TableCell>{e.asset.equipmentType.name} ({e.asset.serialNumber})</TableCell>
                                            <TableCell>{e.quantity}</TableCell>
                                            <TableCell>{e.reason}</TableCell>
                                            <TableCell>{new Date(e.expenditureDate).toLocaleDateString()}</TableCell>
                                            <TableCell>{e.createdBy.username}</TableCell>
                                            <TableCell>{e.approvedBy?.username || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </>
                        )}
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={totalItems || 0}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Paper>
            <CreateAssignment
                open={isCreateAssignmentModalOpen}
                onClose={() => setCreateAssignmentModalOpen(false)}
                onSuccess={handleShowSnackbar}
            />
            <RecordExpenditure
                open={isRecordExpenditureModalOpen}
                onClose={() => setRecordExpenditureModalOpen(false)}
                onSuccess={handleShowSnackbar}
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

export default Assignments; 