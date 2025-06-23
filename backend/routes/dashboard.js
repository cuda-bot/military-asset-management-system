import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   GET /api/dashboard/metrics
// @desc    Get dashboard metrics
// @access  Private
router.get('/metrics', async (req, res) => {
    // Accept both camelCase and snake_case query params
    const startDate = req.query.start_date || req.query.startDate;
    const endDate = req.query.end_date || req.query.endDate;
    const baseId = req.query.base_id || req.query.baseId;
    const equipmentTypeId = req.query.equipment_type_id || req.query.equipmentTypeId;
    const { user } = req;

    try {
        const db = await connectToMongo();

        // Authorization & Base Filtering
        let baseFilter = {};
        if (user.role !== 'admin' && user.base_ids && user.base_ids.length > 0) {
            const userBases = user.base_ids.map(id => new ObjectId(id));
            if (baseId && ObjectId.isValid(baseId) && user.base_ids.includes(baseId)) {
                baseFilter = { _id: new ObjectId(baseId) };
            } else {
                baseFilter = { _id: { $in: userBases } };
            }
        } else if (baseId && ObjectId.isValid(baseId)) {
            baseFilter = { _id: new ObjectId(baseId) };
        }

        const baseIds = await db.collection('bases').find(baseFilter).project({ _id: 1 }).toArray();
        const authorizedBaseIds = baseIds.map(b => b._id);

        // Date Filtering
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // Aggregations
        const opening_balance = await db.collection('assets').countDocuments({ base_id: { $in: authorizedBaseIds } });

        const purchasesFilter = { base_id: { $in: authorizedBaseIds } };
        if (hasDateFilter) purchasesFilter.purchaseDate = dateFilter;
        const purchasesAgg = await db.collection('purchases').aggregate([
            { $match: purchasesFilter },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]).toArray();
        const purchases = purchasesAgg[0]?.total || 0;

        const transfersInFilter = { to_base_id: { $in: authorizedBaseIds }, status: 'approved' };
        if (hasDateFilter) transfersInFilter.approvedAt = dateFilter;
        const transfersInAgg = await db.collection('transfers').aggregate([
            { $match: transfersInFilter },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]).toArray();
        const transfers_in = transfersInAgg[0]?.total || 0;

        const transfersOutFilter = { from_base_id: { $in: authorizedBaseIds }, status: 'approved' };
        if (hasDateFilter) transfersOutFilter.approvedAt = dateFilter;
        const transfersOutAgg = await db.collection('transfers').aggregate([
            { $match: transfersOutFilter },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]).toArray();
        const transfers_out = transfersOutAgg[0]?.total || 0;

        // For now, assigned and expended are set to 0 (implement as needed)
        const assigned = 0;
        const expended = 0;

        // Calculate net movement and closing balance
        const net_movement = purchases + transfers_in - transfers_out;
        const closing_balance = opening_balance + net_movement;

        res.json({
            metrics: {
                opening_balance,
                closing_balance,
                net_movement,
                purchases,
                transfers_in,
                transfers_out,
                assigned,
                expended
            }
        });
    } catch (error) {
        logger.error('Error fetching dashboard metrics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   GET /api/dashboard/filters
// @desc    Get data for dashboard filters (bases, equipment types)
// @access  Private
router.get('/filters', async (req, res) => {
    try {
        const db = await connectToMongo();
        let baseFilter = {};
        if (req.user.role !== 'admin' && req.user.base_ids && req.user.base_ids.length > 0) {
            baseFilter._id = { $in: req.user.base_ids.map(id => new ObjectId(id)) };
        }

        const bases = await db.collection('bases').find(baseFilter).sort({ name: 1 }).toArray();
        const equipmentTypes = await db.collection('equipment_types').find().sort({ name: 1 }).toArray();

        res.json({ bases, equipmentTypes });
    } catch (error) {
        logger.error('Error fetching dashboard filters:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router; 