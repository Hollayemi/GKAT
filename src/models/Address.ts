import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
    userId: Types.ObjectId;
    label: 'Home' | 'Shop' | 'Office' | 'Other';
    phone?: string;
    street: string;
    address: string;
    landmark: string;
    state: string;
    localGovernment: string;
    isDefault: boolean;
    /**
     * Optional WGS-84 coordinates for the address.
     * Populated at creation time (from device GPS, browser Geolocation API,
     * or a geocoding service on the frontend).
     * Used by the order system to resolve the nearest delivery region.
     */
    coordinates?: {
        lat: number;
        lng: number;
    };
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
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^[0-9+\-\s()]+$/, 'Please provide a valid phone number']
    },
    street: {
        type: String,
        required: [true, 'Street is required'],
        trim: true,
        minlength: [3, 'Street must be at least 3 characters'],
        maxlength: [100, 'Street cannot exceed 100 characters']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true,
        minlength: [10, 'Address must be at least 10 characters'],
        maxlength: [500, 'Address cannot exceed 500 characters']
    },
    landmark: {
        type: String,
        required: [true, 'Landmark is required'],
        trim: true,
        minlength: [3, 'Landmark must be at least 3 characters'],
        maxlength: [100, 'Landmark cannot exceed 100 characters']
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
    },
    localGovernment: {
        type: String,
        required: [true, 'Local Government is required'],
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false,
        index: true
    },
    coordinates: {
        lat: {
            type: Number,
            min: [-90, 'Latitude must be between -90 and 90'],
            max: [90, 'Latitude must be between -90 and 90']
        },
        lng: {
            type: Number,
            min: [-180, 'Longitude must be between -180 and 180'],
            max: [180, 'Longitude must be between -180 and 180']
        }
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
    const parts = [this.street, this.landmark, this.localGovernment];
    return parts.filter(part => part).join(', ');
});

export default mongoose.model<IAddress>('Address', AddressSchema);
