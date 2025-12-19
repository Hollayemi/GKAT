"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const error_1 = require("./error");
exports.protect = (0, error_1.asyncHandler)(async (req, res, next) => {
    console.log(req.body);
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    if (!token) {
        return next(new error_1.AppError('Not authorized to access this route', 401));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await User_1.default.findById(decoded.id);
        if (!user) {
            return next(new error_1.AppError('User no longer exists', 401));
        }
        if (!user.isPhoneVerified) {
            return next(new error_1.AppError('Please verify your phone number', 401));
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new error_1.AppError('Token expired. Please login again', 401));
        }
        return next(new error_1.AppError('Not authorized to access this route', 401));
    }
});
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new error_1.AppError('Not authorized to access this route', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new error_1.AppError(`User role '${req.user.role}' is not authorized to access this route`, 403));
        }
        next();
    };
};
exports.authorize = authorize;
exports.optionalAuth = (0, error_1.asyncHandler)(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = await User_1.default.findById(decoded.id);
            if (user && user.isPhoneVerified) {
                req.user = user;
            }
        }
        catch (error) {
        }
    }
    next();
});
//# sourceMappingURL=auth.js.map