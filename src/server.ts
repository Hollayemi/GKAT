import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import connectDB from './config/database';
import {
    errorHandler,
    handle404,
    jsonPayload,
    extendResponse
} from './middleware/error';
import routes from './routes';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use(limiter);

// CORS
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

// Body parser middleware with error handling
app.use(express.json({
    limit: '10mb',
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.urlencoded({
    extended: true,
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

// JSON payload error handler
app.use(((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        jsonPayload(err, req, res);
        return;
    }
    next();
}) as ErrorRequestHandler);

// Extend response object with custom methods
app.use(extendResponse);

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check route
app.get('/health', (req, res) => {
    (res as any).data({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    }, 'Server is running healthy');
});

// dynamic routes
app.use('/api/v1', routes);
app.use('*', handle404);

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err: Error, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', err);
    console.log(err.stack);
    server.close(() => {
        process.exit(1);
    });
});

export default app;