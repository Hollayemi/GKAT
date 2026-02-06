import mongoose, { Document, Schema, Types } from 'mongoose';

interface IActionButton {
    text: string;
    link: string;
}

interface IFilters {
    region?: string[];
    city?: string[];
    userStatus?: string[];
    orderHistory?: 'has-ordered' | 'never-ordered' | 'frequent-buyers';
}

export interface IPushNotification extends Document {
    // Content
    title: string;
    message: string;
    image?: string;

    // Targeting
    targetAudience: 'all' | 'customers' | 'drivers' | 'specific';
    specificUserIds: Types.ObjectId[];
    specificDriverIds: Types.ObjectId[];

    // Filters
    filters?: IFilters;

    // Delivery
    scheduleType: 'immediate' | 'scheduled';
    scheduledAt?: Date;

    // Interactive Content
    deepLink?: string;
    actionButton?: IActionButton;

    // Status
    status: 'draft' | 'scheduled' | 'sent' | 'failed';

    // Analytics
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    clickedCount: number;
    failedCount: number;

    // Metadata
    createdBy: Types.ObjectId;
    createdByName: string;
    sentAt?: Date;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

const PushNotificationSchema = new Schema<IPushNotification>({
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
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    specificDriverIds: [{
        type: Schema.Types.ObjectId,
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
        type: Schema.Types.ObjectId,
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
PushNotificationSchema.pre('save', function(next) {
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
PushNotificationSchema.virtual('deliveryRate').get(function() {
    if (this.sentCount === 0) return 0;
    return ((this.deliveredCount / this.sentCount) * 100).toFixed(2);
});

// Virtual for click-through rate
PushNotificationSchema.virtual('clickThroughRate').get(function() {
    if (this.deliveredCount === 0) return 0;
    return ((this.clickedCount / this.deliveredCount) * 100).toFixed(2);
});

export default mongoose.model<IPushNotification>('PushNotification', PushNotificationSchema);
