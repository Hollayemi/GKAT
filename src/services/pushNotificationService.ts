import webpush from 'web-push';
import UserSchema from '../models/User';
import BranchSchema from '../models/businesses/store_details';
import UserNotification from '../models/user/notification';
import logger from '../utils/logger';

interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface NotificationData {
    _id: string;
    title?: string;
    body?: string;
    type?: string;
    icon?: string;
    image?: string;
    clickUrl?: string;
    priority?: string;
    silent?: boolean;
    data?: Record<string, any>;
    actions?: Array<{ action: string; title: string }>;
    groupKey?: string;
}

interface SendResult {
    success: boolean;
    statusCode?: number;
    subscription?: PushSubscription;
    error?: string;
    shouldRemove?: boolean;
    shouldRetry?: boolean;
}

interface BulkSendResult {
    total: number;
    successful: number;
    failed: number;
}

class PushNotificationService {
    /**
     * Send push notification with retry logic and error handling
     */
    static async sendPushNotification(
        notification: NotificationData,
        userId: string,
        accountType: string = 'user'
    ): Promise<any> {
        try {
            const account = accountType === 'user'
                ? await UserSchema.findById(userId).lean()
                : await BranchSchema.findOne({ branchId: userId });

            if (!account) {
                throw new Error(`Account not found: ${userId}`);
            }

            // Check notification preferences
            if (!account.notification_pref?.push_notification) {
                logger.info(`Push notifications disabled for user: ${userId}`);
                return { skipped: true, reason: 'Push notifications disabled' };
            }

            if (!account.push_subscription || Object.keys(account.push_subscription).length === 0) {
                logger.info(`No push subscriptions found for user: ${userId}`);
                return { skipped: true, reason: 'No subscriptions' };
            }

            const payload = this._buildPayload(notification);
            const subscriptions = Object.values(account.push_subscription) as PushSubscription[];

            const results = await Promise.allSettled(
                subscriptions.map(subscription =>
                    this._sendToSubscription(subscription, payload, notification._id)
                )
            );

            return this._processResults(results, notification._id);

        } catch (error) {
            logger.error('Push notification error:', error);
            await this._updateNotificationStatus(notification._id, 'failed', (error as Error).message);
            throw error;
        }
    }

    /**
     * Send to single subscription with error handling
     */
    static async _sendToSubscription(
        subscription: PushSubscription,
        payload: any,
        notificationId: string
    ): Promise<SendResult> {
        try {
            const response = await webpush.sendNotification(
                subscription,
                JSON.stringify(payload),
                {
                    TTL: 3600, // 1 hour
                    urgency: payload.priority === 'urgent' ? 'high' : 'normal'
                }
            );

            // Update notification delivery status
            await this._updateNotificationStatus(notificationId, 'sent', null, 'push');

            return {
                success: true,
                statusCode: response.statusCode,
                subscription
            };

        } catch (error: any) {
            // Handle different error types
            if (error.statusCode === 410 || error.statusCode === 404) {
                // Subscription expired or not found - remove it
                logger.warn(`Removing expired subscription: ${error.statusCode}`);
                await this._removeExpiredSubscription(subscription);
                return {
                    success: false,
                    error: 'Subscription expired',
                    shouldRemove: true
                };
            }

            if (error.statusCode === 429) {
                // Rate limited - schedule retry
                logger.warn('Push notification rate limited');
                await this._scheduleRetry(notificationId, subscription);
                return {
                    success: false,
                    error: 'Rate limited',
                    shouldRetry: true
                };
            }

            logger.error('Push send error:', error);
            return {
                success: false,
                error: error.message,
                statusCode: error.statusCode
            };
        }
    }

    /**
     * Build notification payload
     */
    static _buildPayload(notification: NotificationData): any {
        return {
            title: notification.title || "",
            body: notification.body || "",
            icon: notification.icon || "",
            badge: '/icons/badge.png',
            image: notification.image,
            data: {
                notificationId: notification._id,
                type: notification.type,
                url: notification.clickUrl || '/',
                timestamp: new Date().toISOString(),
                ...notification.data
            },
            actions: notification.actions || [
                { action: 'view', title: 'View' },
                { action: 'dismiss', title: 'Dismiss' }
            ],
            requireInteraction: notification.priority === 'urgent',
            silent: notification.silent || false,
            vibrate: notification.silent ? undefined : [200, 100, 200],
            tag: notification.groupKey || `notification-${notification._id}`,
            renotify: true,
            timestamp: Date.now()
        };
    }

