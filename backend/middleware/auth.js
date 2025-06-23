import jwt from 'jsonwebtoken';
import { connectToMongo } from '../config/mongodb.js';
import logger from '../utils/logger.js';
import { ObjectId } from 'mongodb';

export const logTransaction = async (req, { action, tableName, recordId, oldData, newData }) => {
    try {
        const db = await connectToMongo();
        const userId = req.user ? new ObjectId(req.user.id) : null;
        await db.collection('audit_logs').insertOne({
            userId,
            action,
            tableName,
            recordId: recordId ? recordId.toString() : null,
            oldValues: oldData ? JSON.stringify(oldData) : null,
            newValues: newData ? JSON.stringify(newData) : null,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            createdAt: new Date(),
        });
    } catch (error) {
        logger.error('Failed to log transaction:', error);
    }
};

export const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // Trust the JWT payload
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

export const hasBaseAccess = (req, res, next) => {
    const { baseId } = req.params.baseId ? req.params : req.body;

    if (!baseId) {
        return req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Forbidden: Base ID is required' });
    }

    if (req.user.role === 'admin' || (req.user.base_ids && req.user.base_ids.includes(baseId))) {
        return next();
    }

    return res.status(403).json({ error: 'Forbidden: You do not have access to this base' });
}; 