import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ICoupon extends Document {
    code: string;
    title: string;
    description?: string;

    // Discount Configuration
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxDiscount?: number; // For percentage discounts
    minPurchase?: number; // Minimum order amount required

    // Validity
    startDate: Date;
    expiresAt: Date;
    isActive: boolean;

    // Usage Limits
    maxUsage?: number; // Total times coupon can be used
    maxUsagePerUser?: number; // Max times per user
    currentUsage: number;

    // User Restrictions
    userType?: 'all' | 'new' | 'existing'; // Who can use it
    specificUsers?: Types.ObjectId[]; // Specific user IDs

    // Product Restrictions
    applicableProducts?: Types.ObjectId[]; // Specific products
    applicableCategories?: string[]; // Specific categories
    excludedProducts?: Types.ObjectId[];

    // UI Display
    backgroundColor?: string;
    icon?: string;
    terms?: string;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;

    // Virtuals
    isExpired: boolean;
    isAvailable: boolean;
    usageRemaining: number;

    // Methods
    canBeUsedBy(userId: Types.ObjectId): Promise<boolean>;
    incrementUsage(userId: Types.ObjectId): Promise<void>;
    validateForCart(cartTotal: number, cartItems: any[]): { valid: boolean; reason?: string };
}

interface ICouponModel extends Model<ICoupon> {
    getAvailableCoupons(userId: Types.ObjectId, cartTotal?: number): Promise<ICoupon[]>;
    validateCoupon(code: string, userId: Types.ObjectId): Promise<{ valid: boolean; coupon?: ICoupon; reason?: string }>;
}

const couponSchema = new Schema<ICoupon, ICouponModel>({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
        maxlength: 20
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },

    discountType: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed']
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscount: {
        type: Number,
        min: 0
    },
    minPurchase: {
        type: Number,
        min: 0,
        default: 0
    },

    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    maxUsage: {
        type: Number,
        min: 0
    },
    maxUsagePerUser: {
        type: Number,
        min: 0,
        default: 1
    },
    currentUsage: {
        type: Number,
        default: 0,
        min: 0
    },

    userType: {
        type: String,
        enum: ['all', 'new', 'existing'],
        default: 'all'
    },
    specificUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],

    applicableProducts: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: String
    }],
    excludedProducts: [{
        type: Schema.Types.ObjectId,
        ref: 'Product'
    }],

    backgroundColor: {
        type: String,
        default: '#8B5CF6'
    },
    icon: {
        type: String,
        default: '🎁'
    },
    terms: {
        type: String,
        trim: true
    },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ expiresAt: 1, isActive: 1 });
couponSchema.index({ userType: 1, isActive: 1 });

// Virtual: Is Expired
couponSchema.virtual('isExpired').get(function () {
    return new Date() > this.expiresAt;
});

// Virtual: Is Available
couponSchema.virtual('isAvailable').get(function () {
    if (!this.isActive || this.isExpired) return false;
    if (new Date() < this.startDate) return false;
    if (this.maxUsage && this.currentUsage >= this.maxUsage) return false;
    return true;
});

// Virtual: Usage Remaining
couponSchema.virtual('usageRemaining').get(function () {
    if (!this.maxUsage) return Infinity;
    return Math.max(0, this.maxUsage - this.currentUsage);
});

// Method: Can Be Used By User
couponSchema.methods.canBeUsedBy = async function (userId: Types.ObjectId): Promise<boolean> {
    // Check if coupon is available
    if (!this.isAvailable) return false;

    // Check specific users restriction
    if (this.specificUsers && this.specificUsers.length > 0) {
        if (!this.specificUsers.some((id: any) => id.toString() === userId.toString())) {
            return false;
        }
    }

    // Check user type restriction
    if (this.userType !== 'all') {
        const User = mongoose.model('User');
        const Order = mongoose.model('Order');

        const user = await User.findById(userId);
        if (!user) return false;

        const orderCount = await Order.countDocuments({
            userId,
            orderStatus: 'delivered'
        });

        if (this.userType === 'new' && orderCount > 0) return false;
        if (this.userType === 'existing' && orderCount === 0) return false;
    }

    // Check per-user usage limit
    if (this.maxUsagePerUser) {
        const Order = mongoose.model('Order');
        const usageCount = await Order.countDocuments({
            userId,
            'appliedCoupons.code': this.code
        });

        if (usageCount >= this.maxUsagePerUser) return false;
    }

    return true;
};

