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
} from '@mui/material';

const DetailItem = ({ title, value, halfWidth = false }) => (
    <Grid item xs={12} sm={halfWidth ? 6 : 12}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>{title}</Typography>
        <Typography variant="body1">{value || 'N/A'}</Typography>
    </Grid>
);

const ViewPurchase = ({ open, onClose, purchase }) => {
    if (!purchase) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Purchase Details - ID: {purchase.id}</DialogTitle>
            <DialogContent>
                <Paper elevation={2} sx={{ p: 3, mt: 2 }}>
                    <Grid container spacing={2}>
                        <DetailItem title="Equipment Type" value={purchase.equipmentType.name} halfWidth />
                        <DetailItem title="Base" value={purchase.base.name} halfWidth />
                        <DetailItem title="Quantity" value={purchase.quantity} halfWidth />
                        <DetailItem title="Unit Price" value={`$${purchase.unitPrice.toLocaleString()}`} halfWidth />
                        <DetailItem title="Total Amount" value={`$${purchase.totalAmount.toLocaleString()}`} halfWidth />
                        <DetailItem title="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} halfWidth />
                        <DetailItem title="Supplier" value={purchase.supplier} halfWidth />
                        <DetailItem title="Invoice Number" value={purchase.invoiceNumber} halfWidth />
                        <DetailItem title="Created By" value={purchase.createdBy.username} halfWidth />
                        <DetailItem title="Created At" value={new Date(purchase.createdAt).toLocaleString()} halfWidth />
                        <DetailItem title="Notes" value={purchase.notes} />
                    </Grid>
                </Paper>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ViewPurchase; 