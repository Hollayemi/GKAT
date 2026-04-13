import { Request, Response, NextFunction } from 'express';
import Driver from '../../models/Driver';
import Order from '../../models/Orders';
import DriverDelivery from '../../models/DriverDelivery';
import DriverWallet from '../../models/DriverWallet';
import NotificationController from '../others/notification';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';

// ─── Fare calculation ────────────────────────────────────────────────────────

const calculateFare = (distanceKm: number, isPriority = false) => {
    const BASE_FARE = 900;
    const DISTANCE_BONUS_PER_KM = 89;  // ~250 for ~2.8km as shown in UI
    const PRIORITY_FEE = isPriority ? 50 : 0;

    const distanceBonus = Math.round(distanceKm * DISTANCE_BONUS_PER_KM);
    const totalEarned = BASE_FARE + distanceBonus + PRIORITY_FEE;

    return { baseFare: BASE_FARE, distanceBonus, priorityFee: PRIORITY_FEE, totalEarned };
};

// ─── Generate 4-digit delivery PIN ──────────────────────────────────────────

const generateDeliveryPin = (): string =>
    Math.floor(1000 + Math.random() * 9000).toString();

// ─── @desc    Get available orders in driver&apos;sregion (broadcast)
// ─── @route   GET /api/v1/driver-app/orders/available
// ─── @access  Private (driver)
export const getAvailableOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    if (!driver.isOnline) {
        return next(new AppError('You must be online to see available orders', 403));
    }

    if (driver.verificationStatus !== 'verified' || driver.status !== 'active') {
        return next(new AppError('Your account is not active', 403));
    }

    // Find deliveries broadcasted to this driver&apos;sregion that are not yet accepted
    const available = await DriverDelivery.find({
        status: 'pending_acceptance',
        expiresAt: { $gt: new Date() }
    })
        .populate({
            path: 'orderId',
            select: 'orderNumber orderSlug items totalAmount notes',
            populate: { path: 'shippingAddress', select: 'address localGovernment state' }
        })
        .populate('userId', 'name avatar')
        .sort({ broadcastedAt: -1 })
        .limit(5);

    (res as AppResponse).data(
        { orders: available, count: available.length },
        'Available orders retrieved'
    );
});

// ─── @desc    Accept an order
// ─── @route   POST /api/v1/driver-app/orders/:deliveryId/accept
// ─── @access  Private (driver)
export const acceptOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    if (!driver.isOnline) return next(new AppError('You must be online to accept orders', 403));

    // Ensure driver is not already on a delivery
    const activeDelivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    });

    if (activeDelivery) {
        return next(new AppError('You already have an active delivery in progress', 400));
    }

    const delivery = await DriverDelivery.findById(req.params.deliveryId);

    if (!delivery) return next(new AppError('Delivery not found', 404));

    if (delivery.status !== 'pending_acceptance') {
        return next(new AppError('This order is no longer available', 400));
    }

    if (new Date() > delivery.expiresAt) {
        delivery.status = 'rejected';
        await delivery.save();
        return next(new AppError('Acceptance window has expired', 400));
    }

    const now = new Date();
    delivery.status = 'accepted';
    delivery.driverId = driver._id;
    delivery.acceptedAt = now;
    delivery.statusHistory.push({ status: 'accepted', timestamp: now, note: 'Driver accepted the order' });
    await delivery.save();

    // Update driver status
    driver.status = 'on-delivery';
    driver.lastActive = now;
    await driver.save();

    // Update the parent order
    await Order.findByIdAndUpdate(delivery.orderId, {
        orderStatus: 'processing',
        $push: {
            statusHistory: {
                status: 'processing',
                timestamp: now,
                note: 'Driver accepted the delivery'
            }
        }
    });

    // Notify customer
    await NotificationController.saveAndSendNotification({
        userId: delivery.userId.toString(),
        title: 'Driver Accepted Your Order',
        body: `A driver is on the way to pick up your order #${delivery.orderNumber}`,
        type: 'order',
        typeId: { orderId: delivery.orderId },
        clickUrl: `/orders/${delivery.orderId}`,
        priority: 'high'
    }, 'user', { push_notification: true });

    const populated = await DriverDelivery.findById(delivery._id)
        .populate('orderId', 'orderNumber orderSlug items totalAmount notes')
        .populate('userId', 'name avatar phoneNumber');

    (res as AppResponse).data({ delivery: populated }, 'Order accepted successfully');
});

