import { Request, Response, NextFunction } from 'express';

// Custom error class
export class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Response interface
export interface AppResponse extends Response {
    data: (data: any, message?: string, status?: number) => Response;
    success: (message?: string, status?: number) => Response;
    error: (error: any, message?: string, code?: number) => Response;
    errorMessage: (message: string, status?: number) => Response;
}

// Custom response methods
const responseHelpers = {
    data: function (this: Response, data: any, message: string = 'Success', status: number = 200): Response {
        return this.status(status).json({
            success: true,
            type: 'success',
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },

    success: function (this: Response, message: string = 'Operation successful', status: number = 200): Response {
        return this.status(status).json({
            success: true,
            type: 'success',
            message,
            timestamp: new Date().toISOString()
        });
    },

    error: function (this: Response, error: any, message: string = 'An error occurred', code: number = 500): Response {
        const isDev = process.env.NODE_ENV === 'development';

        return this.status(code).json({
            success: false,
            type: 'error',
            message,
            ...(isDev && { error: error.message, stack: error.stack }),
            timestamp: new Date().toISOString()
        });
    },

    errorMessage: function (this: Response, message: string = 'Bad request', status: number = 400): Response {
        return this.status(status).json({
            success: false,
            type: 'error',
            message,
            timestamp: new Date().toISOString()
        });
    }
};

// Middleware to extend response object
export const extendResponse = (req: Request, res: Response, next: NextFunction): void => {
    (res as AppResponse).data = responseHelpers.data.bind(res);
    (res as AppResponse).success = responseHelpers.success.bind(res);
    (res as AppResponse).error = responseHelpers.error.bind(res);
    (res as AppResponse).errorMessage = responseHelpers.errorMessage.bind(res);
    next();
};

// Main error handler
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    const appRes = res as AppResponse;

    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Development vs Production
    if (process.env.NODE_ENV === 'development') {
        appRes.error(err, err.message, err.statusCode);
        return;
    }

    // Production - handle specific errors
    let error = { ...err };
    error.message = err.message;

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        error = new AppError(message, 409);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e: any) => e.message);
        const message = errors.join('. ');
        error = new AppError(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token. Please login again';
        error = new AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired. Please login again';
        error = new AppError(message, 401);
    }

    appRes.errorMessage(error.message || 'Something went wrong', error.statusCode || 500);
};

// 404 handler
export const handle404 = (req: Request, res: Response): void => {
    (res as AppResponse).errorMessage(`Route ${req.originalUrl} not found`, 404);
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// JSON parsing error handler
export const jsonParseErrorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof SyntaxError && 'body' in err) {
        (res as AppResponse).errorMessage('Invalid JSON payload', 400);
        return;
    }
    next(err);
};

// Export default for easier imports
export default {
    AppError,
    extendResponse,
    errorHandler,
    handle404,
    asyncHandler,
    jsonParseErrorHandler
};