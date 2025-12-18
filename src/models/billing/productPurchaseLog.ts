import mongoose, { Schema, Document, Model, Types } from 'mongoose';


export enum PaymentStatus {
    PENDING_PAYMENT_CONFIRMATION = 'PENDING_PAYMENT_CONFIRMATION',
    PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export enum PaymentChannel {
    PAYSTACK = 'PAYSTACK',
    PALMPAY = 'PALMPAY',
    OPAY = 'OPAY',
    CASH_ON_DELIVERY = 'CASH_ON_DELIVERY'
}


export interface IPurchaseMeta {
    orderIds?: Types.ObjectId[];
    coin?: number;
    orderSlugs?: string[];
    items?: Array<{
        productId: Types.ObjectId;
        quantity: number;
        price: number;
    }>;
    shippingAddress?: {
        address: string;
        city: string;
        state: string;
        country: string;
        zipCode: string;
    };
    [key: string]: any;
}


export interface IPurchaseLog extends Document {
    userId: Types.ObjectId;
    amount: number;
    meta: IPurchaseMeta;
    payment_status: PaymentStatus;
    paymentChannel: PaymentChannel;
    transaction_ref: string;
    date?: Date;
    createdAt: Date;
    updatedAt: Date;
    formattedDate?: string;
    updateStatus(newStatus: PaymentStatus): Promise<IPurchaseLog>;
    isSuccessful(): boolean;
    isPending(): boolean;
}

interface IPurchaseLogModel extends Model<IPurchaseLog> {
    findByUserId(userId: Types.ObjectId | string): Promise<IPurchaseLog[]>;
    findByTransactionRef(transaction_ref: string): Promise<IPurchaseLog | null>;
    findByStatus(payment_status: PaymentStatus): Promise<IPurchaseLog[]>;
    findSuccessfulPayments(): Promise<IPurchaseLog[]>;
    findRecentPurchases(days?: number): Promise<IPurchaseLog[]>;
    getTotalRevenue(): Promise<number>;
    getRevenueByChannel(): Promise<Array<{ channel: PaymentChannel; total: number }>>;
}

const PurchaseLogSchema: Schema<IPurchaseLog> = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: [true, 'User ID is required'],
            ref: 'users',
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        meta: {
            type: Schema.Types.Mixed,
            required: [true, 'Meta data is required'],
            validate: {
                validator: function (value: any) {
                    return value && typeof value === 'object';
                },
                message: 'Meta must be an object'
            }
        },
        payment_status: {
            type: String,
            required: [true, 'Payment status is required'],
            enum: {
                values: Object.values(PaymentStatus),
                message: 'Invalid payment status'
            },
            default: PaymentStatus.PENDING_PAYMENT_CONFIRMATION
        },
        paymentChannel: {
            type: String,
            required: [true, 'Payment channel is required'],
            enum: {
                values: Object.values(PaymentChannel),
                message: 'Invalid payment channel'
            },
        },
        transaction_ref: {
            type: String,
            required: [true, 'Transaction reference is required'],
            unique: true,
            index: true,
            trim: true
        },
        date: {
            type: Date,
            required: false,
            default: Date.now
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret: any) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);



PurchaseLogSchema.index({ userId: 1, createdAt: -1 });
PurchaseLogSchema.index({ transaction_ref: 1 }, { unique: true });
PurchaseLogSchema.index({ payment_status: 1 });
PurchaseLogSchema.index({ paymentChannel: 1 });
PurchaseLogSchema.index({ createdAt: -1 });
PurchaseLogSchema.index({ userId: 1, payment_status: 1 });
PurchaseLogSchema.index({ 'meta.orderIds': 1 });



PurchaseLogSchema.statics.findByUserId = function (userId: Types.ObjectId | string): Promise<IPurchaseLog[]> {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email')
        .exec();
};

PurchaseLogSchema.statics.findByTransactionRef = function (transaction_ref: string): Promise<IPurchaseLog | null> {
    return this.findOne({ transaction_ref })
        .populate('userId', 'name email')
        .exec();
};

PurchaseLogSchema.statics.findByStatus = function (payment_status: PaymentStatus): Promise<IPurchaseLog[]> {
    return this.find({ payment_status })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email')
        .exec();
};

PurchaseLogSchema.statics.findSuccessfulPayments = function (): Promise<IPurchaseLog[]> {
    return this.find({ payment_status: PaymentStatus.PAYMENT_CONFIRMED })
        .sort({ createdAt: -1 })
        .exec();
};

PurchaseLogSchema.statics.findRecentPurchases = function (days: number = 7): Promise<IPurchaseLog[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return this.find({
        createdAt: { $gte: date },
        payment_status: PaymentStatus.PAYMENT_CONFIRMED
    })
        .sort({ createdAt: -1 })
        .exec();
};

PurchaseLogSchema.statics.getTotalRevenue = function (): Promise<number> {
    return this.aggregate([
        { $match: { payment_status: PaymentStatus.PAYMENT_CONFIRMED } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result[0]?.total || 0);
};

PurchaseLogSchema.statics.getRevenueByChannel = function (): Promise<Array<{ channel: PaymentChannel; total: number }>> {
    return this.aggregate([
        { $match: { payment_status: PaymentStatus.PAYMENT_CONFIRMED } },
        {
            $group: {
                _id: '$paymentChannel',
                total: { $sum: '$amount' }
            }
        },
        { $project: { channel: '$_id', total: 1, _id: 0 } }
    ]);
};



PurchaseLogSchema.methods.updateStatus = function (newStatus: PaymentStatus): Promise<IPurchaseLog> {
    this.payment_status = newStatus;
    return this.save();
};

PurchaseLogSchema.methods.isSuccessful = function (): boolean {
    return this.payment_status === PaymentStatus.PAYMENT_CONFIRMED;
};

PurchaseLogSchema.methods.isPending = function (): boolean {
    return this.payment_status === PaymentStatus.PENDING_PAYMENT_CONFIRMATION;
};



PurchaseLogSchema.virtual('formattedDate').get(function (this: IPurchaseLog) {
    return this.date?.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

PurchaseLogSchema.virtual('isDigitalPayment').get(function (this: IPurchaseLog) {
    return this.paymentChannel !== PaymentChannel.CASH_ON_DELIVERY;
});



PurchaseLogSchema.pre<IPurchaseLog>('save', function (next) {
    if (!this.date) {
        this.date = new Date();
    }
    if (!this.transaction_ref.startsWith('PAY_')) {
        next(new Error('Transaction reference must start with PAY_'));
        return;
    }

    next();
});



PurchaseLogSchema.post<IPurchaseLog>('save', function (doc) {
    console.log(`Purchase log saved for user ${doc.userId} with ref ${doc.transaction_ref}`);
});



const PurchaseLog: IPurchaseLogModel = mongoose.model<IPurchaseLog, IPurchaseLogModel>('purchase_log', PurchaseLogSchema);

export default PurchaseLog;