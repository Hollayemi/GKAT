import { Request, Response, NextFunction } from 'express';
import PushNotification from '../models/admin/PushNotification.model';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import CloudinaryService from '../services/cloudinary';
import { sendBatchNotifications, sendToToken } from '../services/pushNotification.service';

// import User from '../models/User';
// import Driver from '../models/Driver';
// import Order from '../models/Order';

// Helper function to get recipients based on targeting
const getRecipients = async (notification: any) => {
    let recipients: any[] = [];
    let query: any = {};

    // Target audience
    if (notification.targetAudience === 'customers') {
       // Adjust based on your User model
    } else if (notification.targetAudience === 'drivers') {
        // Get drivers instead of users
        // const Driver = require('../models/Driver').default;
        // query = {}; // Will query Driver model
    } else if (notification.targetAudience === 'specific') {
        if (notification.specificUserIds && notification.specificUserIds.length > 0) {
            query._id = { $in: notification.specificUserIds };
        }
        // Handle specificDriverIds separately if needed
    }

    // Apply filters
    if (notification.filters) {
        if (notification.filters.region && notification.filters.region.length > 0) {
            query.region = { $in: notification.filters.region };
        }

        if (notification.filters.city && notification.filters.city.length > 0) {
            query.city = { $in: notification.filters.city };
        }

        if (notification.filters.userStatus && notification.filters.userStatus.length > 0) {
            query.status = { $in: notification.filters.userStatus };
        }

        // Order history filtering
        if (notification.filters.orderHistory) {
            const Order = require('../models/Order').default;
            
            if (notification.filters.orderHistory === 'has-ordered') {
                const userIds = await Order.distinct('userId', { status: 'completed' });
                if (query._id) {
                    // Combine with existing _id filter
                    query._id = { $in: query._id.$in.filter((id: any) => userIds.includes(id)) };
                } else {
                    query._id = { $in: userIds };
                }
            } else if (notification.filters.orderHistory === 'never-ordered') {
                const userIds = await Order.distinct('userId');
                query._id = { $nin: userIds };
            } else if (notification.filters.orderHistory === 'frequent-buyers') {
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const frequentBuyers = await Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: thirtyDaysAgo },
                            status: 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: '$userId',
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $match: { count: { $gte: 5 } }
                    }
                ]);
                
                const frequentBuyerIds = frequentBuyers.map((u: any) => u._id);
                if (query._id) {
                    query._id = { $in: query._id.$in.filter((id: any) => frequentBuyerIds.includes(id)) };
                } else {
                    query._id = { $in: frequentBuyerIds };
                }
            }
        }
    }

    // Get users with FCM tokens
    const User = require('../models/User').default;
    
    if (notification.targetAudience === 'drivers') {
        const Driver = require('../models/Driver').default;
        recipients = await Driver.find({
            ...query,
            $and: [
                { fcmToken: { $exists: true } },
                { fcmToken: { $ne: null } },
                { fcmToken: { $ne: '' } }
            ]
        }).select('fcmToken fullName email');
    } else {
        recipients = await User.find({
            ...query,
            $and: [
                { fcmToken: { $exists: true } },
                { fcmToken: { $ne: null } },
                { fcmToken: { $ne: '' } }
            ]
        }).select('fcmToken fullName email');
    }

    return recipients;
};

// Helper function to actually send the notification
const performSend = async (notification: any) => {
    try {
        // Get recipients
        const recipients = await getRecipients(notification);
        const tokens = recipients.map((r: any) => r.fcmToken).filter((t: any) => t);

        if (tokens.length === 0) {
            notification.status = 'failed';
            notification.failedCount = 0;
            await notification.save();
            return {
                success: false,
                message: 'No valid recipients found',
                sentCount: 0
            };
        }

        // Prepare notification data
        const data: any = {
            notificationId: notification._id.toString()
        };

        if (notification.deepLink) {
            data.deepLink = notification.deepLink;
        }

        if (notification.actionButton) {
            data.actionButton = JSON.stringify(notification.actionButton);
        }

        // Send in batches
        const result = await sendBatchNotifications(
            tokens,
            notification.title,
            notification.message,
            data,
            notification.image
        );

        // Update notification stats
        notification.status = 'sent';
        notification.totalRecipients = tokens.length;
        notification.sentCount = result.totalSuccess;
        notification.failedCount = result.totalFailure;
        notification.sentAt = new Date();
        
        await notification.save();

        return {
            success: true,
            message: `Notification sent successfully to ${result.totalSuccess} recipients`,
            sentCount: result.totalSuccess,
            failedCount: result.totalFailure
        };
    } catch (error) {
        notification.status = 'failed';
        await notification.save();
        throw error;
    }
};

