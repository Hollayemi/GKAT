import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import PaymentGateway from '../services/payment';

// Interface for Cart Item with detailed product info
export interface ICartItem {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    name: string;
    brand?: string;
    category: string;
    price: number;
    quantity: number;
    image?: string;
    unitType: string;
    unitQuantity: string;
    maxQuantity: number; // Stock limit
    totalPrice: number;
}

// Interface for Applied Coupon
export interface IAppliedCoupon {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    minPurchase?: number;
    maxDiscount?: number;
    appliedAt: Date;
}

// Interface for Cart Document
export interface ICart extends Document {
    userId: Types.ObjectId;
    items: ICartItem[];

    // Pricing breakdown
    subtotal: number;
    deliveryFee: number;
    serviceCharge: number;
    discount: number;
    totalAmount: number;

    // Coupon management
    appliedCoupons: IAppliedCoupon[];
    availableCoupons: string[]; // Coupon codes user can apply

    // Delivery info
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryAddress?: Types.ObjectId;
    estimatedDeliveryTime?: string;

    // Cart status
    isActive: boolean;
    expiresAt?: Date;
    lastModified: Date;

    createdAt: Date;
    updatedAt: Date;

    // Computed properties
    totalItems: number;
    totalSavings: number;

    // Instance methods
    addItem(productData: {
        id: Types.ObjectId;
        variantId?: Types.ObjectId;
        name: string;
        brand?: string;
        category: string;
        price: number;
        quantity?: number;
        image?: string;
        unitType: string;
        unitQuantity: string;
        maxQuantity: number;
    }): Promise<ICart>;

    removeItem(productId: Types.ObjectId, variantId?: Types.ObjectId): Promise<ICart>;
    updateItemQuantity(productId: Types.ObjectId, quantity: number, variantId?: Types.ObjectId): Promise<ICart>;
    applyCoupon(couponCode: string): Promise<ICart>;
    removeCoupon(couponCode: string): Promise<ICart>;
    clearCart(): Promise<ICart>;
    calculateTotals(): void;
    validateStock(): Promise<{ valid: boolean; outOfStock: string[] }>;
}

// Interface for Cart Model with static methods
interface ICartModel extends Model<ICart> {
    findOrCreateCart(userId: Types.ObjectId): Promise<ICart>;
    getActiveCart(userId: Types.ObjectId): Promise<ICart | null>;
}

