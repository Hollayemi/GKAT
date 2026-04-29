import { Request, Response, NextFunction } from 'express';
import Driver from '../../models/Driver';
import User from '../../models/User';
import DriverDelivery from '../../models/DriverDelivery';
import DriverWallet from '../../models/DriverWallet';
import UserNotification from '../../models/Notification';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import CloudinaryService from '../../services/cloudinary';

// ─── @desc    Home screen stats
// ─── @route   GET /api/v1/driver-app/profile/home
// ─── @access  Private (driver)
export const getHomeStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id })
        .populate('userId', 'name avatar')
        .select('-password -passwordSetupToken -passwordSetupExpiry');

    if (!driver) return next(new AppError('Driver profile not found', 404));

    // Check for active delivery
    const activeDelivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    }).select('status orderId orderNumber');

    const [totalKmResult] = await DriverDelivery.aggregate([
        { $match: { driverId: driver._id, status: 'delivered' } },
        { $group: { _id: null, totalKm: { $sum: '$distanceKm' } } }
    ]);

    const wallet = await DriverWallet.findOne({ driverId: driver._id })
        .select('balance totalEarned');

    const unreadCount = await UserNotification.getUnreadCount(req.user._id);

    (res as AppResponse).data(
        {
            driver: {
                _id: driver._id,
                name: (driver.userId as any)?.name,
                avatar: (driver.userId as any)?.avatar || driver.profilePhoto,
                rating: driver.rating,
                region: driver.region,
                isOnline: driver.isOnline,
                status: driver.status,
                verificationStatus: driver.verificationStatus
            },
            stats: {
                currentOrders: activeDelivery ? 1 : 0,
                totalDeliveries: driver.completedDeliveries,
                cancelledDeliveries: driver.cancelledDeliveries,
                totalKmTravelled: Math.round((totalKmResult?.totalKm || 0) * 10) / 10
            },
            wallet: {
                balance: wallet?.balance || 0,
                totalEarned: wallet?.totalEarned || 0
            },
            activeDelivery: activeDelivery || null,
            unreadNotifications: unreadCount
        },
        'Home stats retrieved'
    );
});

// ─── @desc    Get driver notifications
// ─── @route   GET /api/v1/driver-app/profile/notifications
// ─── @access  Private (driver)
export const getNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const notifications = await UserNotification.findByUserId(req.user._id, {
        limit: parseInt(limit as string),
        skip,
        unreadOnly: unreadOnly === 'true'
    });

    const unreadCount = await UserNotification.getUnreadCount(req.user._id);

    (res as AppResponse).data(
        { notifications, unreadCount },
        'Notifications retrieved'
    );
});

// ─── @desc    Mark notification as read
// ─── @route   PATCH /api/v1/driver-app/profile/notifications/:id/read
// ─── @access  Private (driver)
export const markNotificationRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const notification = await UserNotification.findOne({
        _id: req.params.id,
        userId: req.user._id
    });

    if (!notification) return next(new AppError('Notification not found', 404));

    await notification.markAsRead();

    (res as AppResponse).success('Notification marked as read');
});

// ─── @desc    Mark all notifications as read
// ─── @route   PATCH /api/v1/driver-app/profile/notifications/read-all
// ─── @access  Private (driver)
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    await UserNotification.markAllAsRead(req.user._id);

    (res as AppResponse).success('All notifications marked as read');
});

// ─── @desc    Update driver profile (name, photo)
// ─── @route   PUT /api/v1/driver-app/profile
// ─── @access  Private (driver)
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const allowedFields = [
        'vehicleModel',
        'vehicleColor',
        'emergencyContact'
    ];

    const updates: any = {};
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });

    // Handle emergency contact nested update
    if (req.body.emergencyContactName || req.body.emergencyContactPhone || req.body.emergencyContactRelationship) {
        updates.emergencyContact = {
            name: req.body.emergencyContactName || driver.emergencyContact?.name,
            phone: req.body.emergencyContactPhone || driver.emergencyContact?.phone,
            relationship: req.body.emergencyContactRelationship || driver.emergencyContact?.relationship
        };
    }

    // Handle profile photo upload
    if (req.file) {
        try {
            if (driver.profilePhoto) {
                await CloudinaryService.deleteImage(driver.profilePhoto);
            }
            const result = await CloudinaryService.uploadImage(req.file, 'go-kart/drivers/profiles');
            updates.profilePhoto = result.url;
        } catch (error: any) {
            return next(new AppError(`Photo upload failed: ${error.message}`, 400));
        }
    }

    const updated = await Driver.findByIdAndUpdate(
        driver._id,
        updates,
        { new: true, runValidators: true }
    ).select('-password -passwordSetupToken -passwordSetupExpiry');

    (res as AppResponse).data({ driver: updated }, 'Profile updated successfully');
});

// ─── @desc    Get driver performance stats
// ─── @route   GET /api/v1/driver-app/profile/stats
// ─── @access  Private (driver)
export const getPerformanceStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyStats, allTimeKm, averageRating] = await Promise.all([
        DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    createdAt: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]),
        DriverDelivery.aggregate([
            { $match: { driverId: driver._id, status: 'delivered' } },
            { $group: { _id: null, totalKm: { $sum: '$distanceKm' } } }
        ]),
        DriverDelivery.aggregate([
            {
                $match: {
                    driverId: driver._id,
                    driverRating: { $exists: true }
                }
            },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$driverRating' },
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    const monthly = monthlyStats.reduce((acc: any, s) => {
        acc[s._id] = s.count;
        return acc;
    }, {});

    const completionRate = driver.totalDeliveries > 0
        ? Number(((driver.completedDeliveries / driver.totalDeliveries) * 100).toFixed(1))
        : 0;

    const cancellationRate = driver.totalDeliveries > 0
        ? Number(((driver.cancelledDeliveries / driver.totalDeliveries) * 100).toFixed(1))
        : 0;

    (res as AppResponse).data(
        {
            allTime: {
                totalDeliveries: driver.totalDeliveries,
                completedDeliveries: driver.completedDeliveries,
                cancelledDeliveries: driver.cancelledDeliveries,
                completionRate,
                cancellationRate,
                totalKmTravelled: Math.round((allTimeKm[0]?.totalKm || 0) * 10) / 10,
                rating: driver.rating,
                reviewCount: averageRating[0]?.count || 0
            },
            thisMonth: {
                delivered: monthly['delivered'] || 0,
                cancelled: monthly['cancelled'] || 0,
                rejected: monthly['rejected'] || 0
            }
        },
        'Performance stats retrieved'
    );
});

// ─── @desc    Update notification preferences
// ─── @route   PUT /api/v1/driver-app/profile/notification-preferences
// ─── @access  Private (driver)
export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const allowedPrefs = [
        'push_notification', 'sound', 'vibrate', 'offers', 'order_updates',
        'promos', 'payments', 'orders', 'app_update', 'policy',
    ];

    const updates: any = {};
    allowedPrefs.forEach(pref => {
        if (req.body[pref] !== undefined) {
            updates[`notification_pref.${pref}`] = Boolean(req.body[pref]);
        }
    });
    await User.findByIdAndUpdate(req.user._id, { $set: updates });

    (res as AppResponse).success('Notification preferences updated');
});
