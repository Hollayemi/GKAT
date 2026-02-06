import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IOrderItem {
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
    totalPrice: number;
}

export interface IShippingAddress {
    label: string; // "Home", "Shop", "Office"
    fullname: string;
    address: string;
    phone: string;
    state: string;
    city?: string;
    zipCode?: string;
    email?: string;
    isDefault?: boolean;
}

export type PaymentMethod = 'palmpay' | 'paystack' | 'opay' | 'cash_on_delivery';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';

export interface IPaymentInfo {
    method: PaymentMethod;
    reference?: string;
    transactionId?: string;
    paymentStatus: PaymentStatus;
    paidAt?: Date;
    amount: number;
}

export interface IStatusHistory {
    status: OrderStatus;
    timestamp: Date;
    note?: string;
    updatedBy?: Types.ObjectId;
}

export interface IAppliedCoupon {
    code: string;
    promotionName: string; 
    promoType: string;
    discountValue: number;
    discountAmount: number;
}

export interface IOrder extends Document {
    orderNumber: string;
    orderSlug: string;
    userId: Types.ObjectId;
    items: IOrderItem[];

    shippingAddress: string;
    deliveryMethod: 'pickup' | 'delivery';

    paymentInfo: IPaymentInfo;

    orderStatus: OrderStatus;

    subtotal: number;
    deliveryFee: number;
    serviceCharge: number;
    tax: number;
    discount: number;
    totalAmount: number;

    appliedCoupons: IAppliedCoupon[];

    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;

    notes?: string;
    adminNotes?: string;

    statusHistory: IStatusHistory[];

    cancellationReason?: string;
    returnReason?: string;
    refundAmount: number;
    refundedAt?: Date;

    rating?: number;
    review?: string;
    reviewedAt?: Date;

    createdAt: Date;
    updatedAt: Date;

    orderAge: number;
    isRecent: boolean;
    canCancel: boolean;
    canReturn: boolean;

    updateStatus(newStatus: OrderStatus, note?: string, updatedBy?: Types.ObjectId): Promise<IOrder>;
    addTrackingInfo(trackingNumber: string, carrier: string, estimatedDelivery?: Date): Promise<IOrder>;
    processPayment(reference: string, transactionId: string, paidAmount: number): Promise<IOrder>;
    cancelOrder(reason: string, cancelledBy?: Types.ObjectId): Promise<IOrder>;
    returnOrder(reason: string): Promise<IOrder>;
    addRating(rating: number, review?: string): Promise<IOrder>;
}

interface IOrderModel extends Model<IOrder> {
    getOrderStats(userId?: Types.ObjectId): Promise<Array<{
        _id: OrderStatus;
        count: number;
        totalAmount: number;
    }>>;
    generateOrderNumber(): Promise<string>;
    generateOrderSlug(): Promise<string>;
}