// @desc    Get all notifications with filtering and pagination
// @route   GET /api/v1/push-notifications
// @access  Private/Admin
export const getAllNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        status,
        page = 1,
        limit = 20
    } = req.query;

    const query: any = {};

    // Filter by status
    if (status && typeof status === 'string') {
        query.status = status;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
        PushNotification.find(query)
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        PushNotification.countDocuments(query)
    ]);

    (res as AppResponse).data(
        {notifications, pagination:{
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        }},
        'Notifications retrieved successfully',
        200,
        
    );
});

// @desc    Get single notification by ID
// @route   GET /api/v1/push-notifications/:id
// @access  Private/Admin
export const getNotificationById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const notification = await PushNotification.findById(req.params.id)
        .populate('createdBy', 'fullName email')
        .lean();

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    (res as AppResponse).data(notification, 'Notification retrieved successfully');
});

// @desc    Create new notification
// @route   POST /api/v1/push-notifications
// @access  Private/Admin
export const createNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        title,
        message,
        targetAudience,
        scheduleType,
        scheduledAt,
        saveAsDraft,
        deepLink,
        actionButton,
        filters,
        specificUserIds,
        specificDriverIds
    } = req.body;

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    // Handle image upload
    let imageUrl = '';
    if (req.file) {
        try {
            const result = await CloudinaryService.uploadImage(req.file, 'go-kart/notifications');
            imageUrl = result.url;
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    // Parse JSON fields if they're strings
    let parsedActionButton;
    let parsedFilters;
    let parsedSpecificUserIds;
    let parsedSpecificDriverIds;

    try {
        if (actionButton && typeof actionButton === 'string') {
            parsedActionButton = JSON.parse(actionButton);
        } else {
            parsedActionButton = actionButton;
        }

        if (filters && typeof filters === 'string') {
            parsedFilters = JSON.parse(filters);
        } else {
            parsedFilters = filters;
        }

        if (specificUserIds && typeof specificUserIds === 'string') {
            parsedSpecificUserIds = JSON.parse(specificUserIds);
        } else {
            parsedSpecificUserIds = specificUserIds;
        }

        if (specificDriverIds && typeof specificDriverIds === 'string') {
            parsedSpecificDriverIds = JSON.parse(specificDriverIds);
        } else {
            parsedSpecificDriverIds = specificDriverIds;
        }
    } catch (error) {
        return next(new AppError('Invalid JSON in request fields', 400));
    }

    // Create notification
    const notification = await PushNotification.create({
        title,
        message,
        image: imageUrl,
        targetAudience,
        specificUserIds: parsedSpecificUserIds || [],
        specificDriverIds: parsedSpecificDriverIds || [],
        filters: parsedFilters,
        scheduleType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        deepLink,
        actionButton: parsedActionButton,
        status: saveAsDraft === 'true' || saveAsDraft === true ? 'draft' : 'draft',
        createdBy: req.user.id,
        createdByName: req.user.fullName
    });

    // If not saving as draft and immediate, send now
    if ((saveAsDraft === 'false' || saveAsDraft === false) && scheduleType === 'immediate') {
        const sendResult = await performSend(notification);
        
        return (res as AppResponse).data(
            {
                _id: notification._id,
                title: notification.title,
                message: notification.message,
                targetAudience: notification.targetAudience,
                status: notification.status,
                totalRecipients: notification.totalRecipients,
                sentCount: notification.sentCount,
                failedCount: notification.failedCount,
                sentAt: notification.sentAt,
                createdAt: notification.createdAt,
                updatedAt: notification.updatedAt
            },
            sendResult.message,
            201
        );
    }

    // If scheduled
    if (scheduleType === 'scheduled') {
        notification.status = 'scheduled';
        await notification.save();

        const scheduledDate = new Date(scheduledAt);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });
        const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return (res as AppResponse).data(
            {
                _id: notification._id,
                title: notification.title,
                status: notification.status,
                scheduledAt: notification.scheduledAt,
                totalRecipients: notification.totalRecipients,
                createdAt: notification.createdAt
            },
            `Notification scheduled successfully for ${formattedDate} at ${formattedTime}`,
            201
        );
    }

    // If saved as draft
    return (res as AppResponse).data(
        {
            _id: notification._id,
            title: notification.title,
            status: notification.status,
            createdAt: notification.createdAt
        },
        'Notification saved as draft',
        201
    );
});

