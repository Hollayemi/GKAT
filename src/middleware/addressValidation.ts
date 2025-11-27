import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';

const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
    'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
    'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export const validateAddressCreate = (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const { label, fullname, address, phone, state, email } = req.body;

    if (!label) {
        errors.push('Address label is required');
    }

    if (!fullname || fullname.trim().length === 0) {
        errors.push('Full name is required');
    } else if (fullname.length < 3) {
        errors.push('Full name must be at least 3 characters');
    } else if (fullname.length > 100) {
        errors.push('Full name cannot exceed 100 characters');
    }

    if (!address || address.trim().length === 0) {
        errors.push('Address is required');
    } else if (address.length < 10) {
        errors.push('Address must be at least 10 characters');
    } else if (address.length > 500) {
        errors.push('Address cannot exceed 500 characters');
    }

    if (!phone || phone.trim().length === 0) {
        errors.push('Phone number is required');
    } else if (!/^[0-9+\-\s()]+$/.test(phone)) {
        errors.push('Please provide a valid phone number');
    }

    if (!state || state.trim().length === 0) {
        errors.push('State is required');
    } else if (!NIGERIAN_STATES.includes(state)) {
        errors.push('Please provide a valid Nigerian state');
    }

    if (email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        errors.push('Please provide a valid email address');
    }

    if (errors.length > 0) {
        return next(new AppError(errors.join(', '), 400));
    }

    next();
};

export const validateAddressUpdate = (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const { label, fullname, address, phone, state, email } = req.body;

    if (label !== undefined && !['Home', 'Shop', 'Office', 'Other'].includes(label)) {
        errors.push('Label must be Home, Shop, Office, or Other');
    }

    if (fullname !== undefined) {
        if (fullname.trim().length === 0) {
            errors.push('Full name cannot be empty');
        } else if (fullname.length < 3) {
            errors.push('Full name must be at least 3 characters');
        } else if (fullname.length > 100) {
            errors.push('Full name cannot exceed 100 characters');
        }
    }

    if (address !== undefined) {
        if (address.trim().length === 0) {
            errors.push('Address cannot be empty');
        } else if (address.length < 10) {
            errors.push('Address must be at least 10 characters');
        } else if (address.length > 500) {
            errors.push('Address cannot exceed 500 characters');
        }
    }

    if (phone !== undefined) {
        if (phone.trim().length === 0) {
            errors.push('Phone number cannot be empty');
        } else if (!/^[0-9+\-\s()]+$/.test(phone)) {
            errors.push('Please provide a valid phone number');
        }
    }

    if (state !== undefined) {
        if (state.trim().length === 0) {
            errors.push('State cannot be empty');
        } else if (!NIGERIAN_STATES.includes(state)) {
            errors.push('Please provide a valid Nigerian state');
        }
    }

    if (email !== undefined && email.trim().length > 0) {
        if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
            errors.push('Please provide a valid email address');
        }
    }

    if (errors.length > 0) {
        return next(new AppError(errors.join(', '), 400));
    }

    next();
};

export { NIGERIAN_STATES };