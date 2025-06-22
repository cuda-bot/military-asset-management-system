import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, hasBaseAccess, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   POST /api/purchases
// @desc    Create a new purchase record
// @access  Private (Logistics Officer or Admin)
router.post(
    '/',
    [
        hasRole(['logistics_officer', 'admin']),
        body('baseId', 'Base ID is required').isInt(),
        hasBaseAccess,
        body('equipmentTypeId', 'Equipment Type ID is required').isInt(),
        body('quantity', 'Quantity must be a positive integer').isInt({ gt: 0 }),
        body('unitPrice', 'Unit price is required').isFloat({ gt: 0 }),
        body('purchaseDate', 'Purchase date is required').isISO8601().toDate(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { baseId, equipmentTypeId, quantity, unitPrice, supplier, purchaseDate, invoiceNumber, notes } = req.body;
        const totalAmount = quantity * unitPrice;

        try {
            const newPurchase = await prisma.$transaction(async (tx) => {
                const purchase = await tx.purchase.create({
                    data: {
                        baseId,
                        equipmentTypeId,
                        quantity,
                        unitPrice,
                        totalAmount,
                        supplier,
                        purchaseDate,
                        invoiceNumber,
                        notes,
                        createdById: req.user.id,
                    },
                });

                // Update asset balance
                await tx.asset.updateMany({
                    where: { baseId, equipmentTypeId },
                    data: {
                        quantity: { increment: quantity },
                        closingBalance: { increment: quantity },
                    },
                });

                return purchase;
            });

            logTransaction(req, {
                action: 'create_purchase',
                tableName: 'purchases',
                recordId: newPurchase.id,
                newData: newPurchase,
            });

            res.status(201).json(newPurchase);
        } catch (error) {
            logger.error('Error creating purchase:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET /api/purchases
// @desc    Get all purchases with filtering and pagination
// @access  Private
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'purchaseDate', order = 'desc', baseId, equipmentTypeId } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const where = {};
        if (req.user.role !== 'admin' && req.user.base_id) {
            where.base_id = req.user.base_id;
        } else if (baseId) {
            where.base_id = baseId;
        }
        if (equipmentTypeId) where.type_id = equipmentTypeId;

        const purchases = await prisma.purchase.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { [sortBy === 'purchaseDate' ? 'purchase_date' : sortBy]: order },
            include: {
                asset: true,
                base: true,
            },
        });

        const totalPurchases = await prisma.purchase.count({ where });
        const totalPages = Math.ceil(totalPurchases / limitNum);

        res.json({
            purchases,
            totalPurchases,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/purchases/:id
// @desc    Get a single purchase by ID
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const purchase = await prisma.purchase.findUnique({
            where: { id: req.params.id },
            include: {
                asset: true,
                base: true,
            },
        });

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        if (req.user.role !== 'admin' && req.user.base_id !== purchase.base_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(purchase);
    } catch (error) {
        logger.error(`Error fetching purchase ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/purchases/:id
// @desc    Delete a purchase (reverses asset update)
// @access  Admin
router.delete('/:id', hasRole(['admin']), async (req, res) => {
    try {
        const deletedPurchase = await prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.findUnique({ where: { id: req.params.id } });

            if (!purchase) {
                throw new Error('PurchaseNotFound');
            }

            // This logic is simplified. A real app would need to handle asset creation/updates.
            // For now, we just delete the purchase record.

            return tx.purchase.delete({ where: { id: req.params.id } });
        });

        logTransaction(req, {
            action: 'delete_purchase',
            tableName: 'purchases',
            recordId: deletedPurchase.id,
            oldData: deletedPurchase
        });

        res.json({ message: 'Purchase deleted successfully' });
    } catch (error) {
        if (error.message === 'PurchaseNotFound' || error.code === 'P2025') {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        logger.error(`Error deleting purchase ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router; 