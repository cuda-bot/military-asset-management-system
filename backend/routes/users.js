import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { verifyToken, hasRole, logTransaction } from '../middleware/auth.js';

const router = Router();

// All routes in this file are protected and require admin role
router.use(verifyToken, hasRole(['admin']));

// @route   GET /api/users
// @desc    Get all users with pagination
// @access  Admin
router.get('/', async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search = '' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
        const where = search ? {
            OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
            ],
        } : {};

        const users = await prisma.user.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { [sortBy]: order },
            include: { bases: { include: { base: true } } },
        });

        const totalUsers = await prisma.user.count({ where });
        const totalPages = Math.ceil(totalUsers / limitNum);

        res.json({
            users,
            totalUsers,
            totalPages,
            currentPage: pageNum,
        });
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Admin
router.get('/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { bases: { include: { base: true } } },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { passwordHash, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        logger.error(`Error fetching user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user details
// @access  Admin
router.put(
    '/:id',
    [
        body('email').optional().isEmail(),
        body('role').optional().isIn(['admin', 'base_commander', 'logistics_officer']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, firstName, lastName, role, isActive } = req.body;
        const updateData = {};
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (role) updateData.role = role;
        if (typeof isActive === 'boolean') updateData.isActive = isActive;

        try {
            const oldUser = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
            if (!oldUser) return res.status(404).json({ error: 'User not found' });

            const updatedUser = await prisma.user.update({
                where: { id: parseInt(req.params.id) },
                data: updateData,
            });

            logTransaction(req, {
                action: 'update_user',
                tableName: 'users',
                recordId: updatedUser.id,
                oldData: { email: oldUser.email, role: oldUser.role, isActive: oldUser.isActive },
                newData: { email: updatedUser.email, role: updatedUser.role, isActive: updatedUser.isActive }
            });

            const { passwordHash, ...userWithoutPassword } = updatedUser;
            res.json(userWithoutPassword);
        } catch (error) {
            logger.error(`Error updating user ${req.params.id}:`, error);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// @route   PUT /api/users/:id/assign-base
// @desc    Assign a base to a user
// @access  Admin
router.put('/:id/assign-base', [body('baseId').isInt()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        await prisma.userBase.create({
            data: {
                userId: parseInt(req.params.id),
                baseId: req.body.baseId,
            },
        });
        res.json({ message: 'Base assigned successfully' });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Base already assigned to this user.' });
        }
        logger.error(`Error assigning base to user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/users/:id/unassign-base
// @desc    Unassign a base from a user
// @access  Admin
router.put('/:id/unassign-base', [body('baseId').isInt()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        await prisma.userBase.delete({
            where: {
                userId_baseId: {
                    userId: parseInt(req.params.id),
                    baseId: req.body.baseId,
                },
            },
        });
        res.json({ message: 'Base unassigned successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Assignment not found.' });
        }
        logger.error(`Error unassigning base from user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});


// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Admin
router.delete('/:id', async (req, res) => {
    try {
        const user = await prisma.user.delete({
            where: { id: parseInt(req.params.id) },
        });

        logTransaction(req, {
            action: 'delete_user',
            tableName: 'users',
            recordId: user.id,
            oldData: user
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        logger.error(`Error deleting user ${req.params.id}:`, error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;