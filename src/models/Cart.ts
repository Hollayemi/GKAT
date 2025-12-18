import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import PaymentGateway from '../services/payment';


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
    unitQuantity: number;
    maxQuantity: number; 
    totalPrice: number;
}

// Interface for Applied Coupon
export interface IAppliedCoupon {
    code: string;
    promotionName: string;
    promoType: string; // promoType (percentage, fixed, etc.)
    discountValue: number;
    discountAmount: number;
    appliedAt: Date;
}

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
    availableCoupons: string[];

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
        unitQuantity: number;
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

interface ICartModel extends Model<ICart> {
    findOrCreateCart(userId: Types.ObjectId): Promise<ICart>;
    getActiveCart(userId: Types.ObjectId): Promise<ICart | null>;
}

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
const appliedCouponSchema = new Schema<IAppliedCoupon>({
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

const cartSchema = new Schema<ICart, ICartModel>({
    userId: {
        type: Schema.Types.ObjectId,
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
        type: Schema.Types.ObjectId,
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
    return this.discount + this.appliedCoupons.reduce((total, coupon) =>
        total + coupon.discountAmount, 0
    );
});

cartSchema.pre('save', function (next) {
    this.calculateTotals();
    this.lastModified = new Date();
    next();
});

cartSchema.methods.calculateTotals = function (): void {
    // Calculate subtotal from items
    this.subtotal = this.items.reduce((total: number, item: any) => {
        item.totalPrice = item.price * item.quantity;
        return total + item.totalPrice;
    }, 0);

    // Calculate discount from coupons
    let totalCouponDiscount = 0;
    this.appliedCoupons.forEach((coupon: any) => {
        const promoType = coupon.promoType.toLowerCase();

        if (promoType.includes('percentage') || promoType.includes('%')) {
            let discount = (this.subtotal * coupon.discountValue) / 100;
            coupon.discountAmount = discount;
        } else if (promoType.includes('fixed') || promoType.includes('flat')) {
            coupon.discountAmount = Math.min(coupon.discountValue, this.subtotal - totalCouponDiscount);
        } else {
            // Default to percentage
            let discount = (this.subtotal * coupon.discountValue) / 100;
            coupon.discountAmount = discount;
        }

        totalCouponDiscount += coupon.discountAmount;
    });

    this.discount = totalCouponDiscount;

    // Calculate total (subtotal + fees - discount)
    this.totalAmount = Math.max(0,
        this.subtotal + this.deliveryFee + this.serviceCharge - this.discount
    );
};

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

cartSchema.methods.applyCoupon = async function (couponCode: string): Promise<ICart> {
    // Check if coupon is already applied
    if (this.appliedCoupons.some((c: any) => c.code === couponCode.toUpperCase())) {
        throw new Error('Coupon already applied');
    }

    const Coupon = mongoose.model('Coupon');

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
        const hasApplicableCategory = this.items.some((item: any) =>
            coupon.applicableCategories.includes(item.category)
        );

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
    } else if (promoType.includes('fixed') || promoType.includes('flat')) {
        // Fixed amount discount
        discountAmount = coupon.discountValue;
    } else {
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

cartSchema.methods.removeCoupon = function (couponCode: string): Promise<ICart> {
    this.appliedCoupons = this.appliedCoupons.filter(
        (c: any) => c.code !== couponCode.toUpperCase()
    );
    return this.save();
};

cartSchema.methods.clearCart = function (): Promise<ICart> {
    this.items = [];
    this.appliedCoupons = [];
    this.discount = 0;
    return this.save();
};

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

cartSchema.statics.findOrCreateCart = async function (userId: Types.ObjectId): Promise<ICart> {
    let cart = await this.findOne({ userId, isActive: true });
    if (!cart) {
        cart = new this({ userId });
        await cart.save();
    }
    return cart;
};

cartSchema.statics.getActiveCart = function (userId: Types.ObjectId): Promise<ICart | null> {
    return this.findOne({ userId, isActive: true })
        .populate('items.productId', 'productName images status stockQuantity')
        .exec();
};

const Cart: ICartModel = mongoose.model<ICart, ICartModel>('Cart', cartSchema);

export default Cart;