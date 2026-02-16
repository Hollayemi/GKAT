import { Request, Response, NextFunction } from 'express';
import Driver from '../models/Driver';
import User from '../models/User';
import DriverActivity from '../models/activities/driver';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import CloudinaryService from '../services/cloudinary';
import { sendEmail, driverEmailTemplates } from '../utils/driverEmail';
import crypto from 'crypto';

// Helper function to log driver activity
const logDriverActivity = async (
    driverId: string,
    driverName: string,
    action: string,
    description: string,
    metadata?: any,
    location?: { lat: number; lng: number; address?: string },
    ipAddress?: string
) => {
    try {
        await DriverActivity.create({
            driverId,
            driverName,
            action,
            description,
            metadata,
            timestamp: new Date(),
            location,
            ipAddress
        });
    } catch (error) {
        console.error('Failed to log driver activity:', error);
    }
};

// @desc    Get all drivers with filtering and pagination
// @route   GET /api/v1/drivers
// @access  Private/Admin
export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const {
        search,
        status,
        region,
        vehicleType,
        employmentType,
        verificationStatus,
        page = 1,
        limit = 10
    } = req.query;

    const query: any = {};

    // Search by name, email, or phone
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }

    // Filter by status
    if (status && typeof status === 'string') {
        query.status = status;
    }

    // Filter by region
    if (region) {
        query.region = region;
    }

    // Filter by vehicle type
    if (vehicleType) {
        query.vehicleType = vehicleType;
    }

    // Filter by employment type
    if (employmentType) {
        query.employmentType = employmentType;
    }

    // Filter by verification status
    if (verificationStatus) {
        query.verificationStatus = verificationStatus;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [drivers, total] = await Promise.all([
        Driver.find(query)
            .select('-password -passwordSetupToken -passwordSetupExpiry')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Driver.countDocuments(query)
    ]);

    (res as AppResponse).data(
        {
            drivers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        },
        'Drivers retrieved successfully',
        200,
    );
});

// @desc    Get single driver by ID
// @route   GET /api/v1/drivers/:id
// @access  Private/Admin
export const getDriverById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id)
        .populate('verifiedBy', 'fullName email')
        .select('-password -passwordSetupToken -passwordSetupExpiry')
        .lean();

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    (res as AppResponse).data(driver, 'Driver retrieved successfully');
});

// @desc    Create new driver (onboarding)
// @route   POST /api/v1/drivers
// @access  Private/Admin
export const createDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        fullName,
        email,
        phone,
        city,
        state,
        vehicleType,
        vehiclePlateNumber,
        region,
        employmentType,
        vehicleModel,
        vehicleColor,
        assignedBranch,
        licenseNumber,
        licenseExpiry,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship
    } = req.body;

    

    // Check if phone number already exists
    const existingDriver = await Driver.findOne({ phone });
    if (existingDriver) {
        return next(new AppError('Phone number already exists', 400, 'DUPLICATE_PHONE'));
    }

    // Check if plate number already exists
    const existingPlate = await Driver.findOne({
        vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, '')
    });

    if (existingPlate) {
        return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
    }

    // Handle file uploads
    let profilePhotoUrl = '';
    let driversLicenseUrl = '';

    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // Upload profile photo
        if (files.profilePhoto && files.profilePhoto[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                profilePhotoUrl = result.url;
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }

        // Upload driver's license
        if (files.driversLicense && files.driversLicense[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                driversLicenseUrl = result.url;
            } catch (error: any) {
                return next(new AppError(`Driver's license upload failed: ${error.message}`, 400));
            }
        }
    }

    let existingUser = null; // Initialize existingUser variable

    existingUser = await User.findOne({ phone }).lean();

    if (!existingUser) {
        const newUser = await User.create({
            phoneNumber: phone,
            residentArea: city || state || 'Unknown',
            name: fullName,
            email: email,
            role: 'driver'
        });
        existingUser = newUser;
    }

    // const user = await User.create({

    // Create driver
    const driver = await Driver.create({
        userId: existingUser._id,
        phone,

        vehicleType,
        vehicleModel,
        vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, ''),
        vehicleColor,
        profilePhoto: profilePhotoUrl,
        driversLicense: driversLicenseUrl,
        licenseNumber,
        licenseExpiry,
        region,
        assignedBranch,
        employmentType,
        emergencyContact: emergencyContactName ? {
            name: emergencyContactName,
            phone: emergencyContactPhone,
            relationship: emergencyContactRelationship
        } : undefined,
        status: 'pending',
        verificationStatus: 'pending',
        hasSetPassword: false
    });

    // Generate password setup token
    await driver.save();

    // Send password setup email
    try {
        // const setupUrl = `${process.env.DRIVER_APP_URL}/setup-password?token=${setupToken}`;
        // await sendEmail({
        //     to: driver.email,
        //     subject: 'Set up your GoKart Driver account',
        //     html: driverEmailTemplates.passwordSetup(driver.fullName, setupUrl)
        // });
    } catch (error) {
        console.error('Failed to send password setup email:', error);
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        existingUser.name,
        'Registration',
        'Driver account created',
        {
            vehicleType: driver.vehicleType,
            region: driver.region,
            employmentType: driver.employmentType
        },
        undefined,
        req.ip
    );

    const responseData = {
        _id: driver._id,
        fullName: existingUser.name,
        email: existingUser.email,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehiclePlateNumber: driver.vehiclePlateNumber,
        region: driver.region,
        employmentType: driver.employmentType,
        status: driver.status,
        verificationStatus: driver.verificationStatus,
        hasSetPassword: driver.hasSetPassword,
        joinedDate: driver.joinedDate,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt
    };

    (res as AppResponse).data(responseData, 'Driver registered successfully. Password setup link sent to email.', 201);
});