// Continue in Part 2...
// Continuation of pushNotificationController.ts - Part 2

// @desc    Update notification (drafts only)
// @route   PUT /api/v1/push-notifications/:id
// @access  Private/Admin
export const updateNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const notification = await PushNotification.findById(req.params.id);

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    // Can only update drafts
    if (notification.status !== 'draft') {
        return next(new AppError('Can only update draft notifications', 400));
    }

    // Handle image upload
    if (req.file) {
        try {
            // Delete old image if exists
            if (notification.image) {
                await CloudinaryService.deleteImage(notification.image);
            }

            const result = await CloudinaryService.uploadImage(req.file, 'go-kart/notifications');
            req.body.image = result.url;
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    // Parse JSON fields if needed
    if (req.body.actionButton && typeof req.body.actionButton === 'string') {
        req.body.actionButton = JSON.parse(req.body.actionButton);
    }

    if (req.body.filters && typeof req.body.filters === 'string') {
        req.body.filters = JSON.parse(req.body.filters);
    }

    if (req.body.specificUserIds && typeof req.body.specificUserIds === 'string') {
        req.body.specificUserIds = JSON.parse(req.body.specificUserIds);
    }

    if (req.body.specificDriverIds && typeof req.body.specificDriverIds === 'string') {
        req.body.specificDriverIds = JSON.parse(req.body.specificDriverIds);
    }

    if (req.body.scheduledAt) {
        req.body.scheduledAt = new Date(req.body.scheduledAt);
    }

    const updatedNotification = await PushNotification.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    (res as AppResponse).data(updatedNotification, 'Notification updated successfully');
});

// @desc    Send notification immediately
// @route   POST /api/v1/push-notifications/:id/send
// @access  Private/Admin
export const sendNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const notification = await PushNotification.findById(req.params.id);

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    // Can't resend already sent notifications
    if (notification.status === 'sent') {
        return next(new AppError('Notification has already been sent', 400));
    }

    const sendResult = await performSend(notification);

    if (!sendResult.success) {
        return next(new AppError(sendResult.message, 400));
    }

    (res as AppResponse).data(
        {
            _id: notification._id,
            title: notification.title,
            status: notification.status,
            totalRecipients: notification.totalRecipients,
            sentCount: notification.sentCount,
            failedCount: notification.failedCount,
            sentAt: notification.sentAt
        },
        sendResult.message
    );
});

// @desc    Test notification (send to admin only)
// @route   POST /api/v1/push-notifications/test
// @access  Private/Admin
export const testNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { title, message, deepLink, actionButton, image } = req.body;

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    // Get admin's FCM token from User model
    const User = require('../models/User').default;
    const admin = await User.findById(req.user.id).select('fcmToken');

    if (!admin || !admin.fcmToken) {
        return next(new AppError('Admin FCM token not found. Please register your device first.', 400));
    }

    // Prepare notification data
    const data: any = {
        notificationId: 'test',
        isTest: 'true'
    };

    if (deepLink) {
        data.deepLink = deepLink;
    }

    if (actionButton) {
        data.actionButton = JSON.stringify(actionButton);
    }

    // Send test notification
    const success = await sendToToken(
        admin.fcmToken,
        title,
        message,
        data,
        image
    );

    if (!success) {
        return next(new AppError('Failed to send test notification', 500));
    }

    (res as AppResponse).data(
        { sent: true },
        'Test notification sent successfully to your device'
    );
});

// @desc    Estimate recipients
// @route   POST /api/v1/push-notifications/estimate-recipients
// @access  Private/Admin
export const estimateRecipients = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { targetAudience, filters, specificUserIds, specificDriverIds } = req.body;

    // Create a temporary notification object for estimation
    const tempNotification = {
        targetAudience,
        filters,
        specificUserIds: specificUserIds || [],
        specificDriverIds: specificDriverIds || []
    };

    const recipients = await getRecipients(tempNotification);
    const count = recipients.filter((r: any) => r.fcmToken).length;

    (res as AppResponse).data(
        {
            estimatedRecipients: count,
            targetAudience,
            filters
        },
        `Estimated ${count} recipient(s) for this notification`
    );
});

