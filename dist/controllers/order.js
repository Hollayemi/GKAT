"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStats = exports.rateOrder = exports.trackOrder = exports.cancelOrder = exports.getOrder = exports.getUserOrders = exports.createOrder = void 0;
const Cart_1 = __importDefault(require("../models/Cart"));
const Orders_1 = __importDefault(require("../models/Orders"));
const Coupon_1 = __importDefault(require("../models/Coupon"));
const Product_1 = __importDefault(require("../models/admin/Product"));
const error_1 = require("../middleware/error");
const notification_1 = __importDefault(require("./others/notification"));
const payment_1 = __importDefault(require("../services/payment"));
// @desc    Create order from cart
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { shippingAddress, deliveryMethod, paymentMethod, notes } = req.body;
    if (!shippingAddress || !deliveryMethod || !paymentMethod) {
        return next(new error_1.AppError('Missing required fields', 400));
    }
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    if (!cart || cart.items.length === 0) {
        return next(new error_1.AppError('Cart is empty', 400));
    }
    const stockValidation = await cart.validateStock();
    if (!stockValidation.valid) {
        return next(new error_1.AppError(`Some items are out of stock: ${stockValidation.outOfStock.join(', ')}`, 400));
    }
    const orderNumber = await Orders_1.default.generateOrderNumber();
    const orderSlug = await Orders_1.default.generateOrderSlug();
    const paymentGateway = new payment_1.default();
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
    });
    const order = await Orders_1.default.create({
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
        const product = await Product_1.default.findById(item.productId);
        if (product) {
            if (item.variantId) {
                const variant = product.variants.find(v => v._id?.toString() === item.variantId?.toString());
                if (variant) {
                    variant.stockQuantity -= item.quantity;
                }
            }
            else {
                product.stockQuantity -= item.quantity;
            }
            await product.save();
        }
    }
    for (const coupon of cart.appliedCoupons) {
        const couponDoc = await Coupon_1.default.findOne({ code: coupon.code });
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
    };
    const paymentResult = await paymentGateway.initializePayment(paymentMethod, paymentData);
    console.log('Payment Result:', paymentResult);
    await notification_1.default.saveAndSendNotification({
        userId: req.user.id,
        title: 'Order Placed Successfully',
        body: `Your order #${orderSlug} has been placed. Total: ₦${order.totalAmount.toLocaleString()}`,
        type: 'order',
        typeId: { orderId: order._id },
        clickUrl: `/orders/${order._id}`,
        priority: 'high'
    }, 'user', {
        push_notification: true
    });
    res.data({ order, payment: paymentResult }, 'Order created successfully', 201);
});
// @desc    Get user orders
// @route   GET /api/v1/orders
// @access  Private
exports.getUserOrders = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { status, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user.id };
    if (status && status !== 'all') {
        query.orderStatus = status;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Orders_1.default.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)).populate('shippingAddress');
    const total = await Orders_1.default.countDocuments(query);
    res.data({
        orders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    }, 'Orders retrieved successfully');
});
// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const order = await Orders_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!order) {
        return next(new error_1.AppError('Order not found', 404));
    }
    res.data({ order }, 'Order retrieved successfully');
});
// @desc    Cancel order
// @route   POST /api/v1/orders/:id/cancel
// @access  Private
exports.cancelOrder = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { reason } = req.body;
    if (!reason) {
        return next(new error_1.AppError('Cancellation reason is required', 400));
    }
    const order = await Orders_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!order) {
        return next(new error_1.AppError('Order not found', 404));
    }
    if (!order.canCancel) {
        return next(new error_1.AppError('Order cannot be cancelled', 400));
    }
    await order.cancelOrder(reason, req.user.id);
    // Send notification
    await notification_1.default.saveAndSendNotification({
        userId: req.user.id,
        title: 'Order Cancelled',
        body: `Your order #${order.orderSlug} has been cancelled`,
        type: 'order',
        typeId: { orderId: order._id },
        clickUrl: `/orders/${order._id}`,
        priority: 'medium'
    }, 'user', {
        push_notification: true
    });
    res.data({ order }, 'Order cancelled successfully');
});
// @desc    Track order
// @route   GET /api/v1/orders/:id/track
// @access  Private
exports.trackOrder = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const order = await Orders_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!order) {
        return next(new error_1.AppError('Order not found', 404));
    }
    res.data({
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
exports.rateOrder = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
        return next(new error_1.AppError('Valid rating (1-5) is required', 400));
    }
    const order = await Orders_1.default.findOne({
        _id: req.params.id,
        userId: req.user.id
    });
    if (!order) {
        return next(new error_1.AppError('Order not found', 404));
    }
    await order.addRating(rating, review);
    res.data({ order }, 'Order rated successfully');
});
// @desc    Get order stats
// @route   GET /api/v1/orders/stats
// @access  Private
exports.getOrderStats = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const stats = await Orders_1.default.getOrderStats(req.user.id);
    res.data({ stats }, 'Order stats retrieved successfully');
});
//# sourceMappingURL=order.js.map