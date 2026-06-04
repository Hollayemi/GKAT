import { Request, Response, NextFunction } from 'express';
import Driver from '../../models/Driver';
import DriverWallet from '../../models/DriverWallet';
import DriverDelivery from '../../models/DriverDelivery';
import Order from '../../models/Orders';
import User from '../../models/User';
import Address from '../../models/Address';
import DriverActivity from '../../models/activities/driver';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import CloudinaryService from '../../services/cloudinary';
import { sendEmail, driverEmailTemplates } from '../../utils/driverEmail';
import { resolveStaffRegionId } from '../../helpers/regionScope';
import { dispatchOrderToDrivers } from '../../controllers/rider/orders';
import NotificationController from '../../controllers/others/notification';
import { logActivity } from '../../utils/activityLogger';
import { ACTIONS } from '../../models/admin/Activitylog.model';


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

    const staffRegionId = await resolveStaffRegionId(req.user);

    if (staffRegionId) {
        query.region = staffRegionId.toString();
    } else if (regionFilter) {
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
            .populate('region', 'name')
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

export const getDriverById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id)
        .populate('verifiedBy', 'fullName email')
        .select('-password -passwordSetupToken -passwordSetupExpiry')
        .lean();

    if (!driver) return next(new AppError('Driver not found', 404));

    const staffRegionId = await resolveStaffRegionId(req.user);
    if (staffRegionId && (driver as any).region !== staffRegionId.toString()) {
        const staffRegion = await Driver.findOne({ _id: req.params.id, region: staffRegionId.toString() }).lean();
        if (!staffRegion) return next(new AppError('Driver not found in your region', 404));
    }

    (res as AppResponse).data(driver, 'Driver retrieved successfully');
});

export const createDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        fullName, email, phone, city, state, address, vehicleType, vehiclePlateNumber,
        region, employmentType, vehicleModel, vehicleColor, assignedBranch,
        licenseNumber, licenseExpiry, emergencyContactName, emergencyContactPhone,
        emergencyContactRelationship
    } = req.body;


    const existingDriver = await Driver.findOne({ phone });
    if (existingDriver) return next(new AppError('Phone number already exists', 400, 'DUPLICATE_PHONE'));

    const existingPlate = await Driver.findOne({ vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, '') });
    if (existingPlate) return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));

    let profilePhotoUrl = '';
    let vehiclePhotoUrl = '';
    let driversLicenseUrl = '';

    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        console.log(Object.keys(files));
        if (files.vehiclePhoto?.[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.vehiclePhoto[0], 'go-kart/drivers/profiles');
                vehiclePhotoUrl = result.url;
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
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

    let existingUser: any = await User.findOne({ phoneNumber: phone }).lean();
    if (!existingUser) {
        existingUser = await User.create({ phoneNumber: phone, residentArea: city || state || 'Unknown', name: fullName, email, role: 'driver' });
    }

    await User.findByIdAndUpdate(existingUser._id, { role: 'driver' });

    console.log('vehiclePhotoUrl:', vehiclePhotoUrl, 'profilePhotoUrl:', profilePhotoUrl, 'driversLicenseUrl:', driversLicenseUrl);
    if (!vehiclePhotoUrl || !profilePhotoUrl || !driversLicenseUrl) {
        return next(new AppError(`Unable to get image URL`, 400));
    }

    const driver = await Driver.create({
        userId: existingUser._id, phone, vehicleType, vehicleModel,
        state, city, address,
        vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, ''),
        vehicleColor, profilePhoto: profilePhotoUrl, driversLicense: driversLicenseUrl,
        vehiclePhoto: vehiclePhotoUrl,
        licenseNumber, licenseExpiry, region, assignedBranch, employmentType,
        emergencyContact: emergencyContactName ? { name: emergencyContactName, phone: emergencyContactPhone, relationship: emergencyContactRelationship } : undefined,
        status: 'pending', verificationStatus: 'pending', hasSetPassword: false
    });

    await driver.save();

    await DriverWallet.create({
        driverId: driver._id,
        userId: existingUser._id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        totalDeliveries: 0,
    });

    await logActivity(req, {
        action: ACTIONS.DRIVER_CREATED,
        description: `Registered new driver ${existingUser.name} (${phone}), vehicle: ${vehiclePlateNumber}`,
        targetId: driver._id.toString(),
        targetType: 'Driver',
        targetName: existingUser.name,
        after: {
            phone, vehicleType, vehiclePlateNumber: vehiclePlateNumber.toUpperCase().replace(/\s/g, ''),
            region, employmentType,
        },
    });
    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Welcome to Go-Kart!',
        body: `Your driver account has been created and is pending verification. We will notify you once your account has been reviewed. Thank you for joining Go-Kart!`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    (res as AppResponse).data(
        { _id: driver._id, fullName: existingUser.name, email: existingUser.email, phone: driver.phone, vehicleType: driver.vehicleType, vehiclePlateNumber: driver.vehiclePlateNumber, region: driver.region, employmentType: driver.employmentType, status: driver.status, verificationStatus: driver.verificationStatus, hasSetPassword: driver.hasSetPassword, joinedDate: driver.joinedDate, createdAt: driver.createdAt, updatedAt: driver.updatedAt },
        'Driver registered successfully.',
        201
    );
});