// @desc    Delete notification (drafts only)
// @route   DELETE /api/v1/push-notifications/:id
// @access  Private/Admin
export const deleteNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const notification = await PushNotification.findById(req.params.id);

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    // Can only delete drafts
    if (notification.status !== 'draft') {
        return next(new AppError('Can only delete draft notifications', 400));
    }

    // Delete image if exists
    if (notification.image) {
        try {
            await CloudinaryService.deleteImage(notification.image);
        } catch (error) {
            console.error('Error deleting notification image:', error);
        }
    }

    await notification.deleteOne();

    (res as AppResponse).success('Notification deleted successfully');
});

// @desc    Track notification delivered
// @route   POST /api/v1/push-notifications/:id/delivered
// @access  Public (called from mobile app)
export const trackDelivered = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.body;

    const notification = await PushNotification.findByIdAndUpdate(
        req.params.id,
        { $inc: { deliveredCount: 1 } },
        { new: true }
    );

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    (res as AppResponse).data(
        { tracked: true },
        'Delivery tracked successfully'
    );
});

// @desc    Track notification clicked
// @route   POST /api/v1/push-notifications/:id/clicked
// @access  Public (called from mobile app)
export const trackClicked = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.body;

    const notification = await PushNotification.findByIdAndUpdate(
        req.params.id,
        { $inc: { clickedCount: 1 } },
        { new: true }
    );

    if (!notification) {
        return next(new AppError('Notification not found', 404));
    }

    (res as AppResponse).data(
        { tracked: true },
        'Click tracked successfully'
    );
});

// @desc    Get notification statistics
// @route   GET /api/v1/push-notifications/statistics
// @access  Private/Admin
export const getStatistics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const [
        totalNotifications,
        sentNotifications,
        scheduledNotifications,
        draftNotifications,
        totalRecipients,
        totalDelivered,
        totalClicked
    ] = await Promise.all([
        PushNotification.countDocuments(),
        PushNotification.countDocuments({ status: 'sent' }),
        PushNotification.countDocuments({ status: 'scheduled' }),
        PushNotification.countDocuments({ status: 'draft' }),
        PushNotification.aggregate([
            { $match: { status: 'sent' } },
            { $group: { _id: null, total: { $sum: '$totalRecipients' } } }
        ]),
        PushNotification.aggregate([
            { $match: { status: 'sent' } },
            { $group: { _id: null, total: { $sum: '$deliveredCount' } } }
        ]),
        PushNotification.aggregate([
            { $match: { status: 'sent' } },
            { $group: { _id: null, total: { $sum: '$clickedCount' } } }
        ])
    ]);

    const totalRecipientsCount = totalRecipients[0]?.total || 0;
    const totalDeliveredCount = totalDelivered[0]?.total || 0;
    const totalClickedCount = totalClicked[0]?.total || 0;

    const deliveryRate = totalRecipientsCount > 0 
        ? ((totalDeliveredCount / totalRecipientsCount) * 100).toFixed(2)
        : 0;

    const clickThroughRate = totalDeliveredCount > 0
        ? ((totalClickedCount / totalDeliveredCount) * 100).toFixed(2)
        : 0;

    // Get recent notifications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentNotifications = await PushNotification.find({
        sentAt: { $gte: sevenDaysAgo },
        status: 'sent'
    })
        .sort({ sentAt: -1 })
        .limit(5)
        .select('title sentCount deliveredCount clickedCount sentAt');

    const statistics = {
        overview: {
            totalNotifications,
            sentNotifications,
            scheduledNotifications,
            draftNotifications
        },
        engagement: {
            totalRecipients: totalRecipientsCount,
            totalDelivered: totalDeliveredCount,
            totalClicked: totalClickedCount,
            deliveryRate: parseFloat(deliveryRate as string),
            clickThroughRate: parseFloat(clickThroughRate as string)
        },
        recentNotifications
    };

    (res as AppResponse).data(statistics, 'Statistics retrieved successfully');
});
