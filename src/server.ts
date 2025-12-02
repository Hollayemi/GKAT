import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import connectDB from './config/database';
import {
    errorHandler,
    handle404,
    jsonParseErrorHandler,
    extendResponse
} from './middleware/error';

dotenv.config();

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

const limiter = rateLimit({
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// app.use('/api/', limiter);

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

app.use(jsonParseErrorHandler);

app.use(extendResponse);

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

app.get('/health', (req, res) => {
    (res as any).data({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        uptime: process.uptime()
    }, 'Server is healthy');
});

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/order';
import addressRoutes from './routes/address';
import paymentRoutes from './routes/payment';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/product', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/order', orderRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/payment', paymentRoutes);

app.use('*', handle404);

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`
    GoKart Server Running
    Environment: ${process.env.NODE_ENV}
    Port: ${PORT}
    Time: ${new Date().toLocaleTimeString()}
  `);
});

process.on('unhandledRejection', (err: Error) => {
    console.log('UNHANDLED REJECTION! Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

process.on('uncaughtException', (err: Error) => {
    console.log('UNCAUGHT EXCEPTION! Shutting down...');
    console.log(err.name, err.message);
    process.exit(1);
});

export default app;