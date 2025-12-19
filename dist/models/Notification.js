"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPriority = exports.NotificationStatus = exports.NotificationType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Enums for type safety
var NotificationType;
(function (NotificationType) {
    NotificationType["ORDER"] = "order";
    NotificationType["PROMOTION"] = "promotion";
    NotificationType["SYSTEM"] = "system";
    NotificationType["MESSAGE"] = "message";
    NotificationType["PAYMENT"] = "payment";
    NotificationType["REVIEW"] = "review";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "pending";
    NotificationStatus["SENT"] = "sent";
    NotificationStatus["DELIVERED"] = "delivered";
    NotificationStatus["FAILED"] = "failed";
    NotificationStatus["READ"] = "read";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["MEDIUM"] = "medium";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["URGENT"] = "urgent";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
const UserNotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        ref: 'users',
        index: true
    },
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
            validator: function (v) {
                return !v || v.startsWith('http') || v.startsWith('/');
            },
            message: 'Image must be a valid URL or path'
        }
    },
    icon: {
        type: String,
        default: '/icons/notification-icon.png',
        validate: {
            validator: function (v) {
                return v.startsWith('http') || v.startsWith('/');
            },
            message: 'Icon must be a valid URL or path'
        }
    },
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
        type: mongoose_1.Schema.Types.Mixed,
        validate: {
            validator: function (v) {
                return !v || typeof v === 'object';
            },
            message: 'TypeId must be an object'
        }
    },
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
            validator: function (v) {
                return !v || v > new Date();
            },
            message: 'Scheduled date must be in the future'
        }
    },
    expiresAt: {
        type: Date,
        validate: {
            validator: function (v) {
                return !v || v > new Date();
            },
            message: 'Expiry date must be in the future'
        }
    },
    retryCount: {
        type: Number,
        default: 0,
        min: [0, 'Retry count cannot be negative'],
        max: [3, 'Maximum retry count is 3']
    },
    lastRetryAt: { type: Date },
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
                    validator: function (v) {
                        return !v || v.startsWith('http') || v.startsWith('/');
                    },
                    message: 'Action icon must be a valid URL or path'
                }
            }
        }],
    clicked: { type: Boolean, default: false },
    clickedAt: { type: Date },
    clickUrl: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || v.startsWith('http') || v.startsWith('/');
            },
            message: 'Click URL must be a valid URL or path'
        }
    },
    groupKey: {
        type: String,
        index: true,
        trim: true
    },
    silent: { type: Boolean, default: false },
    data: {
        type: Map,
        of: String,
        default: new Map()
    },
    archived: { type: Boolean, default: false },
    deletedAt: { type: Date }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});
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
UserNotificationSchema.virtual('isExpired').get(function () {
    return this.expiresAt && this.expiresAt < new Date();
});
UserNotificationSchema.virtual('isScheduled').get(function () {
    return this.scheduledAt && this.scheduledAt > new Date();
});
UserNotificationSchema.virtual('hasActions').get(function () {
    return this.actions && this.actions.length > 0;
});
UserNotificationSchema.virtual('deliveryStatus').get(function () {
    if (this.delivery.push.delivered)
        return 'delivered';
    if (this.delivery.push.sent)
        return 'sent';
    if (this.delivery.push.failed)
        return 'failed';
    return 'pending';
});
UserNotificationSchema.methods.markAsRead = async function () {
    this.unread = 0;
    this.status = NotificationStatus.READ;
    this.delivery.inApp.viewed = true;
    this.delivery.inApp.viewedAt = new Date();
    return await this.save();
};
UserNotificationSchema.methods.trackClick = async function () {
    this.clicked = true;
    this.clickedAt = new Date();
    if (this.unread === 1) {
        await this.markAsRead();
    }
    return await this.save();
};
UserNotificationSchema.methods.isActionable = function () {
    return this.hasActions || !!this.clickUrl;
};
UserNotificationSchema.methods.markAsSent = async function (channel = 'push') {
    this.delivery[channel].sent = true;
    this.delivery[channel].sentAt = new Date();
    this.status = NotificationStatus.SENT;
    return await this.save();
};
UserNotificationSchema.methods.markAsDelivered = async function (channel = 'push') {
    this.delivery[channel].delivered = true;
    this.delivery[channel].deliveredAt = new Date();
    this.status = NotificationStatus.DELIVERED;
    return await this.save();
};
UserNotificationSchema.methods.markAsFailed = async function (error, channel = 'push') {
    this.delivery[channel].failed = true;
    this.delivery[channel].failedAt = new Date();
    this.delivery[channel].error = error;
    this.status = NotificationStatus.FAILED;
    return await this.save();
};
UserNotificationSchema.statics.getUnreadCount = function (userId) {
    return this.countDocuments({
        userId,
        unread: 1,
        archived: false,
        deletedAt: null
    });
};
UserNotificationSchema.statics.markAllAsRead = function (userId) {
    return this.updateMany({
        userId,
        unread: 1,
        archived: false,
        deletedAt: null
    }, {
        $set: {
            unread: 0,
            status: NotificationStatus.READ,
            'delivery.inApp.viewed': true,
            'delivery.inApp.viewedAt': new Date()
        }
    });
};
UserNotificationSchema.statics.findByUserId = function (userId, options = {}) {
    const { limit = 50, skip = 0, unreadOnly = false, type } = options;
    const query = {
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
UserNotificationSchema.statics.findExpired = function () {
    return this.find({
        expiresAt: { $lt: new Date() },
        archived: false,
        deletedAt: null
    }).exec();
};
UserNotificationSchema.statics.cleanupOldNotifications = function (days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return this.updateMany({
        createdAt: { $lt: cutoffDate },
        unread: 0,
        archived: false,
        deletedAt: null
    }, {
        $set: {
            archived: true,
            deletedAt: new Date()
        }
    });
};
UserNotificationSchema.pre('save', function (next) {
    if (this.scheduledAt && this.scheduledAt > new Date()) {
        this.status = NotificationStatus.PENDING;
    }
    if (this.expiresAt && this.expiresAt < new Date() && !this.archived) {
        this.unread = 0;
        this.archived = true;
        this.status = NotificationStatus.READ;
    }
    next();
});
UserNotificationSchema.pre(/^find/, function (next) {
    if (this.getFilter().archived === undefined) {
        this.where({ archived: false, deletedAt: null });
    }
    next();
});
const UserNotification = mongoose_1.default.model('UserNotification', UserNotificationSchema);
exports.default = UserNotification;
//# sourceMappingURL=Notification.js.map