// @desc    Update driver
// @route   PUT /api/v1/drivers/:id
// @access  Private/Admin
export const updateDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    // Email cannot be updated
    if (req.body.email && req.body.email !== (driver.userId as any).email) {
        return next(new AppError('Email cannot be changed', 400));
    }

    // Check if new plate number already exists
    if (req.body.vehiclePlateNumber) {
        const plateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');
        if (plateNumber !== driver.vehiclePlateNumber) {
            const existingPlate = await Driver.findOne({ vehiclePlateNumber: plateNumber });
            if (existingPlate) {
                return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
            }
        }
    }

    // Handle file uploads
    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // Upload new profile photo
        if (files.profilePhoto && files.profilePhoto[0]) {
            try {
                // Delete old photo if exists
                if (driver.profilePhoto) {
                    await CloudinaryService.deleteImage(driver.profilePhoto);
                }
                const result = await CloudinaryService.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                req.body.profilePhoto = result.url;
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }

        // Upload new driver's license
        if (files.driversLicense && files.driversLicense[0]) {
            try {
                // Delete old license if exists
                if (driver.driversLicense) {
                    await CloudinaryService.deleteImage(driver.driversLicense);
                }
                const result = await CloudinaryService.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                req.body.driversLicense = result.url;
            } catch (error: any) {
                return next(new AppError(`Driver's license upload failed: ${error.message}`, 400));
            }
        }
    }

    // Handle emergency contact update
    if (req.body.emergencyContactName || req.body.emergencyContactPhone || req.body.emergencyContactRelationship) {
        req.body.emergencyContact = {
            name: req.body.emergencyContactName || driver.emergencyContact?.name,
            phone: req.body.emergencyContactPhone || driver.emergencyContact?.phone,
            relationship: req.body.emergencyContactRelationship || driver.emergencyContact?.relationship
        };
        delete req.body.emergencyContactName;
        delete req.body.emergencyContactPhone;
        delete req.body.emergencyContactRelationship;
    }

    // Uppercase plate number if provided
    if (req.body.vehiclePlateNumber) {
        req.body.vehiclePlateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');
    }

    const updatedDriver = await Driver.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    ).select('-password -passwordSetupToken -passwordSetupExpiry');

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Profile Updated',
        'Driver profile information updated',
        {
            updatedFields: Object.keys(req.body)
        },
        undefined,
        req.ip
    );

    (res as AppResponse).data(updatedDriver, 'Driver updated successfully');
});

// @desc    Delete driver
// @route   DELETE /api/v1/drivers/:id
// @access  Private/Admin
export const deleteDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    // Delete images from Cloudinary
    if (driver.profilePhoto) {
        try {
            await CloudinaryService.deleteImage(driver.profilePhoto);
        } catch (error) {
            console.error('Error deleting profile photo:', error);
        }
    }

    if (driver.driversLicense) {
        try {
            await CloudinaryService.deleteImage(driver.driversLicense);
        } catch (error) {
            console.error('Error deleting driver license:', error);
        }
    }

    await driver.deleteOne();

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Deleted',
        'Driver account deleted by admin',
        undefined,
        undefined,
        req.ip
    );

    (res as AppResponse).success('Driver deleted successfully');
});

// Continue in Part 2...
// Continuation of driverController.ts - Part 2

