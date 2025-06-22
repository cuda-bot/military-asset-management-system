import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
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
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, firstName, lastName, role } = req.body;

        try {
            let user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                return res.status(400).json({ error: 'User already exists' });
            }

            const passwordHash = await bcrypt.hash(password, 12);

            user = await prisma.user.create({
                data: {
                    username,
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    role,
                },
            });

            logTransaction(req, {
                action: 'register',
                tableName: 'users',
                recordId: user.id,
                newData: { username: user.username, email: user.email, role: user.role }
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
            const user = await prisma.user.findUnique({
                where: { username },
                include: { base: true },
            });

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    baseId: user.base_id,
                },
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            });

            const { password: passwordHash, ...userWithoutPassword } = user;

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
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                role: true,
                base: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

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
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                bases: { include: { base: true } },
            },
        });

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
        const updateData = {};
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;

        try {
            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: updateData,
            });

            const { passwordHash, ...userWithoutPassword } = updatedUser;
            res.json(userWithoutPassword);
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

            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Incorrect current password' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 12);
            await prisma.user.update({
                where: { id: req.user.id },
                data: { passwordHash },
            });

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Password change error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

export default router; 