export const updateDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    // if (req.body.email && req.body.email !== driver.userId?.email) return next(new AppError('Email cannot be changed', 400));
    console.log('Update data:', req.body);
    if (req.body.vehiclePlateNumber) {
        const plateNumber = req.body.vehiclePlateNumber.toUpperCase().replace(/\s/g, '');
        if (plateNumber !== driver.vehiclePlateNumber) {
            const existingPlate = await Driver.findOne({ vehiclePlateNumber: plateNumber });
            if (existingPlate) return next(new AppError('Vehicle plate number already registered', 400, 'DUPLICATE_PLATE_NUMBER'));
        }
    }



    if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files.vehiclePhoto?.[0]) {
            try {
                const result = await CloudinaryService.uploadImage(files.vehiclePhoto[0], 'go-kart/drivers/profiles');
                const vehiclePhotoUrl = result.url;
                req.body.vehiclePhoto = vehiclePhotoUrl
            } catch (error: any) {
                return next(new AppError(`Profile photo upload failed: ${error.message}`, 400));
            }
        }
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



    const before = {
        phone: driver.phone, vehiclePlateNumber: driver.vehiclePlateNumber,
        vehicleType: driver.vehicleType, region: driver.region,
        employmentType: driver.employmentType,
    };

    const updatedDriver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password -passwordSetupToken -passwordSetupExpiry');


    await logActivity(req, {
        action: ACTIONS.DRIVER_UPDATED,
        description: `Updated profile for driver ${driver.userId.name}`,
        targetId: driver._id.toString(),
        targetType: 'Driver',
        targetName: driver.userId.name,
        before,
        after: req.body,
    });
    (res as AppResponse).data(updatedDriver, 'Driver updated successfully');
});

