import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, hasBaseAccess } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// @route   GET /api/assets
// @desc    Get all assets with filtering and pagination
// @access  Private
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', baseId, equipmentTypeId, search } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const where = {};
        if (req.user.role !== 'admin') {
            where.base_id = { in: req.user.bases };
        } else if (baseId) {
            where.base_id = parseInt(baseId);
        }

        if (equipmentTypeId) where.equipment_type_id = parseInt(equipmentTypeId);
        if (search) {
            where.OR = [
                { equipmentType: { name: { contains: search, mode: 'insensitive' } } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        logger.info(`Executing findMany on assets with where clause: ${JSON.stringify(where)}`);
        const assets = await prisma.asset.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { [sortBy]: order },
            include: {
                equipmentType: true,
                base: true,
            },
        });

        const totalAssets = await prisma.asset.count({ where });
        const totalPages = Math.ceil(totalAssets / limitNum);

        res.json({
            assets,
            totalAssets,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/assets/categories
// @desc    Get all equipment type categories
// @access  Private
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.equipmentType.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(categories);
    } catch (error) {
        logger.error('Error fetching asset categories:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   GET /api/assets/:id
// @desc    Get a single asset by ID
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                equipmentType: true,
                base: true,
                assignments: { include: { assignedBy: true } },
                expenditures: { include: { createdBy: true } },
            },
        });

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        if (req.user.role !== 'admin' && !req.user.bases.includes(asset.baseId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(asset);
    } catch (error) {
        logger.error(`Error fetching asset ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/assets/base/:baseId
// @desc    Get assets for a specific base
// @access  Private (with base access check)
router.get('/base/:baseId', hasBaseAccess, async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({
            where: { base_id: parseInt(req.params.baseId) },
            include: { equipmentType: true },
            orderBy: { equipmentType: { name: 'asc' } },
        });
        res.json(assets);
    } catch (error) {
        logger.error(`Error fetching assets for base ${req.params.baseId}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;