import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Grid,
    Box,
    Paper,
    Chip,
} from '@mui/material';

const DetailItem = ({ title, value }) => (
    <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
        <Typography variant="body1">{value || 'N/A'}</Typography>
    </Grid>
);

const getStatusChip = (status) => {
    const style = {
        pending: { label: 'Pending', color: 'warning' },
        approved: { label: 'Approved', color: 'info' },
        completed: { label: 'Completed', color: 'success' },
        cancelled: { label: 'Cancelled', color: 'error' },
    };
    const { label, color } = style[status] || { label: 'Unknown', color: 'default' };
    return <Chip label={label} color={color} />;
};

const ViewTransfer = ({ open, onClose, transfer }) => {
    if (!transfer) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Transfer Details</DialogTitle>
            <DialogContent>
                <Paper elevation={0} sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6">
                                    Transfer ID: {transfer.id}
                                </Typography>
                                {getStatusChip(transfer.status)}
                            </Box>
                        </Grid>
                        <DetailItem title="Equipment Type" value={transfer.equipmentType.name} />
                        <DetailItem title="Quantity" value={transfer.quantity} />
                        <DetailItem title="From Base" value={transfer.fromBase.name} />
                        <DetailItem title="To Base" value={transfer.toBase.name} />
                        <DetailItem title="Transfer Date" value={new Date(transfer.transferDate).toLocaleDateString()} />
                        <DetailItem title="Status" value={transfer.status} />
                        <DetailItem title="Created By" value={transfer.createdBy.username} />
                        <DetailItem title="Created At" value={new Date(transfer.createdAt).toLocaleString()} />
                        {transfer.approvedBy && <DetailItem title="Approved By" value={transfer.approvedBy.username} />}
                        {transfer.approvedAt && <DetailItem title="Approved At" value={new Date(transfer.approvedAt).toLocaleString()} />}

                        <Grid item xs={12}>
                            <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                            <Typography variant="body1" sx={{ mt: 1, p: 2, whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                {transfer.notes || 'No notes provided.'}
                            </Typography>
                        </Grid>

                    </Grid>
                </Paper>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ViewTransfer; 