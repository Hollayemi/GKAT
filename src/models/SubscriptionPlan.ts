import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscriptionPlan extends Document {
    name: string;
    description: string;
    price: number;
    durationDays: number;
    discountPercentage: number;
    maxDiscountAmountPerOrder?: number; // optional cap per order
    features: string[];
    isActive: boolean;
    badgeColor?: string; // e.g. "gold", "silver", "platinum"
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
    {
        name: {
            type: String,
            required: [true, 'Plan name is required'],
            trim: true,
            unique: true,
            maxlength: [100, 'Plan name cannot exceed 100 characters']
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative']
        },
        durationDays: {
            type: Number,
            required: [true, 'Duration is required'],
            min: [1, 'Duration must be at least 1 day'],
            enum: {
                values: [7, 30, 90, 180, 365],
                message: 'Duration must be 7, 30, 90, 180, or 365 days'
            }
        },
        discountPercentage: {
            type: Number,
            required: [true, 'Discount percentage is required'],
            min: [1, 'Discount must be at least 1%'],
            max: [100, 'Discount cannot exceed 100%']
        },
        maxDiscountAmountPerOrder: {
            type: Number,
            min: [0, 'Max discount cannot be negative'],
            default: null
        },
        features: [{
            type: String,
            trim: true
        }],
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        badgeColor: {
            type: String,
            trim: true,
            default: 'gold'
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            required: true
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'Staff'
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

SubscriptionPlanSchema.index({ isActive: 1, price: 1 });
SubscriptionPlanSchema.index({ createdAt: -1 });

// Virtual: label for duration
SubscriptionPlanSchema.virtual('durationLabel').get(function () {
    if (this.durationDays === 7) return '1 Week';
    if (this.durationDays === 30) return '1 Month';
    if (this.durationDays === 90) return '3 Months';
    if (this.durationDays === 180) return '6 Months';
    if (this.durationDays === 365) return '1 Year';
    return `${this.durationDays} Days`;
});

export default mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);