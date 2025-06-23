import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo, getMongoClient } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   POST /api/transfers/request
// @desc    Create a new transfer request
// @access  Private (Logistics Officer or Admin)
router.post('/request', [
    body('fromBaseId').isString(),
    body('toBaseId').isString(),
    body('equipmentTypeId').isString(),
    body('quantity').isInt({ gt: 0 }),
    body('transferDate').isISO8601().toDate(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { fromBaseId, toBaseId, equipmentTypeId, quantity, transferDate, notes } = req.body;
    if (!ObjectId.isValid(fromBaseId) || !ObjectId.isValid(toBaseId) || !ObjectId.isValid(equipmentTypeId)) {
        return res.status(400).json({ error: 'Invalid ID format' });
    }
    if (fromBaseId === toBaseId) {
        return res.status(400).json({ error: 'Source and destination bases cannot be the same.' });
    }

    const session = getMongoClient().startSession();
    try {
        let newTransfer;
        await session.withTransaction(async () => {
            const db = await connectToMongo();
            const sourceAsset = await db.collection('assets').findOne(
                { base_id: new ObjectId(fromBaseId), equipment_type_id: new ObjectId(equipmentTypeId) },
                { session }
            );

            if (!sourceAsset || sourceAsset.quantity < quantity) {
                throw new Error('Insufficient assets at the source base.');
            }

            const transferData = {
                from_base_id: new ObjectId(fromBaseId),
                to_base_id: new ObjectId(toBaseId),
                equipment_type_id: new ObjectId(equipmentTypeId),
                quantity,
                transferDate,
                notes,
                status: 'pending',
                createdById: new ObjectId(req.user.id),
                createdAt: new Date(),
            };
            const result = await db.collection('transfers').insertOne(transferData, { session });
            newTransfer = { _id: result.insertedId, ...transferData };
        });

        logTransaction(req, {
            action: 'create_transfer_request',
            tableName: 'transfers',
            recordId: newTransfer._id,
            newData: newTransfer,
        });

        res.status(201).json(newTransfer);
    } catch (error) {
        logger.error('Error creating transfer request:', error);
        if (error.message.includes('Insufficient assets')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        session.endSession();
    }
});

// @route   GET /api/transfers
// @desc    Get all transfers with filtering and pagination
// @access  Private
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'transferDate', order = 'desc', status, baseId } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const db = await connectToMongo();
        const matchStage = {};
        if (status) matchStage.status = status;

        // Base filtering
        const userBases = req.user.base_ids.map(id => new ObjectId(id));
        if (req.user.role !== 'admin') {
            matchStage.$or = [{ from_base_id: { $in: userBases } }, { to_base_id: { $in: userBases } }];
        } else if (baseId && ObjectId.isValid(baseId)) {
            const requestedBaseId = new ObjectId(baseId);
            matchStage.$or = [{ from_base_id: requestedBaseId }, { to_base_id: requestedBaseId }];
        }

        const pipeline = [
            { $match: matchStage },
            { $lookup: { from: 'equipment_types', localField: 'equipment_type_id', foreignField: '_id', as: 'equipmentType' } },
            { $unwind: '$equipmentType' },
            { $lookup: { from: 'bases', localField: 'from_base_id', foreignField: '_id', as: 'fromBase' } },
            { $unwind: '$fromBase' },
            { $lookup: { from: 'bases', localField: 'to_base_id', foreignField: '_id', as: 'toBase' } },
            { $unwind: '$toBase' },
            { $sort: { [sortBy]: order === 'desc' ? -1 : 1 } },
            {
                $facet: {
                    transfers: [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }],
                    totalCount: [{ $count: 'count' }]
                }
            }
        ];

        const results = await db.collection('transfers').aggregate(pipeline).toArray();
        const transfers = results[0].transfers;
        const totalTransfers = results[0].totalCount[0]?.count || 0;

        res.json({ transfers, totalTransfers, totalPages: Math.ceil(totalTransfers / limitNum), currentPage: pageNum });
    } catch (error) {
        logger.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/transfers/:id/approve
// @desc    Approve a transfer request
// @access  Private (Base Commander or Admin)
router.put('/:id/approve', hasRole(['admin', 'base_commander']), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

    const session = getMongoClient().startSession();
    try {
        let updatedTransfer;
        await session.withTransaction(async () => {
            const db = await connectToMongo();
            const transfer = await db.collection('transfers').findOne({ _id: new ObjectId(req.params.id), status: 'pending' }, { session });
            if (!transfer) throw new Error('Pending transfer not found or already actioned.');

            // Authorization check
            if (req.user.role !== 'admin' && !req.user.base_ids.includes(transfer.from_base_id.toString())) {
                throw new Error('Forbidden: You do not have permission for the source base.');
            }

            const sourceAsset = await db.collection('assets').findOne({ base_id: transfer.from_base_id, equipment_type_id: transfer.equipment_type_id }, { session });
            if (!sourceAsset || sourceAsset.quantity < transfer.quantity) throw new Error('Insufficient stock at source base.');

            // Decrement from source
            await db.collection('assets').updateOne(
                { _id: sourceAsset._id },
                { $inc: { quantity: -transfer.quantity } },
                { session }
            );

            // Increment at destination
            await db.collection('assets').updateOne(
                { base_id: transfer.to_base_id, equipment_type_id: transfer.equipment_type_id },
                { $inc: { quantity: transfer.quantity } },
                { upsert: true, session }
            );

            const result = await db.collection('transfers').findOneAndUpdate(
                { _id: new ObjectId(req.params.id) },
                { $set: { status: 'approved', approvedById: new ObjectId(req.user.id), approvedAt: new Date() } },
                { returnDocument: 'after', session }
            );
            updatedTransfer = result.value;
        });

        logTransaction(req, { action: 'approve_transfer', tableName: 'transfers', recordId: updatedTransfer._id, newData: { status: 'approved' } });
        res.json(updatedTransfer);
    } catch (error) {
        logger.error(`Error approving transfer ${req.params.id}:`, error);
        res.status(400).json({ error: error.message });
    } finally {
        session.endSession();
    }
});