// Method: Increment Usage
couponSchema.methods.incrementUsage = async function (userId: Types.ObjectId): Promise<void> {
    this.currentUsage += 1;
    await this.save();
};

// Method: Validate For Cart
couponSchema.methods.validateForCart = function (
    cartTotal: number,
    cartItems: any[]
): { valid: boolean; reason?: string } {
    // Check if available
    if (!this.isAvailable) {
        return { valid: false, reason: 'Coupon is not available' };
    }

    // Check minimum purchase
    if (this.minPurchase && cartTotal < this.minPurchase) {
        return {
            valid: false,
            reason: `Minimum purchase of ₦${this.minPurchase.toLocaleString()} required`
        };
    }

    // Check product restrictions
    if (this.applicableProducts && this.applicableProducts.length > 0) {
        const hasApplicableProduct = cartItems.some(item =>
            this.applicableProducts!.some((pid: any) =>
                pid.toString() === item.productId.toString()
            )
        );

        if (!hasApplicableProduct) {
            return {
                valid: false,
                reason: 'Coupon not applicable to cart items'
            };
        }
    }

    // Check category restrictions
    if (this.applicableCategories && this.applicableCategories.length > 0) {
        const hasApplicableCategory = cartItems.some(item =>
            this.applicableCategories!.includes(item.category)
        );

        if (!hasApplicableCategory) {
            return {
                valid: false,
                reason: 'Coupon not applicable to cart items'
            };
        }
    }

    // Check excluded products
    if (this.excludedProducts && this.excludedProducts.length > 0) {
        const hasExcludedProduct = cartItems.some(item =>
            this.excludedProducts!.some((pid: any) =>
                pid.toString() === item.productId.toString()
            )
        );

        if (hasExcludedProduct) {
            return {
                valid: false,
                reason: 'Cart contains excluded products'
            };
        }
    }

    return { valid: true };
};

// Static: Get Available Coupons
couponSchema.statics.getAvailableCoupons = async function (
    userId: Types.ObjectId,
    cartTotal?: number
): Promise<ICoupon[]> {
    const now = new Date();

    // Base query
    const query: any = {
        isActive: true,
        startDate: { $lte: now },
        expiresAt: { $gt: now }
    };

    // Add usage limit check
    query.$or = [
        { maxUsage: { $exists: false } },
        { $expr: { $lt: ['$currentUsage', '$maxUsage'] } }
    ];

    let coupons = await this.find(query).sort({ createdAt: -1 });

    // Filter by user eligibility
    const eligibleCoupons: ICoupon[] = [];

    for (const coupon of coupons) {
        const canUse = await coupon.canBeUsedBy(userId);
        if (canUse) {
            // Further filter by cart total if provided
            if (cartTotal !== undefined) {
                if (!coupon.minPurchase || cartTotal >= coupon.minPurchase) {
                    eligibleCoupons.push(coupon);
                }
            } else {
                eligibleCoupons.push(coupon);
            }
        }
    }

    return eligibleCoupons;
};

// Static: Validate Coupon
couponSchema.statics.validateCoupon = async function (
    code: string,
    userId: Types.ObjectId
): Promise<{ valid: boolean; coupon?: ICoupon; reason?: string }> {
    const coupon = await this.findOne({
        code: code.toUpperCase(),
        isActive: true
    });

    if (!coupon) {
        return { valid: false, reason: 'Invalid coupon code' };
    }

    if (!coupon.isAvailable) {
        return { valid: false, reason: 'Coupon is not available' };
    }

    const canUse = await coupon.canBeUsedBy(userId);
    if (!canUse) {
        return { valid: false, reason: 'You are not eligible to use this coupon' };
    }

    return { valid: true, coupon };
};

const Coupon: ICouponModel = mongoose.model<ICoupon, ICouponModel>('Coupon', couponSchema);

export default Coupon;