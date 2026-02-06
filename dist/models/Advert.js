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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const AdvertSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    image: {
        type: String,
        required: [true, 'Image is required']
    },
    targetUrl: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v)
                    return true;
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Target URL must be a valid URL starting with http:// or https://'
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    position: {
        type: String,
        default: 'top',
        enum: ['top', 'bottom', 'sidebar']
    },
    clicks: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Indexes
AdvertSchema.index({ isActive: 1, position: 1 });
AdvertSchema.index({ startDate: 1, endDate: 1 });
AdvertSchema.index({ createdAt: -1 });
// Virtual to check if advert is currently valid
AdvertSchema.virtual('isValid').get(function () {
    const now = new Date();
    if (!this.isActive)
        return false;
    if (this.startDate && now < this.startDate)
        return false;
    if (this.endDate && now > this.endDate)
        return false;
    return true;
});
// Pre-save validation
AdvertSchema.pre('save', function (next) {
    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
        next(new Error('End date must be after start date'));
        return;
    }
    next();
});
exports.default = mongoose_1.default.model('Advert', AdvertSchema);
//# sourceMappingURL=Advert.js.map