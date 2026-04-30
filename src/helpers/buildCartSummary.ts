import Product from '../models/admin/Product';
import UserSubscription from '../models/UserSubscription';


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
    return { effectivePrice: originalPrice - dealDiscount, originalPrice, dealDiscount, hasDeal: true };
}


export async function buildCartSummary(cart: any): Promise<any> {
    const enrichedItems: any[] = [];
    let subtotal = 0;
    let totalOriginalPrice = 0;
    let totalDealDiscount = 0;

    for (const item of cart.items) {
        const product = await Product.findById(item.productId)
            .populate('category', 'name icon')
            .lean();

        if (!product) {
            enrichedItems.push({
                ...item.toObject?.() ?? item,
                product: null,
                unavailable: true,
                effectivePrice: item.price,
                originalPrice: item.price,
                dealDiscount: 0,
                hasDeal: false,
                totalPrice: item.price * item.quantity,
            });
            subtotal += item.price * item.quantity;
            totalOriginalPrice += item.price * item.quantity;
            continue;
        }

        let basePrice = item.price;
        if (item.variantId) {
            const variant = (product as any).variants?.find(
                (v: any) => v._id?.toString() === item.variantId?.toString()
            );
            if (variant) basePrice = variant.salesPrice;
        } else {
            basePrice = (product as any).salesPrice;
        }

        const { effectivePrice, originalPrice, dealDiscount, hasDeal } =
            resolveEffectivePrice(product, basePrice);

        const itemOriginalTotal = originalPrice * item.quantity;
        const itemEffectiveTotal = effectivePrice * item.quantity;
        const itemDealDiscount = dealDiscount * item.quantity;

        totalOriginalPrice += itemOriginalTotal;
        totalDealDiscount += itemDealDiscount;
        subtotal += itemEffectiveTotal;

        enrichedItems.push({
            productId: item.productId,
            variantId: item.variantId,
            brand: item.brand,
            category: item.category,
            unitType: item.unitType,
            unitQuantity: item.unitQuantity,
            maxQuantity: item.maxQuantity,
            quantity: item.quantity,
            originalPrice,
            effectivePrice,
            dealDiscount,
            hasDeal,
            dealInfo: hasDeal ? (product as any).dealInfo : null,
            totalOriginalPrice: itemOriginalTotal,
            totalEffectivePrice: itemEffectiveTotal,
            totalDealDiscount: itemDealDiscount,
            _id: (product as any)._id,
            name: (product as any).productName,
            sku: (product as any).sku,
            status: (product as any).status,
            stockQuantity: (product as any).stockQuantity,
            image: (product as any).images[0],
            unavailable:
                (product as any).status !== 'active' ||
                (product as any).stockQuantity < item.quantity,
        });
    }

    let couponDiscount = 0;
    const enrichedCoupons: any[] = [];

    for (const appliedCoupon of cart.appliedCoupons) {
        const promoType = appliedCoupon.promoType?.toLowerCase() ?? '';
        let discountAmount = 0;

        if (promoType.includes('percentage') || promoType.includes('%')) {
            discountAmount = Math.round((subtotal * appliedCoupon.discountValue) / 100);
        } else if (promoType.includes('fixed') || promoType.includes('flat')) {
            discountAmount = Math.min(appliedCoupon.discountValue, subtotal - couponDiscount);
        } else {
            discountAmount = Math.round((subtotal * appliedCoupon.discountValue) / 100);
        }

        couponDiscount += discountAmount;

        enrichedCoupons.push({
            code: appliedCoupon.code,
            promotionName: appliedCoupon.promotionName,
            promoType: appliedCoupon.promoType,
            discountValue: appliedCoupon.discountValue,
            discountAmount,
        });
    }

    const afterCouponSubtotal = Math.max(0, subtotal - couponDiscount);

    let subscriptionDiscount = 0;
    let subscriptionInfo: any = null;

    if (cart.userId) {
        try {
            const activeSub = await UserSubscription.getActiveSubscription(cart.userId.toString());

            console.log({activeSub})

            if (activeSub) {
                const snap = activeSub.planSnapshot;
                subscriptionDiscount = Math.round((afterCouponSubtotal * snap.discountPercentage) / 100);
                if (snap.maxDiscountAmountPerOrder && snap.maxDiscountAmountPerOrder > 0) {
                    subscriptionDiscount = Math.min(subscriptionDiscount, snap.maxDiscountAmountPerOrder);
                }
                subscriptionInfo = {
                    planName: snap.name,
                    discountPercentage: snap.discountPercentage,
                    discountAmount: subscriptionDiscount,
                    endDate: activeSub.endDate,
                    daysRemaining: activeSub.daysRemaining
                };
            }
        } catch (err) {
            // Non-fatal – subscription lookup failure shouldn't break cart
        }
    }

    const discountedSubtotal = Math.max(0, afterCouponSubtotal - subscriptionDiscount);

    console.log({subscriptionDiscount, subscriptionInfo})

    // Delivery fee – stored on the cart document
    const deliveryFee = cart.deliveryFee ?? 0;

    return {
        _id: cart._id,
        userId: cart.userId,
        isActive: cart.isActive,
        deliveryMethod: cart.deliveryMethod,
        deliveryAddress: cart.deliveryAddress,
        estimatedDeliveryTime: cart.estimatedDeliveryTime,
        lastModified: cart.lastModified,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,

        items: enrichedItems,
        appliedCoupons: enrichedCoupons,

        pricing: {
            originalSubtotal: totalOriginalPrice,        // before deals
            dealDiscount: totalDealDiscount,              // saved from deals
            subtotal,                                     // after deals, before go-prime
            couponDiscount,                               // saved from coupons
            subscriptionDiscount,                         // Go Prime discount
            totalAmount: totalOriginalPrice - subscriptionDiscount - totalDealDiscount,
        },

        subscriptionInfo,                                 // null if no active subscription
        totalItems: enrichedItems.reduce((n, i) => n + i.quantity, 0),
        totalSavings: totalDealDiscount + couponDiscount + subscriptionDiscount,
        hasUnavailableItems: enrichedItems.some((i) => i.unavailable),
    };
}