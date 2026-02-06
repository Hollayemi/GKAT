import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface IStaff extends Document {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role: Types.ObjectId;
    region?: string;
    branch?: string;
    status: 'active' | 'suspended' | 'disabled' | 'running';
    avatar?: string;
    customPermissions: string[];
    joinedDate: Date;
    lastLogin?: Date;
    suspendedAt?: Date;
    suspendedUntil?: Date;
    suspensionReason?: string;
    disabledAt?: Date;
    disablementReason?: string;
    passwordResetRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
    
    // Methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateTemporaryPassword(): string;
    getSignedJwtToken(): string;
    getRefreshToken(): string;
    generateOTP(): string;
    verifyOTP(otp: string): boolean;
}

const StaffSchema = new Schema<IStaff>({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
        type: String,
        required: [false, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    phone: {
        type: String,
        trim: true
    },
    role: {
        type: Schema.Types.ObjectId,
        ref: 'Role',
        required: [true, 'Role is required']
    },
    region: {
        type: String,
        trim: true,
        ref: 'Region'
    },
    branch: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'disabled', 'running'],
        default: 'active',
        index: true
    },
    avatar: {
        type: String
    },
    customPermissions: [{
        type: String
    }],
    joinedDate: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
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
    passwordResetRequired: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            const { password, ...result } = ret;
            return result;
        }
    },
    toObject: { virtuals: true }
});

// Indexes
StaffSchema.index({ email: 1 });
StaffSchema.index({ status: 1 });
StaffSchema.index({ role: 1 });
StaffSchema.index({ fullName: 'text', email: 'text' });

// Hash password before saving
StaffSchema.pre('save', async function(next) {
    next();
//     if (!this.isModified('password')) {
//         return next();
//     }

//     try {
//         const salt = await bcrypt.genSalt(10);
//         this.password = await bcrypt.hash(this.password, salt);
//         next();
//     } catch (error: any) {
//         next(error);
//     }
});

// Compare password method
StaffSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        return false;
    }
};

// Generate temporary password method
StaffSchema.methods.generateTemporaryPassword = function(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
    let password = 'Temp@';
    
    for (let i = 0; i < 8; i++) {
        password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return password;
};



StaffSchema.methods.getSignedJwtToken = function (): string {
    return jwt.sign(
        { id: this._id.toString(),
            role: this.role,
            customPermissions: this.customPermissions,
            region: this.region, 
            status: this.status
        },
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    );
};

StaffSchema.methods.getRefreshToken = function (): string {
    const refreshToken = jwt.sign(
        { id: this._id.toString() },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: '30d' }
    );

    this.refreshToken = refreshToken;
    return refreshToken;
};

StaffSchema.methods.generateOTP = function (): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    this.otp = crypto.createHash('sha256').update(otp).digest('hex');
    this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return otp;
};

StaffSchema.methods.verifyOTP = function (otp: string): boolean {
    if (!this.otp || !this.otpExpiry) return false;

    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    if (hashedOTP === this.otp && this.otpExpiry > new Date()) {
        return true;
    }
    return false;
};


export default mongoose.model<IStaff>('Staff', StaffSchema);