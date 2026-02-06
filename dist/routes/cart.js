"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cart_1 = require("../controllers/cart");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// @route   GET /api/v1/cart
// @desc    Get user cart with available coupons
router.get('/', cart_1.getCart);
// @route   POST /api/v1/cart/items
// @desc    Add item to cart
router.post('/', cart_1.addToCart);
// @route   PUT /api/v1/cart/items/:productId
// @desc    Update cart item quantity
router.put('/items/:productId', cart_1.updateCartItem);
// @route   DELETE /api/v1/cart/items/:productId
// @desc    Remove item from cart
router.delete('/items/:productId', cart_1.removeFromCart);
// @route   POST /api/v1/cart/coupon
// @desc    Apply coupon to cart
router.post('/coupon', cart_1.applyCoupon);
// @route   DELETE /api/v1/cart/coupon/:code
// @desc    Remove coupon from cart
router.delete('/coupon/:code', cart_1.removeCoupon);
// @route   DELETE /api/v1/cart
// @desc    Clear entire cart
router.delete('/', cart_1.clearCart);
exports.default = router;
//# sourceMappingURL=cart.js.map