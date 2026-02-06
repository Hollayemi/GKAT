"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const StaffSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
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
        transform: function (doc, ret) {
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
StaffSchema.pre('save', async function (next) {
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
StaffSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        return false;
    }
};
// Generate temporary password method
StaffSchema.methods.generateTemporaryPassword = function () {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
    let password = 'Temp@';
    for (let i = 0; i < 8; i++) {
        password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return password;
};
StaffSchema.methods.getSignedJwtToken = function () {
    return jsonwebtoken_1.default.sign({ id: this._id.toString(),
        role: this.role,
        customPermissions: this.customPermissions,
        region: this.region,
        status: this.status
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
StaffSchema.methods.getRefreshToken = function () {
    const refreshToken = jsonwebtoken_1.default.sign({ id: this._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    this.refreshToken = refreshToken;
    return refreshToken;
};
StaffSchema.methods.generateOTP = function () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return otp;
};
StaffSchema.methods.verifyOTP = function (otp) {
    if (!this.otp || !this.otpExpiry)
        return false;
    const hashedOTP = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    if (hashedOTP === this.otp && this.otpExpiry > new Date()) {
        return true;
    }
    return false;
};
exports.default = mongoose_1.default.model('Staff', StaffSchema);
//# sourceMappingURL=Staff.model.js.map