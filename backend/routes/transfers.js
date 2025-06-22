import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, hasBaseAccess, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   POST /api/transfers
// @desc    Create a new transfer request
// @access  Private (Logistics Officer or Admin)
router.post(
    '/',
    [
        hasRole(['logistics_officer', 'admin']),
        body('from_base_id', 'Source base ID is required').isInt(),
        hasBaseAccess,
        body('to_base_id', 'Destination base ID is required').isInt(),
        body('equipment_type_id', 'Equipment Type ID is required').isInt(),
        body('quantity', 'Quantity must be a positive integer').isInt({ gt: 0 }),
        body('transfer_date', 'Transfer date is required').isISO8601().toDate(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { from_base_id, to_base_id, equipment_type_id, quantity, transfer_date, notes } = req.body;

        if (from_base_id === to_base_id) {
            return res.status(400).json({ error: 'Source and destination bases cannot be the same.' });
        }

        try {
            // Check for sufficient assets at the source base
            const sourceAsset = await prisma.asset.findFirst({
                where: { base_id: from_base_id, equipment_type_id },
            });
            if (!sourceAsset || sourceAsset.quantity < quantity) {
                return res.status(400).json({ error: 'Insufficient assets at the source base.' });
            }

            const newTransfer = await prisma.transfer.create({
                data: {
                    from_base_id,
                    to_base_id,
                    equipment_type_id,
                    quantity,
                    transfer_date,
                    notes,
                    status: 'pending',
                    created_by_id: req.user.id,
                },
            });

            logTransaction(req, {
                action: 'create_transfer_request',
                table_name: 'transfers',
                record_id: newTransfer.id,
                new_data: newTransfer,
            });

            res.status(201).json(newTransfer);
        } catch (error) {
            logger.error('Error creating transfer request:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET /api/transfers
// @desc    Get all transfers with filtering and pagination
// @access  Private
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'transfer_date', order = 'desc', status, baseId } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const where = {};
        if (status) where.status = status;

        if (req.user.role !== 'admin' && req.user.base_id) {
            where.OR = [
                { from_base_id: req.user.base_id },
                { to_base_id: req.user.base_id },
            ];
        } else if (baseId) {
            where.OR = [
                { from_base_id: baseId },
                { to_base_id: baseId },
            ];
        }

        const transfers = await prisma.transfer.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { [sortBy === 'transferDate' ? 'transfer_date' : sortBy]: order },
            include: {
                asset: true,
                from_base: true,
                to_base: true,
            },
        });

        const totalTransfers = await prisma.transfer.count({ where });
        const totalPages = Math.ceil(totalTransfers / limitNum);

        res.json({
            transfers,
            totalTransfers,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/transfers/:id/approve
// @desc    Approve a transfer request
// @access  Private (Base Commander or Admin)
router.put('/:id/approve', hasRole(['base_commander', 'admin']), async (req, res) => {
    try {
        const transfer = await prisma.transfer.findUnique({ where: { id: parseInt(req.params.id) } });

        if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });
        if (transfer.status !== 'pending') return res.status(400).json({ error: `Transfer is already ${transfer.status}.` });

        // Ensure commander is from the source base or user is admin
        if (req.user.role !== 'admin' && !req.user.bases.includes(transfer.fromBaseId)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to approve transfers for this base.' });
        }

        const updatedTransfer = await prisma.transfer.update({
            where: { id: parseInt(req.params.id) },
            data: {
                status: 'approved',
                approved_by_id: req.user.id,
                approved_at: new Date(),
            },
        });

        logTransaction(req, {
            action: 'approve_transfer',
            table_name: 'transfers',
            record_id: updatedTransfer.id,
            old_data: { status: 'pending' },
            new_data: { status: 'approved' },
        });

        res.json(updatedTransfer);
    } catch (error) {
        logger.error(`Error approving transfer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   PUT /api/transfers/:id/complete
// @desc    Complete a transfer
// @access  Private (Logistics Officer or Admin)
router.put('/:id/complete', hasRole(['logistics_officer', 'admin']), async (req, res) => {
    try {
        const transferToComplete = await prisma.transfer.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!transferToComplete) return res.status(404).json({ error: 'Transfer not found.' });
        if (transferToComplete.status !== 'approved') return res.status(400).json({ error: `Transfer must be approved before completion.` });

        // Ensure officer is from the destination base or user is admin
        if (req.user.role !== 'admin' && !req.user.bases.includes(transferToComplete.toBaseId)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to complete transfers for this base.' });
        }

        const completedTransfer = await prisma.$transaction(async (tx) => {
            // Decrement asset from source base
            await tx.asset.updateMany({
                where: { base_id: transferToComplete.from_base_id, equipment_type_id: transferToComplete.equipment_type_id },
                data: {
                    quantity: { decrement: transferToComplete.quantity },
                    closing_balance: { decrement: transferToComplete.quantity }
                },
            });
            // Increment asset at destination base
            await tx.asset.updateMany({
                where: { base_id: transferToComplete.to_base_id, equipment_type_id: transferToComplete.equipment_type_id },
                data: {
                    quantity: { increment: transferToComplete.quantity },
                    closing_balance: { increment: transferToComplete.quantity }
                },
            });
            // Update transfer status
            return tx.transfer.update({
                where: { id: parseInt(req.params.id) },
                data: { status: 'completed' },
            });
        });

        logTransaction(req, {
            action: 'complete_transfer',
            table_name: 'transfers',
            record_id: completedTransfer.id,
            old_data: { status: 'approved' },
            new_data: { status: 'completed' },
        });

        res.json(completedTransfer);
    } catch (error) {
        logger.error(`Error completing transfer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   PUT /api/transfers/:id/cancel
// @desc    Cancel a transfer request
// @access  Private (Original requester, Admin, or involved Base Commander)
router.put('/:id/cancel', async (req, res) => {
    try {
        const transfer = await prisma.transfer.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });
        if (transfer.status === 'completed' || transfer.status === 'cancelled') {
            return res.status(400).json({ error: `Cannot cancel a transfer that is already ${transfer.status}.` });
        }

        // Check permissions
        const canCancel = req.user.role === 'admin' ||
            req.user.id === transfer.createdById ||
            (req.user.role === 'base_commander' && (req.user.bases.includes(transfer.fromBaseId) || req.user.bases.includes(transfer.toBaseId)));

        if (!canCancel) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to cancel this transfer.' });
        }

        const cancelledTransfer = await prisma.transfer.update({
            where: { id: parseInt(req.params.id) },
            data: { status: 'cancelled' },
        });

        logTransaction(req, {
            action: 'cancel_transfer',
            table_name: 'transfers',
            record_id: cancelledTransfer.id,
            old_data: { status: transfer.status },
            new_data: { status: 'cancelled' },
        });

        res.json(cancelledTransfer);
    } catch (error) {
        logger.error(`Error cancelling transfer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});


export default router;