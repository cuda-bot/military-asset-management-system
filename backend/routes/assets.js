import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, hasBaseAccess } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// Asset routes for managing equipment in the system
// These endpoints let you view, create, and filter assets in a way that's easy for real users to understand.
// Comments are written to help future developers (and you!) quickly grasp what's going on.

// @route   GET /api/assets
// @desc    Get all assets with filtering and pagination
// @access  Private
router.get('/', async (req, res) => {
    // Extract query params with defaults for a smoother user experience
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', baseId, equipmentTypeId, search } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const db = await connectToMongo();
        // Build the filter for assets based on user role and query
        const matchStage = {};
        if (req.user.role !== 'admin' && req.user.base_ids && req.user.base_ids.length > 0) {
            matchStage.base_id = { $in: req.user.base_ids.map(id => new ObjectId(id)) };
        } else if (baseId && ObjectId.isValid(baseId)) {
            matchStage.base_id = new ObjectId(baseId);
        }
        if (equipmentTypeId && ObjectId.isValid(equipmentTypeId)) {
            matchStage.equipment_type_id = new ObjectId(equipmentTypeId);
        }
        if (search) {
            matchStage['equipmentType.name'] = { $regex: search, $options: 'i' };
        }
        // Sorting logic for a more natural asset list
        const sortStage = {};
        if (sortBy === 'equipmentType' || sortBy === 'equipment_type') {
            sortStage['equipmentType.name'] = order === 'desc' ? -1 : 1;
        } else {
            sortStage[sortBy] = order === 'desc' ? -1 : 1;
        }
        // MongoDB aggregation pipeline for joining and filtering
        const pipeline = [
            {
                $lookup: {
                    from: 'equipment_types',
                    localField: 'equipment_type_id',
                    foreignField: '_id',
                    as: 'equipmentType'
                }
            },
            { $unwind: '$equipmentType' },
            { $match: matchStage },
            {
                $lookup: {
                    from: 'bases',
                    localField: 'base_id',
                    foreignField: '_id',
                    as: 'base'
                }
            },
            { $unwind: { path: '$base', preserveNullAndEmptyArrays: true } },
            { $sort: sortStage },
            {
                $facet: {
                    assets: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];
        const result = await db.collection('assets').aggregate(pipeline).toArray();
        const assets = result[0].assets;
        const totalAssets = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;
        const totalPages = Math.ceil(totalAssets / limitNum);
        res.json({
            assets,
            totalAssets,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Something went wrong while fetching assets:', error);
        res.status(500).json({ error: 'Oops! We couldn\'t load the assets right now. Please try again in a moment.' });
    }
});

// @route   GET /api/assets/categories
// @desc    Get all equipment type categories
// @access  Private
router.get('/categories', async (req, res) => {
    try {
        const db = await connectToMongo();
        const categories = await db.collection('equipment_types').find().sort({ name: 1 }).toArray();
        res.json(categories);
    } catch (error) {
        logger.error('Could not fetch asset categories:', error);
        res.status(500).json({ error: 'Sorry, we couldn\'t get the categories right now. Please try again later.' });
    }
});

// @route   GET /api/assets/:id
// @desc    Get a single asset by ID
// @access  Private
router.get('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'That asset ID doesn\'t look right. Please check and try again.' });
    try {
        const db = await connectToMongo();
        const asset = await db.collection('assets').findOne({ _id: new ObjectId(req.params.id) });
        if (!asset) return res.status(404).json({ error: 'We couldn\'t find an asset with that ID.' });
        if (req.user.role !== 'admin' && !(req.user.base_ids && req.user.base_ids.includes(asset.base_id.toString()))) {
            return res.status(403).json({ error: 'You don\'t have permission to view this asset.' });
        }
        res.json(asset);
    } catch (error) {
        logger.error(`Trouble fetching asset ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, something went wrong while loading this asset.' });
    }
});

// @route   GET /api/assets/base/:baseId
// @desc    Get assets for a specific base
// @access  Private (with base access check)
router.get('/base/:baseId', hasBaseAccess, async (req, res) => {
    if (!ObjectId.isValid(req.params.baseId)) return res.status(400).json({ error: 'That base ID doesn\'t look right. Please check and try again.' });
    try {
        const db = await connectToMongo();
        const assets = await db.collection('assets').find({ base_id: new ObjectId(req.params.baseId) }).toArray();
        res.json(assets);
    } catch (error) {
        logger.error(`Trouble fetching assets for base ${req.params.baseId}:`, error);
        res.status(500).json({ error: 'Could not load assets for this base. Please try again soon.' });
    }
});

// @route   POST /api/assets
// @desc    Create a new asset
// @access  Private
router.post('/', async (req, res) => {
    try {
        const db = await connectToMongo();
        const { name, serial_number, type_id, base_id, status, quantity } = req.body;
        // Friendly validation message
        if (!name || !serial_number || !type_id || !base_id || !status) {
            return res.status(400).json({ error: 'Please fill in all required fields: name, serial number, type, base, and status.' });
        }
        const newAsset = {
            name,
            serial_number,
            equipment_type_id: new ObjectId(type_id),
            base_id: new ObjectId(base_id),
            status,
            quantity: quantity || 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('assets').insertOne(newAsset);
        res.status(201).json({ ...newAsset, _id: result.insertedId });
    } catch (error) {
        logger.error('Error creating asset:', error);
        res.status(500).json({ error: 'We couldn\'t create the asset right now. Please try again later.' });
    }
});

export default router;