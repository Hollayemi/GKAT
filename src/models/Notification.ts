import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Enums for type safety
export enum NotificationType {
    ORDER = 'order',
    PROMOTION = 'promotion',
    SYSTEM = 'system',
    MESSAGE = 'message',
    PAYMENT = 'payment',
    REVIEW = 'review'
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    READ = 'read'
}

export enum NotificationPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

// Interfaces
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

// Main Document Interface
export interface IUserNotification extends Document {
    userId: Types.ObjectId;

    // Notification Content
    title: string;
    body: string;
    image?: string;
    icon: string;

    // Metadata
    type: NotificationType;
    typeId?: ITypeId;

    // Status Tracking
    status: NotificationStatus;
    unread: number;

    // Delivery Tracking
    delivery: IDelivery;

    // Priority & Scheduling
    priority: NotificationPriority;
    scheduledAt?: Date;
    expiresAt?: Date;

    // Retry Logic
    retryCount: number;
    lastRetryAt?: Date;

    // Actions
    actions: INotificationAction[];

    // Click tracking
    clicked: boolean;
    clickedAt?: Date;
    clickUrl?: string;

    // Grouping
    groupKey?: string;

    // Silent notification
    silent: boolean;

    // Custom data
    data: Map<string, string>;

    // Archived/Deleted
    archived: boolean;
    deletedAt?: Date;

    // Virtuals
    isExpired: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;

    // Methods
    markAsRead(): Promise<IUserNotification>;
    trackClick(): Promise<IUserNotification>;
    isActionable(): boolean;
}

// Static Methods Interface
interface IUserNotificationModel extends Model<IUserNotification> {
    getUnreadCount(userId: Types.ObjectId | string): Promise<number>;
    markAllAsRead(userId: Types.ObjectId | string): Promise<any>;
    findByUserId(
        userId: Types.ObjectId | string,
        options?: {
            limit?: number;
            skip?: number;
            unreadOnly?: boolean;
            type?: NotificationType;
        }
    ): Promise<IUserNotification[]>;
    findExpired(): Promise<IUserNotification[]>;
    cleanupOldNotifications(days?: number): Promise<any>;
}

