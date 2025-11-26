import admin from 'firebase-admin';
import UserSchema from '../models/User';
import UserNotification from '../models/Notification';
import logger from '../utils/logger';

// Initialize Firebase Admin SDK
// You'll need to add your service account credentials
// Download from Firebase Console > Project Settings > Service Accounts
const serviceAccount = require('../../config/firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

interface FCMToken {
    token: string;
    deviceId: string;
    platform: 'ios' | 'android';
    addedAt: Date;
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
    groupKey?: string;
    typeId?: any;
}

interface SendResult {
    success: boolean;
    messageId?: string;
    token?: string;
    error?: string;
    shouldRemove?: boolean;
}

interface BulkSendResult {
    successCount: number;
    failureCount: number;
    results: admin.messaging.BatchResponse;
}

class MobilePushNotificationService {
    /**
     * Send push notification to user's mobile devices
     */
    static async sendPushNotification(
        notification: NotificationData,
        userId: string,
        accountType: string = 'user'
    ): Promise<any> {
        try {
            const user = await UserSchema.findById(userId).lean();

            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }

            // Check notification preferences
            if (!user.notification_pref?.push_notification) {
                logger.info(`Push notifications disabled for user: ${userId}`);
                return { skipped: true, reason: 'Push notifications disabled' };
            }

            // Get FCM tokens
            const fcmTokens = user.fcmTokens || [];

            if (fcmTokens.length === 0) {
                logger.info(`No FCM tokens found for user: ${userId}`);
                return { skipped: true, reason: 'No FCM tokens' };
            }

            // Build notification payload
            const payload = this._buildFCMPayload(notification);

            // Send to all user devices
            const tokens = fcmTokens.map((t: FCMToken) => t.token);
            const result = await this._sendMulticast(tokens, payload, notification._id);

            // Process results and clean up invalid tokens
            await this._processResults(result, fcmTokens, userId);

            return result;

        } catch (error) {
            logger.error('Mobile push notification error:', error);
            await this._updateNotificationStatus(notification._id, 'failed', (error as Error).message);
            throw error;
        }
    }

    /**
     * Build FCM notification payload
     */
    static _buildFCMPayload(notification: NotificationData): admin.messaging.MulticastMessage['notification'] & { data: any } {
        return {
            notification: {
                title: notification.title || "",
                body: notification.body || "",
                imageUrl: notification.image
            },
            data: {
                notificationId: notification._id,
                type: notification.type || 'general',
                clickUrl: notification.clickUrl || '/',
                icon: notification.icon || '',
                groupKey: notification.groupKey || '',
                typeId: JSON.stringify(notification.typeId || {}),
                timestamp: new Date().toISOString(),
                ...(notification.data || {})
            },
            android: {
                priority: notification.priority === 'urgent' ? 'high' : 'normal',
                notification: {
                    icon: notification.icon || 'ic_notification',
                    color: '#8B5CF6',
                    sound: notification.silent ? undefined : 'default',
                    channelId: notification.type || 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    tag: notification.groupKey || `notification-${notification._id}`
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: notification.title,
                            body: notification.body
                        },
                        sound: notification.silent ? undefined : 'default',
                        badge: 1,
                        'mutable-content': 1,
                        'content-available': 1
                    }
                },
                fcmOptions: {
                    imageUrl: notification.image
                }
            }
        };
    }

    /**
     * Send to multiple devices (multicast)
     */
    static async _sendMulticast(
        tokens: string[],
        payload: any,
        notificationId: string
    ): Promise<admin.messaging.BatchResponse> {
        try {
            const message: admin.messaging.MulticastMessage = {
                tokens: tokens,
                ...payload
            };

            const response = await admin.messaging().sendMulticast(message);

            // Update notification status
            if (response.successCount > 0) {
                await this._updateNotificationStatus(notificationId, 'sent', null, 'push');
            }

            logger.info(`FCM multicast result: ${response.successCount} success, ${response.failureCount} failures`);

            return response;

        } catch (error: any) {
            logger.error('FCM multicast error:', error);
            throw error;
        }
    }

    /**
     * Process batch send results and remove invalid tokens
     */
    static async _processResults(
        result: admin.messaging.BatchResponse,
        tokens: FCMToken[],
        userId: string
    ): Promise<void> {
        try {
            const tokensToRemove: string[] = [];

            result.responses.forEach((response, index) => {
                if (!response.success) {
                    const error = response.error;
                    const token = tokens[index];

                    // Check for errors that require token removal
                    if (
                        error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/registration-token-not-registered' ||
                        error?.code === 'messaging/invalid-argument'
                    ) {
                        logger.warn(`Removing invalid FCM token: ${error.code}`);
                        tokensToRemove.push(token.token);
                    }
                }
            });

            // Remove invalid tokens
            if (tokensToRemove.length > 0) {
                await this._removeInvalidTokens(userId, tokensToRemove);
            }

        } catch (error) {
            logger.error('Error processing FCM results:', error);
        }
    }

    /**
     * Remove invalid FCM tokens
     */
    static async _removeInvalidTokens(userId: string, tokens: string[]): Promise<void> {
        try {
            await UserSchema.updateOne(
                { _id: userId },
                {
                    $pull: {
                        fcmTokens: { token: { $in: tokens } }
                    }
                }
            );

            logger.info(`Removed ${tokens.length} invalid FCM tokens for user: ${userId}`);

        } catch (error) {
            logger.error('Error removing FCM tokens:', error);
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
     * Register FCM token for user
     */
    static async registerToken(
        userId: string,
        token: string,
        deviceId: string,
        platform: 'ios' | 'android'
    ): Promise<{ success: boolean }> {
        try {
            // Verify token with FCM first
            try {
                await admin.messaging().send({
                    token,
                    data: { test: 'true' }
                }, true); // dry run
            } catch (error: any) {
                logger.error('Invalid FCM token:', error.code);
                throw new Error('Invalid FCM token');
            }

            // Check if token already exists
            const user = await UserSchema.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const existingTokenIndex = user.fcmTokens?.findIndex(
                (t: FCMToken) => t.deviceId === deviceId
            );

            if (existingTokenIndex !== undefined && existingTokenIndex >= 0) {
                // Update existing token
                await UserSchema.updateOne(
                    { _id: userId, 'fcmTokens.deviceId': deviceId },
                    {
                        $set: {
                            'fcmTokens.$.token': token,
                            'fcmTokens.$.platform': platform,
                            'fcmTokens.$.addedAt': new Date()
                        }
                    }
                );
            } else {
                // Add new token
                await UserSchema.updateOne(
                    { _id: userId },
                    {
                        $push: {
                            fcmTokens: {
                                token,
                                deviceId,
                                platform,
                                addedAt: new Date()
                            }
                        }
                    }
                );
            }

            // Enable push notifications
            await UserSchema.updateOne(
                { _id: userId },
                { $set: { 'notification_pref.push_notification': true } }
            );

            logger.info(`FCM token registered for user ${userId}, device: ${deviceId}`);
            return { success: true };

        } catch (error) {
            logger.error('FCM token registration error:', error);
            throw error;
        }
    }

    /**
     * Unregister FCM token
     */
    static async unregisterToken(
        userId: string,
        deviceId: string
    ): Promise<{ success: boolean }> {
        try {
            await UserSchema.updateOne(
                { _id: userId },
                {
                    $pull: {
                        fcmTokens: { deviceId }
                    }
                }
            );

            logger.info(`FCM token unregistered for user ${userId}, device: ${deviceId}`);
            return { success: true };

        } catch (error) {
            logger.error('FCM token unregistration error:', error);
            throw error;
        }
    }

    /**
     * Send to topic (for broadcast notifications)
     */
    static async sendToTopic(
        topic: string,
        notification: NotificationData
    ): Promise<string> {
        try {
            const payload = this._buildFCMPayload(notification);

            const message: admin.messaging.Message = {
                topic,
                ...payload
            };

            const messageId = await admin.messaging().send(message);
            logger.info(`Message sent to topic ${topic}: ${messageId}`);

            return messageId;

        } catch (error) {
            logger.error('FCM topic send error:', error);
            throw error;
        }
    }

    /**
     * Subscribe user to topic
     */
    static async subscribeToTopic(
        tokens: string[],
        topic: string
    ): Promise<void> {
        try {
            await admin.messaging().subscribeToTopic(tokens, topic);
            logger.info(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
        } catch (error) {
            logger.error('Topic subscription error:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe user from topic
     */
    static async unsubscribeFromTopic(
        tokens: string[],
        topic: string
    ): Promise<void> {
        try {
            await admin.messaging().unsubscribeFromTopic(tokens, topic);
            logger.info(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
        } catch (error) {
            logger.error('Topic unsubscription error:', error);
            throw error;
        }
    }

    /**
     * Send bulk notifications efficiently
     */
    static async sendBulkNotifications(
        notifications: Array<{
            notification: NotificationData;
            userId: string;
        }>
    ): Promise<{ total: number; successful: number; failed: number }> {
        const results = await Promise.allSettled(
            notifications.map(({ notification, userId }) =>
                this.sendPushNotification(notification, userId)
            )
        );

        return {
            total: results.length,
            successful: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length
        };
    }

    /**
     * Send silent data message (for background updates)
     */
    static async sendDataMessage(
        userId: string,
        data: Record<string, string>
    ): Promise<void> {
        try {
            const user = await UserSchema.findById(userId).lean();
            if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
                return;
            }

            const tokens = user.fcmTokens.map((t: FCMToken) => t.token);

            await admin.messaging().sendMulticast({
                tokens,
                data,
                android: {
                    priority: 'normal'
                },
                apns: {
                    headers: {
                        'apns-priority': '5',
                        'apns-push-type': 'background'
                    },
                    payload: {
                        aps: {
                            'content-available': 1
                        }
                    }
                }
            });

            logger.info(`Data message sent to user: ${userId}`);

        } catch (error) {
            logger.error('Data message error:', error);
        }
    }

    /**
     * Get user's registered devices
     */
    static async getUserDevices(userId: string): Promise<FCMToken[]> {
        try {
            const user = await UserSchema.findById(userId).select('fcmTokens').lean();
            return user?.fcmTokens || [];
        } catch (error) {
            logger.error('Error getting user devices:', error);
            return [];
        }
    }
}

export default MobilePushNotificationService;