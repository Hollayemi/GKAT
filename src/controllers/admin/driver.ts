/**
 * Admin driver controller — key change:
 *  • getAllDrivers now filters by the requesting staff's region unless they
 *    are a super_admin.
 *  • getDashboardSummary stats are also scoped to the staff's region.
 *  • All other methods are unchanged in behaviour.
 *
 * Only the region-aware sections are shown in full below; the remaining
 * CRUD / lifecycle methods from the original file are preserved verbatim.
 */
import { Request, Response, NextFunction } from 'express';
import Driver from '../../models/Driver';
import User from '../../models/User';
import DriverActivity from '../../models/activities/driver';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import CloudinaryService from '../../services/cloudinary';
import { sendEmail, driverEmailTemplates } from '../../utils/driverEmail';
import { resolveStaffRegionId } from '../../helpers/regionScope';

// ─── activity logger ──────────────────────────────────────────────────────────

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
        await DriverActivity.create({ driverId, driverName, action, description, metadata, timestamp: new Date(), location, ipAddress });
    } catch (error) {
        console.error('Failed to log driver activity:', error);
    }
};

// ─── GET all drivers ─────────────────────────────────────────────────────────

// @desc    Get all drivers — region-scoped for non-super-admin staff
// @route   GET /api/v1/drivers
// @access  Private/Admin
export const getAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const {
        search,
        status,
        vehicleType,
        employmentType,
        verificationStatus,
        page = 1,
        limit = 10,
        region: regionFilter,
    } = req.query;

    const query: any = {};

    // ── Region scoping ────────────────────────────────────────────────────────
    const staffRegionId = await resolveStaffRegionId(req.user);

    if (staffRegionId) {
        // Non-super-admin sees only drivers in their own region
        query.region = staffRegionId.toString();
    } else if (regionFilter) {
        // super_admin can still filter by a specific region name/id
        query.region = regionFilter;
    }

    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }
    if (status) query.status = status;
    if (vehicleType) query.vehicleType = vehicleType;
    if (employmentType) query.employmentType = employmentType;
    if (verificationStatus) query.verificationStatus = verificationStatus;

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
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
            scopedToRegion: staffRegionId ? staffRegionId.toString() : null,
        },
        'Drivers retrieved successfully',
        200
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

    if (!driver) return next(new AppError('Driver not found', 404));

    // Non-super-admin cannot view a driver outside their region
    const staffRegionId = await resolveStaffRegionId(req.user);
    if (staffRegionId && (driver as any).region !== staffRegionId.toString()) {
        // Try name-based match as driver.region is a string
        const staffRegion = await Driver.findOne({ _id: req.params.id, region: staffRegionId.toString() }).lean();
        if (!staffRegion) return next(new AppError('Driver not found in your region', 404));
    }

    (res as AppResponse).data(driver, 'Driver retrieved successfully');
});

