import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

interface JwtPayload {
    id: string;
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token: string | undefined;

        // Check for token in header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Check for token in cookies
        else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
            return;
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

            // Get user from database
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            req.user = user;
            next();
        } catch (error) {
            res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
            return;
        }
    } catch (error) {
        next(error);
    }
};

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
            return;
        }

        next();
    };
};