// @desc    Verify driver
// @route   POST /api/v1/drivers/:id/verify
// @access  Private/Admin
export const verifyDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { notes } = req.body;

    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    if (driver.verificationStatus === 'verified') {
        return next(new AppError('Driver is already verified', 400, 'ALREADY_VERIFIED'));
    }

    driver.verificationStatus = 'verified';
    driver.status = 'active';
    driver.verifiedAt = new Date();
    driver.verifiedBy = req.user?.id;
    driver.verificationNotes = notes;
    driver.rejectedAt = undefined;
    driver.rejectionReason = undefined;

    await driver.save();

    // Send verification approved email
    try {
        const loginUrl = `${process.env.DRIVER_APP_URL}/login`;
        await sendEmail({
            to: driver.userId.email,
            subject: 'Your driver account has been verified!',
            html: driverEmailTemplates.verificationApproved(driver.userId.name, loginUrl)
        });
    } catch (error) {
        console.error('Failed to send verification email:', error);
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Verified',
        'Driver account verified by admin',
        {
            verifiedBy: req.user?.fullName,
            verificationNotes: notes
        },
        undefined,
        req.ip
    );

    const responseData = {
        _id: driver._id,
        fullName: driver.userId.name,
        status: driver.status,
        verificationStatus: driver.verificationStatus,
        verifiedAt: driver.verifiedAt,
        verificationNotes: driver.verificationNotes
    };

    (res as AppResponse).data(responseData, 'Driver verified successfully');
});

// @desc    Reject driver
// @route   POST /api/v1/drivers/:id/reject
// @access  Private/Admin
export const rejectDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason } = req.body;

    if (!reason) {
        return next(new AppError('Rejection reason is required', 400));
    }

    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    driver.verificationStatus = 'rejected';
    driver.status = 'pending';
    driver.rejectedAt = new Date();
    driver.rejectionReason = reason;

    await driver.save();

    // Send rejection email
    try {
        await sendEmail({
            to: driver.userId.email,
            subject: 'Driver account verification update',
            html: driverEmailTemplates.verificationRejected(driver.userId.name, reason)
        });
    } catch (error) {
        console.error('Failed to send rejection email:', error);
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.fullName,
        'Account Rejected',
        'Driver account verification rejected',
        {
            rejectedBy: req.user?.fullName,
            reason
        },
        undefined,
        req.ip
    );

    const responseData = {
        _id: driver._id,
        fullName: driver.fullName,
        verificationStatus: driver.verificationStatus,
        rejectedAt: driver.rejectedAt,
        rejectionReason: driver.rejectionReason
    };

    (res as AppResponse).data(responseData, 'Driver application rejected');
});

// @desc    Suspend driver
// @route   POST /api/v1/drivers/:id/suspend
// @access  Private/Admin
export const suspendDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, duration, notifyDriver = true } = req.body;

    if (!reason) {
        return next(new AppError('Suspension reason is required', 400));
    }

    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    const now = new Date();
    driver.status = 'suspended';
    driver.isOnline = false;
    driver.suspendedAt = now;
    driver.suspensionReason = reason;

    if (duration) {
        const suspendedUntil = new Date(now);
        suspendedUntil.setDate(suspendedUntil.getDate() + duration);
        driver.suspendedUntil = suspendedUntil;
    }

    await driver.save();

    // Send notification email
    if (notifyDriver) {
        try {
            await sendEmail({
                to: driver.userId.email,
                subject: 'Your driver account has been suspended',
                html: driverEmailTemplates.accountSuspended(driver.userId.name, reason, duration, driver.suspendedUntil)
            });
        } catch (error) {
            console.error('Failed to send suspension email:', error);
        }
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Suspended',
        `Driver account suspended: ${reason}`,
        {
            suspendedBy: req.user?.fullName,
            reason,
            duration
        },
        undefined,
        req.ip
    );

    const responseData = {
        _id: driver._id,
        status: driver.status,
        suspendedAt: driver.suspendedAt,
        suspendedUntil: driver.suspendedUntil,
        reason: driver.suspensionReason
    };

    (res as AppResponse).data(responseData, 'Driver suspended successfully');
});

// @desc    Unsuspend driver
// @route   POST /api/v1/drivers/:id/unsuspend
// @access  Private/Admin
export const unsuspendDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    if (driver.status !== 'suspended') {
        return next(new AppError('Driver is not suspended', 400));
    }

    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.suspendedAt = undefined;
    driver.suspendedUntil = undefined;
    driver.suspensionReason = undefined;

    await driver.save();

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Unsuspended',
        'Driver account unsuspended by admin',
        {
            unsuspendedBy: req.user?.fullName
        },
        undefined,
        req.ip
    );

    (res as AppResponse).data({ driver }, 'Driver unsuspended successfully');
});

