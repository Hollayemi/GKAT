import { Request, Response } from 'express';
import { ITypeId } from '../../models/Notification';
interface NotificationData {
    userId?: string;
    branchId?: string;
    store?: string;
    branch?: string;
    title: string;
    body: string;
    type: string;
    icon?: string;
    image?: string;
    clickUrl?: string;
    priority?: string;
    silent?: boolean;
    data?: Record<string, any>;
    actions?: Array<{
        action: string;
        title: string;
    }>;
    groupKey?: string;
    typeId?: ITypeId;
}
interface SendOptions {
    skipInApp?: boolean;
    push_notification?: boolean;
    email_notification?: boolean;
    scheduledAt?: Date;
    priority?: string;
    expiresAt?: Date;
    silent?: boolean;
    skipPush?: boolean;
    sendEmail?: boolean;
}
interface NotificationFilter {
    userId?: string;
    store?: string;
    branch?: string;
    archived?: boolean;
    deletedAt?: null;
    type?: string;
    unread?: number;
}
interface GetNotificationOptions {
    page?: number;
    limit?: number;
    type?: string | null;
    unreadOnly?: boolean;
}
declare class NotificationController {
    static saveAndSendNotification(data: NotificationData, accountType?: string, options?: SendOptions): Promise<any>;
    static sendNotification(notification: any, accountType?: string, options?: SendOptions): Promise<any>;
    static sendInAppNotification(notification: any, userId: string, accountType?: string): Promise<void>;
    static sendPushNotification(notification: any, userId: string, accountType?: string): Promise<any>;
    static sendEmailNotification(notification: any, userId: string, accountType?: string): Promise<void>;
    static getNotificationList(filter: NotificationFilter, accountType?: string, options?: GetNotificationOptions): Promise<any>;
    static _groupByTimePeriod(notifications: any[]): any[];
    static _formatNotification(notification: any): any;
    static markAsRead(notificationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static markAllAsRead(userId: string, accountType?: string): Promise<{
        success: boolean;
    }>;
    static deleteNotification(notificationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static getUnreadCount(userId: string, accountType?: string): Promise<{
        count: number;
    }>;
    static trackClick(notificationId: string, userId: string): Promise<{
        success: boolean;
    }>;
    static _emitNotificationUpdate(userId: string): Promise<void>;
    static subscribe(req: Request, res: Response): Promise<Response>;
    static unsubscribe(req: Request, res: Response): Promise<Response>;
    static getPreferences(req: Request, res: Response): Promise<Response>;
    static updatePreferences(req: Request, res: Response): Promise<Response>;
    static getNotifications(req: Request, res: Response): Promise<Response>;
    static processScheduledNotifications(): Promise<void>;
    static cleanupOldNotifications(): Promise<void>;
    static sendTestNotification(req: Request, res: Response): Promise<Response>;
}
export default NotificationController;
//# sourceMappingURL=notification.d.ts.map