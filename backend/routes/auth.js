import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { verifyToken, logTransaction } from '../middleware/auth.js';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public (for initial setup, should be admin-only in production)
router.post(
    '/register',
    [
        body('username', 'Username is required').not().isEmpty(),
        body('email', 'Please include a valid email').isEmail(),
        body('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
        body('firstName', 'First name is required').not().isEmpty(),
        body('lastName', 'Last name is required').not().isEmpty(),
        body('role').isIn(['admin', 'base_commander', 'logistics_officer']),
    ],
    async (req, res) => {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Registration is disabled in production' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, firstName, lastName, role } = req.body;

        try {
            const db = await connectToMongo();
            const collection = db.collection('users');

            let user = await collection.findOne({ email });
            if (user) {
                return res.status(400).json({ error: 'User already exists' });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const newUser = {
                username,
                email,
                password: passwordHash,
                firstName,
                lastName,
                role,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await collection.insertOne(newUser);
            const insertedUser = { _id: result.insertedId, ...newUser };


            logTransaction(req, {
                action: 'register',
                tableName: 'users',
                recordId: insertedUser._id,
                newData: { username: insertedUser.username, email: insertedUser.email, role: insertedUser.role },
            });

            res.status(201).json({ message: 'User registered successfully' });
        } catch (error) {
            logger.error('Registration error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post(
    '/login',
    [
        body('username', 'Username is required').not().isEmpty(),
        body('password', 'Password is required').exists(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            const db = await connectToMongo();
            const user = await db.collection('users').findOne({ username });

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const payload = {
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    role: user.role,
                    base_ids: user.base_ids || [],
                },
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            });

            const { password: _, ...userWithoutPassword } = user;

            res.json({
                token,
                user: userWithoutPassword,
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   GET /api/auth/verify
// @desc    Verify token and return user data
// @access  Private
router.get('/verify', verifyToken, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.user.id)) {
            return res.status(400).json({ error: 'Invalid user ID in token' });
        }
        const db = await connectToMongo();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        logger.error('Token verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   GET /api/auth/profile
// @desc    Get current user's profile
// @access  Private
router.get('/profile', verifyToken, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.user.id)) {
            return res.status(400).json({ error: 'Invalid user ID in token' });
        }
        const db = await connectToMongo();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update current user's profile
// @access  Private
router.put(
    '/profile',
    [
        verifyToken,
        body('email', 'Please include a valid email').optional().isEmail(),
        body('firstName', 'First name is required').optional().not().isEmpty(),
        body('lastName', 'Last name is required').optional().not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, firstName, lastName } = req.body;
        const updateData = { updatedAt: new Date() };
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;

        try {
            if (!ObjectId.isValid(req.user.id)) {
                return res.status(400).json({ error: 'Invalid user ID in token' });
            }
            const db = await connectToMongo();
            const result = await db.collection('users').findOneAndUpdate(
                { _id: new ObjectId(req.user.id) },
                { $set: updateData },
                { returnDocument: 'after', projection: { password: 0 } }
            );

            if (!result.value) {
                return res.status(404).json({ error: 'User not found' });
            }

            logTransaction(req, {
                action: 'update-profile',
                tableName: 'users',
                recordId: result.value._id,
                newData: updateData
            });

            res.json(result.value);
        } catch (error) {
            logger.error('Profile update error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT /api/auth/change-password
// @desc    Change current user's password
// @access  Private
router.put(
    '/change-password',
    [
        verifyToken,
        body('currentPassword', 'Current password is required').not().isEmpty(),
        body('newPassword', 'New password must be 6 or more characters').isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;

        try {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect current password' });
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({
                where: { id: req.user.id },
                data: { password: newPasswordHash },
            });

            logTransaction(req, {
                action: 'change-password',
                tableName: 'users',
                recordId: user.id
            });

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Password change error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

export default router; 