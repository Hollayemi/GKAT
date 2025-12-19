"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Notification_1 = __importDefault(require("../../models/Notification"));
// import BusinessNotification from '../../models/businesses/notification';
// import SocketSession from '../../models/Auth/userSession';
const logger_1 = __importDefault(require("../../utils/logger"));
class NotificationController {
    static async saveAndSendNotification(data, accountType = 'user', options = {}) {
        try {
            const NotificationModel = Notification_1.default;
            const notification = await NotificationModel.create({
                ...data,
                status: 'pending',
                scheduledAt: options.scheduledAt || undefined,
                priority: options.priority || 'medium',
                expiresAt: options.expiresAt || undefined,
                silent: options.silent || false
            });
            logger_1.default.info(`Notification created: ${notification._id}`);
            if (options.scheduledAt && new Date(options.scheduledAt) > new Date()) {
                logger_1.default.info(`Notification scheduled for: ${options.scheduledAt}`);
                return notification;
            }
            await this.sendNotification(notification, accountType, options);
            return notification;
        }
        catch (error) {
            logger_1.default.error('Error saving notification:', error);
            throw error;
        }
    }
    static async sendNotification(notification, accountType = 'user', options = {}) {
        const userId = accountType === 'user' ? notification.userId : notification.branchId;
        if (!options.skipInApp) {
            await this.sendInAppNotification(notification, userId, accountType);
        }
        if (options.push_notification) {
            await this.sendPushNotification(notification, userId, accountType);
        }
        if (options.email_notification) {
            await this.sendEmailNotification(notification, userId, accountType);
        }
        return notification;
    }
    //  Send in-app notification via Socket.IO
    static async sendInAppNotification(notification, userId, accountType = 'user') {
        try {
            const io = getSocketIo().myIo;
            // const sessions = await SocketSession.find({ accountId: userId });
            // if (sessions.length === 0) {
            //     logger.info(`User ${userId} not connected - notification saved for later`);
            //     return;
            // }
            const filter = accountType === 'user'
                ? { userId }
                : { store: notification.store, branch: notification.branch };
            const notifications = await NotificationController.getNotificationList(filter, accountType);
            // sessions.forEach(session => {
            //     io.to(session.socketId).emit('notification:new', {
            //         notification: this._formatNotification(notification),
            //         unreadCount: notifications.unreadCount
            //     });
            // });
            await Notification_1.default.updateOne({ _id: notification._id }, {
                $set: {
                    'delivery.inApp.sent': true,
                    'delivery.inApp.sentAt': new Date(),
                    status: 'delivered'
                }
            });
            logger_1.default.info(`In-app notification sent to devices for user ${userId}`);
        }
        catch (error) {
            logger_1.default.error('In-app notification error:', error);
        }
    }
    // Send push notification
    static async sendPushNotification(notification, userId, accountType = 'user') {
        try {
            //    FCM push notification logic here
            // logger.info(`Push notification result for ${userId}:`, result);
            return null;
        }
        catch (error) {
            logger_1.default.error('Push notification error:', error);
            // Don't throw - notification already saved
        }
    }
    //  Send email notification
    static async sendEmailNotification(notification, userId, accountType = 'user') {
        try {
            const EmailService = require('../../services/emailService');
            await EmailService.singleEmail({
                userId,
                notification
            });
            await Notification_1.default.updateOne({ _id: notification._id }, {
                $set: {
                    'delivery.email.sent': true,
                    'delivery.email.sentAt': new Date()
                }
            });
        }
        catch (error) {
            logger_1.default.error('Email notification error:', error);
        }
    }
    static async getNotificationList(filter, accountType = 'user', options = {}) {
        const { page = 1, limit = 20, type = null, unreadOnly = false } = options;
        const NotificationModel = Notification_1.default;
        const query = {
            ...filter,
            archived: false,
            deletedAt: null
        };
        if (type)
            query.type = type;
        if (unreadOnly)
            query.unread = 1;
        const skip = (page - 1) * limit;
        const [notifications, total, unreadCount] = await Promise.all([
            NotificationModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            NotificationModel.countDocuments(query),
            NotificationModel.countDocuments({ ...filter, unread: 1, archived: false })
        ]);
        const grouped = this._groupByTimePeriod(notifications);
        return {
            notifications: grouped,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            unreadCount
        };
    }
    //    Group notifications by time period
    static _groupByTimePeriod(notifications) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const groups = {
            today: [],
            yesterday: [],
            thisWeek: [],
            earlier: []
        };
        notifications.forEach(notification => {
            const createdAt = new Date(notification.createdAt);
            if (createdAt >= today) {
                groups.today.push(notification);
            }
            else if (createdAt >= yesterday) {
                groups.yesterday.push(notification);
            }
            else if (createdAt >= weekAgo) {
                groups.thisWeek.push(notification);
            }
            else {
                groups.earlier.push(notification);
            }
        });
        return [
            { label: 'Today', notifications: groups.today },
            { label: 'Yesterday', notifications: groups.yesterday },
            { label: 'This Week', notifications: groups.thisWeek },
            { label: 'Earlier', notifications: groups.earlier }
        ].filter(group => group.notifications.length > 0);
    }
    // Format notification for client
    static _formatNotification(notification) {
        return {
            id: notification._id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            icon: notification.icon,
            image: notification.image,
            unread: notification.unread === 1,
            priority: notification.priority,
            createdAt: notification.createdAt,
            typeId: notification.typeId,
            actions: notification.actions,
            clickUrl: notification.clickUrl
        };
    }
    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification_1.default.findOne({
                _id: notificationId,
                userId
            });
            if (!notification) {
                throw new Error('Notification not found');
            }
            await notification.markAsRead();
            await this._emitNotificationUpdate(userId);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('Mark as read error:', error);
            throw error;
        }
    }
    static async markAllAsRead(userId, accountType = 'user') {
        try {
            const NotificationModel = Notification_1.default;
            await NotificationModel.markAllAsRead(userId);
            await this._emitNotificationUpdate(userId);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('Mark all as read error:', error);
            throw error;
        }
    }
    // Delete notification
    static async deleteNotification(notificationId, userId) {
        try {
            await Notification_1.default.updateOne({ _id: notificationId, userId }, {
                $set: {
                    archived: true,
                    deletedAt: new Date()
                }
            });
            await this._emitNotificationUpdate(userId);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('Delete notification error:', error);
            throw error;
        }
    }
    //    Get unread count
    static async getUnreadCount(userId, accountType = 'user') {
        try {
            const NotificationModel = Notification_1.default;
            const count = await NotificationModel.getUnreadCount(userId);
            return { count };
        }
        catch (error) {
            logger_1.default.error('Get unread count error:', error);
            throw error;
        }
    }
    //  Track notification click
    static async trackClick(notificationId, userId) {
        try {
            const notification = await Notification_1.default.findOne({
                _id: notificationId,
                userId
            });
            if (notification) {
                await notification.trackClick();
                if (notification.unread === 1) {
                    await notification.markAsRead();
                }
                await this._emitNotificationUpdate(userId);
            }
            return { success: true };
        }
        catch (error) {
            logger_1.default.error('Track click error:', error);
            throw error;
        }
    }
    //Emit notification update via Socket.IO
    static async _emitNotificationUpdate(userId) {
        try {
            // const io = getSocketIo();
            // const sessions = await SocketSession.find({ accountId: userId });
            // const unreadCount = await UserNotification.getUnreadCount(userId);
            // sessions.forEach(session => {
            //     io.to(session.socketId).emit('notification:update', { unreadCount });
            // });
        }
        catch (error) {
            logger_1.default.error('Emit update error:', error);
        }
    }
    //    Subscribe to push notifications
    static async subscribe(req, res) {
        try {
            const { subscription, deviceId } = req.body;
            const userId = req.user._id;
            const accountType = req.user.store ? "store" : 'user';
            if (!subscription || !deviceId) {
                return res.status(400).json({ error: 'Subscription and deviceId required' });
            }
            return res.status(200).json({ message: 'Subscribed successfully' });
        }
        catch (error) {
            logger_1.default.error('Subscribe error:', error);
            return res.status(500).json({ error: 'Subscription failed' });
        }
    }
    //   Unsubscribe from push notifications
    static async unsubscribe(req, res) {
        try {
            const { deviceId } = req.body;
            const userId = req.user._id;
            const accountType = req.user.userType || 'user';
            if (!deviceId) {
                return res.status(400).json({ error: 'DeviceId required' });
            }
            return res.status(200).json({ message: 'Unsubscribed successfully' });
        }
        catch (error) {
            logger_1.default.error('Unsubscribe error:', error);
            return res.status(500).json({ error: 'Unsubscription failed' });
        }
    }
    // Get notification preferences
    static async getPreferences(req, res) {
        try {
            const UserSchema = require('../models/Auth/userModel');
            const user = await UserSchema.findById(req.user._id)
                .select('notification_pref')
                .lean();
            return res.status(200).json(user.notification_pref || {});
        }
        catch (error) {
            logger_1.default.error('Get preferences error:', error);
            return res.status(500).json({ error: 'Failed to get preferences' });
        }
    }
    //    Update notification preferences
    static async updatePreferences(req, res) {
        try {
            const { push_notification, in_app_notification, email_notification, notification_sound, order_updates, promotions, system_updates } = req.body;
            const UserSchema = require('../models/Auth/userModel');
            await UserSchema.updateOne({ _id: req.user._id }, {
                $set: {
                    'notification_pref.push_notification': push_notification,
                    'notification_pref.in_app_notification': in_app_notification,
                    'notification_pref.email_notification': email_notification,
                    'notification_pref.notification_sound': notification_sound,
                    'notification_pref.order_updates': order_updates,
                    'notification_pref.promotions': promotions,
                    'notification_pref.system_updates': system_updates
                }
            });
            return res.status(200).json({ message: 'Preferences updated' });
        }
        catch (error) {
            logger_1.default.error('Update preferences error:', error);
            return res.status(500).json({ error: 'Failed to update preferences' });
        }
    }
    //  Get notifications (REST endpoint)
    static async getNotifications(req, res) {
        try {
            const userId = req.user._id;
            const accountType = req.user.store ? "store" : 'user';
            const { page, limit, type, unreadOnly } = req.query;
            const filter = accountType === 'user'
                ? { userId }
                : { store: req.user.store, branch: req.user.branch };
            const result = await NotificationController.getNotificationList(filter, accountType, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                type: type,
                unreadOnly: unreadOnly === 'true'
            });
            return res.status(200).json(result);
        }
        catch (error) {
            logger_1.default.error('Get notifications error:', error);
            return res.status(500).json({ error: 'Failed to get notifications' });
        }
    }
    // 
    //  Process scheduled notifications (run by cron)
    static async processScheduledNotifications() {
        try {
            const now = new Date();
            const notifications = await Notification_1.default.find({
                status: 'pending',
                scheduledAt: { $lte: now }
            }).limit(100);
            logger_1.default.info(`Processing ${notifications.length} scheduled notifications`);
            for (const notification of notifications) {
                await this.sendNotification(notification, 'user');
            }
        }
        catch (error) {
            logger_1.default.error('Process scheduled notifications error:', error);
        }
    }
    // Clean up old notifications (run by cron)
    static async cleanupOldNotifications() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const result = await Notification_1.default.deleteMany({
                unread: 0,
                createdAt: { $lt: thirtyDaysAgo }
            });
            logger_1.default.info(`Cleaned up ${result.deletedCount} old notifications`);
        }
        catch (error) {
            logger_1.default.error('Cleanup notifications error:', error);
        }
    }
    //  Send test notification (for testing purposes)
    static async sendTestNotification(req, res) {
        try {
            const notification = await this.saveAndSendNotification({
                userId: "681a578d7892bde7a4663d28",
                title: 'Test Notification',
                body: 'This is a test notification to verify your settings',
                type: 'system',
                icon: "",
                priority: 'medium'
            }, 'user');
            return res.status(200).json({
                message: 'Test notification sent',
                notificationId: notification._id
            });
        }
        catch (error) {
            logger_1.default.error('Send test notification error:', error);
            return res.status(500).json({ error: 'Failed to send test notification' });
        }
    }
}
function getSocketIo() {
    return require('../../server');
}
exports.default = NotificationController;
//# sourceMappingURL=notification.js.map