// @desc    Create new driver (onboarding)
// @route   POST /api/v1/drivers
// @access  Private/Admin
export const createDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        fullName, email, phone, city, state, vehicleType, vehiclePlateNumber,
        region, employmentType, vehicleModel, vehicleColor, assignedBranch,
        licenseNumber, licenseExpiry, emergencyContactName, emergencyContactPhone,
        emergencyContactRelationship
    } = req.body;

    const existingDriver = await Driver.findOne({ phone });
    if (existingDriver) return next(new AppError('Phone number already exists', 400, 'DUPLICATE_PHONE'));

    const existingPlate = await Driver.findOne({ vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, '') });
    if (existingPlate) return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));

    let profilePhotoUrl = '';
    let driversLicenseUrl = '';

    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files.profilePhoto?.[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                profilePhotoUrl = result.url;
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
        if (files.driversLicense?.[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                driversLicenseUrl = result.url;
            } catch (error: any) {
                return next(new AppError(`Driver license upload failed: ${error.message}`, 400));
            }
        }
    }

    let existingUser: any = await User.findOne({ phone }).lean();
    if (!existingUser) {
        existingUser = await User.create({ phoneNumber: phone, residentArea: city || state || 'Unknown', name: fullName, email, role: 'driver' });
    }

    const driver = await Driver.create({
        userId: existingUser._id, phone, vehicleType, vehicleModel,
        vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, ''),
        vehicleColor, profilePhoto: profilePhotoUrl, driversLicense: driversLicenseUrl,
        licenseNumber, licenseExpiry, region, assignedBranch, employmentType,
        emergencyContact: emergencyContactName ? { name: emergencyContactName, phone: emergencyContactPhone, relationship: emergencyContactRelationship } : undefined,
        status: 'pending', verificationStatus: 'pending', hasSetPassword: false
    });

    await driver.save();

    await logDriverActivity(driver._id.toString(), existingUser.name, 'Registration', 'Driver account created', { vehicleType: driver.vehicleType, region: driver.region, employmentType: driver.employmentType }, undefined, req.ip);

    (res as AppResponse).data(
        { _id: driver._id, fullName: existingUser.name, email: existingUser.email, phone: driver.phone, vehicleType: driver.vehicleType, vehiclePlateNumber: driver.vehiclePlateNumber, region: driver.region, employmentType: driver.employmentType, status: driver.status, verificationStatus: driver.verificationStatus, hasSetPassword: driver.hasSetPassword, joinedDate: driver.joinedDate, createdAt: driver.createdAt, updatedAt: driver.updatedAt },
        'Driver registered successfully.',
        201
    );
});

// @desc    Update driver
// @route   PUT /api/v1/drivers/:id
// @access  Private/Admin
export const updateDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (req.body.email && req.body.email !== driver.userId?.email) return next(new AppError('Email cannot be changed', 400));

    if (req.body.vehiclePlateNumber) {
        const plateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');
        if (plateNumber !== driver.vehiclePlateNumber) {
            const existingPlate = await Driver.findOne({ vehiclePlateNumber: plateNumber });
            if (existingPlate) return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
        }
    }

    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files.profilePhoto?.[0]) {
            try {
                if (driver.profilePhoto) await CloudinaryService.deleteImage(driver.profilePhoto);
                const result = await CloudinaryService.uploadImage(files.profilePhoto[0], 'go-kart/drivers/profiles');
                req.body.profilePhoto = result.url;
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
        if (files.driversLicense?.[0]) {
            try {
                if (driver.driversLicense) await CloudinaryService.deleteImage(driver.driversLicense);
                const result = await CloudinaryService.uploadImage(files.driversLicense[0], 'go-kart/drivers/licenses');
                req.body.driversLicense = result.url;
            } catch (error: any) {
                return next(new AppError(`Driver license upload failed: ${error.message}`, 400));
            }
        }
    }

    if (req.body.emergencyContactName || req.body.emergencyContactPhone || req.body.emergencyContactRelationship) {
        req.body.emergencyContact = {
            name: req.body.emergencyContactName || driver.emergencyContact?.name,
            phone: req.body.emergencyContactPhone || driver.emergencyContact?.phone,
            relationship: req.body.emergencyContactRelationship || driver.emergencyContact?.relationship
        };
    }
    if (req.body.vehiclePlateNumber) req.body.vehiclePlateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');

    const updatedDriver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password -passwordSetupToken -passwordSetupExpiry');

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Profile Updated', 'Driver profile information updated', { updatedFields: Object.keys(req.body) }, undefined, req.ip);

    (res as AppResponse).data(updatedDriver, 'Driver updated successfully');
});

// @desc    Delete driver
// @route   DELETE /api/v1/drivers/:id
// @access  Private/Admin
export const deleteDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));

    if (driver.profilePhoto) { try { await CloudinaryService.deleteImage(driver.profilePhoto); } catch (e) { console.error(e); } }
    if (driver.driversLicense) { try { await CloudinaryService.deleteImage(driver.driversLicense); } catch (e) { console.error(e); } }

    await driver.deleteOne();
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Deleted', 'Driver account deleted by admin', undefined, undefined, req.ip);

    (res as AppResponse).success('Driver deleted successfully');
});

