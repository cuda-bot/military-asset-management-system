import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Grid,
    Box
} from '@mui/material';

const DetailItem = ({ title, value }) => (
    <Grid item xs={12} sm={6}>
        <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
        <Typography variant="body1">{value}</Typography>
    </Grid>
);

const ViewAsset = ({ open, onClose, asset }) => {
    if (!asset) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Asset Details</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                        <DetailItem title="Asset ID" value={asset.id} />
                        <DetailItem title="Name" value={asset.name} />
                        <DetailItem title="Serial Number" value={asset.serial_number} />
                        <DetailItem title="Equipment Type" value={asset.equipment_type.name} />
                        <DetailItem title="Base" value={asset.base.name} />
                        <DetailItem title="Status" value={asset.status.replace('_', ' ')} />
                        <DetailItem title="Created At" value={new Date(asset.created_at).toLocaleString()} />
                        <DetailItem title="Last Updated" value={new Date(asset.updated_at).toLocaleString()} />
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ViewAsset; 