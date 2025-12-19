"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonParseErrorHandler = exports.asyncHandler = exports.handle404 = exports.errorHandler = exports.extendResponse = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const responseHelpers = {
    data: function (data, message = 'Success', status = 200) {
        return this.status(status).json({
            success: true,
            type: 'success',
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },
    success: function (message = 'Operation successful', status = 200) {
        return this.status(status).json({
            success: true,
            type: 'success',
            message,
            timestamp: new Date().toISOString()
        });
    },
    error: function (error, message = 'An error occurred', code = 500) {
        const isDev = process.env.NODE_ENV === 'development';
        return this.status(code).json({
            success: false,
            type: 'error',
            message,
            ...(isDev && { error: error.message, stack: error.stack }),
            timestamp: new Date().toISOString()
        });
    },
    errorMessage: function (message = 'Bad request', status = 400) {
        return this.status(status).json({
            success: false,
            type: 'error',
            message,
            timestamp: new Date().toISOString()
        });
    }
};
const extendResponse = (req, res, next) => {
    res.data = responseHelpers.data.bind(res);
    res.success = responseHelpers.success.bind(res);
    res.error = responseHelpers.error.bind(res);
    res.errorMessage = responseHelpers.errorMessage.bind(res);
    next();
};
exports.extendResponse = extendResponse;
const errorHandler = (err, req, res, next) => {
    const appRes = res;
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    if (process.env.NODE_ENV === 'development') {
        appRes.error(err, err.message, err.statusCode);
        return;
    }
    let error = { ...err };
    error.message = err.message;
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new AppError(message, 404);
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        error = new AppError(message, 409);
    }
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => e.message);
        const message = errors.join('. ');
        error = new AppError(message, 400);
    }
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
exports.errorHandler = errorHandler;
const handle404 = (req, res) => {
    res.errorMessage(`Route ${req.originalUrl} not found`, 404);
};
exports.handle404 = handle404;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const jsonParseErrorHandler = (err, req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
        res.errorMessage('Invalid JSON payload', 400);
        return;
    }
    next(err);
};
exports.jsonParseErrorHandler = jsonParseErrorHandler;
exports.default = {
    AppError,
    extendResponse: exports.extendResponse,
    errorHandler: exports.errorHandler,
    handle404: exports.handle404,
    asyncHandler: exports.asyncHandler,
    jsonParseErrorHandler: exports.jsonParseErrorHandler
};
//# sourceMappingURL=error.js.map