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
const mongoose_1 = __importStar(require("mongoose"));
const PushNotificationSchema = new mongoose_1.Schema({
    // Content
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [65, 'Title cannot exceed 65 characters'],
        minlength: [1, 'Title must be at least 1 character']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [240, 'Message cannot exceed 240 characters'],
        minlength: [1, 'Message must be at least 1 character']
    },
    image: {
        type: String
    },
    // Targeting
    targetAudience: {
        type: String,
        required: [true, 'Target audience is required'],
        enum: {
            values: ['all', 'customers', 'drivers', 'specific'],
            message: '{VALUE} is not a valid target audience'
        }
    },
    specificUserIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User'
        }],
    specificDriverIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Driver'
        }],
    // Filters
    filters: {
        region: [{ type: String }],
        city: [{ type: String }],
        userStatus: [{ type: String }],
        orderHistory: {
            type: String,
            enum: ['has-ordered', 'never-ordered', 'frequent-buyers']
        }
    },
    // Delivery
    scheduleType: {
        type: String,
        required: [true, 'Schedule type is required'],
        enum: {
            values: ['immediate', 'scheduled'],
            message: '{VALUE} is not a valid schedule type'
        }
    },
    scheduledAt: {
        type: Date
    },
    // Interactive Content
    deepLink: {
        type: String,
        trim: true
    },
    actionButton: {
        text: { type: String, trim: true },
        link: { type: String, trim: true }
    },
    // Status
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sent', 'failed'],
        default: 'draft',
        index: true
    },
    // Analytics
    totalRecipients: {
        type: Number,
        default: 0,
        min: 0
    },
    sentCount: {
        type: Number,
        default: 0,
        min: 0
    },
    deliveredCount: {
        type: Number,
        default: 0,
        min: 0
    },
    clickedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    failedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // Metadata
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Staff',
        required: true
    },
    createdByName: {
        type: String,
        required: true
    },
    sentAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Indexes for performance
PushNotificationSchema.index({ status: 1, scheduledAt: 1 });
PushNotificationSchema.index({ createdBy: 1 });
PushNotificationSchema.index({ sentAt: -1 });
PushNotificationSchema.index({ createdAt: -1 });
// Validation: scheduledAt required if scheduleType is 'scheduled'
PushNotificationSchema.pre('save', function (next) {
    if (this.scheduleType === 'scheduled' && !this.scheduledAt) {
        return next(new Error('Scheduled time is required when schedule type is "scheduled"'));
    }
    if (this.scheduleType === 'scheduled' && this.scheduledAt) {
        if (this.scheduledAt <= new Date()) {
            return next(new Error('Scheduled time must be in the future'));
        }
    }
    if (this.targetAudience === 'specific') {
        if (this.specificUserIds.length === 0 && this.specificDriverIds.length === 0) {
            return next(new Error('At least one user or driver must be specified when target audience is "specific"'));
        }
    }
    next();
});
// Virtual for delivery rate
PushNotificationSchema.virtual('deliveryRate').get(function () {
    if (this.sentCount === 0)
        return 0;
    return ((this.deliveredCount / this.sentCount) * 100).toFixed(2);
});
// Virtual for click-through rate
PushNotificationSchema.virtual('clickThroughRate').get(function () {
    if (this.deliveredCount === 0)
        return 0;
    return ((this.clickedCount / this.deliveredCount) * 100).toFixed(2);
});
exports.default = mongoose_1.default.model('PushNotification', PushNotificationSchema);
//# sourceMappingURL=PushNotification.model.js.map