// ─── @desc    Reject an order
// ─── @route   POST /api/v1/driver-app/orders/:deliveryId/reject
// ─── @access  Private (driver)
export const rejectOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findById(req.params.deliveryId);
    if (!delivery) return next(new AppError('Delivery not found', 404));

    if (delivery.status !== 'pending_acceptance') {
        return next(new AppError('This order cannot be rejected at this stage', 400));
    }

    const { reason } = req.body;

    delivery.status = 'rejected';
    delivery.rejectionReason = reason;
    delivery.statusHistory.push({
        status: 'rejected',
        timestamp: new Date(),
        note: reason || 'Driver rejected the order'
    });
    await delivery.save();

    (res as AppResponse).success('Order rejected');
});

// ─── @desc    Update delivery status (arrived_at_store → picked_up → in_transit → arrived_at_customer)
// ─── @route   PATCH /api/v1/driver-app/orders/:deliveryId/status
// ─── @access  Private (driver)
export const updateDeliveryStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findOne({
        _id: req.params.deliveryId,
        driverId: driver._id
    });

    if (!delivery) return next(new AppError('Delivery not found', 404));

    const { status, location, note } = req.body;

    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
        accepted: ['arrived_at_store'],
        arrived_at_store: ['picked_up'],
        picked_up: ['in_transit'],
        in_transit: ['arrived_at_customer']
    };

    const allowed = validTransitions[delivery.status];
    if (!allowed || !allowed.includes(status)) {
        return next(new AppError(
            `Cannot transition from '${delivery.status}' to '${status}'`,
            400
        ));
    }

    const now = new Date();
    delivery.status = status;
    delivery.statusHistory.push({ status, timestamp: now, note, location });

    // Set specific timestamps
    if (status === 'arrived_at_store') delivery.arrivedAtStoreAt = now;
    if (status === 'picked_up') delivery.pickedUpAt = now;
    if (status === 'arrived_at_customer') delivery.arrivedAtCustomerAt = now;

    await delivery.save();

    // Sync order status
    const orderStatusMap: Record<string, string> = {
        picked_up: 'shipped',
        arrived_at_customer: 'shipped'
    };

    if (orderStatusMap[status]) {
        await Order.findByIdAndUpdate(delivery.orderId, {
            orderStatus: orderStatusMap[status],
            $push: {
                statusHistory: {
                    status: orderStatusMap[status],
                    timestamp: now,
                    note: `Driver status: ${status}`
                }
            }
        });
    }

    // Notify customer when driver is arriving
    if (status === 'arrived_at_customer') {
        await NotificationController.saveAndSendNotification({
            userId: delivery.userId.toString(),
            title: "Driver Has Arrived!",
            body: 'Your driver is at your location. Please share your 4-digit delivery code.',
            type: 'order',
            typeId: { orderId: delivery.orderId },
            clickUrl: `/orders/${delivery.orderId}`,
            priority: 'high'
        }, 'user', { push_notification: true });
    }

    if (status === 'picked_up') {
        await NotificationController.saveAndSendNotification({
            userId: delivery.userId.toString(),
            title: 'Order Picked Up',
            body: `Your order #${delivery.orderNumber} has been collected and is on its way!`,
            type: 'order',
            typeId: { orderId: delivery.orderId },
            clickUrl: `/orders/${delivery.orderId}`,
            priority: 'medium'
        }, 'user', { push_notification: true });
    }

    (res as AppResponse).data({ delivery }, `Status updated to '${status}'`);
});

