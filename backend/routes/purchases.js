import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo, getMongoClient } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, logTransaction } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// All routes in this file are protected and require authentication
// These endpoints let you view, create, and manage purchases in a way that's clear for real users.
// Comments are written to help future developers (and you!) quickly grasp what's going on.

// Create a new purchase
router.post(
    '/',
    [
        body('baseId').isString(),
        body('equipmentTypeId').isString(),
        body('quantity').isInt({ gt: 0 }),
        body('unitPrice').isFloat({ gt: 0 }),
        body('supplier').not().isEmpty(),
        body('purchaseDate').isISO8601().toDate(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array(), message: 'Please check the fields and try again.' });
        }
        const { baseId, equipmentTypeId, quantity, unitPrice, supplier, purchaseDate, invoiceNumber, notes } = req.body;
        if (!ObjectId.isValid(baseId) || !ObjectId.isValid(equipmentTypeId)) {
            return res.status(400).json({ error: 'That base or equipment type ID doesn\'t look right. Please check and try again.' });
        }
        const session = getMongoClient().startSession();
        const db = await connectToMongo();
        try {
            let newPurchase;
            await session.withTransaction(async () => {
                const purchaseData = {
                    base_id: new ObjectId(baseId),
                    equipment_type_id: new ObjectId(equipmentTypeId),
                    quantity,
                    unitPrice,
                    totalAmount: quantity * unitPrice,
                    supplier,
                    purchaseDate,
                    invoiceNumber,
                    notes,
                    createdById: new ObjectId(req.user.id),
                    createdAt: new Date()
                };
                const result = await db.collection('purchases').insertOne(purchaseData, { session });
                newPurchase = { _id: result.insertedId, ...purchaseData };
                await db.collection('assets').updateOne(
                    { base_id: new ObjectId(baseId), equipment_type_id: new ObjectId(equipmentTypeId) },
                    {
                        $inc: { quantity: quantity },
                        $setOnInsert: { openingBalance: 0 }
                    },
                    { upsert: true, session }
                );
            });
            logTransaction(req, {
                action: 'create_purchase',
                tableName: 'purchases',
                recordId: newPurchase._id,
                newData: newPurchase,
            });
            // Populate equipmentType, base, and createdBy for the response
            const populatedPurchase = await db.collection('purchases').aggregate([
                { $match: { _id: newPurchase._id } },
                { $lookup: { from: 'equipment_types', localField: 'equipment_type_id', foreignField: '_id', as: 'equipmentType' } },
                { $unwind: '$equipmentType' },
                { $lookup: { from: 'bases', localField: 'base_id', foreignField: '_id', as: 'base' } },
                { $unwind: '$base' },
                { $lookup: { from: 'users', localField: 'createdById', foreignField: '_id', as: 'createdBy' } },
                { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } }
            ]).toArray();
            res.status(201).json(populatedPurchase[0]);
        } catch (error) {
            logger.error('Error creating purchase:', error);
            res.status(500).json({ error: 'Sorry, we couldn\'t create the purchase right now. Please try again later.' });
        } finally {
            session.endSession();
        }
    }
);

// Get all purchases
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'purchaseDate', order = 'desc', baseId, equipmentTypeId } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    try {
        const db = await connectToMongo();
        // Build the filter for purchases based on user role and query
        const matchStage = {};
        if (req.user.role !== 'admin' && req.user.base_ids && req.user.base_ids.length > 0) {
            matchStage.base_id = { $in: req.user.base_ids.map(id => new ObjectId(id)) };
        } else if (baseId && ObjectId.isValid(baseId)) {
            matchStage.base_id = new ObjectId(baseId);
        }
        if (equipmentTypeId && ObjectId.isValid(equipmentTypeId)) {
            matchStage.equipment_type_id = new ObjectId(equipmentTypeId);
        }
        const sortStage = { [sortBy]: order === 'desc' ? -1 : 1 };
        // MongoDB aggregation pipeline for joining and filtering
        const pipeline = [
            { $match: matchStage },
            { $lookup: { from: 'equipment_types', localField: 'equipment_type_id', foreignField: '_id', as: 'equipmentType' } },
            { $unwind: '$equipmentType' },
            { $lookup: { from: 'bases', localField: 'base_id', foreignField: '_id', as: 'base' } },
            { $unwind: '$base' },
            { $lookup: { from: 'users', localField: 'createdById', foreignField: '_id', as: 'createdBy' } },
            { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
            { $sort: sortStage },
            {
                $facet: {
                    purchases: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum }
                    ],
                    totalCount: [
                        { $count: 'count' }
                    ]
                }
            }
        ];
        const result = await db.collection('purchases').aggregate(pipeline).toArray();
        const purchases = result[0].purchases;
        const totalPurchases = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;
        const totalPages = Math.ceil(totalPurchases / limitNum);
        res.json({
            purchases,
            totalPurchases,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Sorry, we couldn\'t load the purchases right now. Please try again in a moment.' });
    }
});

// Get purchase by ID
router.get('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'That purchase ID doesn\'t look right. Please check and try again.' });
    }
    try {
        const db = await connectToMongo();
        const purchase = await db.collection('purchases').findOne({ _id: new ObjectId(req.params.id) });
        if (!purchase) {
            return res.status(404).json({ error: 'We couldn\'t find a purchase with that ID.' });
        }
        res.json(purchase);
    } catch (error) {
        logger.error('Error fetching purchase:', error);
        res.status(500).json({ error: 'Sorry, something went wrong while loading this purchase.' });
    }
});

export default router;