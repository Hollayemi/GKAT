import { Document, Model, Types } from 'mongoose';
export declare enum NotificationType {
    ORDER = "order",
    PROMOTION = "promotion",
    SYSTEM = "system",
    MESSAGE = "message",
    PAYMENT = "payment",
    REVIEW = "review"
}
export declare enum NotificationStatus {
    PENDING = "pending",
    SENT = "sent",
    DELIVERED = "delivered",
    FAILED = "failed",
    READ = "read"
}
export declare enum NotificationPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    URGENT = "urgent"
}
export interface INotificationAction {
    action: string;
    title: string;
    icon?: string;
}
export interface IDeliveryTracking {
    sent: boolean;
    sentAt?: Date;
    delivered?: boolean;
    deliveredAt?: Date;
    failed?: boolean;
    failedAt?: Date;
    error?: string;
}
export interface IInAppDelivery {
    sent: boolean;
    sentAt?: Date;
    viewed: boolean;
    viewedAt?: Date;
}
export interface IEmailDelivery {
    sent: boolean;
    sentAt?: Date;
    opened: boolean;
    openedAt?: Date;
}
export interface IDelivery {
    push: IDeliveryTracking;
    inApp: IInAppDelivery;
    email: IEmailDelivery;
}
export interface ITypeId {
    orderId?: Types.ObjectId;
    productId?: Types.ObjectId;
    messageId?: Types.ObjectId;
    paymentId?: Types.ObjectId;
    reviewId?: Types.ObjectId;
    [key: string]: any;
}
export interface IUserNotification extends Document {
    userId: Types.ObjectId;
    title: string;
    body: string;
    image?: string;
    icon: string;
    type: NotificationType;
    typeId?: ITypeId;
    status: NotificationStatus;
    unread: number;
    delivery: IDelivery;
    priority: NotificationPriority;
    scheduledAt?: Date;
    expiresAt?: Date;
    retryCount: number;
    lastRetryAt?: Date;
    actions: INotificationAction[];
    clicked: boolean;
    clickedAt?: Date;
    clickUrl?: string;
    groupKey?: string;
    silent: boolean;
    data: Map<string, string>;
    archived: boolean;
    deletedAt?: Date;
    isExpired: boolean;
    createdAt: Date;
    updatedAt: Date;
    markAsRead(): Promise<IUserNotification>;
    trackClick(): Promise<IUserNotification>;
    isActionable(): boolean;
}
interface IUserNotificationModel extends Model<IUserNotification> {
    getUnreadCount(userId: Types.ObjectId | string): Promise<number>;
    markAllAsRead(userId: Types.ObjectId | string): Promise<any>;
    findByUserId(userId: Types.ObjectId | string, options?: {
        limit?: number;
        skip?: number;
        unreadOnly?: boolean;
        type?: NotificationType;
    }): Promise<IUserNotification[]>;
    findExpired(): Promise<IUserNotification[]>;
    cleanupOldNotifications(days?: number): Promise<any>;
}
declare const UserNotification: IUserNotificationModel;
export default UserNotification;
//# sourceMappingURL=Notification.d.ts.map