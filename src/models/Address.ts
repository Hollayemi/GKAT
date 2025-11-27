import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
    userId: Types.ObjectId;
    label: 'Home' | 'Shop' | 'Office' | 'Other';
    fullname: string;
    address: string;
    phone: string;
    state: string;
    city?: string;
    zipCode?: string;
    email?: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    label: {
        type: String,
        required: [true, 'Address label is required'],
        enum: {
            values: ['Home', 'Shop', 'Office', 'Other'],
            message: 'Label must be Home, Shop, Office, or Other'
        }
    },
    fullname: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 3 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        minlength: [10, 'Address must be at least 10 characters'],
        maxlength: [500, 'Address cannot exceed 500 characters']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^[0-9+\-\s()]+$/, 'Please provide a valid phone number']
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    zipCode: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    isDefault: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

AddressSchema.index({ userId: 1, isDefault: 1 });
AddressSchema.index({ userId: 1, createdAt: -1 });

AddressSchema.pre('save', async function (next) {
    if (this.isDefault && this.isModified('isDefault')) {
        await mongoose.model('Address').updateMany(
            {
                userId: this.userId,
                _id: { $ne: this._id }
            },
            { $set: { isDefault: false } }
        );
    }
    next();
});

// Virtual for formatted address
AddressSchema.virtual('formattedAddress').get(function () {
    const parts = [this.address];
    if (this.city) parts.push(this.city);
    parts.push(this.state);
    if (this.zipCode) parts.push(this.zipCode);
    return parts.join(', ');
});

export default mongoose.model<IAddress>('Address', AddressSchema);