const orderItemSchema = new Schema<IOrderItem>({
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
        min: 1
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
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const shippingAddressSchema = new Schema<IShippingAddress>({
    label: {
        type: String,
        required: true,
        enum: ['Home', 'Shop', 'Office', 'Other']
    },
    fullname: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    zipCode: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { _id: false });


const paymentInfoSchema = new Schema<IPaymentInfo>({
    method: {
        type: String,
        required: true,
        enum: ['palmpay', 'paystack', 'opay', 'cash_on_delivery'] as PaymentMethod[]
    },
    reference: {
        type: String,
        trim: true
    },
    transactionId: {
        type: String,
        trim: true
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'] as PaymentStatus[],
        default: 'pending'
    },
    paidAt: {
        type: Date
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });


const statusHistorySchema = new Schema<IStatusHistory>({
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'] as OrderStatus[]
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        trim: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, { _id: false });

const appliedCouponSchema = new Schema<IAppliedCoupon>({
    code: {
        type: String,
        required: true,
        uppercase: true
    },
    promotionName: {
        type: String,
        required: true
    },
    promoType: {
        type: String,
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
    }
}, { _id: false });


const orderSchema = new Schema<IOrder, IOrderModel>({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    orderSlug: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    items: [orderItemSchema],

    shippingAddress: {
        type: String,  
        required: true,
        ref: 'Address'
    },
    deliveryMethod: {
        type: String,
        required: true,
        enum: ['pickup', 'delivery'],
        default: 'delivery'
    },

    paymentInfo: {
        type: paymentInfoSchema,
        required: true
    },

    orderStatus: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'] as OrderStatus[],
        default: 'pending',
        index: true
    },

    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    deliveryFee: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    serviceCharge: {
        type: Number,
        required: true,
        min: 0,
        default: 200
    },
    tax: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    discount: {
        type: Number,
        min: 0,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    appliedCoupons: [appliedCouponSchema],

    trackingNumber: {
        type: String,
        trim: true
    },
    carrier: {
        type: String,
        trim: true
    },
    estimatedDelivery: {
        type: Date
    },
    actualDelivery: {
        type: Date
    },

    notes: {
        type: String,
        trim: true,
        maxlength: 500
    },
    adminNotes: {
        type: String,
        trim: true,
        maxlength: 1000
    },

    statusHistory: [statusHistorySchema],

    cancellationReason: {
        type: String,
        trim: true
    },
    returnReason: {
        type: String,
        trim: true
    },
    refundAmount: {
        type: Number,
        min: 0,
        default: 0
    },
    refundedAt: {
        type: Date
    },

    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    reviewedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderSlug: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'paymentInfo.paymentStatus': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.reference': 1 });

orderSchema.pre('save', async function (next) {
    this.items.forEach(item => {
        item.totalPrice = item.price * item.quantity;
    });

    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

    this.totalAmount = this.subtotal + this.deliveryFee + this.serviceCharge + this.tax - this.discount;

    if (this.isNew && this.statusHistory.length === 0) {
        this.statusHistory.push({
            status: this.orderStatus,
            timestamp: new Date(),
            note: 'Order created'
        });
    }

    next();
});

orderSchema.virtual('orderAge').get(function () {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

orderSchema.virtual('isRecent').get(function () {
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return this.createdAt > thirtyDaysAgo;
});

orderSchema.virtual('canCancel').get(function () {
    return ['pending', 'confirmed'].includes(this.orderStatus) &&
        this.paymentInfo.paymentStatus !== 'completed';
});

orderSchema.virtual('canReturn').get(function () {
    if (this.orderStatus !== 'delivered') return false;

    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    return this.actualDelivery ? this.actualDelivery > sevenDaysAgo : false;
});

orderSchema.methods.updateStatus = function (
    newStatus: OrderStatus,
    note: string = '',
    updatedBy?: Types.ObjectId
): Promise<IOrder> {
    this.orderStatus = newStatus;
    this.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        note,
        updatedBy
    });

    if (newStatus === 'delivered' && !this.actualDelivery) {
        this.actualDelivery = new Date();
    }

    if (newStatus === 'shipped' && !this.estimatedDelivery) {
        this.estimatedDelivery = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days
    }

    return this.save();
};

orderSchema.methods.addTrackingInfo = function (
    trackingNumber: string,
    carrier: string,
    estimatedDelivery?: Date
): Promise<IOrder> {
    this.trackingNumber = trackingNumber;
    this.carrier = carrier;
    if (estimatedDelivery) {
        this.estimatedDelivery = estimatedDelivery;
    }
    return this.save();
};

orderSchema.methods.processPayment = function (
    reference: string,
    transactionId: string,
    paidAmount: number
): Promise<IOrder> {
    this.paymentInfo.reference = reference;
    this.paymentInfo.transactionId = transactionId;
    this.paymentInfo.paymentStatus = 'completed';
    this.paymentInfo.paidAt = new Date();
    this.paymentInfo.amount = paidAmount;

    if (this.orderStatus === 'pending') {
        this.orderStatus = 'confirmed';
        this.statusHistory.push({
            status: 'confirmed',
            timestamp: new Date(),
            note: 'Payment confirmed'
        });
    }

    return this.save();
};

orderSchema.methods.cancelOrder = function (
    reason: string,
    cancelledBy?: Types.ObjectId
): Promise<IOrder> {
    this.orderStatus = 'cancelled';
    this.cancellationReason = reason;
    this.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: `Order cancelled: ${reason}`,
        updatedBy: cancelledBy
    });

    if (this.paymentInfo.paymentStatus === 'completed') {
        this.paymentInfo.paymentStatus = 'refunded';
        this.refundAmount = this.totalAmount;
        this.refundedAt = new Date();
    }

    return this.save();
};

orderSchema.methods.returnOrder = function (reason: string): Promise<IOrder> {
    if (!this.canReturn) {
        throw new Error('Order cannot be returned');
    }

    this.orderStatus = 'returned';
    this.returnReason = reason;
    this.statusHistory.push({
        status: 'returned',
        timestamp: new Date(),
        note: `Order returned: ${reason}`
    });

    return this.save();
};

orderSchema.methods.addRating = function (rating: number, review?: string): Promise<IOrder> {
    if (this.orderStatus !== 'delivered') {
        throw new Error('Can only rate delivered orders');
    }

    this.rating = rating;
    if (review) {
        this.review = review;
    }
    this.reviewedAt = new Date();

    return this.save();
};

orderSchema.statics.getOrderStats = async function (userId?: Types.ObjectId) {
    const matchStage = userId ? { userId } : {};

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$orderStatus',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' }
            }
        }
    ]);

    return stats;
};

orderSchema.statics.generateOrderNumber = async function (): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    let isUnique = false;
    let orderNumber = '';

    while (!isUnique) {
        const random = Math.floor(100000 + Math.random() * 900000);
        orderNumber = `ORD-${year}${month}${day}-${random}`;

        const existing = await this.findOne({ orderNumber });
        if (!existing) {
            isUnique = true;
        }
    }

    return orderNumber;
};

orderSchema.statics.generateOrderSlug = async function (): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let slug = '';

    while (!isUnique) {
        slug = '';
        for (let i = 0; i < 8; i++) {
            slug += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        const existing = await this.findOne({ orderSlug: slug });
        if (!existing) {
            isUnique = true;
        }
    }

    return slug;
};

const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;