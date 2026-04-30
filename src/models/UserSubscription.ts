import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type SubscriptionStatus = 'pending_payment' | 'active' | 'expired' | 'cancelled';

export interface IUserSubscription extends Document {
    userId: Types.ObjectId;
    planId: Types.ObjectId;

    // Dates
    startDate?: Date;
    endDate?: Date;

    // Payment
    paymentReference: string;
    paymentStatus: 'pending' | 'completed' | 'failed';
    amountPaid: number;
    paymentMethod: string;
    paymentCompletedAt?: Date;

    // Status
    status: SubscriptionStatus;
    cancelledAt?: Date;
    cancellationReason?: string;

    // Snapshot of plan at subscription time (in case plan changes)
    planSnapshot: {
        name: string;
        discountPercentage: number;
        maxDiscountAmountPerOrder?: number;
        durationDays: number;
    };

    createdAt: Date;
    updatedAt: Date;

    // Virtuals
    isActive: boolean;
    daysRemaining: number;
}

interface IUserSubscriptionModel extends Model<IUserSubscription> {
    getActiveSubscription(userId: Types.ObjectId | string): Promise<IUserSubscription | null>;
}

const UserSubscriptionSchema = new Schema<IUserSubscription, IUserSubscriptionModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        planId: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },

        // Dates
        startDate: { type: Date },
        endDate: { type: Date, index: true },

        // Payment
        paymentReference: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending'
        },
        amountPaid: {
            type: Number,
            required: true,
            min: 0
        },
        paymentMethod: {
            type: String,
            required: true,
            trim: true
        },
        paymentCompletedAt: { type: Date },

        // Status
        status: {
            type: String,
            enum: ['pending_payment', 'active', 'expired', 'cancelled'],
            default: 'pending_payment',
            index: true
        },
        cancelledAt: { type: Date },
        cancellationReason: { type: String, trim: true },

        // Immutable plan snapshot
        planSnapshot: {
            name: { type: String, required: true },
            discountPercentage: { type: Number, required: true },
            maxDiscountAmountPerOrder: { type: Number },
            durationDays: { type: Number, required: true }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

UserSubscriptionSchema.index({ userId: 1, status: 1 });
UserSubscriptionSchema.index({ userId: 1, endDate: -1 });
UserSubscriptionSchema.index({ paymentReference: 1 });

// Virtual: isActive
UserSubscriptionSchema.virtual('isActive').get(function () {
    return (
        this.status === 'active' &&
        !!this.endDate &&
        this.endDate > new Date()
    );
});

// Virtual: daysRemaining
UserSubscriptionSchema.virtual('daysRemaining').get(function () {
    if (!this.endDate || this.status !== 'active') return 0;
    const diff = this.endDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Static: get currently active subscription for a user
UserSubscriptionSchema.statics.getActiveSubscription = function (
    userId: Types.ObjectId | string
): Promise<IUserSubscription | null> {
    return this.findOne({
        userId,
        status: 'active',
        endDate: { $gt: new Date() }
    })
        .populate('planId', 'name discountPercentage maxDiscountAmountPerOrder durationDays badgeColor features')
        .exec();
};

// Auto-expire subscriptions on read (optional – a cron is better, but this is a safety net)
UserSubscriptionSchema.pre(/^find/, function (this: any, next) {
    // Don't auto-filter – we want to show historical records too
    next();
});

const UserSubscription = mongoose.model<IUserSubscription, IUserSubscriptionModel>(
    'UserSubscription',
    UserSubscriptionSchema
);

export default UserSubscription;