// ─── @desc    Confirm delivery with customer PIN
// ─── @route   POST /api/v1/driver-app/orders/:deliveryId/confirm-delivery
// ─── @access  Private (driver)
export const confirmDelivery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findOne({
        _id: req.params.deliveryId,
        driverId: driver._id
    });

    if (!delivery) return next(new AppError('Delivery not found', 404));

    if (delivery.status !== 'arrived_at_customer') {
        return next(new AppError('You must arrive at the customer location first', 400));
    }

    const { pin } = req.body;

    if (!pin || pin.toString().length !== 4) {
        return next(new AppError('Please enter the 4-digit delivery code', 400));
    }

    if (delivery.pinAttempts >= 5) {
        return next(new AppError('Too many failed attempts. Please contact support.', 429));
    }

    if (pin.toString() !== delivery.deliveryPin) {
        delivery.pinAttempts += 1;
        await delivery.save();
        const remaining = 5 - delivery.pinAttempts;
        return next(new AppError(
            `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
            400
        ));
    }

    const now = new Date();
    delivery.status = 'delivered';
    delivery.pinVerified = true;
    delivery.deliveredAt = now;
    delivery.statusHistory.push({
        status: 'delivered',
        timestamp: now,
        note: 'Delivery confirmed with PIN'
    });
    await delivery.save();

    // Update order
    await Order.findByIdAndUpdate(delivery.orderId, {
        orderStatus: 'delivered',
        actualDelivery: now,
        $push: {
            statusHistory: {
                status: 'delivered',
                timestamp: now,
                note: 'Delivery confirmed with customer PIN'
            }
        }
    });

    // Credit driver wallet
    const wallet = await DriverWallet.findOne({ driverId: driver._id });
    if (wallet) {
        await wallet.creditEarning(
            delivery.fareBreakdown.totalEarned,
            `Earnings for order #${delivery.orderNumber}`,
            delivery._id as any
        );
        delivery.isPaid = true;
        await delivery.save();
    }

    // Update driver stats
    driver.status = 'active';
    driver.totalDeliveries += 1;
    driver.completedDeliveries += 1;
    driver.lastActive = now;
    await driver.save();

    // Notify customer
    await NotificationController.saveAndSendNotification({
        userId: delivery.userId.toString(),
        title: 'Order Delivered! 🎉',
        body: `Your order #${delivery.orderNumber} has been delivered successfully.`,
        type: 'order',
        typeId: { orderId: delivery.orderId },
        clickUrl: `/orders/${delivery.orderId}`,
        priority: 'high'
    }, 'user', { push_notification: true });

    (res as AppResponse).data(
        {
            delivery,
            earned: delivery.fareBreakdown.totalEarned
        },
        'Delivery confirmed successfully!'
    );
});

// ─── @desc    Cancel an active delivery (before pickup only)
// ─── @route   POST /api/v1/driver-app/orders/:deliveryId/cancel
// ─── @access  Private (driver)
export const cancelDelivery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findOne({
        _id: req.params.deliveryId,
        driverId: driver._id
    });

    if (!delivery) return next(new AppError('Delivery not found', 404));

    const cancelableStatuses = ['accepted', 'arrived_at_store'];
    if (!cancelableStatuses.includes(delivery.status)) {
        return next(new AppError('This delivery cannot be cancelled at this stage', 400));
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
        return next(new AppError('Cancellation reason is required', 400));
    }

    const now = new Date();
    delivery.status = 'cancelled';
    delivery.cancellationReason = reason;
    delivery.cancelledAt = now;
    delivery.statusHistory.push({ status: 'cancelled', timestamp: now, note: reason });
    await delivery.save();

    // Reset driver status
    driver.status = 'active';
    driver.totalDeliveries += 1;
    driver.cancelledDeliveries += 1;
    await driver.save();

    // Re-broadcast the order for another driver (reset to pending)
    await Order.findByIdAndUpdate(delivery.orderId, {
        orderStatus: 'confirmed',
        $push: {
            statusHistory: {
                status: 'confirmed',
                timestamp: now,
                note: 'Driver cancelled. Order re-queued for dispatch.'
            }
        }
    });

    // Notify customer
    await NotificationController.saveAndSendNotification({
        userId: delivery.userId.toString(),
        title: 'Driver Cancelled',
        body: 'Your driver had to cancel. We are finding a new driver for you.',
        type: 'order',
        typeId: { orderId: delivery.orderId },
        clickUrl: `/orders/${delivery.orderId}`,
        priority: 'high'
    }, 'user', { push_notification: true });

    (res as AppResponse).success('Delivery cancelled');
});

// ─── @desc    Get driver&apos;scurrent active delivery
// ─── @route   GET /api/v1/driver-app/orders/active
// ─── @access  Private (driver)
export const getActiveDelivery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findOne({
        driverId: driver._id,
        status: { $in: ['accepted', 'arrived_at_store', 'picked_up', 'in_transit', 'arrived_at_customer'] }
    })
        .populate({
            path: 'orderId',
            select: 'orderNumber orderSlug items totalAmount notes',
            populate: { path: 'shippingAddress', select: 'address localGovernment state phone' }
        })
        .populate('userId', 'name avatar phoneNumber');

    (res as AppResponse).data({ delivery: delivery || null }, 'Active delivery retrieved');
});