export const deleteDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email').exec() as any;
    if (!driver) return next(new AppError('Driver not found', 404));

    if (driver.profilePhoto) { try { await CloudinaryService.deleteImage(driver.profilePhoto); } catch (e) { console.error(e); } }
    if (driver.driversLicense) { try { await CloudinaryService.deleteImage(driver.driversLicense); } catch (e) { console.error(e); } }

    await driver.deleteOne();
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Deleted', 'Driver account deleted by admin', undefined, undefined, req.ip);

    await logActivity(req, {
        action: ACTIONS.DRIVER_DELETED,
        description: `Deleted driver account for ${driver.userId.name}`,
        targetId: req.params.id,
        targetType: 'Driver',
        targetName: driver.userId.name,
        before: { phone: driver.phone, vehicleType: driver.vehicleType, region: driver.region },
    });

    (res as AppResponse).success('Driver deleted successfully');
});

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

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Verified',
        body: `Congratulations! Your driver account has been verified and is now active. You can log in to your account to start accepting deliveries. Thank you for joining Go-Kart!`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    (res as AppResponse).data({ _id: driver._id, fullName: driver.userId.name, status: driver.status, verificationStatus: driver.verificationStatus, verifiedAt: driver.verifiedAt, verificationNotes: driver.verificationNotes }, 'Driver verified successfully');
});

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

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Suspension Notice',
        body: `Your driver account has been suspended. Reason: ${reason}. Please contact support for more information.`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    (res as AppResponse).data({ _id: driver._id, fullName: driver.fullName, verificationStatus: driver.verificationStatus, rejectedAt: driver.rejectedAt, rejectionReason: driver.rejectionReason }, 'Driver application rejected');
});

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

    await logActivity(req, {
        action: ACTIONS.DRIVER_SUSPENDED,
        description: `Suspended driver ${driver.userId.name}. Reason: "${reason}"${duration ? `. Duration: ${duration} day(s)` : ''}`,
        targetId: driver._id.toString(),
        targetType: 'Driver',
        targetName: driver.userId.name,
        metadata: { reason, duration, suspendedUntil: driver.suspendedUntil },
    });
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Suspended', `Driver account suspended: ${reason}`, { suspendedBy: req.user?.fullName, reason, duration }, undefined, req.ip);

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Suspension Notice',
        body: `Your driver account has been suspended. Reason: ${reason}. Please contact support for more information.`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    (res as AppResponse).data({ _id: driver._id, status: driver.status, suspendedAt: driver.suspendedAt, suspendedUntil: driver.suspendedUntil, reason: driver.suspensionReason }, 'Driver suspended successfully');
});

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

    await logActivity(req, {
        action: ACTIONS.DRIVER_UNSUSPENDED,
        description: `Unsuspended driver ${driver.userId.name}`,
        targetId: driver._id.toString(),
        targetType: 'Driver',
        targetName: driver.userId.name,
    });

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Unsuspension Notice',
        body: `Your driver account has been unsuspended and is now active. Thank you for your patience. Please log in to your account to continue accepting deliveries.`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    (res as AppResponse).data({ driver }, 'Driver unsuspended successfully');
});

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

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Disabled Notice',
        body: `Your driver account has been disabled. Reason: ${reason}. Please contact support for more information.`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });


    if (notifyDriver) { try { await sendEmail({ to: driver.userId.email, subject: 'Driver account disabled', html: driverEmailTemplates.accountDisabled(driver.userId.name, reason) }); } catch (e) { console.error(e); } }
    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Disabled', `Driver account disabled: ${reason}`, { disabledBy: req.user?.fullName, reason }, undefined, req.ip);

    await logActivity(req, {
        action: ACTIONS.DRIVER_DISABLED,
        description: `Permanently disabled driver ${driver.userId.name}. Reason: "${reason}"`,
        targetId: driver._id.toString(),
        targetType: 'Driver',
        targetName: driver.userId.name,
        metadata: { reason },
    });

    (res as AppResponse).data({ _id: driver._id, status: driver.status, disabledAt: driver.disabledAt, reason: driver.disablementReason }, 'Driver disabled successfully');
});

export const enableDriver = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.status !== 'disabled') return next(new AppError('Driver is not disabled', 400));

    driver.status = driver.verificationStatus === 'verified' ? 'active' : 'pending';
    driver.disabledAt = undefined;
    driver.disablementReason = undefined;
    await driver.save();

     await logActivity(req, {
      action:      ACTIONS.DRIVER_ENABLED,
      description: `Re-enabled driver ${driver.userId.name}`,
      targetId:    driver._id.toString(),
      targetType:  'Driver',
      targetName:  driver.userId.name,
    });

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Account Enabled', 'Driver account enabled by admin', { enabledBy: req.user?.fullName }, undefined, req.ip);

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Account Enabled Notice',
        body: `Your driver account has been enabled and is now active. Thank you for your patience. Please log in to your account to continue accepting deliveries.`,
        type: 'driver',
        priority: 'high'
    }, 'user', { push_notification: true });

    (res as AppResponse).data({ driver }, 'Driver enabled successfully');
});