    /**
     * Process batch send results
     */
    static _processResults(results: PromiseSettledResult<SendResult>[], notificationId: string): any {
        const summary = {
            total: results.length,
            sent: 0,
            failed: 0,
            expired: 0,
            errors: [] as Array<{ index: number; error: string }>
        };

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                summary.sent++;
            } else {
                summary.failed++;

                if (result.status === 'fulfilled' && result.value.shouldRemove) {
                    summary.expired++;
                }

                summary.errors.push({
                    index,
                    error: result.status === 'rejected' ? result.reason?.message : result.value?.error || 'Unknown error'
                });
            }
        });

        logger.info(`Push notification results for ${notificationId}:`, summary);
        return summary;
    }

    /**
     * Remove expired subscription
     */
    static async _removeExpiredSubscription(subscription: PushSubscription): Promise<void> {
        try {
            // Find user with this subscription
            const user = await UserSchema.findOne({
                'push_subscription': { $exists: true }
            });

            if (user) {
                // Remove the specific subscription
                const updatedSubscriptions: Record<string, PushSubscription> = {};
                for (const [key, value] of Object.entries(user.push_subscription)) {
                    if (JSON.stringify(value) !== JSON.stringify(subscription)) {
                        updatedSubscriptions[key] = value as PushSubscription;
                    }
                }

                console.log(updatedSubscriptions);

                await UserSchema.updateOne(
                    { _id: user._id },
                    { $set: { push_subscription: updatedSubscriptions } }
                );

                logger.info(`Removed expired subscription for user: ${user._id}`);
            }
        } catch (error) {
            logger.error('Error removing subscription:', error);
        }
    }

    /**
     * Schedule retry for failed notification
     */
    static async _scheduleRetry(notificationId: string, subscription: PushSubscription): Promise<void> {
        try {
            const notification = await UserNotification.findById(notificationId);

            if (!notification) return;

            // Max 3 retries
            if (notification.retryCount >= 3) {
                await this._updateNotificationStatus(notificationId, 'failed', 'Max retries exceeded');
                return;
            }

            // Exponential backoff: 1min, 5min, 15min
            const delays = [60, 300, 900];
            const delay = delays[notification.retryCount] || 900;

            // Store retry job in Redis (commented out as Redis client is not available)
            // await redis.zadd(
            //     'notification:retry',
            //     Date.now() + (delay * 1000),
            //     JSON.stringify({
            //         notificationId,
            //         subscription,
            //         retryCount: notification.retryCount + 1
            //     })
            // );

            await UserNotification.updateOne(
                { _id: notificationId },
                {
                    $inc: { retryCount: 1 },
                    $set: { lastRetryAt: new Date() }
                }
            );

            logger.info(`Scheduled retry for notification: ${notificationId} in ${delay}s`);

        } catch (error) {
            logger.error('Error scheduling retry:', error);
        }
    }

    /**
     * Update notification delivery status
     */
    static async _updateNotificationStatus(
        notificationId: string,
        status: string,
        error: string | null = null,
        channel: string = 'push'
    ): Promise<void> {
        try {
            const update: any = {
                status,
                [`delivery.${channel}.sent`]: status === 'sent' || status === 'delivered',
                [`delivery.${channel}.sentAt`]: status === 'sent' ? new Date() : undefined,
                [`delivery.${channel}.delivered`]: status === 'delivered',
                [`delivery.${channel}.deliveredAt`]: status === 'delivered' ? new Date() : undefined,
                [`delivery.${channel}.failed`]: status === 'failed',
                [`delivery.${channel}.failedAt`]: status === 'failed' ? new Date() : undefined,
                [`delivery.${channel}.error`]: error
            };

            // Remove undefined values
            Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

            await UserNotification.updateOne(
                { _id: notificationId },
                { $set: update }
            );
        } catch (err) {
            logger.error('Error updating notification status:', err);
        }
    }

    /**
     * Process retry queue (should be run by a cron job)
     */
    static async processRetryQueue(): Promise<void> {
        try {
            const now = Date.now();

            // Get notifications ready for retry (commented out as Redis client is not available)
            // const retries = await redis.zrangebyscore(
            //     'notification:retry',
            //     0,
            //     now,
            //     'LIMIT', 0, 100
            // );

            const retries: any[] = []; // Placeholder

            for (const retryData of retries) {
                const { notificationId, subscription } = JSON.parse(retryData);

                const notification = await UserNotification.findById(notificationId);
                if (notification) {
                    const payload = this._buildPayload(notification);
                    await this._sendToSubscription(subscription, payload, notificationId);
                }

                // Remove from retry queue (commented out as Redis client is not available)
                // await redis.zrem('notification:retry', retryData);
            }

            if (retries.length > 0) {
                logger.info(`Processed ${retries.length} notification retries`);
            }

        } catch (error) {
            logger.error('Error processing retry queue:', error);
        }
    }

    /**
     * Send bulk notifications efficiently
     */
    static async sendBulkNotifications(notifications: Array<{
        notification: NotificationData;
        userId: string;
        accountType: string;
    }>): Promise<BulkSendResult> {
        const results = await Promise.allSettled(
            notifications.map(({ notification, userId, accountType }) =>
                this.sendPushNotification(notification, userId, accountType)
            )
        );

        return {
            total: results.length,
            successful: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length
        };
    }

    /**
     * Subscribe user to push notifications
     */
    static async subscribe(
        userId: string,
        subscription: PushSubscription,
        deviceId: string,
        accountType: string = 'user'
    ): Promise<{ success: boolean }> {
        try {
            const AccountModel = accountType === 'user' ? UserSchema : BranchSchema;
            const filter = accountType === 'user' ? { _id: userId } : { branchId: userId };

            await AccountModel.updateOne(
                filter,
                {
                    $set: {
                        [`push_subscription.${deviceId}`]: subscription,
                        'notification_pref.push_notification': true
                    }
                }
            );

            logger.info(`User ${userId} subscribed to push notifications (${deviceId})`);
            return { success: true };

        } catch (error) {
            logger.error('Subscription error:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe user from push notifications
     */
    static async unsubscribe(
        userId: string,
        deviceId: string,
        accountType: string = 'user'
    ): Promise<{ success: boolean }> {
        try {
            const AccountModel = accountType === 'user' ? UserSchema : BranchSchema;
            const filter = accountType === 'user' ? { _id: userId } : { branchId: userId };

            await AccountModel.updateOne(
                filter,
                { $unset: { [`push_subscription.${deviceId}`]: "" } }
            );

            logger.info(`User ${userId} unsubscribed from push notifications (${deviceId})`);
            return { success: true };

        } catch (error) {
            logger.error('Unsubscription error:', error);
            throw error;
        }
    }
}

export default PushNotificationService;