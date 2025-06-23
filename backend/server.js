import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import logger from './utils/logger.js';
import { connectToMongo } from './config/mongodb.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import purchaseRoutes from './routes/purchases.js';
import transferRoutes from './routes/transfers.js';
import assignmentRoutes from './routes/assignments.js';
import assetRoutes from './routes/assets.js';
import baseRoutes from './routes/bases.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-frontend-domain.com']
        : ['http://localhost:3000'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/bases', baseRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    // Add any Mongo-specific error handling here if needed

    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Server startup
async function startServer() {
    try {
        await connectToMongo();
        logger.info('Successfully connected to MongoDB.');

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 