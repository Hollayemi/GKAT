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


// export async function buildCartSummary(cart: any): Promise<any> {

//     const enrichedItems: any[] = [];
//     let subtotal = 0;
//     let totalOriginalPrice = 0;
//     let totalDealDiscount = 0;

//     for (const item of cart.items) {
//         const product = await Product.findById(item.productId)
//             .populate('category', 'name icon')
//             .lean();

//         if (!product) {
//             // Product removed from catalogue – keep item but flag it
//             enrichedItems.push({
//                 ...item.toObject?.() ?? item,
//                 product: null,
//                 unavailable: true,
//                 effectivePrice: item.price,
//                 originalPrice: item.price,
//                 dealDiscount: 0,
//                 hasDeal: false,
//                 totalPrice: item.price * item.quantity,
//             });
//             subtotal += item.price * item.quantity;
//             totalOriginalPrice += item.price * item.quantity;
//             continue;
//         }

//         // Resolve variant vs main product price
//         let basePrice = item.price;
//         if (item.variantId) {
//             const variant = (product as any).variants?.find(
//                 (v: any) => v._id?.toString() === item.variantId?.toString()
//             );
//             if (variant) basePrice = variant.salesPrice;
//         } else {
//             basePrice = (product as any).salesPrice;
//         }

//         const { effectivePrice, originalPrice, dealDiscount, hasDeal } =
//             resolveEffectivePrice(product, basePrice);

//         const itemOriginalTotal = originalPrice * item.quantity;
//         const itemEffectiveTotal = effectivePrice * item.quantity;
//         const itemDealDiscount = dealDiscount * item.quantity;

//         totalOriginalPrice += itemOriginalTotal;
//         totalDealDiscount += itemDealDiscount;
//         subtotal += itemEffectiveTotal;

//         enrichedItems.push({
//             productId: item.productId,
//             variantId: item.variantId,
          
//             brand: item.brand,
//             category: item.category,

//             unitType: item.unitType,
//             unitQuantity: item.unitQuantity,
//             maxQuantity: item.maxQuantity,
//             quantity: item.quantity,

//             // Pricing
//             originalPrice,          // price without deal
//             effectivePrice,         // price after deal
//             dealDiscount,           // discount per unit
//             hasDeal,
//             dealInfo: hasDeal ? (product as any).dealInfo : null,
//             totalOriginalPrice: itemOriginalTotal,
//             totalEffectivePrice: itemEffectiveTotal,
//             totalDealDiscount: itemDealDiscount,


//             _id: (product as any)._id,
//             name: (product as any).productName,
//             sku: (product as any).sku,
//             status: (product as any).status,
//             stockQuantity: (product as any).stockQuantity,
//             image: (product as any).images[0],

//             unavailable:
//                 (product as any).status !== 'active' ||
//                 (product as any).stockQuantity < item.quantity,
//         });
//     }

//     let couponDiscount = 0;
//     const enrichedCoupons: any[] = [];

//     for (const appliedCoupon of cart.appliedCoupons) {
//         const promoType = appliedCoupon.promoType?.toLowerCase() ?? '';
//         let discountAmount = 0;

//         if (promoType.includes('percentage') || promoType.includes('%')) {
//             discountAmount = Math.round((subtotal * appliedCoupon.discountValue) / 100);
//         } else if (promoType.includes('fixed') || promoType.includes('flat')) {
//             discountAmount = Math.min(appliedCoupon.discountValue, subtotal - couponDiscount);
//         } else {
//             // default → percentage
//             discountAmount = Math.round((subtotal * appliedCoupon.discountValue) / 100);
//         }

//         couponDiscount += discountAmount;

//         enrichedCoupons.push({
//             code: appliedCoupon.code,
//             promotionName: appliedCoupon.promotionName,
//             promoType: appliedCoupon.promoType,
//             discountValue: appliedCoupon.discountValue,
//             discountAmount,
//         });
//     }

//     const discountedSubtotal = Math.max(0, subtotal - couponDiscount);


//     // Delivery fee – use whatever is already stored on the cart
//     const deliveryFee = cart.deliveryFee ?? 0;

//     const totalAmount = discountedSubtotal;

//     return {
//         _id: cart._id,
//         userId: cart.userId,
//         isActive: cart.isActive,
//         deliveryMethod: cart.deliveryMethod,
//         deliveryAddress: cart.deliveryAddress,
//         estimatedDeliveryTime: cart.estimatedDeliveryTime,
//         lastModified: cart.lastModified,
//         createdAt: cart.createdAt,
//         updatedAt: cart.updatedAt,

//         items: enrichedItems,
//         appliedCoupons: enrichedCoupons,

//         pricing: {
//             originalSubtotal: totalOriginalPrice,     // sum of original prices (before deals)
//             dealDiscount: totalDealDiscount,           // total saved from deals
//             subtotal,                                  // after deals, before coupons
//             couponDiscount,                            // total saved from coupons
//             discountedSubtotal,                        // after both deals & coupons
//             totalAmount,
//         },

//         totalItems: enrichedItems.reduce((n, i) => n + i.quantity, 0),
//         totalSavings: totalDealDiscount + couponDiscount,
//         hasUnavailableItems: enrichedItems.some((i) => i.unavailable),
//     };
// }

//  controllers 

// @desc    Get user cart (fully populated + live pricing)
// @route   GET /api/v1/cart
// @access  Private
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