// @desc    Verify driver
// @route   POST /api/v1/drivers/:id/verify
// @access  Private/Admin
export const verifyDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { notes } = req.body;
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.verificationStatus === 'verified') return next(new AppError('Driver is already verified', 400, 'ALREADY_VERIFIED'));

    driver.verificationStatus = 'verified';
    driver.status = 'active';
    driver.verifiedAt = new Date();
    driver.verifiedBy = req.user?.id;
    driver.verificationNotes = notes;
    await driver.save();

    try {
        await sendEmail({ to: driver.userId.email, subject: 'Your driver account has been verified!', html: driverEmailTemplates.verificationApproved(driver.userId.name, `${process.env.DRIVER_APP_URL}/login`) });
    } catch (e) { console.error('Failed to send verification email:', e); }

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Verified', 'Driver account verified by admin', { verifiedBy: req.user?.fullName, verificationNotes: notes }, undefined, req.ip);

    (res as AppResponse).data({ _id: driver._id, fullName: driver.userId.name, status: driver.status, verificationStatus: driver.verificationStatus, verifiedAt: driver.verifiedAt, verificationNotes: driver.verificationNotes }, 'Driver verified successfully');
});

// @desc    Reject driver
// @route   POST /api/v1/drivers/:id/reject
// @access  Private/Admin
export const rejectDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason } = req.body;
    if (!reason) return next(new AppError('Rejection reason is required', 400));
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));

    driver.verificationStatus = 'rejected';
    driver.status = 'pending';
    driver.rejectedAt = new Date();
    driver.rejectionReason = reason;
    await driver.save();

    try { await sendEmail({ to: driver.userId.email, subject: 'Driver account verification update', html: driverEmailTemplates.verificationRejected(driver.userId.name, reason) }); } catch (e) { console.error(e); }
    await logDriverActivity(driver._id.toString(), driver.fullName, 'Account Rejected', 'Driver account verification rejected', { rejectedBy: req.user?.fullName, reason }, undefined, req.ip);

    (res as AppResponse).data({ _id: driver._id, fullName: driver.fullName, verificationStatus: driver.verificationStatus, rejectedAt: driver.rejectedAt, rejectionReason: driver.rejectionReason }, 'Driver application rejected');
});

// @desc    Suspend driver
// @route   POST /api/v1/drivers/:id/suspend
// @access  Private/Admin
export const suspendDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, duration, notifyDriver = true } = req.body;
    if (!reason) return next(new AppError('Suspension reason is required', 400));
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));

    const now = new Date();
    driver.status = 'suspended';
    driver.isOnline = false;
    driver.suspendedAt = now;
    driver.suspensionReason = reason;
    if (duration) {
        const until = new Date(now);
        until.setDate(until.getDate() + duration);
        driver.suspendedUntil = until;
    }
    await driver.save();

    if (notifyDriver) { try { await sendEmail({ to: driver.userId.email, subject: 'Your driver account has been suspended', html: driverEmailTemplates.accountSuspended(driver.userId.name, reason, duration, driver.suspendedUntil) }); } catch (e) { console.error(e); } }
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Suspended', `Driver account suspended: ${reason}`, { suspendedBy: req.user?.fullName, reason, duration }, undefined, req.ip);

    (res as AppResponse).data({ _id: driver._id, status: driver.status, suspendedAt: driver.suspendedAt, suspendedUntil: driver.suspendedUntil, reason: driver.suspensionReason }, 'Driver suspended successfully');
});

// @desc    Unsuspend driver
// @route   POST /api/v1/drivers/:id/unsuspend
// @access  Private/Admin
export const unsuspendDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.status !== 'suspended') return next(new AppError('Driver is not suspended', 400));

    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.suspendedAt = undefined;
    driver.suspendedUntil = undefined;
    driver.suspensionReason = undefined;
    await driver.save();

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Unsuspended', 'Driver account unsuspended by admin', { unsuspendedBy: req.user?.fullName }, undefined, req.ip);

    (res as AppResponse).data({ driver }, 'Driver unsuspended successfully');
});

