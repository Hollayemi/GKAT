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
exports.PaymentChannel = exports.PaymentStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING_PAYMENT_CONFIRMATION"] = "PENDING_PAYMENT_CONFIRMATION";
    PaymentStatus["PAYMENT_CONFIRMED"] = "PAYMENT_CONFIRMED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var PaymentChannel;
(function (PaymentChannel) {
    PaymentChannel["PAYSTACK"] = "PAYSTACK";
    PaymentChannel["PALMPAY"] = "PALMPAY";
    PaymentChannel["OPAY"] = "OPAY";
    PaymentChannel["CASH_ON_DELIVERY"] = "CASH_ON_DELIVERY";
})(PaymentChannel || (exports.PaymentChannel = PaymentChannel = {}));
const PurchaseLogSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        ref: 'users',
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative'],
    },
    meta: {
        type: mongoose_1.Schema.Types.Mixed,
        required: [true, 'Meta data is required'],
        validate: {
            validator: function (value) {
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
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});
PurchaseLogSchema.index({ userId: 1, createdAt: -1 });
PurchaseLogSchema.index({ transaction_ref: 1 }, { unique: true });
PurchaseLogSchema.index({ payment_status: 1 });
PurchaseLogSchema.index({ paymentChannel: 1 });
PurchaseLogSchema.index({ createdAt: -1 });
PurchaseLogSchema.index({ userId: 1, payment_status: 1 });
PurchaseLogSchema.index({ 'meta.orderIds': 1 });
PurchaseLogSchema.statics.findByUserId = function (userId) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email')
        .exec();
};
PurchaseLogSchema.statics.findByTransactionRef = function (transaction_ref) {
    return this.findOne({ transaction_ref })
        .populate('userId', 'name email')
        .exec();
};
PurchaseLogSchema.statics.findByStatus = function (payment_status) {
    return this.find({ payment_status })
        .sort({ createdAt: -1 })
        .populate('userId', 'name email')
        .exec();
};
PurchaseLogSchema.statics.findSuccessfulPayments = function () {
    return this.find({ payment_status: PaymentStatus.PAYMENT_CONFIRMED })
        .sort({ createdAt: -1 })
        .exec();
};
PurchaseLogSchema.statics.findRecentPurchases = function (days = 7) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.find({
        createdAt: { $gte: date },
        payment_status: PaymentStatus.PAYMENT_CONFIRMED
    })
        .sort({ createdAt: -1 })
        .exec();
};
PurchaseLogSchema.statics.getTotalRevenue = function () {
    return this.aggregate([
        { $match: { payment_status: PaymentStatus.PAYMENT_CONFIRMED } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).then(result => result[0]?.total || 0);
};
PurchaseLogSchema.statics.getRevenueByChannel = function () {
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
PurchaseLogSchema.methods.updateStatus = function (newStatus) {
    this.payment_status = newStatus;
    return this.save();
};
PurchaseLogSchema.methods.isSuccessful = function () {
    return this.payment_status === PaymentStatus.PAYMENT_CONFIRMED;
};
PurchaseLogSchema.methods.isPending = function () {
    return this.payment_status === PaymentStatus.PENDING_PAYMENT_CONFIRMATION;
};
PurchaseLogSchema.virtual('formattedDate').get(function () {
    return this.date?.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});
PurchaseLogSchema.virtual('isDigitalPayment').get(function () {
    return this.paymentChannel !== PaymentChannel.CASH_ON_DELIVERY;
});
PurchaseLogSchema.pre('save', function (next) {
    if (!this.date) {
        this.date = new Date();
    }
    if (!this.transaction_ref.startsWith('PAY_')) {
        next(new Error('Transaction reference must start with PAY_'));
        return;
    }
    next();
});
PurchaseLogSchema.post('save', function (doc) {
    console.log(`Purchase log saved for user ${doc.userId} with ref ${doc.transaction_ref}`);
});
const PurchaseLog = mongoose_1.default.model('purchase_log', PurchaseLogSchema);
exports.default = PurchaseLog;
//# sourceMappingURL=productPurchaseLog.js.map