export const resendPasswordLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driver = await Driver.findById(req.params.id).populate('userId', 'name email') as any;
    if (!driver) return next(new AppError('Driver not found', 404));
    if (driver.hasSetPassword) return next(new AppError('Driver has already set up their password', 400));

    driver.generatePasswordSetupToken();
    await driver.save();

    await logDriverActivity(driver._id.toString(), driver.userId.name, 'Password Link Resent', 'Password setup link resent by admin', { resentBy: req.user?.fullName }, undefined, req.ip);

    (res as AppResponse).data({ emailSent: true }, 'Password setup link sent successfully');
});

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

export const getActiveDelivery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const driverId = req.params.id as string;
    if (!driverId) return next(new AppError('Driver ID not found', 404));

    const delivery = await DriverDelivery.findOne({
        driverId,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    })
        .populate({
            path: 'orderId',
            select: 'orderNumber orderSlug items totalAmount notes',
            populate: { path: 'shippingAddress', select: 'address localGovernment state phone' }
        })
        .populate('userId', 'name avatar phoneNumber');

    (res as AppResponse).data(delivery, 'Active delivery retrieved');
});

export const getDeliveryHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driverId = req.params.id as string;
    if (!driverId) return next(new AppError('Driver ID not found', 404));
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = { driverId };

    if (status && status !== 'all') {
        query.status = status;
    } else {
        // query.status = { $in: ['delivered', 'cancelled', 'rejected', "accepted", "on-delivery"] };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [deliveries, total] = await Promise.all([
        DriverDelivery.find(query)
            .populate('orderId', 'orderNumber orderSlug items')
            .populate('userId', 'name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit as string)),
        DriverDelivery.countDocuments(query)
    ]);

    (res as AppResponse).data(
        {
            deliveries,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        },
        'Delivery history retrieved'
    );
});

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



export const getAvailableDrivers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { region, search } = req.query;

    console.log('Fetching available drivers with filters:', { region, search });

    const staffRegionId = await resolveStaffRegionId(req.user);

    console.log('Resolved staff region ID:', staffRegionId);

    const query: any = {
        status: 'active',
        verificationStatus: 'verified',
    };

    if (staffRegionId) {
        query.region = staffRegionId.toString();
    } else if (region) {
        query.region = region;
    }

    if (search) {
        query.$or = [
            { phone: { $regex: search, $options: 'i' } },
            { vehiclePlateNumber: { $regex: search, $options: 'i' } },
        ];
    }

    const drivers = await Driver.find(query)
        .populate('userId', 'name email phoneNumber avatar')
        .populate('region', 'name')
        .select('-password -passwordSetupToken -passwordSetupExpiry')
        .lean();

    const busyDriverIds = await DriverDelivery.find({
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    }).distinct('driverId');

    const busySet = new Set(busyDriverIds.map(id => id.toString()));

    const available = drivers
        .filter(d => !busySet.has(d._id.toString()))
        .map(d => ({
            _id: d._id,
            fullName: (d.userId as any)?.name || 'Unknown',
            email: (d.userId as any)?.email || '',
            phone: d.phone,
            avatar: (d.userId as any)?.avatar || d.profilePhoto || null,
            vehicleType: d.vehicleType,
            vehiclePlateNumber: d.vehiclePlateNumber,
            vehicleModel: d.vehicleModel,
            region: d.region,
            rating: d.rating,
            totalDeliveries: d.totalDeliveries,
            completedDeliveries: d.completedDeliveries,
            isOnline: d.isOnline,
            status: d.status,
        }));

    (res as AppResponse).data(
        { drivers: available, total: available.length },
        'Available drivers retrieved successfully'
    );
});


