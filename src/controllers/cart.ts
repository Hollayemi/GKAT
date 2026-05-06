import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Cart from '../models/Cart';
import Coupon from '../models/Coupon';
import Product from '../models/admin/Product';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import { buildCartSummary } from '../helpers/buildCartSummary';


function resolveEffectivePrice(
    product: any,
    basePrice: number
): { effectivePrice: number; originalPrice: number; dealDiscount: number; hasDeal: boolean } {
    const originalPrice = basePrice;

    const deal = product?.dealInfo;
    const hasDeal =
        deal &&
        deal.status === 'active' &&
        new Date() >= new Date(deal.startDate) &&
        new Date() <= new Date(deal.endDate);

    if (!hasDeal) {
        return { effectivePrice: originalPrice, originalPrice, dealDiscount: 0, hasDeal: false };
    }

    const dealDiscount = Math.round((originalPrice * deal.percentage) / 100);
    const effectivePrice = originalPrice - dealDiscount;

    return { effectivePrice, originalPrice, dealDiscount, hasDeal: true };
}



export const getCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    // Find or create cart (raw document so we keep appliedCoupons etc.)
    const cart = await Cart.findOrCreateCart(req.user.id);

    const [summary, availableCoupons] = await Promise.all([
        buildCartSummary(cart),
        Coupon.getAvailableCoupons(req.user.id, cart.subtotal),
    ]);

    (res as AppResponse).data(
        {
            cart: summary,
            availableCoupons: availableCoupons.map((c) => ({
                code: c.couponCode,
                title: c.promotionName,
                description: c.description,
                discountType: c.promoType,
                discountValue: c.discountValue,
                minimumOrderValue: c.minimumOrderValue,
            })),
        },
        'Cart retrieved successfully'
    );
});


// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
export const addToCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId) return next(new AppError('Product ID is required', 400));

    const product = await Product.findById(productId);
    if (!product) return next(new AppError('Product not found', 404));
    if (product.status !== 'active') return next(new AppError('Product is not available', 400));

    let variantData: any = null;
    if (variantId) {
        variantData = product.variants.find((v) => v._id?.toString() === variantId);
        if (!variantData) return next(new AppError('Variant not found', 404));
    }

    const availableStock = variantData ? variantData.stockQuantity : product.stockQuantity;
    if (availableStock < quantity) return next(new AppError('Insufficient stock', 400));

    const cart = await Cart.findOrCreateCart(req.user.id);

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
        maxQuantity: availableStock,
    });

    const summary = await buildCartSummary(cart);

    (res as AppResponse).data({ cart: summary }, 'Item added to cart successfully');
});


// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/items/:productId
// @access  Private
export const updateCartItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { productId } = req.params;
    const { quantity, variantId } = req.body;

    if (!quantity || quantity < 1) return next(new AppError('Valid quantity is required', 400));

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) return next(new AppError('Cart not found', 404));

    await cart.updateItemQuantity(new Types.ObjectId(productId), quantity, variantId);

    const summary = await buildCartSummary(cart);

    (res as AppResponse).data({ cart: summary }, 'Cart item updated successfully');
});


// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:productId
// @access  Private
export const removeFromCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { productId } = req.params;
    const { variantId } = req.query;

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) return next(new AppError('Cart not found', 404));

    const variantObjectId = variantId ? new Types.ObjectId(variantId as string) : undefined;
    await cart.removeItem(new Types.ObjectId(productId), variantObjectId);

    const summary = await buildCartSummary(cart);

    (res as AppResponse).data({ cart: summary }, 'Item removed from cart successfully');
});


// @desc    Apply coupon to cart
// @route   POST /api/v1/cart/coupon
// @access  Private
export const applyCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { couponCode } = req.body;
    if (!couponCode) return next(new AppError('Coupon code is required', 400));

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) return next(new AppError('Cart not found', 404));

    try {
        await cart.applyCoupon(couponCode);
    } catch (error: any) {
        return next(new AppError(error.message, 400));
    }

    const summary = await buildCartSummary(cart);

    (res as AppResponse).data({ cart: summary }, 'Coupon applied successfully');
});


// @desc    Remove coupon from cart
// @route   DELETE /api/v1/cart/coupon/:code
// @access  Private
export const removeCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { code } = req.params;

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) return next(new AppError('Cart not found', 404));

    await cart.removeCoupon(code);

    const summary = await buildCartSummary(cart);

    (res as AppResponse).data({ cart: summary }, 'Coupon removed successfully');
});


// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
export const clearCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) return next(new AppError('Cart not found', 404));

    await cart.clearCart();

    (res as AppResponse).success('Cart cleared successfully');
});
