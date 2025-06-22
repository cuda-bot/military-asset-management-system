import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

export const logTransaction = async (req, { action, tableName, recordId, oldData, newData }) => {
    try {
        const userId = req.user ? req.user.id : null;
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                tableName,
                recordId,
                oldValues: oldData ? JSON.stringify(oldData) : undefined,
                newValues: newData ? JSON.stringify(newData) : undefined,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            },
        });
    } catch (error) {
        logger.error('Failed to log transaction:', error);
    }
};

export const verifyToken = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.user.id },
            include: { base: true },
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;

        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export const hasRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
};

export const hasBaseAccess = async (req, res, next) => {
    const { baseId } = req.params.baseId ? req.params : req.body;

    if (!baseId) {
        // If no baseId is specified, proceed if user is admin, otherwise deny
        return req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Forbidden: Base access required' });
    }

    if (req.user.role === 'admin' || req.user.bases.includes(parseInt(baseId))) {
        return next();
    }

    return res.status(403).json({ error: 'Forbidden: You do not have access to this base' });
}; 