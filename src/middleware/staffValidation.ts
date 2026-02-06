import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

// Validate staff creation
export const validateStaffCreate = (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email, phone, role } = req.body;
    const errors: any = {};

    // Full name validation
    if (!fullName || fullName.trim().length === 0) {
        errors.fullName = ['Full name is required'];
    } else if (fullName.length > 100) {
        errors.fullName = ['Full name cannot exceed 100 characters'];
    }

    // Email validation
    if (!email || email.trim().length === 0) {
        errors.email = ['Email is required'];
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.email = ['Please provide a valid email address'];
    }

    // Role validation
    if (!role || role.trim().length === 0) {
        errors.role = ['Role is required'];
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};

export const validateStaffLogin = (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    const errors: any = {};

    // Email validation
    if (!email || email.trim().length === 0) {
        errors.email = ['Email is required'];
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.email = ['Please provide a valid email address'];
    }

    // Password validation
    if (!password || password.length === 0) {
        errors.password = ['Password is required'];
    } else if (password.length < 6) {
        errors.password = ['Password must be at least 6 characters'];
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};

// Validate staff update
export const validateStaffUpdate = (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email } = req.body;
    const errors: any = {};

    // Full name validation (if provided)
    if (fullName !== undefined) {
        if (fullName.trim().length === 0) {
            errors.fullName = ['Full name cannot be empty'];
        } else if (fullName.length > 100) {
            errors.fullName = ['Full name cannot exceed 100 characters'];
        }
    }

    // Email validation (if provided)
    if (email !== undefined) {
        if (email.trim().length === 0) {
            errors.email = ['Email cannot be empty'];
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.email = ['Please provide a valid email address'];
        }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};

// Validate role assignment
export const validateRoleAssignment = (req: Request, res: Response, next: NextFunction) => {
    const { roleId } = req.body;

    if (!roleId || roleId.trim().length === 0) {
        return next(new AppError('Role ID is required', 400, 'VALIDATION_ERROR'));
    }

    next();
};