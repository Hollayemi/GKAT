import { Request, Response, NextFunction } from 'express';
import Cart from '../models/Cart';
import Order from '../models/Orders';
import Coupon from '../models/Coupon';
import Product from '../models/admin/Product';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import NotificationController from './others/notification';
import PaymentGateway from '../services/payment';


// @desc    Create order from cart
// @route   POST /api/v1/orders
// @access  Private
export const createOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const {
        shippingAddress,
        deliveryMethod,
        paymentMethod,
        notes
    } = req.body;

    if (!shippingAddress || !deliveryMethod || !paymentMethod) {
        return next(new AppError('Missing required fields', 400));
    }

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart || cart.items.length === 0) {
        return next(new AppError('Cart is empty', 400));
    }

    const stockValidation = await cart.validateStock();
    if (!stockValidation.valid) {
        return next(new AppError(
            `Some items are out of stock: ${stockValidation.outOfStock.join(', ')}`,
            400
        ));
    }

    const orderNumber = await Order.generateOrderNumber();
    const orderSlug = await Order.generateOrderSlug();


    const paymentGateway = new PaymentGateway();

    console.log({
        orderNumber,
        orderSlug,
        userId: req.user.id,
        items: cart.items,
        shippingAddress,
        deliveryMethod,
        paymentInfo: {
            method: paymentMethod,
            paymentStatus: paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
            amount: cart.totalAmount
        },
        orderStatus: 'pending',
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee,
        serviceCharge: cart.serviceCharge,
        discount: cart.discount,
        totalAmount: cart.totalAmount,
        appliedCoupons: cart.appliedCoupons,
        notes
    })

    const order = await Order.create({
        orderNumber,
        orderSlug,
        userId: req.user.id,
        items: cart.items,
        shippingAddress,
        deliveryMethod,
        paymentInfo: {
            method: paymentMethod,
            paymentStatus: paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
            amount: cart.totalAmount
        },
        orderStatus: 'pending',
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee,
        serviceCharge: cart.serviceCharge,
        discount: cart.discount,
        totalAmount: cart.totalAmount,
        appliedCoupons: cart.appliedCoupons,
        notes
    });

    for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        if (product) {
            if (item.variantId) {
                const variant = product.variants.find(v =>
                    v._id?.toString() === item.variantId?.toString()
                );
                if (variant) {
                    variant.stockQuantity -= item.quantity;
                }
            } else {
                product.stockQuantity -= item.quantity;
            }
            await product.save();
        }
    }

    for (const coupon of cart.appliedCoupons) {
        const couponDoc = await Coupon.findOne({ code: coupon.code });
        if (couponDoc) {
            await couponDoc.incrementUsage(req.user.id);
        }
    }

    // await cart.clearCart();

    const paymentReference = paymentGateway.generatePaymentReference(order.orderNumber);

    const paymentData = {
        email: req.user.email,
        amount: order.paymentInfo.amount,
        reference: paymentReference,
        orderId: order._id.toString(),
        userId: req.user.id,
        description: "Order Payment",
        phone: req.user.phone || '',
        metadata: {}
    }

    const paymentResult = await paymentGateway.initializePayment(paymentMethod, paymentData);
    console.log('Payment Result:', paymentResult);

    // await NotificationController.saveAndSendNotification({
    //     userId: req.user.id,
    //     title: 'Order Placed Successfully',
    //     body: `Your order #${orderSlug} has been placed. Total: ₦${order.totalAmount.toLocaleString()}`,
    //     type: 'order',
    //     typeId: order._id.toString(),
    //     clickUrl: `/orders/${order._id}`,
    //     priority: 'high'
    // }, 'user', {
    //     push_notification: true
    // });

    (res as AppResponse).data({ order, payment: paymentResult }, 'Order created successfully', 201);
});

// @desc    Get user orders
// @route   GET /api/v1/orders
// @access  Private
export const getUserOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { status, page = 1, limit = 20 } = req.query;

    const query: any = { userId: req.user.id };
    if (status && status !== 'all') {
        query.orderStatus = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)).populate('shippingAddress');

    const total = await Order.countDocuments(query);

    (res as AppResponse).data({
        orders,
        pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
        }
    }, 'Orders retrieved successfully');
});

// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
export const getOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    (res as AppResponse).data({ order }, 'Order retrieved successfully');
});

// @desc    Cancel order
// @route   POST /api/v1/orders/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { reason } = req.body;

    if (!reason) {
        return next(new AppError('Cancellation reason is required', 400));
    }

    const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    if (!order.canCancel) {
        return next(new AppError('Order cannot be cancelled', 400));
    }

    await order.cancelOrder(reason, req.user.id);

    // Send notification
    await NotificationController.saveAndSendNotification({
        userId: req.user.id,
        title: 'Order Cancelled',
        body: `Your order #${order.orderSlug} has been cancelled`,
        type: 'order',
        typeId: order._id.toString(),
        clickUrl: `/orders/${order._id}`,
        priority: 'medium'
    }, 'user', {
        push_notification: true
    });

    (res as AppResponse).data({ order }, 'Order cancelled successfully');
});

// @desc    Track order
// @route   GET /api/v1/orders/:id/track
// @access  Private
export const trackOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    (res as AppResponse).data({
        orderNumber: order.orderNumber,
        orderSlug: order.orderSlug,
        status: order.orderStatus,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        estimatedDelivery: order.estimatedDelivery,
        statusHistory: order.statusHistory
    }, 'Order tracking retrieved successfully');
});

// @desc    Rate order
// @route   POST /api/v1/orders/:id/rate
// @access  Private
export const rateOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return next(new AppError('Valid rating (1-5) is required', 400));
    }

    const order = await Order.findOne({
        _id: req.params.id,
        userId: req.user.id
    });

    if (!order) {
        return next(new AppError('Order not found', 404));
    }

    await order.addRating(rating, review);

    (res as AppResponse).data({ order }, 'Order rated successfully');
});

// @desc    Get order stats
// @route   GET /api/v1/orders/stats
// @access  Private
export const getOrderStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const stats = await Order.getOrderStats(req.user.id);

    (res as AppResponse).data({ stats }, 'Order stats retrieved successfully');
});