// Schema Definition
const UserNotificationSchema: Schema<IUserNotification> = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: [true, 'User ID is required'],
            ref: 'users',
            index: true
        },

        // Notification Content
        title: {
            type: String,
            required: [true, 'Notification title is required'],
            maxlength: [100, 'Title cannot exceed 100 characters'],
            trim: true
        },
        body: {
            type: String,
            required: [true, 'Notification body is required'],
            maxlength: [500, 'Body cannot exceed 500 characters'],
            trim: true
        },
        image: {
            type: String,
            validate: {
                validator: function (v: string) {
                    return !v || v.startsWith('http') || v.startsWith('/');
                },
                message: 'Image must be a valid URL or path'
            }
        },
        icon: {
            type: String,
            default: '/icons/notification-icon.png',
            validate: {
                validator: function (v: string) {
                    return v.startsWith('http') || v.startsWith('/');
                },
                message: 'Icon must be a valid URL or path'
            }
        },

        // Metadata
        type: {
            type: String,
            enum: {
                values: Object.values(NotificationType),
                message: 'Invalid notification type'
            },
            required: [true, 'Notification type is required'],
            index: true
        },
        typeId: {
            type: Schema.Types.Mixed,
            validate: {
                validator: function (v: any) {
                    return !v || typeof v === 'object';
                },
                message: 'TypeId must be an object'
            }
        },

        // Status Tracking
        status: {
            type: String,
            enum: {
                values: Object.values(NotificationStatus),
                message: 'Invalid notification status'
            },
            default: NotificationStatus.PENDING,
            index: true
        },
        unread: {
            type: Number,
            default: 1,
            min: [0, 'Unread must be 0 or 1'],
            max: [1, 'Unread must be 0 or 1']
        },

        // Delivery Tracking
        delivery: {
            push: {
                sent: { type: Boolean, default: false },
                sentAt: { type: Date },
                delivered: { type: Boolean, default: false },
                deliveredAt: { type: Date },
                failed: { type: Boolean, default: false },
                failedAt: { type: Date },
                error: { type: String }
            },
            inApp: {
                sent: { type: Boolean, default: false },
                sentAt: { type: Date },
                viewed: { type: Boolean, default: false },
                viewedAt: { type: Date }
            },
            email: {
                sent: { type: Boolean, default: false },
                sentAt: { type: Date },
                opened: { type: Boolean, default: false },
                openedAt: { type: Date }
            }
        },

        // Priority & Scheduling
        priority: {
            type: String,
            enum: {
                values: Object.values(NotificationPriority),
                message: 'Invalid notification priority'
            },
            default: NotificationPriority.MEDIUM,
            index: true
        },
        scheduledAt: {
            type: Date,
            validate: {
                validator: function (v: Date) {
                    return !v || v > new Date();
                },
                message: 'Scheduled date must be in the future'
            }
        },
        expiresAt: {
            type: Date,
            validate: {
                validator: function (v: Date) {
                    return !v || v > new Date();
                },
                message: 'Expiry date must be in the future'
            }
        },

        // Retry Logic
        retryCount: {
            type: Number,
            default: 0,
            min: [0, 'Retry count cannot be negative'],
            max: [3, 'Maximum retry count is 3']
        },
        lastRetryAt: { type: Date },

        // Actions
        actions: [{
            action: {
                type: String,
                required: [true, 'Action type is required'],
                trim: true
            },
            title: {
                type: String,
                required: [true, 'Action title is required'],
                trim: true
            },
            icon: {
                type: String,
                validate: {
                    validator: function (v: string) {
                        return !v || v.startsWith('http') || v.startsWith('/');
                    },
                    message: 'Action icon must be a valid URL or path'
                }
            }
        }],

        // Click tracking
        clicked: { type: Boolean, default: false },
        clickedAt: { type: Date },
        clickUrl: {
            type: String,
            validate: {
                validator: function (v: string) {
                    return !v || v.startsWith('http') || v.startsWith('/');
                },
                message: 'Click URL must be a valid URL or path'
            }
        },

        // Grouping
        groupKey: {
            type: String,
            index: true,
            trim: true
        },

        // Silent notification
        silent: { type: Boolean, default: false },

        // Custom data
        data: {
            type: Map,
            of: String,
            default: new Map()
        },

        // Archived/Deleted
        archived: { type: Boolean, default: false },
        deletedAt: { type: Date }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret: any) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);

// Indexes for performance
UserNotificationSchema.index({ userId: 1, createdAt: -1 });
UserNotificationSchema.index({ userId: 1, status: 1, unread: 1 });
UserNotificationSchema.index({ userId: 1, type: 1 });
UserNotificationSchema.index({ scheduledAt: 1 }, { sparse: true });
UserNotificationSchema.index({ expiresAt: 1 }, {
    sparse: true,
    expireAfterSeconds: 0
});
UserNotificationSchema.index({ status: 1, scheduledAt: 1 });
UserNotificationSchema.index({ archived: 1, deletedAt: 1 });

