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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const UserSchema = new mongoose_1.Schema({
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
    addresses: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Address'
        }],
    defaultAddress: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Address'
    },
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
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ referralCode: 1 });
UserSchema.index({ role: 1 });
UserSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        this.referralCode = await generateUniqueReferralCode();
    }
    next();
});
UserSchema.methods.getSignedJwtToken = function () {
    return jsonwebtoken_1.default.sign({ id: this._id.toString(), role: this.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
UserSchema.methods.getRefreshToken = function () {
    const refreshToken = jsonwebtoken_1.default.sign({ id: this._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    this.refreshToken = refreshToken;
    return refreshToken;
};
UserSchema.methods.generateOTP = function () {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otp = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return otp;
};
UserSchema.methods.verifyOTP = function (otp) {
    if (!this.otp || !this.otpExpiry)
        return false;
    const hashedOTP = crypto_1.default.createHash('sha256').update(otp).digest('hex');
    if (hashedOTP === this.otp && this.otpExpiry > new Date()) {
        return true;
    }
    return false;
};
async function generateUniqueReferralCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const existingUser = await mongoose_1.default.model('User').findOne({ referralCode: code });
    if (existingUser) {
        return generateUniqueReferralCode(); // Recursive call if code exists
    }
    return code;
}
exports.default = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map