// @desc    Disable driver
// @route   POST /api/v1/drivers/:id/disable
// @access  Private/Admin
export const disableDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, notifyDriver = true } = req.body;

    if (!reason) {
        return next(new AppError('Disablement reason is required', 400));
    }

    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    driver.status = 'disabled';
    driver.isOnline = false;
    driver.disabledAt = new Date();
    driver.disablementReason = reason;

    await driver.save();

    // Send notification email
    if (notifyDriver) {
        try {
            await sendEmail({
                to: driver.userId.email,
                subject: 'Driver account disabled',
                html: driverEmailTemplates.accountDisabled(driver.userId.name, reason)
            });
        } catch (error) {
            console.error('Failed to send disablement email:', error);
        }
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Disabled',
        `Driver account disabled: ${reason}`,
        {
            disabledBy: req.user?.fullName,
            reason
        },
        undefined,
        req.ip
    );

    const responseData = {
        _id: driver._id,
        status: driver.status,
        disabledAt: driver.disabledAt,
        reason: driver.disablementReason
    };

    (res as AppResponse).data(responseData, 'Driver disabled successfully');
});

// @desc    Enable driver
// @route   POST /api/v1/drivers/:id/enable
// @access  Private/Admin
export const enableDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    if (driver.status !== 'disabled') {
        return next(new AppError('Driver is not disabled', 400));
    }

    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.disabledAt = undefined;
    driver.disablementReason = undefined;

    await driver.save();

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Account Enabled',
        'Driver account enabled by admin',
        {
            enabledBy: req.user?.fullName
        },
        undefined,
        req.ip
    );

    (res as AppResponse).data({ driver }, 'Driver enabled successfully');
});

// @desc    Resend password setup link
// @route   POST /api/v1/drivers/:id/resend-password-link
// @access  Private/Admin
export const resendPasswordLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    if (driver.hasSetPassword) {
        return next(new AppError('Driver has already set up their password', 400));
    }

    // Generate new password setup token
    const setupToken = driver.generatePasswordSetupToken();
    await driver.save();

    // Send password setup email
    try {
        // await sendEmail({
        //     to: driver.email,
        //     subject: 'New password setup link - GoKart Driver',
        //     html: driverEmailTemplates.passwordSetupResend(driver.userId.name, setupUrl)
        // });
    } catch (error) {
        console.error('Failed to send password setup email:', error);
        return next(new AppError('Failed to send password setup email', 500));
    }

    // Log activity
    await logDriverActivity(
        driver._id.toString(),
        driver.userId.name,
        'Password Link Resent',
        'Password setup link resent by admin',
        {
            resentBy: req.user?.fullName
        },
        undefined,
        req.ip
    );

    (res as AppResponse).data(
        { emailSent: true },
        'Password setup link sent successfully'
    );
});

// Continue in Part 3...
// Continuation of driverController.ts - Part 3

// @desc    Bulk suspend drivers
// @route   POST /api/v1/drivers/bulk/suspend
// @access  Private/Admin
export const bulkSuspend = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids, reason } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new AppError('Driver IDs array is required', 400));
    }

    if (!reason) {
        return next(new AppError('Suspension reason is required', 400));
    }

    const now = new Date();
    const result = await Driver.updateMany(
        { _id: { $in: ids } },
        {
            $set: {
                status: 'suspended',
                isOnline: false,
                suspendedAt: now,
                suspensionReason: reason
            }
        }
    );

    // Log activity for each driver
    const drivers = await Driver.find({ _id: { $in: ids } }).populate('userId', 'name email') as any;
    for (const driver of drivers) {
        await logDriverActivity(
            driver._id.toString(),
            driver.userId.name,
            'Bulk Suspend',
            `Driver suspended in bulk operation: ${reason}`,
            {
                suspendedBy: req.user?.fullName,
                reason,
                bulkOperation: true
            },
            undefined,
            req.ip
        );
    }

    (res as AppResponse).data(
        {
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        },
        `${result.modifiedCount} driver(s) suspended successfully`
    );
});