// ─── @desc    Get delivery history with pagination
// ─── @route   GET /api/v1/driver-app/orders/history
// ─── @access  Private (driver)
export const getDeliveryHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { status, page = 1, limit = 20 } = req.query;
    const query: any = { driverId: driver._id };

    if (status && status !== 'all') {
        query.status = status;
    } else {
        query.status = { $in: ['delivered', 'cancelled', 'rejected'] };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [deliveries, total] = await Promise.all([
        DriverDelivery.find(query)
            .populate('orderId', 'orderNumber orderSlug items')
            .populate('userId', 'name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit as string)),
        DriverDelivery.countDocuments(query)
    ]);

    (res as AppResponse).data(
        {
            deliveries,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        },
        'Delivery history retrieved'
    );
});

// ─── @desc    Get single delivery details
// ─── @route   GET /api/v1/driver-app/orders/:deliveryId
// ─── @access  Private (driver)
export const getDeliveryDetails = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const delivery = await DriverDelivery.findOne({
        _id: req.params.deliveryId,
        driverId: driver._id
    })
        .populate({
            path: 'orderId',
            select: 'orderNumber orderSlug items totalAmount notes',
            populate: { path: 'shippingAddress', select: 'address localGovernment state phone' }
        })
        .populate('userId', 'name avatar phoneNumber');

    if (!delivery) return next(new AppError('Delivery not found', 404));

    (res as AppResponse).data({ delivery }, 'Delivery details retrieved');
});

// ─── @desc    Rate customer after delivery
// ─── @route   POST /api/v1/driver-app/orders/:deliveryId/rate-customer
// ─── @access  Private (driver)
export const rateCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    const { rating, review, tags } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return next(new AppError('Rating must be between 1 and 5', 400));
    }

    const delivery = await DriverDelivery.findOne({
        _id: req.params.deliveryId,
        driverId: driver._id,
        status: 'delivered'
    });

    if (!delivery) return next(new AppError('Delivery not found or not yet completed', 404));

    if (delivery.driverRating) {
        return next(new AppError('You have already rated this customer', 400));
    }

    delivery.driverRating = rating;
    delivery.driverReview = review;
    delivery.customerRatedAt = new Date();
    await delivery.save();

    (res as AppResponse).data(
        { rating, review },
        'Customer rated successfully. Thank you for your feedback!'
    );
});

// ─── @desc    Dispatch order to drivers (admin/system)
// ─── @route   POST /api/v1/driver-app/orders/dispatch
// ─── @access  Private (admin)
export const dispatchOrderToDrivers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { orderId, region, isPriority = false } = req.body;

    if (!orderId || !region) {
        return next(new AppError('orderId and region are required', 400));
    }

    const order = await Order.findById(orderId).populate('shippingAddress');
    if (!order) return next(new AppError('Order not found', 404));

    if (!['confirmed', 'processing'].includes(order.orderStatus)) {
        return next(new AppError('Order is not ready for dispatch', 400));
    }

    // Check if already dispatched
    const existing = await DriverDelivery.findOne({
        orderId,
        status: { $nin: ['cancelled', 'rejected'] }
    });

    if (existing) {
        return next(new AppError('Order has already been dispatched', 409));
    }

    const distanceKm = req.body.distanceKm || 3.5; // fallback; real impl uses geo calculation
    const fare = calculateFare(distanceKm, isPriority);
    const pin = generateDeliveryPin();

    const shippingAddr = order.shippingAddress as any;
    const deliveryAddress = typeof shippingAddr === 'string'
        ? shippingAddr
        : `${shippingAddr?.address || ''}, ${shippingAddr?.localGovernment || ''}, ${shippingAddr?.state || ''}`;

    const delivery = await DriverDelivery.create({
        orderId: order._id,
        driverId: new (require('mongoose').Types.ObjectId)(), // placeholder until accepted
        userId: order.userId,
        orderNumber: order.orderNumber,
        pickupAddress: `${region} Dark Store Warehouse`,
        deliveryAddress,
        distanceKm,
        fareBreakdown: fare,
        deliveryPin: pin,
        broadcastedAt: new Date(),
        expiresAt: new Date(Date.now() + 20 * 1000),
        status: 'pending_acceptance',
        statusHistory: [{
            status: 'pending_acceptance',
            timestamp: new Date(),
            note: 'Order broadcasted to available drivers'
        }]
    });

    // Send delivery PIN to customer
    await NotificationController.saveAndSendNotification({
        userId: order.userId.toString(),
        title: 'Your Delivery PIN',
        body: `Your 4-digit delivery code is: ${pin}. Share only with your driver.`,
        type: 'order',
        typeId: { orderId: order._id },
        clickUrl: `/orders/${order._id}`,
        priority: 'high'
    }, 'user', { push_notification: true });

    (res as AppResponse).data(
        { delivery, fare },
        'Order dispatched to available drivers',
        201
    );
});
