import { Request, Response, NextFunction } from 'express';
import Cart from '../models/Cart';
import Order from '../models/Orders';
import Coupon from '../models/Coupon';
import Product from '../models/admin/Product';
import Address from '../models/Address';
import Region from '../models/config/region.model';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import NotificationController from './others/notification';
import PaymentGateway from '../services/payment';
import { findNearestRegion } from '../utils/geo';
import mongoose from 'mongoose';
import { buildCartSummary } from '../helpers/buildCartSummary';


async function resolveOrderRegion(
    lat: number | undefined,
    lng: number | undefined
): Promise<mongoose.Types.ObjectId | null> {
    if (lat == null || lng == null) return null;
    const regions = await Region.find({ isActive: true }).lean();
    const nearest = findNearestRegion(lat, lng, regions);
    if (!nearest) return null;
    return new mongoose.Types.ObjectId(nearest.regionId);
}

async function deductRegionalStock(
    productId: mongoose.Types.ObjectId,
    variantId: mongoose.Types.ObjectId | undefined,
    quantity: number,
    regionId: mongoose.Types.ObjectId | null
): Promise<void> {
    const product = await Product.findById(productId);
    if (!product) return;

    if (variantId) {
        const variant = product.variants.find(
            v => v._id?.toString() === variantId.toString()
        );
        if (variant) variant.stockQuantity = Math.max(0, variant.stockQuantity - quantity);
    } else {
        product.stockQuantity = Math.max(0, product.stockQuantity - quantity);
    }

    if (regionId) {
        const regionalDist = product.regionalDistribution.find(
            rd => rd.region.toString() === regionId.toString()
        );
        if (regionalDist) {
            if (variantId) {
                const variantDist = regionalDist.variants.find(
                    vd => vd.variantId === variantId.toString()
                );
                if (variantDist) variantDist.quantity = Math.max(0, variantDist.quantity - quantity);
            } else {
                regionalDist.mainProduct = Math.max(0, regionalDist.mainProduct - quantity);
            }
        }
    }

    await product.save();
}


// @desc    Create order from cart
// @route   POST /api/v1/order
// @access  Private
export const createOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { shippingAddress, deliveryMethod, paymentMethod, notes } = req.body;

    if (!shippingAddress || !deliveryMethod || !paymentMethod) {
        return next(new AppError('Missing required fields', 400));
    }

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart || cart.items.length === 0) {
        return next(new AppError('Cart is empty', 400));
    }

    const stockValidation = await cart.validateStock();
    if (!stockValidation.valid) {
        return next(
            new AppError(
                `Some items are out of stock: ${stockValidation.outOfStock.join(', ')}`,
                400
            )
        );
    }

    const addressDoc = await Address.findById(shippingAddress).lean();
    const addressCoords = addressDoc?.coordinates;
    const resolvedRegionId = await resolveOrderRegion(
        addressCoords?.lat,
        addressCoords?.lng
    );

   
    const cartSummary = await buildCartSummary(cart);

    let subscriptionDiscount = cartSummary.pricing.subscriptionDiscount || 0;
    let subscriptionInfo = cartSummary.subscriptionInfo || null;

    console.log({cartSummary})

    const orderNumber = await Order.generateOrderNumber();
    const orderSlug = await Order.generateOrderSlug();

    const paymentGateway = new PaymentGateway();

    const orderData: any = {
        orderNumber,
        orderSlug,
        userId: req.user.id,
        items: cart.items,
        shippingAddress,
        deliveryMethod,
        region: resolvedRegionId ?? undefined,
        paymentInfo: {
            method: paymentMethod,
            paymentStatus: 'pending',
            amount: cartSummary.pricing.totalAmount
        },
        orderStatus: 'pending',
        deliveryFee: cart.deliveryFee ?? 0,
        serviceCharge: cart.serviceCharge ?? 0,
        pricing: cartSummary.pricing ,
        totalAmount: cartSummary.pricing.totalAmount,
        appliedCoupons: cart.appliedCoupons,
        notes
    };

    // Attach subscription info if applicable
    if (subscriptionInfo) {
        orderData.subscriptionInfo = {
            planName: subscriptionInfo.planName,
            discountPercentage: subscriptionInfo.discountPercentage
        };
    }


    console.log({orderData})

    const order = await Order.create(orderData);

    for (const item of cart.items) {
        await deductRegionalStock(
            item.productId as mongoose.Types.ObjectId,
            item.variantId as mongoose.Types.ObjectId | undefined,
            item.quantity,
            resolvedRegionId
        );
    }

    for (const coupon of cart.appliedCoupons) {
        const couponDoc = await Coupon.findOne({ couponCode: coupon.code });
        if (couponDoc) await couponDoc.incrementUsage(req.user.id);
    }

    const paymentReference = paymentGateway.generatePaymentReference(order.orderNumber);

  
    const paymentData = {
        email: req.user.email || 'admin@gmail.com',
        amount: order.totalAmount,
        reference: paymentReference,
        orderId: order._id.toString(),
        userId: req.user.id,
        description: 'Order Payment',
        phone: req.user.phone || req.user.phoneNumber || '',
        metadata: {
            type: 'purchase',
            orderId: order._id.toString(),
            orderSlugs: [order.orderSlug]
        }
    };

    const paymentResult = await paymentGateway.initializePayment(paymentMethod, paymentData);

    await NotificationController.saveAndSendNotification(
        {
            userId: req.user.id,
            title: 'Order Placed Successfully',
            body: `Your order #${orderSlug} has been placed. Total: ₦${order.totalAmount.toLocaleString()}${
                subscriptionDiscount > 0
                    ? ` (Go Prime saved you ₦${subscriptionDiscount.toLocaleString()}!)`
                    : ''
            }`,
            type: 'order',
            typeId: { orderId: order._id },
            clickUrl: `/orders/${order._id}`,
            priority: 'high'
        },
        'user',
        { push_notification: true }
    );

    (res as AppResponse).data(
        {
            order,
            payment: paymentResult,
            region: resolvedRegionId,
            subscriptionSaving: subscriptionDiscount > 0
                ? {
                    planName: subscriptionInfo?.planName,
                    discountPercentage: subscriptionInfo?.discountPercentage,
                    amountSaved: subscriptionDiscount
                }
                : null
        },
        'Order created successfully',
        201
    );
});