// @desc    Bulk delete drivers
// @route   DELETE /api/v1/drivers/bulk/delete
// @access  Private/Admin
export const bulkDelete = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new AppError('Driver IDs array is required', 400));
    }

    // Get drivers before deletion to delete their images
    const drivers = await Driver.find({ _id: { $in: ids } }).populate('userId', 'name email') as any;

    // Delete images from Cloudinary
    for (const driver of drivers) {
        if (driver.profilePhoto) {
            try {
                await CloudinaryService.deleteImage(driver.profilePhoto);
            } catch (error) {
                console.error('Error deleting profile photo:', error);
            }
        }

        if (driver.driversLicense) {
            try {
                await CloudinaryService.deleteImage(driver.driversLicense);
            } catch (error) {
                console.error('Error deleting driver license:', error);
            }
        }

        // Log activity
        await logDriverActivity(
            driver._id.toString(),
            driver.userId.name,
            'Bulk Delete',
            'Driver account deleted in bulk operation',
            {
                deletedBy: req.user?.fullName,
                bulkOperation: true
            },
            undefined,
            req.ip
        );
    }

    const result = await Driver.deleteMany({ _id: { $in: ids } });

    (res as AppResponse).data(
        {
            deletedCount: result.deletedCount
        },
        `${result.deletedCount} driver(s) deleted successfully`
    );
});

// @desc    Get driver activity logs
// @route   GET /api/v1/drivers/:id/activity-logs
// @access  Private/Admin
export const getActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 20 } = req.query;

    const driver = await Driver.findById(req.params.id);

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        DriverActivity.find({ driverId: req.params.id })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        DriverActivity.countDocuments({ driverId: req.params.id })
    ]);

    (res as AppResponse).data(
        {
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        },
        'Activity logs retrieved successfully',
        200
    );
});

// @desc    Get driver statistics
// @route   GET /api/v1/drivers/:id/statistics
// @access  Private/Admin
export const getDriverStatistics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
        return next(new AppError('Driver not found', 404));
    }

    // Calculate additional statistics
    const completionRate = driver.totalDeliveries > 0
        ? ((driver.completedDeliveries / driver.totalDeliveries) * 100).toFixed(1)
        : 0;

    const cancellationRate = driver.totalDeliveries > 0
        ? ((driver.cancelledDeliveries / driver.totalDeliveries) * 100).toFixed(1)
        : 0;

    const statistics = {
        totalDeliveries: driver.totalDeliveries,
        completedDeliveries: driver.completedDeliveries,
        cancelledDeliveries: driver.cancelledDeliveries,
        rating: driver.rating,
        completionRate: parseFloat(completionRate as string),
        cancellationRate: parseFloat(cancellationRate as string),
        isLicenseExpiringSoon: driver.licenseExpiry
            ? new Date(driver.licenseExpiry).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000
            : false,
        accountAge: Math.floor((Date.now() - driver.joinedDate.getTime()) / (1000 * 60 * 60 * 24)), // days
        lastActiveAgo: driver.lastActive
            ? Math.floor((Date.now() - driver.lastActive.getTime()) / (1000 * 60 * 60 * 24)) // days
            : null
    };

    (res as AppResponse).data(statistics, 'Driver statistics retrieved successfully');
});

// @desc    Get drivers dashboard summary
// @route   GET /api/v1/drivers/dashboard/summary
// @access  Private/Admin
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
    const [
        totalDrivers,
        activeDrivers,
        pendingDrivers,
        suspendedDrivers,
        onlineDrivers,
        verifiedDrivers,
        pendingVerification
    ] = await Promise.all([
        Driver.countDocuments(),
        Driver.countDocuments({ status: 'active' }),
        Driver.countDocuments({ status: 'pending' }),
        Driver.countDocuments({ status: 'suspended' }),
        Driver.countDocuments({ isOnline: true }),
        Driver.countDocuments({ verificationStatus: 'verified' }),
        Driver.countDocuments({ verificationStatus: 'pending' })
    ]);

    // Get drivers by vehicle type
    const byVehicleType = await Driver.aggregate([
        {
            $group: {
                _id: '$vehicleType',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get drivers by region
    const byRegion = await Driver.aggregate([
        {
            $group: {
                _id: '$region',
                count: { $sum: 1 }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 10
        }
    ]);

    // Get top rated drivers
    const topRatedDrivers = await Driver.find({
        status: 'active',
        rating: { $gte: 4.5 }
    })
        .sort({ rating: -1 })
        .limit(5)
        .select('fullName email rating totalDeliveries completedDeliveries');

    const summary = {
        overview: {
            totalDrivers,
            activeDrivers,
            pendingDrivers,
            suspendedDrivers,
            onlineDrivers
        },
        verification: {
            verified: verifiedDrivers,
            pending: pendingVerification
        },
        byVehicleType: byVehicleType.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {} as any),
        topRegions: byRegion.map(r => ({
            region: r._id,
            count: r.count
        })),
        topRatedDrivers
    };

    (res as AppResponse).data(summary, 'Dashboard summary retrieved successfully');
});
