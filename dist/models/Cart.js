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
const payment_1 = __importDefault(require("../services/payment"));
const cartItemSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variantId: {
        type: mongoose_1.Schema.Types.ObjectId
    },
    name: {
        type: String,
        required: true
    },
    brand: {
        type: String
    },
    category: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    image: {
        type: String
    },
    unitType: {
        type: String,
        required: true
    },
    unitQuantity: {
        type: Number,
        required: true
    },
    maxQuantity: {
        type: Number,
        required: true,
        min: 0
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });
// Applied Coupon Schema
const appliedCouponSchema = new mongoose_1.Schema({
    code: {
        type: String,
        required: true,
        uppercase: true
    },
    promoType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    discountAmount: {
        type: Number,
        required: true,
        min: 0
    },
    // minPurchase: {
    //     type: Number,
    //     min: 0
    // },
    // maxDiscount: {
    //     type: Number,
    //     min: 0
    // },
    appliedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });
const cartSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [cartItemSchema],
    subtotal: {
        type: Number,
        default: 0,
        min: 0
    },
    deliveryFee: {
        type: Number,
        default: 0,
        min: 0
    },
    serviceCharge: {
        type: Number,
        default: 200, // ₦200 default service charge
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    appliedCoupons: [appliedCouponSchema],
    availableCoupons: [{
            type: String,
            uppercase: true
        }],
    deliveryMethod: {
        type: String,
        enum: ['pickup', 'delivery']
    },
    deliveryAddress: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Address'
    },
    estimatedDeliveryTime: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date
    },
    lastModified: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