// @desc    Re-pay an existing order
// @route   POST /api/v1/order/repay
// @access  Private
export const repayOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { orderId, paymentMethod = 'paystack' } = req.body;
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const order = await Order.findOne({ _id: orderId, userId: req.user.id });
    if (!order) return next(new AppError('Order not found', 404));

    const paymentGateway = new PaymentGateway();
    const paymentReference = paymentGateway.generatePaymentReference(order.orderNumber);

    const paymentData = {
        email: req.user.email || 'admin@gmail.com',
        amount: order.totalAmount,
        reference: paymentReference,
        orderId: order._id.toString(),
        userId: req.user.id,
        description: 'Order re-Payment',
        phone: req.user.phone || req.user.phoneNumber || '',
        metadata: {
            type: 'purchase',
            orderId: order._id.toString(),
            orderSlugs: [order.orderSlug]
        }
    };

    const paymentResult = await paymentGateway.initializePayment(paymentMethod, paymentData);
    (res as AppResponse).data({ order, payment: paymentResult }, 'Order Payment', 201);
});

// @desc    Get user orders
// @route   GET /api/v1/order
// @access  Private
export const getUserOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { status, page = 1, limit = 20 } = req.query;

    const query: any = { userId: req.user.id };
    if (status && status !== 'all') query.orderStatus = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .populate('shippingAddress')
        .populate('region', 'name');

    const total = await Order.countDocuments(query);

    (res as AppResponse).data(
        {
            orders,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                pages: Math.ceil(total / parseInt(limit as string))
            }
        },
        'Orders retrieved successfully'
    );
});

// @desc    Get single order
// @route   GET /api/v1/order/:id
// @access  Private
export const getOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id })
        .populate('region', 'name coordinate');

    if (!order) return next(new AppError('Order not found', 404));
    (res as AppResponse).data({ order }, 'Order retrieved successfully');
});

// @desc    Cancel order
// @route   POST /api/v1/order/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { reason } = req.body;
    if (!reason) return next(new AppError('Cancellation reason is required', 400));

    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return next(new AppError('Order not found', 404));
    if (!order.canCancel) return next(new AppError('Order cannot be cancelled', 400));

    await order.cancelOrder(reason, req.user.id);

    await NotificationController.saveAndSendNotification(
        {
            userId: req.user.id,
            title: 'Order Cancelled',
            body: `Your order #${order.orderSlug} has been cancelled`,
            type: 'order',
            typeId: { orderId: order._id },
            clickUrl: `/orders/${order._id}`,
            priority: 'medium'
        },
        'user',
        { push_notification: true }
    );

    (res as AppResponse).data({ order }, 'Order cancelled successfully');
});

// @desc    Track order
// @route   GET /api/v1/order/:id/track
// @access  Private
export const trackOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return next(new AppError('Order not found', 404));

    (res as AppResponse).data(
        {
            orderNumber: order.orderNumber,
            orderSlug: order.orderSlug,
            status: order.orderStatus,
            trackingNumber: order.trackingNumber,
            carrier: order.carrier,
            estimatedDelivery: order.estimatedDelivery,
            statusHistory: order.statusHistory
        },
        'Order tracking retrieved successfully'
    );
});

// @desc    Rate order
// @route   POST /api/v1/order/:id/rate
// @access  Private
export const rateOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
        return next(new AppError('Valid rating (1-5) is required', 400));
    }

    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return next(new AppError('Order not found', 404));

    await order.addRating(rating, review);
    (res as AppResponse).data({ order }, 'Order rated successfully');
});

// @desc    Get order stats
// @route   GET /api/v1/order/stats
// @access  Private
export const getOrderStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    const stats = await Order.getOrderStats(req.user.id);
    (res as AppResponse).data({ stats }, 'Order stats retrieved successfully');
});