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
const crypto_1 = __importDefault(require("crypto"));
const DriverSchema = new mongoose_1.Schema({
    // Basic Information
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.ObjectId,
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
        transform: function (doc, ret) {
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
DriverSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    try {
        const salt = await bcryptjs_1.default.genSalt(10);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// Compare password method
DriverSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        if (!this.password)
            return false;
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        return false;
    }
};
// Generate password setup token
DriverSchema.methods.generatePasswordSetupToken = function () {
    // Generate random token
    const token = crypto_1.default.randomBytes(32).toString('hex');
    // Hash token and set to passwordSetupToken field
    this.passwordSetupToken = crypto_1.default
        .createHash('sha256')
        .update(token)
        .digest('hex');
    // Set expiry to 24 hours
    this.passwordSetupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return token; // Return unhashed token to send via email
};
// Virtual for completion rate
DriverSchema.virtual('completionRate').get(function () {
    if (this.totalDeliveries === 0)
        return 0;
    return ((this.completedDeliveries / this.totalDeliveries) * 100).toFixed(1);
});
// Check if license is expiring soon (within 30 days)
DriverSchema.virtual('isLicenseExpiringSoon').get(function () {
    if (!this.licenseExpiry)
        return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return this.licenseExpiry < thirtyDaysFromNow;
});
exports.default = mongoose_1.default.model('Driver', DriverSchema);
//# sourceMappingURL=Driver.js.map