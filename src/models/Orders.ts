import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IOrderItem {
    productId: Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    totalPrice: number;
}

export interface IShippingAddress {
    fullname: string;
    address: string;
    phone?: string;
    state: string;
    email?: string;
}

export type PaymentMethod = 'bank' | 'opay' | 'paypal' | 'paystack' | 'cash_on_delivery';

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
}

export interface IOrder extends Document {
    orderNumber: string;
    userId: Types.ObjectId;
    items: IOrderItem[];
    shippingAddress: IShippingAddress;
    paymentInfo: IPaymentInfo;
    orderStatus: OrderStatus;

    subtotal: number;
    shippingFee: number;
    deliveryMethod: string;
    tax: number;
    discount: number;
    totalAmount: number;

    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;

    notes?: string;
    adminNotes?: string;

    couponCode?: string;
    couponDiscount: number;

    statusHistory: IStatusHistory[];

    cancellationReason?: string;
    returnReason?: string;
    refundAmount: number;
    refundedAt?: Date;

    createdAt: Date;
    updatedAt: Date;

    orderAge: number;
    isRecent: boolean;

    updateStatus(newStatus: OrderStatus, note?: string): Promise<IOrder>;
    addTrackingInfo(trackingNumber: string, carrier: string, estimatedDelivery?: Date): Promise<IOrder>;
    processPayment(reference: string, paidAmount: number): Promise<IOrder>;
    cancelOrder(reason: string): Promise<IOrder>;
}

interface IOrderModel extends Model<IOrder> {
    getOrderStats(userId?: Types.ObjectId): Promise<Array<{
        _id: OrderStatus;
        count: number;
        totalAmount: number;
    }>>;
}

const orderItemSchema = new Schema<IOrderItem>({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
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
        type: String,
        default: ''
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    _id: false
});

const shippingAddressSchema = new Schema<IShippingAddress>({
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
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        trim: true
    }
}, {
    _id: false
});

const paymentInfoSchema = new Schema<IPaymentInfo>({
    method: {
        type: String,
        required: true,
        enum: ['bank', 'opay', 'paypal', 'paystack', 'cash_on_delivery'] as PaymentMethod[]
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
}, {
    _id: false
});

const statusHistorySchema = new Schema<IStatusHistory>({
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as OrderStatus[]
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    note: {
        type: String,
        trim: true
    }
}, {
    _id: false
});

const orderSchema = new Schema<IOrder, IOrderModel>({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    items: [orderItemSchema],
    shippingAddress: {
        type: shippingAddressSchema,
        required: true
    },
    paymentInfo: {
        type: paymentInfoSchema,
        required: true
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'] as OrderStatus[],
        default: 'pending'
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    shippingFee: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    deliveryMethod: {
        type: String,
        required: true,
        default: "pickup"
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
        trim: true
    },
    adminNotes: {
        type: String,
        trim: true
    },
    couponCode: {
        type: String,
        trim: true
    },
    couponDiscount: {
        type: Number,
        min: 0,
        default: 0
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
    }
}, {
    timestamps: true
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'paymentInfo.paymentStatus': 1 });
orderSchema.index({ createdAt: -1 });

orderSchema.pre('save', async function (next) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.shippingFee + this.tax - this.discount - this.couponDiscount;

    next();
});

orderSchema.methods.updateStatus = function (newStatus: OrderStatus, note: string = ''): Promise<IOrder> {
    this.orderStatus = newStatus;
    this.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        note: note
    });

    if (newStatus === 'delivered') {
        this.actualDelivery = new Date();
    }

    if (newStatus === 'shipped' && this.trackingNumber) {
        this.estimatedDelivery = new Date(Date.now() + (12 * 24 * 60 * 60 * 1000));
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

orderSchema.methods.processPayment = function (reference: string, paidAmount: number): Promise<IOrder> {
    this.paymentInfo.reference = reference;
    this.paymentInfo.paymentStatus = 'completed';
    this.paymentInfo.paidAt = new Date();
    this.paymentInfo.amount = paidAmount;

    return this.save();
};

orderSchema.methods.cancelOrder = function (reason: string): Promise<IOrder> {
    this.orderStatus = 'cancelled';
    this.cancellationReason = reason;
    this.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: `Order cancelled: ${reason}`
    });

    if (this.paymentInfo.paymentStatus === 'completed') {
        this.paymentInfo.paymentStatus = 'refunded';
        this.refundAmount = this.totalAmount;
        this.refundedAt = new Date();
    }

    return this.save();
};

orderSchema.statics.getOrderStats = async function (userId?: Types.ObjectId): Promise<Array<{
    _id: OrderStatus;
    count: number;
    totalAmount: number;
}>> {
    const matchStage = userId ? { userId: new Types.ObjectId(userId) } : {};

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

orderSchema.virtual('isRecent').get(function (this: IOrder): boolean {
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return this.createdAt > thirtyDaysAgo;
});

const Order: IOrderModel = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;