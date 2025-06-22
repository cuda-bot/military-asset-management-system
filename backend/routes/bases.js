import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, logTransaction } from '../middleware/auth.js';

const router = Router();

// @route   GET /api/bases
// @desc    Get all bases
// @access  Private (all authenticated users)
router.get('/', verifyToken, async (req, res) => {
    try {
        const bases = await prisma.base.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(bases);
    } catch (error) {
        logger.error('Error fetching bases:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/bases/:id
// @desc    Get a single base by ID
// @access  Private (all authenticated users)
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const base = await prisma.base.findUnique({
            where: { id: parseInt(req.params.id) },
        });

        if (!base) {
            return res.status(404).json({ error: 'Base not found' });
        }
        res.json(base);
    } catch (error) {
        logger.error(`Error fetching base ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/bases
// @desc    Create a new base
// @access  Admin
router.post(
    '/',
    [
        verifyToken,
        hasRole(['admin']),
        body('name', 'Name is required').not().isEmpty(),
        body('location', 'Location is required').not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, location, commanderName, contactEmail, contactPhone } = req.body;

        try {
            const newBase = await prisma.base.create({
                data: {
                    name,
                    location,
                    commanderName,
                    contactEmail,
                    contactPhone,
                },
            });

            logTransaction(req, {
                action: 'create_base',
                tableName: 'bases',
                recordId: newBase.id,
                newData: newBase,
            });

            res.status(201).json(newBase);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'A base with this name already exists' });
            }
            logger.error('Error creating base:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT /api/bases/:id
// @desc    Update a base
// @access  Admin
router.put(
    '/:id',
    [
        verifyToken,
        hasRole(['admin']),
        body('name').optional().not().isEmpty(),
        body('location').optional().not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, location, commanderName, contactEmail, contactPhone } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (location) updateData.location = location;
        if (commanderName) updateData.commanderName = commanderName;
        if (contactEmail) updateData.contactEmail = contactEmail;
        if (contactPhone) updateData.contactPhone = contactPhone;

        try {
            const oldBase = await prisma.base.findUnique({ where: { id: parseInt(req.params.id) } });
            if (!oldBase) return res.status(404).json({ error: 'Base not found' });

            const updatedBase = await prisma.base.update({
                where: { id: parseInt(req.params.id) },
                data: updateData,
            });

            logTransaction(req, {
                action: 'update_base',
                tableName: 'bases',
                recordId: updatedBase.id,
                oldData: oldBase,
                newData: updatedBase,
            });

            res.json(updatedBase);
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(409).json({ error: 'A base with this name already exists' });
            }
            logger.error(`Error updating base ${req.params.id}:`, error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   DELETE /api/bases/:id
// @desc    Delete a base
// @access  Admin
router.delete('/:id', [verifyToken, hasRole(['admin'])], async (req, res) => {
    try {
        const base = await prisma.base.delete({
            where: { id: parseInt(req.params.id) },
        });

        logTransaction(req, {
            action: 'delete_base',
            tableName: 'bases',
            recordId: base.id,
            oldData: base,
        });

        res.json({ message: 'Base deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Base not found' });
        }
        logger.error(`Error deleting base ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router; 