export const assignDriverToOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { orderNumber } = req.params;
    const { driverId, distanceKm = 3.5, isPriority = false, pickupAddress } = req.body;

    if (!driverId) return next(new AppError('driverId is required', 400));

    const staffRegionId = await resolveStaffRegionId(req.user);
    const orderQuery: any = { orderNumber };
    if (staffRegionId) orderQuery.region = staffRegionId;

    const order = await Order.findOne(orderQuery).populate('userId', 'name email');
    if (!order) return next(new AppError('Order not found or not in your region', 404));

    if (order.orderStatus !== "ready") {
        return next(new AppError(
            `Cannot assign driver to order with status "${order.orderStatus}". Order must be paid or confirmed.`,
            400
        ));
    }

    const driver = await Driver.findById(driverId).populate('userId', 'name email phoneNumber');
    if (!driver) return next(new AppError('Driver not found', 404));

    if (driver.verificationStatus !== 'verified') {
        return next(new AppError('Driver must be verified before assignment', 400));
    }
    if (driver.status === 'suspended' || driver.status === 'disabled') {
        return next(new AppError(`Driver account is ${driver.status} and cannot be assigned`, 400));
    }

    const activeDelivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    });
    if (activeDelivery) {
        return next(new AppError('Driver is currently on an active delivery', 409));
    }

    const existingOrderDelivery = await DriverDelivery.findOne({
        orderId: order._id,
        status: { $nin: ['cancelled', 'rejected'] }
    });
    if (existingOrderDelivery && existingOrderDelivery.driverId) {
        return next(new AppError('This order already has an active delivery assignment', 409));
    }

    let deliveryAddress = 'Customer Location';
    try {
        const addressDoc = await Address.findById(order.shippingAddress).lean() as any;
        if (addressDoc) {
            deliveryAddress = [addressDoc.address, addressDoc.localGovernment, addressDoc.state]
                .filter(Boolean).join(', ');
        }
    } catch (_) { }

    const delivery = await dispatchOrderToDrivers(order.id, driver.id, distanceKm,);

    await order.updateStatus('ready', `Driver assigned by admin: ${(driver.userId as any)?.name || driver._id}`);

    await logActivity(req, {
        action: ACTIONS.DRIVER_ASSIGNED,
        description: `Assigned driver ${(driver.userId as any)?.name} to order #${order.orderNumber}`,
        targetId: order.orderNumber,
        targetType: 'Order',
        targetName: `#${order.orderNumber}`,
        metadata: {
            driverId,
            driverName: (driver.userId as any)?.name,
            distanceKm,
            deliveryId: delivery._id,
        },
    });

    // driver.status = 'on-delivery';
    // await driver.save();

    await NotificationController.saveAndSendNotification({
        userId: driver.userId?.toString(),
        title: 'Driver Assigned to Order',
        body: `You have been assigned to deliver order ${order.orderNumber}. Please check your app for details.`,
        type: 'driver',
        typeId: { orderId: delivery.orderId },
        clickUrl: `/orders/${delivery.orderId}`,
        priority: 'high'
    }, 'user', { push_notification: true });

    const walletExists = await DriverWallet.findOne({ driverId: driver._id });
    if (!walletExists) {
        await DriverWallet.create({
            driverId: driver._id,
            userId: driver.userId,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            totalDeliveries: 0,
        });
    }

    (res as AppResponse).data(
        {
            delivery: {
                _id: delivery._id,
                orderNumber: delivery.orderNumber,
                status: delivery.status,
                fareBreakdown: delivery.fareBreakdown,
                distanceKm: delivery.distanceKm,
                pickupAddress: delivery.pickupAddress,
                deliveryAddress: delivery.deliveryAddress,
            },
            driver: {
                _id: driver._id,
                fullName: (driver.userId as any)?.name,
                phone: driver.phone,
                vehicleType: driver.vehicleType,
                vehiclePlateNumber: driver.vehiclePlateNumber,
            },
            orderStatus: 'processing',
        },
        'Driver assigned to order successfully',
        201
    );
});

