import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Cart from '../models/Cart';
import Coupon from '../models/Coupon';
import Product from '../models/admin/Product';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';


// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private
export const getCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const cart = await Cart.findOrCreateCart(req.user.id);
    
    // Get available coupons for user
    const availableCoupons = await Coupon.getAvailableCoupons(
        req.user.id, 
        cart.subtotal
    );

    (res as AppResponse).data({
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
export const addToCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    console.log(req.user)

    console.log(req.body);

    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId) {
        return next(new AppError('Product ID is required', 400));
    }

    // Fetch product details
    const product = await Product.findById(productId);
    if (!product) {
        return next(new AppError('Product not found', 404));
    }

    if (product.status !== 'active') {
        return next(new AppError('Product is not available', 400));
    }

    // Check variant if provided
    let variantData = null;
    if (variantId) {
        variantData = product.variants.find(v => v._id?.toString() === variantId);
        if (!variantData) {
            return next(new AppError('Variant not found', 404));
        }
    }

    // Check stock
    const availableStock = variantData ? variantData.stockQuantity : product.stockQuantity;
    if (availableStock < quantity) {
        return next(new AppError('Insufficient stock', 400));
    }

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
        maxQuantity: availableStock
    });

    (res as AppResponse).data({ cart }, 'Item added to cart successfully');
});

// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/items/:productId
// @access  Private
export const updateCartItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }
    const { productId } = req.params;
    const { quantity, variantId } = req.body;

    if (!quantity || quantity < 1) {
        return next(new AppError('Valid quantity is required', 400));
    }

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    await cart.updateItemQuantity(new Types.ObjectId(productId), quantity, variantId);

    (res as AppResponse).data({ cart }, 'Cart item updated successfully');
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/items/:productId
// @access  Private
export const removeFromCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { productId } = req.params;
    const { variantId } = req.query;

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    const variantObjectId = variantId ? new Types.ObjectId(variantId as string) : undefined;
    await cart.removeItem(new Types.ObjectId(productId), variantObjectId);

    (res as AppResponse).data({ cart }, 'Item removed from cart successfully');
});

// @desc    Apply coupon to cart
// @route   POST /api/v1/cart/coupon
// @access  Private
export const applyCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { couponCode } = req.body;

    if (!couponCode) {
        return next(new AppError('Coupon code is required', 400));
    }

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    try {
        await cart.applyCoupon(couponCode);
        (res as AppResponse).data({ cart }, 'Coupon applied successfully');
    } catch (error: any) {
        return next(new AppError(error.message, 400));
    }
});

// @desc    Remove coupon from cart
// @route   DELETE /api/v1/cart/coupon/:code
// @access  Private
export const removeCoupon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const { code } = req.params;

    // console.log('Removing coupon code:', req.user);
    
    const cart = await Cart.getActiveCart(req.user.id);

    console.log('Removing coupon code:', cart);
    
    console.log('Current cart before removing coupon:', cart);

    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    await cart.removeCoupon(code);

    (res as AppResponse).data({ cart }, 'Coupon removed successfully');
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
export const clearCart = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const cart = await Cart.getActiveCart(req.user.id);
    if (!cart) {
        return next(new AppError('Cart not found', 404));
    }

    await cart.clearCart();

    (res as AppResponse).success('Cart cleared successfully');
});
