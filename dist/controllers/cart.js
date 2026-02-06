"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeCoupon = exports.applyCoupon = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const mongoose_1 = require("mongoose");
const Cart_1 = __importDefault(require("../models/Cart"));
const Coupon_1 = __importDefault(require("../models/Coupon"));
const Product_1 = __importDefault(require("../models/admin/Product"));
const error_1 = require("../middleware/error");
// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const cart = await Cart_1.default.findOrCreateCart(req.user.id);
    // Get available coupons for user
    const availableCoupons = await Coupon_1.default.getAvailableCoupons(req.user.id, cart.subtotal);
    res.data({
        cart,
        availableCoupons: availableCoupons.map(c => ({
            code: c.couponCode,
            title: c.promotionName,
            description: c.description,
            discountType: c.promoType,
            discountValue: c.discountValue,
        }))
    }, 'Cart retrieved successfully');
});
// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
exports.addToCart = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    console.log(req.user);
    console.log(req.body);
    const { productId, variantId, quantity = 1 } = req.body;
    if (!productId) {
        return next(new error_1.AppError('Product ID is required', 400));
    }
    // Fetch product details
    const product = await Product_1.default.findById(productId);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    if (product.status !== 'active') {
        return next(new error_1.AppError('Product is not available', 400));
    }
    // Check variant if provided
    let variantData = null;
    if (variantId) {
        variantData = product.variants.find(v => v._id?.toString() === variantId);
        if (!variantData) {
            return next(new error_1.AppError('Variant not found', 404));
        }
    }
    // Check stock
    const availableStock = variantData ? variantData.stockQuantity : product.stockQuantity;
    if (availableStock < quantity) {
        return next(new error_1.AppError('Insufficient stock', 400));
    }
    const cart = await Cart_1.default.findOrCreateCart(req.user.id);
    await cart.addItem({
        id: product._id,
        variantId: variantData?._id,
        name: product.productName,
        brand: product.brand,
        category: product.category,
        price: variantData ? variantData.salesPrice : product.salesPrice,
        quantity,
        image: product.images[0],
        unitType: variantData ? variantData.unitType : product.unitType,
        unitQuantity: variantData ? variantData.unitQuantity : product.unitQuantity,
        maxQuantity: availableStock
    });
    res.data({ cart }, 'Item added to cart successfully');
});
// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/items/:productId
// @access  Private
exports.updateCartItem = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { productId } = req.params;
    const { quantity, variantId } = req.body;
    if (!quantity || quantity < 1) {
        return next(new error_1.AppError('Valid quantity is required', 400));
    }
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    if (!cart) {
        return next(new error_1.AppError('Cart not found', 404));
    }
    await cart.updateItemQuantity(new mongoose_1.Types.ObjectId(productId), quantity, variantId);
    res.data({ cart }, 'Cart item updated successfully');
});
// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:productId
// @access  Private
exports.removeFromCart = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { productId } = req.params;
    const { variantId } = req.query;
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    if (!cart) {
        return next(new error_1.AppError('Cart not found', 404));
    }
    const variantObjectId = variantId ? new mongoose_1.Types.ObjectId(variantId) : undefined;
    await cart.removeItem(new mongoose_1.Types.ObjectId(productId), variantObjectId);
    res.data({ cart }, 'Item removed from cart successfully');
});
// @desc    Apply coupon to cart
// @route   POST /api/v1/cart/coupon
// @access  Private
exports.applyCoupon = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { couponCode } = req.body;
    if (!couponCode) {
        return next(new error_1.AppError('Coupon code is required', 400));
    }
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    if (!cart) {
        return next(new error_1.AppError('Cart not found', 404));
    }
    try {
        await cart.applyCoupon(couponCode);
        res.data({ cart }, 'Coupon applied successfully');
    }
    catch (error) {
        return next(new error_1.AppError(error.message, 400));
    }
});
// @desc    Remove coupon from cart
// @route   DELETE /api/v1/cart/coupon/:code
// @access  Private
exports.removeCoupon = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { code } = req.params;
    // console.log('Removing coupon code:', req.user);
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    console.log('Removing coupon code:', cart);
    console.log('Current cart before removing coupon:', cart);
    if (!cart) {
        return next(new error_1.AppError('Cart not found', 404));
    }
    await cart.removeCoupon(code);
    res.data({ cart }, 'Coupon removed successfully');
});
// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
exports.clearCart = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const cart = await Cart_1.default.getActiveCart(req.user.id);
    if (!cart) {
        return next(new error_1.AppError('Cart not found', 404));
    }
    await cart.clearCart();
    res.success('Cart cleared successfully');
});
//# sourceMappingURL=cart.js.map