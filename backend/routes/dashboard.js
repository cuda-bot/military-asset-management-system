import { Router } from 'express';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   GET /api/dashboard/metrics
// @desc    Get dashboard metrics
// @access  Private
router.get('/metrics', async (req, res) => {
    const { start_date, end_date, base_id, equipment_type_id } = req.query;
    const user = req.user;

    try {
        const whereClause = {};
        if (user.role !== 'admin' && user.base_id) {
            whereClause.base_id = user.base_id;
        } else if (base_id) {
            whereClause.base_id = base_id;
        }

        if (equipment_type_id) {
            whereClause.type_id = equipment_type_id;
        }

        const dateFilter = {};
        if (start_date) dateFilter.gte = new Date(start_date);
        if (end_date) dateFilter.lte = new Date(end_date);

        const hasDateFilter = Object.keys(dateFilter).length > 0;

        // For this simplified example, we'll just count assets.
        // A real implementation would require more complex logic for balances.
        const opening_balance = await prisma.asset.count({ where: whereClause });
        const closing_balance = opening_balance; // Placeholder

        // Purchases
        const purchases = await prisma.purchase.count({
            where: { ...whereClause, ...(hasDateFilter && { purchase_date: dateFilter }) },
        });

        // Transfers In
        const transfers_in = await prisma.transfer.count({
            where: { to_base_id: whereClause.base_id, ...(hasDateFilter && { transfer_date: dateFilter }) },
        });

        // Transfers Out
        const transfers_out = await prisma.transfer.count({
            where: { from_base_id: whereClause.base_id, ...(hasDateFilter && { transfer_date: dateFilter }) },
        });

        // Assignments
        const assigned = await prisma.assignment.count({
            where: { asset: { ...whereClause }, ...(hasDateFilter && { assignment_date: dateFilter }) },
        });

        // Expenditures
        const expended = await prisma.expenditure.count({
            where: { asset: { ...whereClause }, ...(hasDateFilter && { expenditure_date: dateFilter }) },
        });

        const net_movement = purchases + transfers_in - transfers_out - expended;

        res.json({
            metrics: {
                opening_balance,
                closing_balance,
                net_movement,
                purchases,
                transfers_in,
                transfers_out,
                assigned,
                expended,
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
        let baseWhere = {};
        if (req.user.role !== 'admin' && req.user.base_id) {
            baseWhere.id = req.user.base_id;
        }

        const bases = await prisma.base.findMany({
            where: baseWhere,
            orderBy: { name: 'asc' }
        });

        const equipment_types = await prisma.equipmentType.findMany({
            orderBy: { name: 'asc' }
        });

        res.json({ bases, equipment_types });
    } catch (error) {
        logger.error('Error fetching dashboard filters:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router; 