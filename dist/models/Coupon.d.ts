import { Document, Model, Types } from 'mongoose';
export interface ICoupon extends Document {
    promotionName: string;
    promoType: string;
    couponCode: string;
    discountValue: number;
    usageLimit: number;
    perUserLimit: number;
    currentUsage: number;
    description?: string;
    minimumOrderValue?: number;
    applicableCategories?: string[];
    applicableProducts?: string[];
    startDateTime: Date;
    endDateTime: Date;
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    isExpired: boolean;
    isAvailable: boolean;
    usageRemaining: number;
    canBeUsedBy(userId: Types.ObjectId): Promise<boolean>;
    incrementUsage(userId: Types.ObjectId): Promise<void>;
    validateForCart(cartTotal: number, cartItems: any[]): {
        valid: boolean;
        reason?: string;
    };
}
interface ICouponModel extends Model<ICoupon> {
    getAvailableCoupons(userId: Types.ObjectId, cartTotal?: number): Promise<ICoupon[]>;
    validateCoupon(code: string, userId: Types.ObjectId): Promise<{
        valid: boolean;
        coupon?: ICoupon;
        reason?: string;
    }>;
}
declare const Coupon: ICouponModel;
export default Coupon;
//# sourceMappingURL=Coupon.d.ts.map