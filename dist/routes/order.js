"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_1 = require("../controllers/order");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// @route   POST /api/v1/orders
// @desc    Create order from cart
router.post('/', order_1.createOrder);
// @route   GET /api/v1/orders
// @desc    Get user orders with pagination and filtering
router.get('/', order_1.getUserOrders);
// @route   GET /api/v1/orders/stats
// @desc    Get order statistics
router.get('/stats', order_1.getOrderStats);
// @route   GET /api/v1/orders/:id
// @desc    Get single order details
router.get('/:id', order_1.getOrder);
// @route   POST /api/v1/orders/:id/cancel
// @desc    Cancel an order
router.post('/:id/cancel', order_1.cancelOrder);
// @route   GET /api/v1/orders/:id/track
// @desc    Track order status
router.get('/:id/track', order_1.trackOrder);
// @route   POST /api/v1/orders/:id/rate
// @desc    Rate a delivered order
router.post('/:id/rate', order_1.rateOrder);
exports.default = router;
//# sourceMappingURL=order.js.map