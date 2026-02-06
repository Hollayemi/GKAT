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
const couponSchema = new mongoose_1.Schema({
    promotionName: {
        type: String,
        required: [true, 'Promotion name is required'],
        trim: true,
        maxlength: [100, 'Promotion name cannot exceed 100 characters']
    },
    promoType: {
        type: String,
        required: [true, 'Promo type is required'],
        trim: true
    },
    couponCode: {
        type: String,
        required: [true, 'Coupon code is required'],
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
        maxlength: [20, 'Coupon code cannot exceed 20 characters']
    },
    discountValue: {
        type: Number,
        required: [true, 'Discount value is required'],
        min: [0, 'Discount value must be positive']
    },
    usageLimit: {
        type: Number,
        required: [true, 'Usage limit is required'],
        min: [1, 'Usage limit must be at least 1']
    },
    perUserLimit: {
        type: Number,
        required: [true, 'Per user limit is required'],
        min: [1, 'Per user limit must be at least 1'],
        default: 1
    },
    currentUsage: {
        type: Number,
        default: 0,
        min: 0
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    minimumOrderValue: {
        type: Number,
        min: [0, 'Minimum order value cannot be negative'],
        default: 0
    },
    applicableCategories: [{
            type: String,
            trim: true
        }],
    applicableProducts: [{
            type: String,
            trim: true
        }],
    startDateTime: {
        type: Date,
        required: [true, 'Start date and time is required'],
        index: true
    },
    endDateTime: {
        type: Date,
        required: [true, 'End date and time is required'],
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
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
couponSchema.index({ couponCode: 1, isActive: 1 });
couponSchema.index({ endDateTime: 1, isActive: 1 });
couponSchema.index({ createdAt: -1 });
couponSchema.index({ promotionName: 'text', description: 'text' });
couponSchema.virtual('isExpired').get(function () {
    return new Date() > this.endDateTime;
});
couponSchema.virtual('isAvailable').get(function () {
    if (!this.isActive || this.isExpired)
        return false;
    if (new Date() < this.startDateTime)
        return false;
    if (this.currentUsage >= this.usageLimit)
        return false;
    return true;
});
couponSchema.virtual('usageRemaining').get(function () {
    return Math.max(0, this.usageLimit - this.currentUsage);
});
couponSchema.pre('save', function (next) {
    if (this.endDateTime <= this.startDateTime) {
        next(new Error('End date must be after start date'));
        return;
    }
    if (this.promoType.toLowerCase().includes('percentage') ||
        this.promoType.toLowerCase().includes('%')) {
        if (this.discountValue < 0 || this.discountValue > 100) {
            next(new Error('Percentage discount must be between 0 and 100'));
            return;
        }
    }
    next();
});
couponSchema.methods.canBeUsedBy = async function (userId) {
    if (!this.isAvailable)
        return false;
    const Order = mongoose_1.default.model('Order');
    const userUsageCount = await Order.countDocuments({
        userId,
        'appliedCoupons.code': this.couponCode
    });
    if (userUsageCount >= this.perUserLimit)
        return false;
    return true;
};
couponSchema.methods.incrementUsage = async function (userId) {
    this.currentUsage += 1;
    await this.save();
};
couponSchema.methods.validateForCart = function (cartTotal, cartItems) {
    if (!this.isAvailable) {
        return { valid: false, reason: 'Coupon is not available' };
    }
    if (this.minimumOrderValue && cartTotal < this.minimumOrderValue) {
        return {
            valid: false,
            reason: `Minimum order value of ₦${this.minimumOrderValue.toLocaleString()} required`
        };
    }
    if (this.applicableCategories && this.applicableCategories.length > 0) {
        const hasApplicableCategory = cartItems.some(item => this.applicableCategories.includes(item.category));
        const hasApplicableProduct = cartItems.some(item => this.applicableProducts.includes(item.productId));
        if (!hasApplicableCategory && !hasApplicableProduct) {
            return {
                valid: false,
                reason: 'Coupon not applicable to cart items'
            };
        }
    }
    return { valid: true };
};
couponSchema.statics.getAvailableCoupons = async function (userId, cartTotal) {
    const now = new Date();
    const query = {
        isActive: true,
        startDateTime: { $lte: now },
        endDateTime: { $gt: now }
    };
    query.$expr = { $lt: ['$currentUsage', '$usageLimit'] };
    let coupons = await this.find(query).sort({ createdAt: -1 });
    const eligibleCoupons = [];
    for (const coupon of coupons) {
        const canUse = await coupon.canBeUsedBy(userId);
        if (canUse) {
            if (cartTotal !== undefined) {
                if (!coupon.minimumOrderValue || cartTotal >= coupon.minimumOrderValue) {
                    eligibleCoupons.push(coupon);
                }
            }
            else {
                eligibleCoupons.push(coupon);
            }
        }
    }
    return eligibleCoupons;
};
couponSchema.statics.validateCoupon = async function (code, userId) {
    const coupon = await this.findOne({
        couponCode: code.toUpperCase(),
        isActive: true
    });
    if (!coupon) {
        return { valid: false, reason: 'Invalid coupon code' };
    }
    if (!coupon.isAvailable) {
        if (coupon.isExpired) {
            return { valid: false, reason: 'Coupon has expired' };
        }
        if (new Date() < coupon.startDateTime) {
            return { valid: false, reason: 'Coupon is not yet active' };
        }
        if (coupon.currentUsage >= coupon.usageLimit) {
            return { valid: false, reason: 'Coupon usage limit reached' };
        }
        return { valid: false, reason: 'Coupon is not available' };
    }
    const canUse = await coupon.canBeUsedBy(userId);
    if (!canUse) {
        return { valid: false, reason: 'You have reached the usage limit for this coupon' };
    }
    return { valid: true, coupon };
};
const Coupon = mongoose_1.default.model('Coupon', couponSchema);
exports.default = Coupon;
//# sourceMappingURL=Coupon.js.map