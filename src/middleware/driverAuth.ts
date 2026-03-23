import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Driver from '../models/Driver';
import { AppError, asyncHandler } from './error';

// Protect driver app routes - only verified drivers may access
export const protectDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return next(new AppError('Not authorised to access this route', 401, 'UNAUTHORIZED'));
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
        return next(new AppError('Invalid or expired token. Please log in again.', 401, 'UNAUTHORIZED'));
    }

    const user = await User.findById(decoded.id);

    if (!user) {
        return next(new AppError('Account no longer exists', 401));
    }

    if (user.role !== 'driver') {
        return next(new AppError('Access restricted to driver accounts only', 403, 'FORBIDDEN'));
    }

    if (!user.isPhoneVerified) {
        return next(new AppError('Please verify your phone number to continue', 401));
    }

    // Check driver profile status
    const driver = await Driver.findOne({ userId: user._id });
    if (!driver) {
        return next(new AppError('Driver profile not found', 404));
    }

    if (driver.status === 'suspended') {
        return next(new AppError('Your account has been suspended. Please contact support.', 403));
    }

    if (driver.status === 'disabled') {
        return next(new AppError('Your account has been disabled. Please contact support.', 403));
    }

    req.user = user;
    next();
});