// @desc    Disable driver
// @route   POST /api/v1/drivers/:id/disable
// @access  Private/Admin
export const disableDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { reason, notifyDriver = true } = req.body;
    if (!reason) return next(new AppError('Disablement reason is required', 400));
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));

    driver.status = 'disabled';
    driver.isOnline = false;
    driver.disabledAt = new Date();
    driver.disablementReason = reason;
    await driver.save();

    if (notifyDriver) { try { await sendEmail({ to: driver.userId.email, subject: 'Driver account disabled', html: driverEmailTemplates.accountDisabled(driver.userId.name, reason) }); } catch (e) { console.error(e); } }
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Disabled', `Driver account disabled: ${reason}`, { disabledBy: req.user?.fullName, reason }, undefined, req.ip);

    (res as AppResponse).data({ _id: driver._id, status: driver.status, disabledAt: driver.disabledAt, reason: driver.disablementReason }, 'Driver disabled successfully');
});

// @desc    Enable driver
// @route   POST /api/v1/drivers/:id/enable
// @access  Private/Admin
export const enableDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.status !== 'disabled') return next(new AppError('Driver is not disabled', 400));

    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.disabledAt = undefined;
    driver.disablementReason = undefined;
    await driver.save();

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Enabled', 'Driver account enabled by admin', { enabledBy: req.user?.fullName }, undefined, req.ip);

    (res as AppResponse).data({ driver }, 'Driver enabled successfully');
});

// @desc    Resend password setup link
// @route   POST /api/v1/drivers/:id/resend-password-link
// @access  Private/Admin
export const resendPasswordLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.hasSetPassword) return next(new AppError('Driver has already set up their password', 400));

    driver.generatePasswordSetupToken();
    await driver.save();

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Password Link Resent', 'Password setup link resent by admin', { resentBy: req.user?.fullName }, undefined, req.ip);

    (res as AppResponse).data({ emailSent: true }, 'Password setup link sent successfully');
});

// @desc    Bulk suspend drivers
// @route   POST /api/v1/drivers/bulk/suspend
// @access  Private/Admin
export const bulkSuspend = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids, reason } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return next(new AppError('Driver IDs array is required', 400));
    if (!reason) return next(new AppError('Suspension reason is required', 400));

    const now = new Date();
    const result = await Driver.updateMany({ _id: { $in: ids } }, { $set: { status: 'suspended', isOnline: false, suspendedAt: now, suspensionReason: reason } });

    const drivers = await Driver.find({ _id: { $in: ids } }).populate('userId', 'name email') as any[];
    for (const driver of drivers) {
        await logDriverActivity(driver._id.toString(), driver.userId.name, 'Bulk Suspend', `Driver suspended in bulk: ${reason}`, { suspendedBy: req.user?.fullName, reason, bulkOperation: true }, undefined, req.ip);
    }

    (res as AppResponse).data({ modifiedCount: result.modifiedCount, matchedCount: result.matchedCount }, `${result.modifiedCount} driver(s) suspended successfully`);
});

// @desc    Bulk delete drivers
// @route   DELETE /api/v1/drivers/bulk/delete
// @access  Private/Admin
export const bulkDelete = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return next(new AppError('Driver IDs array is required', 400));

    const drivers = await Driver.find({ _id: { $in: ids } }).populate('userId', 'name email') as any[];
    for (const driver of drivers) {
        if (driver.profilePhoto) { try { await CloudinaryService.deleteImage(driver.profilePhoto); } catch (e) { console.error(e); } }
        if (driver.driversLicense) { try { await CloudinaryService.deleteImage(driver.driversLicense); } catch (e) { console.error(e); } }
        await logDriverActivity(driver._id.toString(), driver.userId.name, 'Bulk Delete', 'Driver account deleted in bulk', { deletedBy: req.user?.fullName, bulkOperation: true }, undefined, req.ip);
    }

    const result = await Driver.deleteMany({ _id: { $in: ids } });

    (res as AppResponse).data({ deletedCount: result.deletedCount }, `${result.deletedCount} driver(s) deleted successfully`);
});