// Virtual for isExpired
UserNotificationSchema.virtual('isExpired').get(function (this: IUserNotification) {
    return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for isScheduled
UserNotificationSchema.virtual('isScheduled').get(function (this: IUserNotification) {
    return this.scheduledAt && this.scheduledAt > new Date();
});

// Virtual for hasActions
UserNotificationSchema.virtual('hasActions').get(function (this: IUserNotification) {
    return this.actions && this.actions.length > 0;
});

// Virtual for deliveryStatus
UserNotificationSchema.virtual('deliveryStatus').get(function (this: IUserNotification) {
    if (this.delivery.push.delivered) return 'delivered';
    if (this.delivery.push.sent) return 'sent';
    if (this.delivery.push.failed) return 'failed';
    return 'pending';
});

// Method to mark as read
UserNotificationSchema.methods.markAsRead = async function (): Promise<IUserNotification> {
    this.unread = 0;
    this.status = NotificationStatus.READ;
    this.delivery.inApp.viewed = true;
    this.delivery.inApp.viewedAt = new Date();
    return await this.save();
};

// Method to track click
UserNotificationSchema.methods.trackClick = async function (): Promise<IUserNotification> {
    this.clicked = true;
    this.clickedAt = new Date();

    // Also mark as read if not already
    if (this.unread === 1) {
        await this.markAsRead();
    }

    return await this.save();
};

// Method to check if notification is actionable
UserNotificationSchema.methods.isActionable = function (): boolean {
    return this.hasActions || !!this.clickUrl;
};

// Method to mark as sent
UserNotificationSchema.methods.markAsSent = async function (channel: keyof IDelivery = 'push'): Promise<IUserNotification> {
    this.delivery[channel].sent = true;
    this.delivery[channel].sentAt = new Date();
    this.status = NotificationStatus.SENT;
    return await this.save();
};

// Method to mark as delivered
UserNotificationSchema.methods.markAsDelivered = async function (channel: keyof IDelivery = 'push'): Promise<IUserNotification> {
    this.delivery[channel].delivered = true;
    this.delivery[channel].deliveredAt = new Date();
    this.status = NotificationStatus.DELIVERED;
    return await this.save();
};

// Method to mark as failed
UserNotificationSchema.methods.markAsFailed = async function (error: string, channel: keyof IDelivery = 'push'): Promise<IUserNotification> {
    this.delivery[channel].failed = true;
    this.delivery[channel].failedAt = new Date();
    this.delivery[channel].error = error;
    this.status = NotificationStatus.FAILED;
    return await this.save();
};

// Static method to get unread count
UserNotificationSchema.statics.getUnreadCount = function (userId: Types.ObjectId | string): Promise<number> {
    return this.countDocuments({
        userId,
        unread: 1,
        archived: false,
        deletedAt: null
    });
};

// Static method to mark all as read
UserNotificationSchema.statics.markAllAsRead = function (userId: Types.ObjectId | string) {
    return this.updateMany(
        {
            userId,
            unread: 1,
            archived: false,
            deletedAt: null
        },
        {
            $set: {
                unread: 0,
                status: NotificationStatus.READ,
                'delivery.inApp.viewed': true,
                'delivery.inApp.viewedAt': new Date()
            }
        }
    );
};

// Static method to find by user ID with options
UserNotificationSchema.statics.findByUserId = function (
    userId: Types.ObjectId | string,
    options: {
        limit?: number;
        skip?: number;
        unreadOnly?: boolean;
        type?: NotificationType;
    } = {}
): Promise<IUserNotification[]> {
    const { limit = 50, skip = 0, unreadOnly = false, type } = options;

    const query: any = {
        userId,
        archived: false,
        deletedAt: null
    };

    if (unreadOnly) {
        query.unread = 1;
    }

    if (type) {
        query.type = type;
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
};

// Static method to find expired notifications
UserNotificationSchema.statics.findExpired = function (): Promise<IUserNotification[]> {
    return this.find({
        expiresAt: { $lt: new Date() },
        archived: false,
        deletedAt: null
    }).exec();
};

// Static method to cleanup old notifications
UserNotificationSchema.statics.cleanupOldNotifications = function (days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.updateMany(
        {
            createdAt: { $lt: cutoffDate },
            unread: 0,
            archived: false,
            deletedAt: null
        },
        {
            $set: {
                archived: true,
                deletedAt: new Date()
            }
        }
    );
};

// Pre-save hook to set status based on scheduledAt
UserNotificationSchema.pre<IUserNotification>('save', function (next) {
    // If scheduled for future, set as pending
    if (this.scheduledAt && this.scheduledAt > new Date()) {
        this.status = NotificationStatus.PENDING;
    }

    // If expired, mark as read and archived
    if (this.expiresAt && this.expiresAt < new Date() && !this.archived) {
        this.unread = 0;
        this.archived = true;
        this.status = NotificationStatus.READ;
    }

    next();
});

// Pre-find hook to exclude archived/deleted notifications
UserNotificationSchema.pre(/^find/, function (this: any, next) {
    if (this.getFilter().archived === undefined) {
        this.where({ archived: false, deletedAt: null });
    }
    next();
});

// Create and export the model
const UserNotification: IUserNotificationModel = mongoose.model<IUserNotification, IUserNotificationModel>(
    'UserNotification',
    UserNotificationSchema
);

export default UserNotification;