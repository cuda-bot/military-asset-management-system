import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// Create a new assignment
router.post('/', [
    body('assetId').isString(),
    body('assignedTo').not().isEmpty(),
    body('assignmentDate').isISO8601().toDate(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { assetId, assignedTo, assignmentDate, notes } = req.body;
    if (!ObjectId.isValid(assetId)) return res.status(400).json({ error: 'Invalid Asset ID' });

    try {
        const db = await connectToMongo();
        const assignmentData = {
            asset_id: new ObjectId(assetId),
            assignedTo,
            assignmentDate,
            notes,
            status: 'assigned',
            assignedById: new ObjectId(req.user.id),
            createdAt: new Date(),
        };
        const result = await db.collection('assignments').insertOne(assignmentData);
        const newAssignment = { _id: result.insertedId, ...assignmentData };

        logTransaction(req, {
            action: 'create_assignment',
            tableName: 'assignments',
            recordId: newAssignment._id,
            newData: newAssignment,
        });

        res.status(201).json(newAssignment);
    } catch (error) {
        logger.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all assignments
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'assignmentDate', order = 'desc', baseId, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const db = await connectToMongo();
        const matchStage = {};
        if (status) matchStage.status = status;

        const pipeline = [
            // First, match assignments
            { $match: matchStage },
            // Then, lookup the asset
            {
                $lookup: {
                    from: 'assets',
                    localField: 'asset_id',
                    foreignField: '_id',
                    as: 'asset'
                }
            },
            { $unwind: '$asset' },
        ];

        // Authorize: filter by base access
        const baseAuthMatch = {};
        if (req.user.role !== 'admin' && req.user.base_ids && req.user.base_ids.length > 0) {
            baseAuthMatch['asset.base_id'] = { $in: req.user.base_ids.map(id => new ObjectId(id)) };
        } else if (baseId && ObjectId.isValid(baseId)) {
            baseAuthMatch['asset.base_id'] = new ObjectId(baseId);
        }
        if (Object.keys(baseAuthMatch).length > 0) {
            pipeline.push({ $match: baseAuthMatch });
        }

        // Finalize pipeline with lookups for display, sort, and pagination
        pipeline.push(
            { $lookup: { from: 'equipment_types', localField: 'asset.equipment_type_id', foreignField: '_id', as: 'asset.equipmentType' } },
            { $unwind: { path: '$asset.equipmentType', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'bases', localField: 'asset.base_id', foreignField: '_id', as: 'asset.base' } },
            { $unwind: { path: '$asset.base', preserveNullAndEmptyArrays: true } },
            { $sort: { [sortBy]: order === 'desc' ? -1 : 1 } },
            {
                $facet: {
                    assignments: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum }
                    ],
                    totalCount: [{ $count: 'count' }]
                }
            }
        );

        const result = await db.collection('assignments').aggregate(pipeline).toArray();
        const assignments = result[0].assignments;
        const totalAssignments = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;
        const totalPages = Math.ceil(totalAssignments / limitNum);

        res.json({ assignments, totalAssignments, totalPages, currentPage: pageNum });
    } catch (error) {
        logger.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Record expenditure for an assignment
router.post('/:id/expenditure', [
    body('expenditureType').not().isEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('expenditureDate').isISO8601().toDate(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid Assignment ID' });

    try {
        const db = await connectToMongo();
        const expenditure = {
            _id: new ObjectId(),
            ...req.body,
            recordedById: new ObjectId(req.user.id),
            createdAt: new Date(),
        };

        const result = await db.collection('assignments').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { expenditures: expenditure } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        logTransaction(req, {
            action: 'record_expenditure',
            tableName: 'assignments',
            recordId: req.params.id,
            newData: expenditure,
        });

        res.status(201).json(expenditure);
    } catch (error) {
        logger.error('Error recording expenditure:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;