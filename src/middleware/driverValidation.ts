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
    const { 
        fullName, 
        email, 
        phone,
        address,
        city,
        state,
        vehicleType, 
        vehicleModel,
        vehiclePlateNumber,
        vehicleColor,
        licenseNumber,
        licenseExpiry, 
        region,
        assignedBranch,
        employmentType,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship
    } = req.body;
    
    const errors: { [key: string]: string[] } = {};

    // Basic Information validation (if provided)
    if (fullName !== undefined) {
        if (!fullName || fullName.trim().length === 0) {
            errors.fullName = ['Full name cannot be empty'];
        } else if (fullName.length > 100) {
            errors.fullName = ['Full name cannot exceed 100 characters'];
        } else if (fullName.length < 3) {
            errors.fullName = ['Full name must be at least 3 characters'];
        }
    }

        // Email validation
    if (!email || email.trim().length === 0) {
        errors.email = ['Email is required'];
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.email = ['Please provide a valid email address'];
    }

    // Phone validation (if provided)
    if (phone !== undefined) {
        if (!phone || phone.trim().length === 0) {
            errors.phone = ['Phone number cannot be empty'];
        } else if (!/^[\+]?[0-9]{8,15}$/.test(phone.replace(/\s/g, ''))) {
            errors.phone = ['Please enter a valid phone number (8-15 digits, optional + prefix)'];
        }
    }

    // Address validation (if provided)
    if (address !== undefined && address.trim().length === 0) {
        errors.address = ['Address cannot be empty'];
    }

    // City validation (if provided)
    if (city !== undefined && city.trim().length === 0) {
        errors.city = ['City cannot be empty'];
    }

    // State validation (if provided)
    if (state !== undefined && state.trim().length === 0) {
        errors.state = ['State cannot be empty'];
    }

    // Vehicle Type validation (if provided)
    if (vehicleType !== undefined) {
        if (!vehicleType || vehicleType.trim().length === 0) {
            errors.vehicleType = ['Vehicle type is required'];
        } else if (!['motorcycle', 'bicycle', 'car', 'van', 'truck'].includes(vehicleType)) {
            errors.vehicleType = ['Invalid vehicle type. Must be one of: motorcycle, bicycle, car, van, truck'];
        }
    }

    // Vehicle Model validation (if provided)
    if (vehicleModel !== undefined && vehicleModel.trim().length === 0) {
        errors.vehicleModel = ['Vehicle model cannot be empty'];
    }

    // Vehicle Plate Number validation (if provided)
    if (vehiclePlateNumber !== undefined) {
        if (!vehiclePlateNumber || vehiclePlateNumber.trim().length === 0) {
            errors.vehiclePlateNumber = ['Vehicle plate number cannot be empty'];
        } else if (vehiclePlateNumber.length < 3) {
            errors.vehiclePlateNumber = ['Vehicle plate number must be at least 3 characters'];
        } else if (vehiclePlateNumber.length > 20) {
            errors.vehiclePlateNumber = ['Vehicle plate number cannot exceed 20 characters'];
        }
    }

    // Vehicle Color validation (if provided)
    if (vehicleColor !== undefined && vehicleColor.trim().length === 0) {
        errors.vehicleColor = ['Vehicle color cannot be empty'];
    }

    // License Number validation (if provided)
    if (licenseNumber !== undefined && licenseNumber.trim().length === 0) {
        errors.licenseNumber = ['License number cannot be empty'];
    }

    // License expiry validation (if provided)
    if (licenseExpiry !== undefined) {
        if (!licenseExpiry) {
            errors.licenseExpiry = ['License expiry date is required'];
        } else {
            const expiryDate = new Date(licenseExpiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (isNaN(expiryDate.getTime())) {
                errors.licenseExpiry = ['Invalid license expiry date format'];
            } else if (expiryDate < today) {
                errors.licenseExpiry = ['License expiry date must be in the future'];
            }
        }
    }

    // Region validation (if provided)
    if (region !== undefined && (!region || region.trim().length === 0)) {
        errors.region = ['Region is required'];
    }

    // Assigned Branch validation (if provided)
    if (assignedBranch !== undefined && assignedBranch.trim().length === 0) {
        errors.assignedBranch = ['Assigned branch cannot be empty'];
    }

    // Employment Type validation (if provided)
    if (employmentType !== undefined) {
        if (!employmentType || employmentType.trim().length === 0) {
            errors.employmentType = ['Employment type is required'];
        } else if (!['full-time', 'part-time', 'contract'].includes(employmentType)) {
            errors.employmentType = ['Invalid employment type. Must be one of: full-time, part-time, contract'];
        }
    }

    // Emergency Contact Name validation (if provided)
    if (emergencyContactName !== undefined && emergencyContactName.trim().length === 0) {
        errors.emergencyContactName = ['Emergency contact name cannot be empty'];
    }

    // Emergency Contact Phone validation (if provided)
    if (emergencyContactPhone !== undefined) {
        if (!emergencyContactPhone || emergencyContactPhone.trim().length === 0) {
            errors.emergencyContactPhone = ['Emergency contact phone number cannot be empty'];
        } else if (!/^[\+]?[0-9]{8,15}$/.test(emergencyContactPhone.replace(/\s/g, ''))) {
            errors.emergencyContactPhone = ['Please enter a valid emergency contact phone number (8-15 digits, optional + prefix)'];
        }
    }

    // Emergency Contact Relationship validation (if provided)
    if (emergencyContactRelationship !== undefined && emergencyContactRelationship.trim().length === 0) {
        errors.emergencyContactRelationship = ['Emergency contact relationship cannot be empty'];
    }

    // If there are errors, return them with details
    if (Object.keys(errors).length > 0) {
        const errorMessages = Object.values(errors).flat();
        return next(new AppError(
            `Validation failed: ${errorMessages.join(', ')}`, 
            400, 
            'VALIDATION_ERROR',
        ));
    }

    next();
};


