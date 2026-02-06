import { Request, Response, NextFunction } from 'express';
import { AppError } from './error';

// Validate notification creation
export const validateNotificationCreate = (req: Request, res: Response, next: NextFunction) => {
    const {
        title,
        message,
        targetAudience,
        scheduleType,
        scheduledAt,
        specificUserIds,
        specificDriverIds
    } = req.body;

    const errors: any = {};

    // Title validation
    if (!title || title.trim().length === 0) {
        errors.title = ['Title is required'];
    } else if (title.length > 65) {
        errors.title = ['Title cannot exceed 65 characters'];
    }

    // Message validation
    if (!message || message.trim().length === 0) {
        errors.message = ['Message is required'];
    } else if (message.length > 240) {
        errors.message = ['Message cannot exceed 240 characters'];
    }

    // Target audience validation
    if (!targetAudience) {
        errors.targetAudience = ['Target audience is required'];
    } else if (!['all', 'customers', 'drivers', 'specific'].includes(targetAudience)) {
        errors.targetAudience = ['Invalid target audience'];
    }

    // Specific users validation
    if (targetAudience === 'specific') {
        let hasSpecificUsers = false;
        
        if (specificUserIds) {
            try {
                const parsed = typeof specificUserIds === 'string' 
                    ? JSON.parse(specificUserIds) 
                    : specificUserIds;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    hasSpecificUsers = true;
                }
            } catch (e) {
                errors.specificUserIds = ['Invalid specificUserIds format'];
            }
        }

        if (specificDriverIds) {
            try {
                const parsed = typeof specificDriverIds === 'string'
                    ? JSON.parse(specificDriverIds)
                    : specificDriverIds;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    hasSpecificUsers = true;
                }
            } catch (e) {
                errors.specificDriverIds = ['Invalid specificDriverIds format'];
            }
        }

        if (!hasSpecificUsers) {
            errors.specificUserIds = ['At least one user or driver must be specified when target audience is "specific"'];
        }
    }

    // Schedule type validation
    if (!scheduleType) {
        errors.scheduleType = ['Schedule type is required'];
    } else if (!['immediate', 'scheduled'].includes(scheduleType)) {
        errors.scheduleType = ['Invalid schedule type'];
    }

    // Scheduled time validation
    if (scheduleType === 'scheduled') {
        if (!scheduledAt) {
            errors.scheduledAt = ['Scheduled time is required when schedule type is "scheduled"'];
        } else {
            const scheduledDate = new Date(scheduledAt);
            if (isNaN(scheduledDate.getTime())) {
                errors.scheduledAt = ['Invalid date format'];
            } else if (scheduledDate <= new Date()) {
                errors.scheduledAt = ['Scheduled time must be in the future'];
            }
        }
    }

    // Image validation (if uploaded)
    if (req.file) {
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (req.file.size > maxSize) {
            errors.image = ['Image must be less than 2MB'];
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            errors.image = ['Only JPG and PNG images are allowed'];
        }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};

// Validate notification update
export const validateNotificationUpdate = (req: Request, res: Response, next: NextFunction) => {
    const { title, message, scheduleType, scheduledAt } = req.body;
    const errors: any = {};

    // Title validation (if provided)
    if (title !== undefined) {
        if (title.trim().length === 0) {
            errors.title = ['Title cannot be empty'];
        } else if (title.length > 65) {
            errors.title = ['Title cannot exceed 65 characters'];
        }
    }

    // Message validation (if provided)
    if (message !== undefined) {
        if (message.trim().length === 0) {
            errors.message = ['Message cannot be empty'];
        } else if (message.length > 240) {
            errors.message = ['Message cannot exceed 240 characters'];
        }
    }

    // Schedule type validation (if provided)
    if (scheduleType !== undefined) {
        if (!['immediate', 'scheduled'].includes(scheduleType)) {
            errors.scheduleType = ['Invalid schedule type'];
        }
    }

    // Scheduled time validation (if provided)
    if (scheduledAt !== undefined) {
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            errors.scheduledAt = ['Invalid date format'];
        } else if (scheduledDate <= new Date()) {
            errors.scheduledAt = ['Scheduled time must be in the future'];
        }
    }

    // Image validation (if uploaded)
    if (req.file) {
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (req.file.size > maxSize) {
            errors.image = ['Image must be less than 2MB'];
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            errors.image = ['Only JPG and PNG images are allowed'];
        }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
    }

    next();
};