// Cart Item Schema
const cartItemSchema = new Schema<ICartItem>({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variantId: {
        type: Schema.Types.ObjectId
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
        type: String,
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
const appliedCouponSchema = new Schema<IAppliedCoupon>({
    code: {
        type: String,
        required: true,
        uppercase: true
    },
    discountType: {
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
    minPurchase: {
        type: Number,
        min: 0
    },
    maxDiscount: {
        type: Number,
        min: 0
    },
    appliedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Cart Schema
const cartSchema = new Schema<ICart, ICartModel>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [cartItemSchema],

    // Pricing
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

    // Coupons
    appliedCoupons: [appliedCouponSchema],
    availableCoupons: [{
        type: String,
        uppercase: true
    }],

    // Delivery
    deliveryMethod: {
        type: String,
        enum: ['pickup', 'delivery']
    },
    deliveryAddress: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    },
    estimatedDeliveryTime: {
        type: String
    },

    // Status
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

// Indexes
cartSchema.index({ userId: 1, isActive: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual: Total Items Count
cartSchema.virtual('totalItems').get(function () {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual: Total Savings
cartSchema.virtual('totalSavings').get(function () {
    return this.discount + this.appliedCoupons.reduce((total, coupon) =>
        total + coupon.discountAmount, 0
    );
});

// Pre-save middleware to calculate totals
cartSchema.pre('save', function (next) {
    this.calculateTotals();
    this.lastModified = new Date();
    next();
});

// Calculate totals method
cartSchema.methods.calculateTotals = function (): void {
    // Calculate subtotal
    this.subtotal = this.items.reduce((total: number, item: any) => {
        item.totalPrice = item.price * item.quantity;
        return total + item.totalPrice;
    }, 0);

    // Calculate coupon discounts
    let totalCouponDiscount = 0;
    this.appliedCoupons.forEach((coupon: any) => {
        if (coupon.discountType === 'percentage') {
            let discount = (this.subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
                discount = Math.min(discount, coupon.maxDiscount);
            }
            coupon.discountAmount = discount;
        } else {
            coupon.discountAmount = coupon.discountValue;
        }
        totalCouponDiscount += coupon.discountAmount;
    });

    this.discount = totalCouponDiscount;

    // Calculate total (subtotal + fees - discount)
    this.totalAmount = Math.max(0,
        this.subtotal + this.deliveryFee + this.serviceCharge - this.discount
    );
};

// Add item to cart
cartSchema.methods.addItem = function (productData: any): Promise<ICart> {
    const itemKey = productData.variantId
        ? `${productData.id}-${productData.variantId}`
        : productData.id.toString();

    const existingItemIndex = this.items.findIndex((item: ICartItem) => {
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
    } else {
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

// Remove item from cart
cartSchema.methods.removeItem = function (productId: Types.ObjectId, variantId?: Types.ObjectId): Promise<ICart> {
    this.items = this.items.filter((item: ICartItem) => {
        if (variantId) {
            return !(item.productId.toString() === productId.toString() &&
                item.variantId?.toString() === variantId.toString());
        }
        return item.productId.toString() !== productId.toString();
    });
    return this.save();
};

// Update item quantity
cartSchema.methods.updateItemQuantity = function (
    productId: Types.ObjectId,
    quantity: number,
    variantId?: Types.ObjectId
): Promise<ICart> {
    console.log('Updating item quantity:', { productId, quantity, variantId });
    console.log('Current cart items before update:', this.items);
    const item = this.items.find((item: ICartItem) => {
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
    const serviceCharge = new PaymentGateway().getPaymentFees("paystack", quantity * item.price);

    this.serviceCharge = serviceCharge;

    console.log('Calculated service charge:', serviceCharge);

    return this.save();
};

// Apply coupon
cartSchema.methods.applyCoupon = async function (couponCode: string): Promise<ICart> {
    // Check if coupon already applied
    if (this.appliedCoupons.some((c: any) => c.code === couponCode.toUpperCase())) {
        throw new Error('Coupon already applied');
    }

    // Fetch coupon from database (you need to implement Coupon model)
    const Coupon = mongoose.model('Coupon');
    const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        expiresAt: { $gt: new Date() }
    });

    if (!coupon) {
        throw new Error('Invalid or expired coupon');
    }

    // Check minimum purchase requirement
    if (coupon.minPurchase && this.subtotal < coupon.minPurchase) {
        throw new Error(`Minimum purchase of ₦${coupon.minPurchase} required`);
    }

    // Add coupon
    this.appliedCoupons.push({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: 0, // Will be calculated in calculateTotals
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount,
        appliedAt: new Date()
    });

    return this.save();
};

// Remove coupon
cartSchema.methods.removeCoupon = function (couponCode: string): Promise<ICart> {
    this.appliedCoupons = this.appliedCoupons.filter(
        (c: any) => c.code !== couponCode.toUpperCase()
    );
    return this.save();
};

// Clear cart
cartSchema.methods.clearCart = function (): Promise<ICart> {
    this.items = [];
    this.appliedCoupons = [];
    this.discount = 0;
    return this.save();
};

// Validate stock availability
cartSchema.methods.validateStock = async function (): Promise<{ valid: boolean; outOfStock: string[] }> {
    const Product = mongoose.model('Product');
    const outOfStock: string[] = [];

    for (const item of this.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
            outOfStock.push(item.name);
            continue;
        }

        const availableStock = item.variantId
            ? product.variants.find((v: any) => v._id.toString() === item.variantId?.toString())?.stockQuantity
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

// Static: Find or create cart
cartSchema.statics.findOrCreateCart = async function (userId: Types.ObjectId): Promise<ICart> {
    let cart = await this.findOne({ userId, isActive: true });
    if (!cart) {
        cart = new this({ userId });
        await cart.save();
    }
    return cart;
};

// Static: Get active cart
cartSchema.statics.getActiveCart = function (userId: Types.ObjectId): Promise<ICart | null> {
    return this.findOne({ userId, isActive: true })
        .populate('items.productId', 'productName images status stockQuantity')
        .exec();
};

const Cart: ICartModel = mongoose.model<ICart, ICartModel>('Cart', cartSchema);

export default Cart;