import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface IEmergencyContact {
    name?: string;
    phone?: string;
    relationship?: string;
}

export interface IDriver extends Document {
    // Basic Information
    userId: Types.ObjectId; // Reference to User model
    phone: string;

    // Vehicle Information
    vehicleType: 'motorcycle' | 'bicycle' | 'car' | 'van' | 'truck';
    vehicleModel?: string;
    vehiclePlateNumber: string;
    vehicleColor?: string;

    // Documents
    profilePhoto?: string;
    vehiclePhoto?: string;
    driversLicense?: string;
    licenseNumber?: string;
    licenseExpiry?: Date;

    // Work Information
    region: string;
    assignedBranch?: string;
    employmentType: 'full-time' | 'part-time' | 'contract';

    // Status & Verification
    status: 'pending' | 'active' | 'suspended' | 'disabled' | 'on-delivery';
    verificationStatus: 'pending' | 'verified' | 'rejected';
    isOnline: boolean;
    verifiedAt?: Date;
    verifiedBy?: Types.ObjectId;
    verificationNotes?: string;
    rejectedAt?: Date;
    rejectionReason?: string;

    // Password & Authentication
    password?: string;
    hasSetPassword: boolean;
    passwordSetupToken?: string;
    passwordSetupExpiry?: Date;

    // Emergency Contact
    emergencyContact?: IEmergencyContact;

    // Suspension/Disablement
    suspendedAt?: Date;
    suspendedUntil?: Date;
    suspensionReason?: string;
    disabledAt?: Date;
    disablementReason?: string;

    // Statistics
    totalDeliveries: number;
    completedDeliveries: number;
    cancelledDeliveries: number;
    rating: number;

    // Timestamps
    joinedDate: Date;
    lastActive?: Date;
    createdAt: Date;
    updatedAt: Date;

     otp?: string;
    otpExpiry?: Date;

    // Methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    generatePasswordSetupToken(): string;
}

const DriverSchema = new Schema<IDriver>({
    // Basic Information
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[0-9+\-\s()]+$/, 'Please provide a valid phone number'],
        unique: true
    },
    // Vehicle Information
    vehicleType: {
        type: String,
        required: [true, 'Vehicle type is required'],
        enum: {
            values: ['motorcycle', 'bicycle', 'car', 'van', 'truck'],
            message: '{VALUE} is not a valid vehicle type'
        }
    },
    vehicleModel: {
        type: String,
        trim: true
    },
    vehiclePlateNumber: {
        type: String,
        required: [true, 'Vehicle plate number is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    vehicleColor: {
        type: String,
        trim: true
    },

    // Documents
    profilePhoto: {
        type: String
    },
    vehiclePhoto: {
        type: String
    },
    driversLicense: {
        type: String
    },
    licenseNumber: {
        type: String,
        trim: true
    },
    licenseExpiry: {
        type: Date
    },

    // Work Information
    region: {
        type: String,
        required: [true, 'Region is required'],
        trim: true,
        index: true
    },
    assignedBranch: {
        type: String,
        trim: true
    },
    employmentType: {
        type: String,
        required: [true, 'Employment type is required'],
        enum: {
            values: ['full-time', 'part-time', 'contract'],
            message: '{VALUE} is not a valid employment type'
        }
    },

    // Status & Verification
    status: {
        type: String,
        enum: ['pending', 'active', 'suspended', 'disabled', 'on-delivery'],
        default: 'pending',
        index: true
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
        index: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Staff'
    },
    verificationNotes: {
        type: String
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    },

    // Password & Authentication
    password: {
        type: String,
        select: false
    },
    hasSetPassword: {
        type: Boolean,
        default: false
    },
    passwordSetupToken: {
        type: String,
        select: false
    },
    passwordSetupExpiry: {
        type: Date,
        select: false
    },

    // Emergency Contact
    emergencyContact: {
        name: { type: String },
        phone: { type: String },
        relationship: { type: String }
    },

    // Suspension/Disablement
    suspendedAt: {
        type: Date
    },
    suspendedUntil: {
        type: Date
    },
    suspensionReason: {
        type: String
    },
    disabledAt: {
        type: Date
    },
    disablementReason: {
        type: String
    },

    // Statistics
    totalDeliveries: {
        type: Number,
        default: 0,
        min: 0
    },
    completedDeliveries: {
        type: Number,
        default: 0,
        min: 0
    },
    cancelledDeliveries: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },

    // Timestamps
    joinedDate: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.passwordSetupToken;
            delete ret.passwordSetupExpiry;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for performance
DriverSchema.index({ email: 1 });
DriverSchema.index({ vehiclePlateNumber: 1 });
DriverSchema.index({ status: 1, region: 1 });
DriverSchema.index({ verificationStatus: 1 });
DriverSchema.index({ fullName: 'text', email: 'text', phone: 'text' });

// Hash password before saving
DriverSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Compare password method
DriverSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    try {
        if (!this.password) return false;
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        return false;
    }
};

// Generate password setup token
DriverSchema.methods.generatePasswordSetupToken = function(): string {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token and set to passwordSetupToken field
    this.passwordSetupToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    // Set expiry to 24 hours
    this.passwordSetupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return token; // Return unhashed token to send via email
};

// Virtual for completion rate
DriverSchema.virtual('completionRate').get(function() {
    if (this.totalDeliveries === 0) return 0;
    return ((this.completedDeliveries / this.totalDeliveries) * 100).toFixed(1);
});

// Check if license is expiring soon (within 30 days)
DriverSchema.virtual('isLicenseExpiringSoon').get(function() {
    if (!this.licenseExpiry) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return this.licenseExpiry < thirtyDaysFromNow;
});

export default mongoose.model<IDriver>('Driver', DriverSchema);