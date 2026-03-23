import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeliveryStatus =
    | 'pending_acceptance'   // Order broadcasted, waiting for driver
    | 'accepted'             // Driver accepted
    | 'arrived_at_store'     // Driver arrived at dark store/warehouse
    | 'picked_up'            // Driver collected the order
    | 'in_transit'           // Driver heading to customer
    | 'arrived_at_customer'  // Driver at delivery location
    | 'delivered'            // Confirmed with PIN
    | 'cancelled'            // Cancelled before pickup
    | 'rejected';            // Driver rejected the order

export interface IFareBreakdown {
    baseFare: number;
    distanceBonus: number;
    priorityFee: number;
    totalEarned: number;
}

export interface IDeliveryStatusHistory {
    status: DeliveryStatus;
    timestamp: Date;
    note?: string;
    location?: { lat: number; lng: number };
}

export interface IDriverDelivery extends Document {
    orderId: Types.ObjectId;
    driverId: Types.ObjectId;
    userId: Types.ObjectId;           // Customer
    orderNumber: string;

    // Locations
    pickupAddress: string;
    pickupCoordinates?: { lat: number; lng: number };
    deliveryAddress: string;
    deliveryCoordinates?: { lat: number; lng: number };
    distanceKm: number;

    // Status
    status: DeliveryStatus;
    statusHistory: IDeliveryStatusHistory[];

    // Timing
    broadcastedAt: Date;              // When order was sent to drivers
    acceptedAt?: Date;
    arrivedAtStoreAt?: Date;
    pickedUpAt?: Date;
    arrivedAtCustomerAt?: Date;
    deliveredAt?: Date;
    cancelledAt?: Date;
    expiresAt: Date;                  // Acceptance countdown deadline

    // Delivery PIN
    deliveryPin: string;              // 4-digit PIN from customer
    pinAttempts: number;
    pinVerified: boolean;

    // Earnings
    fareBreakdown: IFareBreakdown;
    isPaid: boolean;                  // Credited to wallet

    // Ratings
    driverRating?: number;
    driverReview?: string;
    customerRatedAt?: Date;

    // Misc
    cancellationReason?: string;
    rejectionReason?: string;
    notes?: string;

    createdAt: Date;
    updatedAt: Date;
}

const FareBreakdownSchema = new Schema<IFareBreakdown>({
    baseFare: { type: Number, required: true, default: 0 },
    distanceBonus: { type: Number, default: 0 },
    priorityFee: { type: Number, default: 0 },
    totalEarned: { type: Number, required: true, default: 0 }
}, { _id: false });

const StatusHistorySchema = new Schema<IDeliveryStatusHistory>({
    status: {
        type: String,
        required: true,
        enum: [
            'pending_acceptance', 'accepted', 'arrived_at_store',
            'picked_up', 'in_transit', 'arrived_at_customer',
            'delivered', 'cancelled', 'rejected'
        ]
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    }
}, { _id: false });

const DriverDeliverySchema = new Schema<IDriverDelivery>({
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    driverId: {
        type: Schema.Types.ObjectId,
        ref: 'Driver',
        required: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Locations
    pickupAddress: { type: String, required: true, trim: true },
    pickupCoordinates: {
        lat: { type: Number },
        lng: { type: Number }
    },
    deliveryAddress: { type: String, required: true, trim: true },
    deliveryCoordinates: {
        lat: { type: Number },
        lng: { type: Number }
    },
    distanceKm: { type: Number, default: 0, min: 0 },

    // Status
    status: {
        type: String,
        enum: [
            'pending_acceptance', 'accepted', 'arrived_at_store',
            'picked_up', 'in_transit', 'arrived_at_customer',
            'delivered', 'cancelled', 'rejected'
        ],
        default: 'pending_acceptance',
        index: true
    },
    statusHistory: [StatusHistorySchema],

    // Timing
    broadcastedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    arrivedAtStoreAt: { type: Date },
    pickedUpAt: { type: Date },
    arrivedAtCustomerAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 20 * 1000) // 20 second window
    },

    // PIN
    deliveryPin: {
        type: String,
        required: true,
        length: 4
    },
    pinAttempts: { type: Number, default: 0, min: 0 },
    pinVerified: { type: Boolean, default: false },

    // Earnings
    fareBreakdown: { type: FareBreakdownSchema, required: true },
    isPaid: { type: Boolean, default: false },

    // Rating
    driverRating: { type: Number, min: 1, max: 5 },
    driverReview: { type: String, trim: true, maxlength: 500 },
    customerRatedAt: { type: Date },

    // Misc
    cancellationReason: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    notes: { type: String, trim: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

DriverDeliverySchema.index({ driverId: 1, status: 1 });
DriverDeliverySchema.index({ driverId: 1, createdAt: -1 });
DriverDeliverySchema.index({ orderId: 1, driverId: 1 });
DriverDeliverySchema.index({ expiresAt: 1, status: 1 });

DriverDeliverySchema.virtual('isExpired').get(function () {
    return this.status === 'pending_acceptance' && new Date() > this.expiresAt;
});

DriverDeliverySchema.virtual('durationMinutes').get(function () {
    if (!this.acceptedAt || !this.deliveredAt) return null;
    return Math.floor((this.deliveredAt.getTime() - this.acceptedAt.getTime()) / 60000);
});

export default mongoose.model<IDriverDelivery>('DriverDelivery', DriverDeliverySchema);