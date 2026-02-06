"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeNotificationCronJobs = initializeNotificationCronJobs;
exports.stopNotificationCronJobs = stopNotificationCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const notification_1 = __importDefault(require("../../controllers/others/notification"));
// import PushNotificationService from '../pushNotificationService';
// import SocketSession from '../../models/Auth/userSession';
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Initialize all notification-related cron jobs
 */
function initializeNotificationCronJobs() {
    /**
     * Process scheduled notifications
     * Runs every minute
     */
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await notification_1.default.processScheduledNotifications();
        }
        catch (error) {
            logger_1.default.error('Scheduled notifications cron error:', error);
        }
    });
    /**
     * Clean up old notifications
     * Runs daily at 2 AM
     */
    node_cron_1.default.schedule('0 2 * * *', async () => {
        try {
            await notification_1.default.cleanupOldNotifications();
        }
        catch (error) {
            logger_1.default.error('Cleanup cron error:', error);
        }
    });
    /**
     * Send digest notifications (daily summary)
     * Runs daily at 6 PM
     */
    node_cron_1.default.schedule('0 18 * * *', async () => {
        try {
            await sendDailyDigest();
        }
        catch (error) {
            logger_1.default.error('Daily digest cron error:', error);
        }
    });
    //  Clean up expired notifications
    //  Runs every hour
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const UserNotification = require('../models/user/notification');
            const result = await UserNotification.deleteMany({
                expiresAt: { $lt: new Date() },
                unread: 0
            });
            if (result.deletedCount > 0) {
                logger_1.default.info(`Deleted ${result.deletedCount} expired notifications`);
            }
        }
        catch (error) {
            logger_1.default.error('Expired notifications cleanup error:', error);
        }
    });
    logger_1.default.info('✅ Notification cron jobs initialized');
}
// daily digest sender
async function sendDailyDigest() {
    try {
        const UserNotification = require('../models/user/notification');
        const UserSchema = require('../models/Auth/userModel');
        const usersWithUnread = await UserNotification.aggregate([
            {
                $match: {
                    unread: 1,
                    createdAt: {
                        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                    }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 }
                }
            },
            {
                $match: {
                    count: { $gte: 3 } // At least 3 unread notifications
                }
            }
        ]);
        logger_1.default.info(`Sending daily digest to ${usersWithUnread.length} users`);
        for (const { _id: userId, count } of usersWithUnread) {
            const user = await UserSchema.findById(userId)
                .select('notification_pref email firstName')
                .lean();
            if (!user?.notification_pref?.email_notification) {
                continue;
            }
            await notification_1.default.saveAndSendNotification({
                userId,
                title: 'Daily Summary',
                body: `You have ${count} unread notifications from today`,
                type: 'system',
                priority: 'low',
                silent: true
            }, 'user', {
                skipPush: true,
                sendEmail: true
            });
        }
        logger_1.default.info('Daily digest sent successfully');
    }
    catch (error) {
        logger_1.default.error('Send daily digest error:', error);
    }
}
// shutdown
function stopNotificationCronJobs() {
    node_cron_1.default.getTasks().forEach(task => task.stop());
    logger_1.default.info('Notification cron jobs stopped');
}
//# sourceMappingURL=hotificationCron.js.map