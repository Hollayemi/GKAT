import mongoose, { Document, Schema, Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface FCMToken {
    token: string;
    deviceId: string;
    platform: 'ios' | 'android';
    addedAt: Date;
}

interface NotificationPreferences {
    push_notification: boolean;
    in_app_notification: boolean;
    email_notification: boolean;
    notification_sound: boolean;
    order_updates: boolean;
    promotions: boolean;
    system_updates: boolean;
}

export interface IUser extends Document {
    name: string;
    email?: string;
    password?: string;
    phoneNumber: string;
    residentArea: string;
    avatar?: string;
    role: 'user' | 'admin' | 'driver';

    // Verification
    isPhoneVerified: boolean;
    isEmailVerified: boolean;

    // Referral
    referralCode: string;
    referredBy?: string;

    // Settings
    notification_pref: NotificationPreferences;
    biometricsEnabled: boolean;

    // OTP
    otp?: string;
    otpExpiry?: Date;

    // Tokens
    refreshToken?: string;
    fcmTokens: FCMToken[]; // Firebase Cloud Messaging tokens for push notifications

    // Saved Addresses
    addresses: Types.ObjectId[];
    defaultAddress?: Types.ObjectId;

    // Stats
    totalOrders: number;
    totalSpent: number;

    createdAt: Date;
    updatedAt: Date;

    // Methods
    getSignedJwtToken(): string;
    getRefreshToken(): string;
    generateOTP(): string;
    verifyOTP(otp: string): boolean;
}

const UserSchema = new Schema<IUser>({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    phoneNumber: {
        type: String,
        required: [true, 'Please add a phone number'],
        unique: true,
        trim: true,
        index: true
    },
    residentArea: {
        type: String,
        required: [true, 'Please add a resident area'],
        default: 'Lagos'
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'driver'],
        default: 'user',
        index: true
    },

    // Verification
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },

    // Referral
    referralCode: {
        type: String,
        unique: true,
        index: true
    },
    referredBy: {
        type: String,
        default: null
    },

    // Notification Preferences
    notification_pref: {
        push_notification: {
            type: Boolean,
            default: true
        },
        in_app_notification: {
            type: Boolean,
            default: true
        },
        email_notification: {
            type: Boolean,
            default: true
        },
        notification_sound: {
            type: Boolean,
            default: true
        },
        order_updates: {
            type: Boolean,
            default: true
        },
        promotions: {
            type: Boolean,
            default: true
        },
        system_updates: {
            type: Boolean,
            default: true
        }
    },

    biometricsEnabled: {
        type: Boolean,
        default: false
    },

    // OTP
    otp: {
        type: String,
        select: false
    },
    otpExpiry: {
        type: Date,
        select: false
    },

    // Tokens
    refreshToken: {
        type: String,
        select: false
    },

    // FCM Tokens for push notifications
    fcmTokens: [{
        token: {
            type: String,
            required: true
        },
        deviceId: {
            type: String,
            required: true
        },
        platform: {
            type: String,
            enum: ['ios', 'android'],
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Addresses
    addresses: [{
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }],
    defaultAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    },

    // User Stats
    totalOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.otp;
            delete ret.otpExpiry;
            delete ret.refreshToken;
            delete ret.password;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ referralCode: 1 });
UserSchema.index({ role: 1 });

// Pre-save: Generate unique referral code
UserSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        this.referralCode = await generateUniqueReferralCode();
    }
    next();
});

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function (): string {
    return jwt.sign(
        { id: this._id.toString(), role: this.role },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    );
};

// Generate Refresh token
UserSchema.methods.getRefreshToken = function (): string {
    const refreshToken = jwt.sign(
        { id: this._id.toString() },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: '30d' }
    );

    this.refreshToken = refreshToken;
    return refreshToken;
};

// Generate OTP
UserSchema.methods.generateOTP = function (): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    this.otp = crypto.createHash('sha256').update(otp).digest('hex');
    this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return otp;
};

// Verify OTP
UserSchema.methods.verifyOTP = function (otp: string): boolean {
    if (!this.otp || !this.otpExpiry) return false;

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (hashedOTP === this.otp && this.otpExpiry > new Date()) {
        return true;
    }
    return false;
};

// Helper function to generate unique referral code
async function generateUniqueReferralCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code exists
    const existingUser = await mongoose.model('User').findOne({ referralCode: code });
    if (existingUser) {
        return generateUniqueReferralCode(); // Recursive call if code exists
    }

    return code;
}

export default mongoose.model<IUser>('User', UserSchema);