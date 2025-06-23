import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, logTransaction } from '../middleware/auth.js';

const router = Router();

// @route   GET /api/bases
// @desc    Get all bases
// @access  Private (all authenticated users)
router.get('/', verifyToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const bases = await db.collection('bases').find().sort({ name: 1 }).toArray();
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
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid base ID format' });
    }
    try {
        const db = await connectToMongo();
        const base = await db.collection('bases').findOne({ _id: new ObjectId(req.params.id) });

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
            const db = await connectToMongo();

            const existingBase = await db.collection('bases').findOne({ name });
            if (existingBase) {
                return res.status(409).json({ error: 'A base with this name already exists' });
            }

            const newBase = {
                name,
                location,
                commanderName,
                contactEmail,
                contactPhone,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('bases').insertOne(newBase);
            const insertedBase = { _id: result.insertedId, ...newBase };

            logTransaction(req, {
                action: 'create_base',
                tableName: 'bases',
                recordId: insertedBase._id,
                newData: insertedBase,
            });

            res.status(201).json(insertedBase);
        } catch (error) {
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
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid base ID format' });
        }

        const { name, location, commanderName, contactEmail, contactPhone } = req.body;
        const updateData = { $set: { updatedAt: new Date() } };
        if (name) updateData.$set.name = name;
        if (location) updateData.$set.location = location;
        if (commanderName) updateData.$set.commanderName = commanderName;
        if (contactEmail) updateData.$set.contactEmail = contactEmail;
        if (contactPhone) updateData.$set.contactPhone = contactPhone;

        try {
            const db = await connectToMongo();
            const result = await db.collection('bases').findOneAndUpdate(
                { _id: new ObjectId(req.params.id) },
                updateData,
                { returnDocument: 'after' }
            );

            if (!result.value) {
                return res.status(404).json({ error: 'Base not found' });
            }

            logTransaction(req, {
                action: 'update_base',
                tableName: 'bases',
                recordId: result.value._id,
                newData: result.value
            });

            res.json(result.value);
        } catch (error) {
            if (error.code === 11000) { // Mongo duplicate key error
                return res.status(409).json({ error: 'A base with this name already exists.' });
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
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid base ID format' });
    }
    try {
        const db = await connectToMongo();
        const baseToDelete = await db.collection('bases').findOne({ _id: new ObjectId(req.params.id) });
        if (!baseToDelete) {
            return res.status(404).json({ error: 'Base not found' });
        }
        const result = await db.collection('bases').deleteOne({ _id: new ObjectId(req.params.id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Base not found' });
        }

        logTransaction(req, {
            action: 'delete_base',
            tableName: 'bases',
            recordId: req.params.id,
            oldData: baseToDelete
        });

        res.json({ message: 'Base deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting base ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router; 