"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeNotificationScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const PushNotification_model_1 = __importDefault(require("../models/admin/PushNotification.model"));
const pushNotification_service_1 = require("../services/pushNotification.service");
// Helper to get recipients (copied from controller)
const getRecipients = async (notification) => {
    let recipients = [];
    let query = {};
    // Target audience
    if (notification.targetAudience === 'customers') {
        query.role = 'customer';
    }
    else if (notification.targetAudience === 'specific') {
        if (notification.specificUserIds && notification.specificUserIds.length > 0) {
            query._id = { $in: notification.specificUserIds };
        }
    }
    // Apply filters
    if (notification.filters) {
        if (notification.filters.region && notification.filters.region.length > 0) {
            query.region = { $in: notification.filters.region };
        }
        if (notification.filters.city && notification.filters.city.length > 0) {
            query.city = { $in: notification.filters.city };
        }
        // Order history filtering
        if (notification.filters.orderHistory) {
            const Order = require('../models/Order').default;
            if (notification.filters.orderHistory === 'has-ordered') {
                const userIds = await Order.distinct('userId', { status: 'completed' });
                if (query._id) {
                    query._id = { $in: query._id.$in.filter((id) => userIds.includes(id)) };
                }
                else {
                    query._id = { $in: userIds };
                }
            }
            else if (notification.filters.orderHistory === 'never-ordered') {
                const userIds = await Order.distinct('userId');
                query._id = { $nin: userIds };
            }
            else if (notification.filters.orderHistory === 'frequent-buyers') {
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const frequentBuyers = await Order.aggregate([
                    { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'completed' } },
                    { $group: { _id: '$userId', count: { $sum: 1 } } },
                    { $match: { count: { $gte: 5 } } }
                ]);
                const frequentBuyerIds = frequentBuyers.map((u) => u._id);
                if (query._id) {
                    query._id = { $in: query._id.$in.filter((id) => frequentBuyerIds.includes(id)) };
                }
                else {
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
            fcmToken: { $exists: true, $ne: null },
            $and: [{ fcmToken: { $ne: '' } }]
        }).select('fcmToken');
    }
    else {
        recipients = await User.find({
            ...query,
            fcmToken: { $exists: true, $ne: null },
            $and: [{ fcmToken: { $ne: '' } }]
        }).select('fcmToken');
    }
    return recipients;
};
// Process scheduled notification
const processScheduledNotification = async (notification) => {
    try {
        console.log(`📤 Processing scheduled notification: ${notification.title}`);
        // Get recipients
        const recipients = await getRecipients(notification);
        const tokens = recipients.map((r) => r.fcmToken).filter((t) => t);
        if (tokens.length === 0) {
            notification.status = 'failed';
            notification.failedCount = 0;
            await notification.save();
            console.log(`❌ No valid recipients for notification: ${notification.title}`);
            return;
        }
        // Prepare notification data
        const data = {
            notificationId: notification._id.toString()
        };
        if (notification.deepLink) {
            data.deepLink = notification.deepLink;
        }
        if (notification.actionButton) {
            data.actionButton = JSON.stringify(notification.actionButton);
        }
        // Send in batches
        const result = await (0, pushNotification_service_1.sendBatchNotifications)(tokens, notification.title, notification.message, data, notification.image);
        // Update notification stats
        notification.status = 'sent';
        notification.totalRecipients = tokens.length;
        notification.sentCount = result.totalSuccess;
        notification.failedCount = result.totalFailure;
        notification.sentAt = new Date();
        await notification.save();
        console.log(`✅ Notification sent successfully: ${notification.title}`);
        console.log(`   Recipients: ${result.totalSuccess}/${tokens.length}`);
    }
    catch (error) {
        console.error(`❌ Error processing scheduled notification:`, error);
        notification.status = 'failed';
        await notification.save();
    }
};
// Initialize notification scheduler
const initializeNotificationScheduler = () => {
    console.log('🔔 Starting notification scheduler...');
    // Run every minute to check for scheduled notifications
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Find all scheduled notifications that are due
            const dueNotifications = await PushNotification_model_1.default.find({
                status: 'scheduled',
                scheduledAt: { $lte: now }
            });
            if (dueNotifications.length > 0) {
                console.log(`⏰ Found ${dueNotifications.length} scheduled notification(s) to send`);
            }
            // Process each notification
            for (const notification of dueNotifications) {
                await processScheduledNotification(notification);
            }
        }
        catch (error) {
            console.error('❌ Error in notification scheduler:', error);
        }
    });
    console.log('✅ Notification scheduler initialized');
    console.log('   Checking for scheduled notifications every minute...');
};
exports.initializeNotificationScheduler = initializeNotificationScheduler;
exports.default = {
    initializeNotificationScheduler: exports.initializeNotificationScheduler
};
//# sourceMappingURL=notificationScheduler.js.map