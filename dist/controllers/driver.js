"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = exports.getDriverStatistics = exports.getActivityLogs = exports.bulkDelete = exports.bulkSuspend = exports.resendPasswordLink = exports.enableDriver = exports.disableDriver = exports.unsuspendDriver = exports.suspendDriver = exports.rejectDriver = exports.verifyDriver = exports.deleteDriver = exports.updateDriver = exports.createDriver = exports.getDriverById = exports.getAllDrivers = void 0;
const Driver_1 = __importDefault(require("../models/Driver"));
const driver_1 = __importDefault(require("../models/activities/driver"));
const error_1 = require("../middleware/error");
const cloudinary_1 = __importDefault(require("../services/cloudinary"));
const driverEmail_1 = require("../utils/driverEmail");
// Helper function to log driver activity
const logDriverActivity = async (driverId, driverName, action, description, metadata, location, ipAddress) => {
    try {
        await driver_1.default.create({
            driverId,
            driverName,
            action,
            description,
            metadata,
            timestamp: new Date(),
            location,
            ipAddress
        });
    }
    catch (error) {
        console.error('Failed to log driver activity:', error);
    }
};
// @desc    Get all drivers with filtering and pagination
// @route   GET /api/v1/drivers
// @access  Private/Admin
exports.getAllDrivers = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { search, status, region, vehicleType, employmentType, verificationStatus, page = 1, limit = 10 } = req.query;
    const query = {};
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
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const [drivers, total] = await Promise.all([
        Driver_1.default.find(query)
            .select('-password -passwordSetupToken -passwordSetupExpiry')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Driver_1.default.countDocuments(query)
    ]);
    res.data({
        drivers,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }
    }, 'Drivers retrieved successfully', 200);
});
// @desc    Get single driver by ID
// @route   GET /api/v1/drivers/:id
// @access  Private/Admin
exports.getDriverById = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id)
        .populate('verifiedBy', 'fullName email')
        .select('-password -passwordSetupToken -passwordSetupExpiry')
        .lean();
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    res.data(driver, 'Driver retrieved successfully');
});
// @desc    Create new driver (onboarding)
// @route   POST /api/v1/drivers
// @access  Private/Admin
exports.createDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { fullName, email, phone, address, city, state, vehicleType, vehiclePlateNumber, region, employmentType, dateOfBirth, vehicleModel, vehicleColor, assignedBranch, licenseNumber, licenseExpiry, emergencyContactName, emergencyContactPhone, emergencyContactRelationship } = req.body;
    // Check if email already exists
    const existingDriver = await Driver_1.default.findOne({ email: email.toLowerCase() });
    if (existingDriver) {
        return next(new error_1.AppError('Email already exists', 400, 'DUPLICATE_EMAIL'));
    }
    // Check if plate number already exists
    const existingPlate = await Driver_1.default.findOne({
        vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, '')
    });
    if (existingPlate) {
        return next(new error_1.AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
    }
    // Handle file uploads
    let profilePhotoUrl = '';
    let driversLicenseUrl = '';
    if (req.files) {
        const files = req.files;
        // Upload profile photo
        if (files.profilePhoto && files.profilePhoto[0]) {
            try {
                const result = await cloudinary_1.default.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                profilePhotoUrl = result.url;
            }
            catch (error) {
                return next(new error_1.AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
        // Upload driver's license
        if (files.driversLicense && files.driversLicense[0]) {
            try {
                const result = await cloudinary_1.default.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                driversLicenseUrl = result.url;
            }
            catch (error) {
                return next(new error_1.AppError(`Driver's license upload failed: ${error.message}`, 400));
            }
        }
    }
    // Create driver
    const driver = await Driver_1.default.create({
        fullName,
        email: email.toLowerCase(),
        phone,
        address,
        city,
        state,
        dateOfBirth,
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
    const setupToken = driver.generatePasswordSetupToken();
    await driver.save();
    // Send password setup email
    try {
        const setupUrl = `${process.env.DRIVER_APP_URL}/setup-password?token=${setupToken}`;
        await (0, driverEmail_1.sendEmail)({
            to: driver.email,
            subject: 'Set up your GoKart Driver account',
            html: driverEmail_1.driverEmailTemplates.passwordSetup(driver.fullName, setupUrl)
        });
    }
    catch (error) {
        console.error('Failed to send password setup email:', error);
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Registration', 'Driver account created', {
        vehicleType: driver.vehicleType,
        region: driver.region,
        employmentType: driver.employmentType
    }, undefined, req.ip);
    const responseData = {
        _id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
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
    res.data(responseData, 'Driver registered successfully. Password setup link sent to email.', 201);
});
// @desc    Update driver
// @route   PUT /api/v1/drivers/:id
// @access  Private/Admin
exports.updateDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    // Email cannot be updated
    if (req.body.email && req.body.email !== driver.email) {
        return next(new error_1.AppError('Email cannot be changed', 400));
    }
    // Check if new plate number already exists
    if (req.body.vehiclePlateNumber) {
        const plateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');
        if (plateNumber !== driver.vehiclePlateNumber) {
            const existingPlate = await Driver_1.default.findOne({ vehiclePlateNumber: plateNumber });
            if (existingPlate) {
                return next(new error_1.AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
            }
        }
    }
    // Handle file uploads
    if (req.files) {
        const files = req.files;
        // Upload new profile photo
        if (files.profilePhoto && files.profilePhoto[0]) {
            try {
                // Delete old photo if exists
                if (driver.profilePhoto) {
                    await cloudinary_1.default.deleteImage(driver.profilePhoto);
                }
                const result = await cloudinary_1.default.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                req.body.profilePhoto = result.url;
            }
            catch (error) {
                return next(new error_1.AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
        // Upload new driver's license
        if (files.driversLicense && files.driversLicense[0]) {
            try {
                // Delete old license if exists
                if (driver.driversLicense) {
                    await cloudinary_1.default.deleteImage(driver.driversLicense);
                }
                const result = await cloudinary_1.default.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                req.body.driversLicense = result.url;
            }
            catch (error) {
                return next(new error_1.AppError(`Driver's license upload failed: ${error.message}`, 400));
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
    const updatedDriver = await Driver_1.default.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    }).select('-password -passwordSetupToken -passwordSetupExpiry');
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Profile Updated', 'Driver profile information updated', {
        updatedFields: Object.keys(req.body)
    }, undefined, req.ip);
    res.data(updatedDriver, 'Driver updated successfully');
});
// @desc    Delete driver
// @route   DELETE /api/v1/drivers/:id
// @access  Private/Admin
exports.deleteDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    // Delete images from Cloudinary
    if (driver.profilePhoto) {
        try {
            await cloudinary_1.default.deleteImage(driver.profilePhoto);
        }
        catch (error) {
            console.error('Error deleting profile photo:', error);
        }
    }
    if (driver.driversLicense) {
        try {
            await cloudinary_1.default.deleteImage(driver.driversLicense);
        }
        catch (error) {
            console.error('Error deleting driver license:', error);
        }
    }
    await driver.deleteOne();
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Deleted', 'Driver account deleted by admin', undefined, undefined, req.ip);
    res.success('Driver deleted successfully');
});
// Continue in Part 2...
// Continuation of driverController.ts - Part 2
// @desc    Verify driver
// @route   POST /api/v1/drivers/:id/verify
// @access  Private/Admin
exports.verifyDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { notes } = req.body;
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    if (driver.verificationStatus === 'verified') {
        return next(new error_1.AppError('Driver is already verified', 400, 'ALREADY_VERIFIED'));
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
        await (0, driverEmail_1.sendEmail)({
            to: driver.email,
            subject: 'Your driver account has been verified!',
            html: driverEmail_1.driverEmailTemplates.verificationApproved(driver.fullName, loginUrl)
        });
    }
    catch (error) {
        console.error('Failed to send verification email:', error);
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Verified', 'Driver account verified by admin', {
        verifiedBy: req.user?.fullName,
        verificationNotes: notes
    }, undefined, req.ip);
    const responseData = {
        _id: driver._id,
        fullName: driver.fullName,
        status: driver.status,
        verificationStatus: driver.verificationStatus,
        verifiedAt: driver.verifiedAt,
        verificationNotes: driver.verificationNotes
    };
    res.data(responseData, 'Driver verified successfully');
});
// @desc    Reject driver
// @route   POST /api/v1/drivers/:id/reject
// @access  Private/Admin
exports.rejectDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { reason } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Rejection reason is required', 400));
    }
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    driver.verificationStatus = 'rejected';
    driver.status = 'pending';
    driver.rejectedAt = new Date();
    driver.rejectionReason = reason;
    await driver.save();
    // Send rejection email
    try {
        await (0, driverEmail_1.sendEmail)({
            to: driver.email,
            subject: 'Driver account verification update',
            html: driverEmail_1.driverEmailTemplates.verificationRejected(driver.fullName, reason)
        });
    }
    catch (error) {
        console.error('Failed to send rejection email:', error);
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Rejected', 'Driver account verification rejected', {
        rejectedBy: req.user?.fullName,
        reason
    }, undefined, req.ip);
    const responseData = {
        _id: driver._id,
        fullName: driver.fullName,
        verificationStatus: driver.verificationStatus,
        rejectedAt: driver.rejectedAt,
        rejectionReason: driver.rejectionReason
    };
    res.data(responseData, 'Driver application rejected');
});
// @desc    Suspend driver
// @route   POST /api/v1/drivers/:id/suspend
// @access  Private/Admin
exports.suspendDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { reason, duration, notifyDriver = true } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Suspension reason is required', 400));
    }
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
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
            await (0, driverEmail_1.sendEmail)({
                to: driver.email,
                subject: 'Your driver account has been suspended',
                html: driverEmail_1.driverEmailTemplates.accountSuspended(driver.fullName, reason, duration, driver.suspendedUntil)
            });
        }
        catch (error) {
            console.error('Failed to send suspension email:', error);
        }
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Suspended', `Driver account suspended: ${reason}`, {
        suspendedBy: req.user?.fullName,
        reason,
        duration
    }, undefined, req.ip);
    const responseData = {
        _id: driver._id,
        status: driver.status,
        suspendedAt: driver.suspendedAt,
        suspendedUntil: driver.suspendedUntil,
        reason: driver.suspensionReason
    };
    res.data(responseData, 'Driver suspended successfully');
});
// @desc    Unsuspend driver
// @route   POST /api/v1/drivers/:id/unsuspend
// @access  Private/Admin
exports.unsuspendDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    if (driver.status !== 'suspended') {
        return next(new error_1.AppError('Driver is not suspended', 400));
    }
    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.suspendedAt = undefined;
    driver.suspendedUntil = undefined;
    driver.suspensionReason = undefined;
    await driver.save();
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Unsuspended', 'Driver account unsuspended by admin', {
        unsuspendedBy: req.user?.fullName
    }, undefined, req.ip);
    res.data({ driver }, 'Driver unsuspended successfully');
});
// @desc    Disable driver
// @route   POST /api/v1/drivers/:id/disable
// @access  Private/Admin
exports.disableDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { reason, notifyDriver = true } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Disablement reason is required', 400));
    }
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    driver.status = 'disabled';
    driver.isOnline = false;
    driver.disabledAt = new Date();
    driver.disablementReason = reason;
    await driver.save();
    // Send notification email
    if (notifyDriver) {
        try {
            await (0, driverEmail_1.sendEmail)({
                to: driver.email,
                subject: 'Driver account disabled',
                html: driverEmail_1.driverEmailTemplates.accountDisabled(driver.fullName, reason)
            });
        }
        catch (error) {
            console.error('Failed to send disablement email:', error);
        }
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Disabled', `Driver account disabled: ${reason}`, {
        disabledBy: req.user?.fullName,
        reason
    }, undefined, req.ip);
    const responseData = {
        _id: driver._id,
        status: driver.status,
        disabledAt: driver.disabledAt,
        reason: driver.disablementReason
    };
    res.data(responseData, 'Driver disabled successfully');
});
// @desc    Enable driver
// @route   POST /api/v1/drivers/:id/enable
// @access  Private/Admin
exports.enableDriver = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    if (driver.status !== 'disabled') {
        return next(new error_1.AppError('Driver is not disabled', 400));
    }
    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.disabledAt = undefined;
    driver.disablementReason = undefined;
    await driver.save();
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Enabled', 'Driver account enabled by admin', {
        enabledBy: req.user?.fullName
    }, undefined, req.ip);
    res.data({ driver }, 'Driver enabled successfully');
});
// @desc    Resend password setup link
// @route   POST /api/v1/drivers/:id/resend-password-link
// @access  Private/Admin
exports.resendPasswordLink = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    if (driver.hasSetPassword) {
        return next(new error_1.AppError('Driver has already set up their password', 400));
    }
    // Generate new password setup token
    const setupToken = driver.generatePasswordSetupToken();
    await driver.save();
    // Send password setup email
    try {
        const setupUrl = `${process.env.DRIVER_APP_URL}/setup-password?token=${setupToken}`;
        await (0, driverEmail_1.sendEmail)({
            to: driver.email,
            subject: 'New password setup link - GoKart Driver',
            html: driverEmail_1.driverEmailTemplates.passwordSetupResend(driver.fullName, setupUrl)
        });
    }
    catch (error) {
        console.error('Failed to send password setup email:', error);
        return next(new error_1.AppError('Failed to send password setup email', 500));
    }
    // Log activity
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Password Link Resent', 'Password setup link resent by admin', {
        resentBy: req.user?.fullName
    }, undefined, req.ip);
    res.data({ emailSent: true }, 'Password setup link sent successfully');
});
// Continue in Part 3...
// Continuation of driverController.ts - Part 3
// @desc    Bulk suspend drivers
// @route   POST /api/v1/drivers/bulk/suspend
// @access  Private/Admin
exports.bulkSuspend = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new error_1.AppError('Driver IDs array is required', 400));
    }
    if (!reason) {
        return next(new error_1.AppError('Suspension reason is required', 400));
    }
    const now = new Date();
    const result = await Driver_1.default.updateMany({ _id: { $in: ids } }, {
        $set: {
            status: 'suspended',
            isOnline: false,
            suspendedAt: now,
            suspensionReason: reason
        }
    });
    // Log activity for each driver
    const drivers = await Driver_1.default.find({ _id: { $in: ids } }).select('fullName');
    for (const driver of drivers) {
        await logDriverActivity(driver._id.toString(), driver.fullName, 'Bulk Suspend', `Driver suspended in bulk operation: ${reason}`, {
            suspendedBy: req.user?.fullName,
            reason,
            bulkOperation: true
        }, undefined, req.ip);
    }
    res.data({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
    }, `${result.modifiedCount} driver(s) suspended successfully`);
});
// @desc    Bulk delete drivers
// @route   DELETE /api/v1/drivers/bulk/delete
// @access  Private/Admin
exports.bulkDelete = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new error_1.AppError('Driver IDs array is required', 400));
    }
    // Get drivers before deletion to delete their images
    const drivers = await Driver_1.default.find({ _id: { $in: ids } });
    // Delete images from Cloudinary
    for (const driver of drivers) {
        if (driver.profilePhoto) {
            try {
                await cloudinary_1.default.deleteImage(driver.profilePhoto);
            }
            catch (error) {
                console.error('Error deleting profile photo:', error);
            }
        }
        if (driver.driversLicense) {
            try {
                await cloudinary_1.default.deleteImage(driver.driversLicense);
            }
            catch (error) {
                console.error('Error deleting driver license:', error);
            }
        }
        // Log activity
        await logDriverActivity(driver._id.toString(), driver.fullName, 'Bulk Delete', 'Driver account deleted in bulk operation', {
            deletedBy: req.user?.fullName,
            bulkOperation: true
        }, undefined, req.ip);
    }
    const result = await Driver_1.default.deleteMany({ _id: { $in: ids } });
    res.data({
        deletedCount: result.deletedCount
    }, `${result.deletedCount} driver(s) deleted successfully`);
});
// @desc    Get driver activity logs
// @route   GET /api/v1/drivers/:id/activity-logs
// @access  Private/Admin
exports.getActivityLogs = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
        driver_1.default.find({ driverId: req.params.id })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        driver_1.default.countDocuments({ driverId: req.params.id })
    ]);
    res.data({
        logs,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }
    }, 'Activity logs retrieved successfully', 200);
});
// @desc    Get driver statistics
// @route   GET /api/v1/drivers/:id/statistics
// @access  Private/Admin
exports.getDriverStatistics = (0, error_1.asyncHandler)(async (req, res, next) => {
    const driver = await Driver_1.default.findById(req.params.id);
    if (!driver) {
        return next(new error_1.AppError('Driver not found', 404));
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
        completionRate: parseFloat(completionRate),
        cancellationRate: parseFloat(cancellationRate),
        isLicenseExpiringSoon: driver.licenseExpiry
            ? new Date(driver.licenseExpiry).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000
            : false,
        accountAge: Math.floor((Date.now() - driver.joinedDate.getTime()) / (1000 * 60 * 60 * 24)), // days
        lastActiveAgo: driver.lastActive
            ? Math.floor((Date.now() - driver.lastActive.getTime()) / (1000 * 60 * 60 * 24)) // days
            : null
    };
    res.data(statistics, 'Driver statistics retrieved successfully');
});
// @desc    Get drivers dashboard summary
// @route   GET /api/v1/drivers/dashboard/summary
// @access  Private/Admin
exports.getDashboardSummary = (0, error_1.asyncHandler)(async (req, res, next) => {
    const [totalDrivers, activeDrivers, pendingDrivers, suspendedDrivers, onlineDrivers, verifiedDrivers, pendingVerification] = await Promise.all([
        Driver_1.default.countDocuments(),
        Driver_1.default.countDocuments({ status: 'active' }),
        Driver_1.default.countDocuments({ status: 'pending' }),
        Driver_1.default.countDocuments({ status: 'suspended' }),
        Driver_1.default.countDocuments({ isOnline: true }),
        Driver_1.default.countDocuments({ verificationStatus: 'verified' }),
        Driver_1.default.countDocuments({ verificationStatus: 'pending' })
    ]);
    // Get drivers by vehicle type
    const byVehicleType = await Driver_1.default.aggregate([
        {
            $group: {
                _id: '$vehicleType',
                count: { $sum: 1 }
            }
        }
    ]);
    // Get drivers by region
    const byRegion = await Driver_1.default.aggregate([
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
    const topRatedDrivers = await Driver_1.default.find({
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
        }, {}),
        topRegions: byRegion.map(r => ({
            region: r._id,
            count: r.count
        })),
        topRatedDrivers
    };
    res.data(summary, 'Dashboard summary retrieved successfully');
});
//# sourceMappingURL=driver.js.map