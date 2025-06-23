import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, logTransaction } from '../middleware/auth.js';

const router = Router();

// All routes in this file are protected and require admin role
// These endpoints let you view, create, update, and manage users in a way that's clear for real admins.
// Comments are written to help future developers (and you!) quickly grasp what's going on.
router.use(verifyToken, hasRole(['admin']));

// @route   GET /api/users
// @desc    Get all users with pagination
// @access  Admin
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search = '' } = req.query;
    try {
        const db = await connectToMongo();
        const collection = db.collection('users');
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        // Build a flexible search query for a more natural admin experience
        const query = search ? {
            $or: [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
            ],
        } : {};
        const users = await collection
            .find(query, { projection: { password: 0 } })
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .toArray();
        const totalUsers = await collection.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limitNum);
        res.json({ users, totalUsers, totalPages, currentPage: pageNum });
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Sorry, we couldn\'t load the users right now. Please try again in a moment.' });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Admin
router.get('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'That user ID doesn\'t look right. Please check and try again.' });
    }
    try {
        const db = await connectToMongo();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.params.id) },
            { projection: { password: 0 } }
        );
        if (!user) {
            return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        }
        res.json(user);
    } catch (error) {
        logger.error(`Error fetching user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, something went wrong while loading this user.' });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user details
// @access  Admin
router.put('/:id', [
    body('email').optional().isEmail(),
    body('firstName').optional().not().isEmpty(),
    body('lastName').optional().not().isEmpty(),
    body('role').optional().isIn(['admin', 'base_commander', 'logistics_officer']),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array(), message: 'Please check the fields and try again.' });
    }
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'That user ID doesn\'t look right. Please check and try again.' });
    }
    const { email, firstName, lastName, role } = req.body;
    const updateData = {};
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (role) updateData.role = role;
    try {
        const db = await connectToMongo();
        const result = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData },
            { returnDocument: 'after', projection: { password: 0 } }
        );
        if (!result.value) {
            return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        }
        logTransaction(req, {
            action: 'update_user',
            tableName: 'users',
            recordId: result.value._id.toString(),
            newData: updateData,
        });
        res.json({ message: 'User updated successfully!', user: result.value });
    } catch (error) {
        logger.error(`Error updating user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, we couldn\'t update the user right now. Please try again later.' });
    }
});

// @route   PUT /api/users/:id/assign-base
// @desc    Assign a base to a user
// @access  Admin
router.put('/:id/assign-base', [body('baseId').isString()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), message: 'Please provide a valid base ID.' });
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(req.body.baseId)) {
        return res.status(400).json({ error: 'That user or base ID doesn\'t look right. Please check and try again.' });
    }
    try {
        const db = await connectToMongo();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $addToSet: { base_ids: new ObjectId(req.body.baseId) } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        res.json({ message: 'Base assigned to user successfully!' });
    } catch (error) {
        logger.error(`Error assigning base to user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, we couldn\'t assign the base right now. Please try again later.' });
    }
});

// @route   PUT /api/users/:id/unassign-base
// @desc    Unassign a base from a user
// @access  Admin
router.put('/:id/unassign-base', [body('baseId').isString()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array(), message: 'Please provide a valid base ID.' });
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(req.body.baseId)) {
        return res.status(400).json({ error: 'That user or base ID doesn\'t look right. Please check and try again.' });
    }
    try {
        const db = await connectToMongo();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $pull: { base_ids: new ObjectId(req.body.baseId) } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        res.json({ message: 'Base unassigned from user successfully!' });
    } catch (error) {
        logger.error(`Error unassigning base from user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, we couldn\'t unassign the base right now. Please try again later.' });
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Admin
router.delete('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'That user ID doesn\'t look right. Please check and try again.' });
    }
    try {
        const db = await connectToMongo();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'We couldn\'t find a user with that ID.' });
        }
        logTransaction(req, {
            action: 'delete_user',
            tableName: 'users',
            recordId: req.params.id,
            oldData: user,
        });
        res.json({ message: 'User deleted successfully!' });
    } catch (error) {
        logger.error(`Error deleting user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Sorry, we couldn\'t delete the user right now. Please try again later.' });
    }
});

// @route   POST /api/users
// @desc    Create a new user (admin only)
// @access  Admin
router.post(
    '/',
    [
        body('username', 'Username is required').not().isEmpty(),
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
        body('firstName', 'First name is required').not().isEmpty(),
        body('lastName', 'Last name is required').not().isEmpty(),
        body('role').isIn(['admin', 'base_commander', 'logistics_officer']),
        body('base_ids').optional().isArray(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, email, password, firstName, lastName, role, base_ids } = req.body;
        try {
            const db = await connectToMongo();
            const collection = db.collection('users');
            // Check for existing user by email or username
            const existing = await collection.findOne({ $or: [{ email }, { username }] });
            if (existing) {
                return res.status(400).json({ error: 'User with this email or username already exists' });
            }
            // Hash password
            const bcrypt = (await import('bcryptjs')).default;
            const passwordHash = await bcrypt.hash(password, 12);
            const newUser = {
                username,
                email,
                password: passwordHash,
                firstName,
                lastName,
                role,
                base_ids: Array.isArray(base_ids) ? base_ids.map(id => new ObjectId(id)) : [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await collection.insertOne(newUser);
            const insertedUser = { _id: result.insertedId, ...newUser };
            logTransaction(req, {
                action: 'admin_create_user',
                tableName: 'users',
                recordId: insertedUser._id,
                newData: { username: insertedUser.username, email: insertedUser.email, role: insertedUser.role },
            });
            // Exclude password from response
            const { password: _, ...userWithoutPassword } = insertedUser;
            res.status(201).json(userWithoutPassword);
        } catch (error) {
            logger.error('Admin user creation error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

export default router;