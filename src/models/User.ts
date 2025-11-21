import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

export interface IUser extends Document {
    name: string;
    email?: string;
    phoneNumber: string;
    residentArea: string;
    avatar?: string;
    role: 'user' | 'admin' | 'driver';
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    referralCode: string;
    referredBy?: string;
    notificationsEnabled: boolean;
    biometricsEnabled: boolean;
    otp?: string;
    otpExpiry?: Date;
    refreshToken?: string;
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
    phoneNumber: {
        type: String,
        required: [true, 'Please add a phone number'],
        unique: true,
        trim: true
    },
    residentArea: {
        type: String,
        required: [true, 'Please add a resident area'],
        default: '+234'
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'driver'],
        default: 'user'
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
        unique: true,
        index: true
    },
    referredBy: {
        type: String,
        default: null
    },
    notificationsEnabled: {
        type: Boolean,
        default: true
    },
    biometricsEnabled: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
        select: false
    },
    otpExpiry: {
        type: Date,
        select: false
    },
    refreshToken: {
        type: String,
        select: false
    },
}, {
    timestamps: true
});

// Generate unique referral code before saving
UserSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        this.referralCode = await generateUniqueReferralCode();
    }
    next();
});


UserSchema.pre('save', async function (next) {

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
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving
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