// @route   PUT /api/transfers/:id/reject
// @desc    Reject a transfer request
// @access  Private (Base Commander or Admin)
router.put('/:id/reject', hasRole(['admin', 'base_commander']), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

    try {
        const db = await connectToMongo();
        const transfer = await db.collection('transfers').findOne({ _id: new ObjectId(req.params.id), status: 'pending' });
        if (!transfer) return res.status(404).json({ error: 'Pending transfer not found.' });

        // Authorization check
        if (req.user.role !== 'admin' && !req.user.base_ids.includes(transfer.from_base_id.toString())) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission for the source base.' });
        }

        const result = await db.collection('transfers').findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: 'rejected', rejectedById: new ObjectId(req.user.id), rejectedAt: new Date() } },
            { returnDocument: 'after' }
        );

        logTransaction(req, { action: 'reject_transfer', tableName: 'transfers', recordId: result.value._id, newData: { status: 'rejected' } });
        res.json(result.value);
    } catch (error) {
        logger.error(`Error rejecting transfer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/transfers/:id/complete
// @desc    Complete a transfer
// @access  Private (Logistics Officer or Admin)
router.put('/:id/complete', hasRole(['logistics_officer', 'admin']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid transfer ID' });
        }

        const transferToComplete = await prisma.transfer.findUnique({ where: { id } });
        if (!transferToComplete) return res.status(404).json({ error: 'Transfer not found.' });
        if (transferToComplete.status !== 'approved') return res.status(400).json({ error: `Transfer must be approved before completion.` });

        // Ensure officer is from the destination base or user is admin
        if (req.user.role !== 'admin' && !(req.user.bases && req.user.bases.some(b => b.baseId === transferToComplete.toBaseId))) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to complete transfers for this base.' });
        }

        const completedTransfer = await prisma.$transaction(async (tx) => {
            // Decrement asset from source base
            await tx.asset.update({
                where: {
                    baseId_equipmentTypeId: {
                        baseId: transferToComplete.fromBaseId,
                        equipmentTypeId: transferToComplete.equipmentTypeId
                    }
                },
                data: {
                    quantity: { decrement: transferToComplete.quantity },
                    closingBalance: { decrement: transferToComplete.quantity }
                },
            });
            // Increment asset at destination base
            await tx.asset.upsert({
                where: { baseId_equipmentTypeId: { baseId: transferToComplete.toBaseId, equipmentTypeId: transferToComplete.equipmentTypeId } },
                update: {
                    quantity: { increment: transferToComplete.quantity },
                    closingBalance: { increment: transferToComplete.quantity }
                },
                create: {
                    baseId: transferToComplete.toBaseId,
                    equipmentTypeId: transferToComplete.equipmentTypeId,
                    quantity: transferToComplete.quantity,
                    closingBalance: transferToComplete.quantity,
                }
            });
            // Update transfer status
            return tx.transfer.update({
                where: { id },
                data: { status: 'completed' },
            });
        });

        logTransaction(req, {
            action: 'complete_transfer',
            tableName: 'transfers',
            recordId: completedTransfer.id,
            oldData: { status: 'approved' },
            newData: { status: 'completed' },
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
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid transfer ID' });
        }

        const transfer = await prisma.transfer.findUnique({ where: { id } });
        if (!transfer) return res.status(404).json({ error: 'Transfer not found.' });
        if (transfer.status === 'completed' || transfer.status === 'cancelled') {
            return res.status(400).json({ error: `Cannot cancel a transfer that is already ${transfer.status}.` });
        }

        // Check permissions
        const canCancel = req.user.role === 'admin' ||
            req.user.id === transfer.createdById ||
            (req.user.role === 'base_commander' && (req.user.bases.some(b => b.baseId === transfer.fromBaseId) || req.user.bases.some(b => b.baseId === transfer.toBaseId)));

        if (!canCancel) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to cancel this transfer.' });
        }

        const cancelledTransfer = await prisma.transfer.update({
            where: { id },
            data: { status: 'cancelled' },
        });

        logTransaction(req, {
            action: 'cancel_transfer',
            tableName: 'transfers',
            recordId: cancelledTransfer.id,
            oldData: { status: transfer.status },
            newData: { status: 'cancelled' },
        });

        res.json(cancelledTransfer);
    } catch (error) {
        logger.error(`Error cancelling transfer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;