cartSchema.index({ userId: 1, isActive: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.virtual('totalItems').get(function () {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});
cartSchema.virtual('totalSavings').get(function () {
    return this.discount + this.appliedCoupons.reduce((total, coupon) => total + coupon.discountAmount, 0);
});
cartSchema.pre('save', function (next) {
    this.calculateTotals();
    this.lastModified = new Date();
    next();
});
cartSchema.methods.calculateTotals = function () {
    // Calculate subtotal from items
    this.subtotal = this.items.reduce((total, item) => {
        item.totalPrice = item.price * item.quantity;
        return total + item.totalPrice;
    }, 0);
    // Calculate discount from coupons
    let totalCouponDiscount = 0;
    this.appliedCoupons.forEach((coupon) => {
        const promoType = coupon.promoType.toLowerCase();
        if (promoType.includes('percentage') || promoType.includes('%')) {
            let discount = (this.subtotal * coupon.discountValue) / 100;
            coupon.discountAmount = discount;
        }
        else if (promoType.includes('fixed') || promoType.includes('flat')) {
            coupon.discountAmount = Math.min(coupon.discountValue, this.subtotal - totalCouponDiscount);
        }
        else {
            // Default to percentage
            let discount = (this.subtotal * coupon.discountValue) / 100;
            coupon.discountAmount = discount;
        }
        totalCouponDiscount += coupon.discountAmount;
    });
    this.discount = totalCouponDiscount;
    // Calculate total (subtotal + fees - discount)
    this.totalAmount = Math.max(0, this.subtotal + this.deliveryFee + this.serviceCharge - this.discount);
};
cartSchema.methods.addItem = function (productData) {
    const itemKey = productData.variantId
        ? `${productData.id}-${productData.variantId}`
        : productData.id.toString();
    const existingItemIndex = this.items.findIndex((item) => {
        const currentKey = item.variantId
            ? `${item.productId}-${item.variantId}`
            : item.productId.toString();
        return currentKey === itemKey;
    });
    if (existingItemIndex >= 0) {
        // Update existing item
        const newQuantity = this.items[existingItemIndex].quantity + (productData.quantity || 1);
        if (newQuantity > this.items[existingItemIndex].maxQuantity) {
            throw new Error(`Cannot add more than ${this.items[existingItemIndex].maxQuantity} items`);
        }
        this.items[existingItemIndex].quantity = newQuantity;
    }
    else {
        // Add new item
        this.items.push({
            productId: productData.id,
            variantId: productData.variantId,
            name: productData.name,
            brand: productData.brand,
            category: productData.category,
            price: productData.price,
            quantity: productData.quantity || 1,
            image: productData.image,
            unitType: productData.unitType,
            unitQuantity: productData.unitQuantity,
            maxQuantity: productData.maxQuantity,
            totalPrice: productData.price * (productData.quantity || 1)
        });
    }
    return this.save();
};
cartSchema.methods.removeItem = function (productId, variantId) {
    this.items = this.items.filter((item) => {
        if (variantId) {
            return !(item.productId.toString() === productId.toString() &&
                item.variantId?.toString() === variantId.toString());
        }
        return item.productId.toString() !== productId.toString();
    });
    return this.save();
};
cartSchema.methods.updateItemQuantity = function (productId, quantity, variantId) {
    console.log('Updating item quantity:', { productId, quantity, variantId });
    console.log('Current cart items before update:', this.items);
    const item = this.items.find((item) => {
        if (variantId) {
            return item.productId.toString() === productId.toString() &&
                item.variantId?.toString() === variantId.toString();
        }
        return item.productId._id.toString() === productId.toString();
    });
    if (!item) {
        throw new Error('Item not found in cart');
    }
    if (quantity <= 0) {
        return this.removeItem(productId, variantId);
    }
    if (quantity > this.maxQuantity) {
        throw new Error(`Maximum quantity is ${this.maxQuantity}`);
    }
    item.quantity = quantity;
    const serviceCharge = new payment_1.default().getPaymentFees("paystack", quantity * item.price);
    this.serviceCharge = serviceCharge;
    console.log('Calculated service charge:', serviceCharge);
    return this.save();
};
cartSchema.methods.applyCoupon = async function (couponCode) {
    // Check if coupon is already applied
    if (this.appliedCoupons.some((c) => c.code === couponCode.toUpperCase())) {
        throw new Error('Coupon already applied');
    }
    const Coupon = mongoose_1.default.model('Coupon');
    // Find the coupon using the new field names
    const coupon = await Coupon.findOne({
        couponCode: couponCode.toUpperCase(),
        isActive: true,
        endDateTime: { $gt: new Date() },
        startDateTime: { $lte: new Date() }
    });
    console.log('Applying coupon:', couponCode, coupon);
    if (!coupon) {
        throw new Error('Invalid or expired coupon');
    }
    // Check if coupon has reached usage limit
    if (coupon.currentUsage >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached');
    }
    // Check minimum order value
    if (coupon.minimumOrderValue && this.subtotal < coupon.minimumOrderValue) {
        throw new Error(`Minimum order value of ₦${coupon.minimumOrderValue} required`);
    }
    // Check applicable categories
    if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
        const hasApplicableCategory = this.items.some((item) => coupon.applicableCategories.includes(item.category));
        if (!hasApplicableCategory) {
            throw new Error('Coupon not applicable to cart items');
        }
    }
    // Calculate discount amount based on promo type
    let discountAmount = 0;
    const promoType = coupon.promoType.toLowerCase();
    if (promoType.includes('percentage') || promoType.includes('%')) {
        // Percentage discount
        discountAmount = (this.subtotal * coupon.discountValue) / 100;
    }
    else if (promoType.includes('fixed') || promoType.includes('flat')) {
        // Fixed amount discount
        discountAmount = coupon.discountValue;
    }
    else {
        // Default to percentage
        discountAmount = (this.subtotal * coupon.discountValue) / 100;
    }
    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, this.subtotal);
    this.appliedCoupons.push({
        code: coupon.couponCode,
        promotionName: coupon.promotionName,
        promoType: coupon.promoType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount,
        appliedAt: new Date()
    });
    return this.save();
};
cartSchema.methods.removeCoupon = function (couponCode) {
    this.appliedCoupons = this.appliedCoupons.filter((c) => c.code !== couponCode.toUpperCase());
    return this.save();
};
cartSchema.methods.clearCart = function () {
    this.items = [];
    this.appliedCoupons = [];
    this.discount = 0;
    return this.save();
};
cartSchema.methods.validateStock = async function () {
    const Product = mongoose_1.default.model('Product');
    const outOfStock = [];
    for (const item of this.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
            outOfStock.push(item.name);
            continue;
        }
        const availableStock = item.variantId
            ? product.variants.find((v) => v._id.toString() === item.variantId?.toString())?.stockQuantity
            : product.stockQuantity;
        if (!availableStock || availableStock < item.quantity) {
            outOfStock.push(item.name);
        }
    }
    return {
        valid: outOfStock.length === 0,
        outOfStock
    };
};
cartSchema.statics.findOrCreateCart = async function (userId) {
    let cart = await this.findOne({ userId, isActive: true });
    if (!cart) {
        cart = new this({ userId });
        await cart.save();
    }
    return cart;
};
cartSchema.statics.getActiveCart = function (userId) {
    return this.findOne({ userId, isActive: true })
        .populate('items.productId', 'productName images status stockQuantity')
        .exec();
};
const Cart = mongoose_1.default.model('Cart', cartSchema);
exports.default = Cart;
//# sourceMappingURL=Cart.js.map