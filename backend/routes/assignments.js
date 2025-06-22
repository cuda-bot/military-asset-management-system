import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, hasBaseAccess, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// --- Assignments ---

// @route   POST /api/assignments
// @desc    Create a new assignment
// @access  Private (Base Commander or Admin)
router.post(
    '/',
    [
        hasRole(['base_commander', 'admin']),
        body('assetId', 'Asset ID is required').isInt(),
        body('quantity', 'Quantity must be a positive integer').isInt({ gt: 0 }),
        body('assignedTo', 'Assigned to person is required').not().isEmpty(),
        body('assignmentDate', 'Assignment date is required').isISO8601().toDate(),
        body('expectedReturnDate').optional().isISO8601().toDate(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { assetId, quantity, assignedTo, assignmentDate, expectedReturnDate, notes } = req.body;

        try {
            const asset = await prisma.asset.findUnique({ where: { id: assetId } });
            if (!asset) return res.status(404).json({ error: 'Asset not found.' });

            // Check permissions
            if (req.user.role !== 'admin' && !req.user.bases.includes(asset.baseId)) {
                return res.status(403).json({ error: 'Forbidden: You do not have permission for this asset.' });
            }
            if (asset.quantity < quantity) return res.status(400).json({ error: 'Insufficient quantity available.' });

            const newAssignment = await prisma.$transaction(async (tx) => {
                await tx.asset.update({
                    where: { id: assetId },
                    data: { quantity: { decrement: quantity } },
                });
                return tx.assignment.create({
                    data: {
                        assetId,
                        quantity,
                        assignedTo,
                        assignmentDate,
                        expectedReturnDate,
                        notes,
                        assignedById: req.user.id,
                        status: 'active',
                    },
                });
            });

            logTransaction(req, {
                action: 'create_assignment',
                tableName: 'assignments',
                recordId: newAssignment.id,
                newData: newAssignment
            });

            res.status(201).json(newAssignment);
        } catch (error) {
            logger.error('Error creating assignment:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET /api/assignments
// @desc    Get all assignments
// @access  Private
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'assignmentDate', order = 'desc', baseId, status } = req.query;
    try {
        const where = {};
        if (status) where.status = status;

        if (req.user.role !== 'admin') {
            // A user can only see assignments for their own base.
            where.asset = { base_id: req.user.base_id };
        } else if (baseId) {
            // An admin can filter by any base.
            where.asset = { base_id: baseId };
        }

        logger.info(`Executing findMany on assignments with where clause: ${JSON.stringify(where)}`);
        const assignments = await prisma.assignment.findMany({
            where,
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            orderBy: { [sortBy]: order },
            include: { asset: { include: { base: true, equipmentType: true } }, assignedBy: true },
        });
        const totalAssignments = await prisma.assignment.count({ where });
        res.json({ assignments, totalAssignments, totalPages: Math.ceil(totalAssignments / parseInt(limit)), currentPage: parseInt(page) });
    } catch (error) {
        logger.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/assignments/:id/return
// @desc    Return an assignment
// @access  Private (Base Commander or Admin)
router.put('/:id/return', hasRole(['base_commander', 'admin']), async (req, res) => {
    const { actualReturnDate, notes } = req.body;
    try {
        const assignment = await prisma.assignment.findUnique({ where: { id: parseInt(req.params.id) }, include: { asset: true } });
        if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
        if (assignment.status !== 'active') return res.status(400).json({ error: 'Assignment is not active.' });

        if (req.user.role !== 'admin' && !req.user.bases.includes(assignment.asset.baseId)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const returnedAssignment = await prisma.$transaction(async (tx) => {
            await tx.asset.update({
                where: { id: assignment.assetId },
                data: { quantity: { increment: assignment.quantity } },
            });
            return tx.assignment.update({
                where: { id: parseInt(req.params.id) },
                data: { status: 'returned', actualReturnDate: actualReturnDate || new Date(), notes },
            });
        });

        logTransaction(req, {
            action: 'return_assignment',
            tableName: 'assignments',
            recordId: returnedAssignment.id,
            newData: returnedAssignment
        });

        res.json(returnedAssignment);
    } catch (error) {
        logger.error(`Error returning assignment ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Expenditures ---

// @route   POST /api/assignments/expenditures
// @desc    Record an expenditure
// @access  Private (Base Commander or Admin)
router.post(
    '/expenditures',
    [
        hasRole(['base_commander', 'admin']),
        body('assetId', 'Asset ID is required').isInt(),
        body('quantity', 'Quantity must be a positive integer').isInt({ gt: 0 }),
        body('reason', 'Reason is required').not().isEmpty(),
        body('expenditureDate', 'Expenditure date is required').isISO8601().toDate(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { assetId, quantity, reason, expenditureDate, notes } = req.body;

        try {
            const asset = await prisma.asset.findUnique({ where: { id: assetId } });
            if (!asset) return res.status(404).json({ error: 'Asset not found.' });

            if (req.user.role !== 'admin' && !req.user.bases.includes(asset.baseId)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            if (asset.closingBalance < quantity) return res.status(400).json({ error: 'Insufficient closing balance for expenditure.' });

            const newExpenditure = await prisma.$transaction(async (tx) => {
                await tx.asset.update({
                    where: { id: assetId },
                    data: { closingBalance: { decrement: quantity } },
                });
                return tx.expenditure.create({
                    data: {
                        assetId,
                        quantity,
                        reason,
                        expenditureDate,
                        notes,
                        createdById: req.user.id,
                        approvedById: req.user.id // Auto-approved for simplicity
                    },
                });
            });

            logTransaction(req, {
                action: 'create_expenditure',
                tableName: 'expenditures',
                recordId: newExpenditure.id,
                newData: newExpenditure
            });

            res.status(201).json(newExpenditure);
        } catch (error) {
            logger.error('Error creating expenditure:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET /api/assignments/expenditures
// @desc    Get all expenditures
// @access  Private
router.get('/expenditures', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'expenditure_date', order = 'desc', baseId } = req.query;
    try {
        const where = {};
        if (req.user.role !== 'admin') {
            where.asset = { base_id: { in: req.user.bases } };
            if (baseId) where.asset.base_id = parseInt(baseId);
        } else if (baseId) {
            where.asset = { base_id: parseInt(baseId) };
        }

        logger.info(`Executing findMany on expenditures with where clause: ${JSON.stringify(where)}`);
        const expenditures = await prisma.expenditure.findMany({
            where,
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            orderBy: { [sortBy]: order },
            include: { asset: { include: { base: true, equipmentType: true } }, createdBy: true, approvedBy: true },
        });
        const totalExpenditures = await prisma.expenditure.count({ where });
        res.json({ expenditures, totalExpenditures, totalPages: Math.ceil(totalExpenditures / parseInt(limit)), currentPage: parseInt(page) });
    } catch (error) {
        logger.error('Error fetching expenditures:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;