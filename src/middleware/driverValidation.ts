import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

// Validate driver creation
export const validateDriverCreate = (req: Request, res: Response, next: NextFunction) => {
    const {
        fullName,
        email,
        phone,
        address,
        city,
        state,
        vehicleType,
        vehiclePlateNumber,
        region,
        employmentType
    } = req.body;

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

    // Phone validation
    if (!phone || phone.trim().length === 0) {
        errors.phone = ['Phone number is required'];
    } else {
        const cleaned = phone.replace(/[\s()-]/g, "");

        if (!/^\+?\d+$/.test(cleaned)) {
            errors.phone = ['Phone number contains invalid characters'];
        }

        if (cleaned.length < 10 || cleaned.length > 15) {
            errors.phone = ['Phone number must be between 10 and 15 digits'];
        }
    }

    // Address validation
    if (!address || address.trim().length === 0) {
        errors.address = ['Address is required'];
    }

    // City validation
    if (!city || city.trim().length === 0) {
        errors.city = ['City is required'];
    }

    // State validation
    if (!state || state.trim().length === 0) {
        errors.state = ['State is required'];
    }

    // Vehicle type validation
    if (!vehicleType || vehicleType.trim().length === 0) {
        errors.vehicleType = ['Vehicle type is required'];
    } else if (!['motorcycle', 'bicycle', 'car', 'van', 'truck'].includes(vehicleType)) {
        errors.vehicleType = ['Invalid vehicle type'];
    }

    // Plate number validation
    if (!vehiclePlateNumber || vehiclePlateNumber.trim().length === 0) {
        errors.vehiclePlateNumber = ['Vehicle plate number is required'];
    }

    // Region validation
    if (!region || region.trim().length === 0) {
        errors.region = ['Region is required'];
    }

    // Employment type validation
    if (!employmentType || employmentType.trim().length === 0) {
        errors.employmentType = ['Employment type is required'];
    } else if (!['full-time', 'part-time', 'contract'].includes(employmentType)) {
        errors.employmentType = ['Invalid employment type'];
    }

    // License expiry validation (if provided)
    if (req.body.licenseExpiry) {
        const expiryDate = new Date(req.body.licenseExpiry);
        if (expiryDate < new Date()) {
            errors.licenseExpiry = ['License expiry date must be in the future'];
        }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};

// Validate driver update
export const validateDriverUpdate = (req: Request, res: Response, next: NextFunction) => {
    const { fullName, email, vehicleType, employmentType, licenseExpiry } = req.body;
    const errors: any = {};

    // Full name validation (if provided)
    if (fullName !== undefined) {
        if (fullName.trim().length === 0) {
            errors.fullName = ['Full name cannot be empty'];
        } else if (fullName.length > 100) {
            errors.fullName = ['Full name cannot exceed 100 characters'];
        }
    }

    // Email cannot be changed
    if (email !== undefined) {
        errors.email = ['Email cannot be changed'];
    }

    // Vehicle type validation (if provided)
    if (vehicleType !== undefined) {
        if (!['motorcycle', 'bicycle', 'car', 'van', 'truck'].includes(vehicleType)) {
            errors.vehicleType = ['Invalid vehicle type'];
        }
    }

    // Employment type validation (if provided)
    if (employmentType !== undefined) {
        if (!['full-time', 'part-time', 'contract'].includes(employmentType)) {
            errors.employmentType = ['Invalid employment type'];
        }
    }

    // License expiry validation (if provided)
    if (licenseExpiry !== undefined) {
        const expiryDate = new Date(licenseExpiry);
        if (expiryDate < new Date()) {
            errors.licenseExpiry = ['License expiry date must be in the future'];
        }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};