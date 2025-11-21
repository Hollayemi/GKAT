import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AppError, asyncHandler } from './error';

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

interface JwtPayload {
    id: string;
    role: string;
}

// Protect routes - verify JWT token
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return next(new AppError('Not authorized to access this route', 401));
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

        // Get user from database
        const user = await User.findById(decoded.id);

        if (!user) {
            return next(new AppError('User no longer exists', 401));
        }

        // Check if user verified phone
        if (!user.isPhoneVerified) {
            return next(new AppError('Please verify your phone number', 401));
        }

        req.user = user;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token expired. Please login again', 401));
        }
        return next(new AppError('Not authorized to access this route', 401));
    }
});

// Grant access to specific roles
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AppError('Not authorized to access this route', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new AppError(
                    `User role '${req.user.role}' is not authorized to access this route`,
                    403
                )
            );
        }

        next();
    };
};

// Optional authentication - IfAuth
export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            const user = await User.findById(decoded.id);

            if (user && user.isPhoneVerified) {
                req.user = user;
            }
        } catch (error) {
            // Token invalid, continue without user
        }
    }

    next();
});