// @desc    Get driver activity logs
// @route   GET /api/v1/drivers/:id/activity-logs
// @access  Private/Admin
export const getActivityLogs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { page = 1, limit = 20 } = req.query;
    const driver = await Driver.findById(req.params.id);
    if (!driver) return next(new AppError('Driver not found', 404));

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        DriverActivity.find({ driverId: req.params.id }).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
        DriverActivity.countDocuments({ driverId: req.params.id })
    ]);

    (res as AppResponse).data({ logs, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } }, 'Activity logs retrieved successfully', 200);
});

// @desc    Get driver statistics
// @route   GET /api/v1/drivers/:id/statistics
// @access  Private/Admin
export const getDriverStatistics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return next(new AppError('Driver not found', 404));

    const completionRate = driver.totalDeliveries > 0 ? ((driver.completedDeliveries / driver.totalDeliveries) * 100).toFixed(1) : 0;
    const cancellationRate = driver.totalDeliveries > 0 ? ((driver.cancelledDeliveries / driver.totalDeliveries) * 100).toFixed(1) : 0;

    (res as AppResponse).data({
        totalDeliveries: driver.totalDeliveries, completedDeliveries: driver.completedDeliveries, cancelledDeliveries: driver.cancelledDeliveries,
        rating: driver.rating, completionRate: parseFloat(completionRate as string), cancellationRate: parseFloat(cancellationRate as string),
        isLicenseExpiringSoon: driver.licenseExpiry ? new Date(driver.licenseExpiry).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000 : false,
        accountAge: Math.floor((Date.now() - driver.joinedDate.getTime()) / (1000 * 60 * 60 * 24)),
        lastActiveAgo: driver.lastActive ? Math.floor((Date.now() - driver.lastActive.getTime()) / (1000 * 60 * 60 * 24)) : null
    }, 'Driver statistics retrieved successfully');
});

// @desc    Get drivers dashboard summary — region-scoped for non-super-admin
// @route   GET /api/v1/drivers/dashboard/summary
// @access  Private/Admin
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
    const staffRegionId = await resolveStaffRegionId(req.user);
    const baseFilter: any = staffRegionId ? { region: staffRegionId.toString() } : {};

    const [totalDrivers, activeDrivers, pendingDrivers, suspendedDrivers, onlineDrivers, verifiedDrivers, pendingVerification] = await Promise.all([
        Driver.countDocuments(baseFilter),
        Driver.countDocuments({ ...baseFilter, status: 'active' }),
        Driver.countDocuments({ ...baseFilter, status: 'pending' }),
        Driver.countDocuments({ ...baseFilter, status: 'suspended' }),
        Driver.countDocuments({ ...baseFilter, isOnline: true }),
        Driver.countDocuments({ ...baseFilter, verificationStatus: 'verified' }),
        Driver.countDocuments({ ...baseFilter, verificationStatus: 'pending' })
    ]);

    const byVehicleType = await Driver.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$vehicleType', count: { $sum: 1 } } }
    ]);

    const byRegion = await Driver.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$region', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    const topRatedDrivers = await Driver.find({ ...baseFilter, status: 'active', rating: { $gte: 4.5 } })
        .sort({ rating: -1 })
        .limit(5)
        .select('fullName email rating totalDeliveries completedDeliveries');

    (res as AppResponse).data({
        overview: { totalDrivers, activeDrivers, pendingDrivers, suspendedDrivers, onlineDrivers },
        verification: { verified: verifiedDrivers, pending: pendingVerification },
        byVehicleType: byVehicleType.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {} as any),
        topRegions: byRegion.map(r => ({ region: r._id, count: r.count })),
        topRatedDrivers,
        scopedToRegion: staffRegionId ? staffRegionId.toString() : null,
    }, 'Dashboard summary retrieved successfully');
});
