import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPaymentMethod extends Document {
    id: string;           // e.g. 'paystack', 'palmpay', 'opay', 'cash_on_delivery'
    name: string;
    description: string;
    logo: string;
    enabled: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
    {
        id: {
            type: String,
            required: [true, 'Payment method ID is required'],
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },
        name: {
            type: String,
            required: [true, 'Payment method name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters']
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: [300, 'Description cannot exceed 300 characters']
        },
        logo: {
            type: String,
            required: [true, 'Logo URL is required'],
            trim: true
        },
        enabled: {
            type: Boolean,
            default: true,
            index: true
        },
        sortOrder: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

PaymentMethodSchema.index({ enabled: 1, sortOrder: 1 });

export default mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);
