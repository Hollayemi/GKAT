import { Document, Model, Types } from 'mongoose';
export interface ICartItem {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    name: string;
    brand?: string;
    category: string;
    price: number;
    quantity: number;
    image?: string;
    unitType: string;
    unitQuantity: number;
    maxQuantity: number;
    totalPrice: number;
}
export interface IAppliedCoupon {
    code: string;
    promotionName: string;
    promoType: string;
    discountValue: number;
    discountAmount: number;
    appliedAt: Date;
}
export interface ICart extends Document {
    userId: Types.ObjectId;
    items: ICartItem[];
    subtotal: number;
    deliveryFee: number;
    serviceCharge: number;
    discount: number;
    totalAmount: number;
    appliedCoupons: IAppliedCoupon[];
    availableCoupons: string[];
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryAddress?: Types.ObjectId;
    estimatedDeliveryTime?: string;
    isActive: boolean;
    expiresAt?: Date;
    lastModified: Date;
    createdAt: Date;
    updatedAt: Date;
    totalItems: number;
    totalSavings: number;
    addItem(productData: {
        id: Types.ObjectId;
        variantId?: Types.ObjectId;
        name: string;
        brand?: string;
        category: string;
        price: number;
        quantity?: number;
        image?: string;
        unitType: string;
        unitQuantity: number;
        maxQuantity: number;
    }): Promise<ICart>;
    removeItem(productId: Types.ObjectId, variantId?: Types.ObjectId): Promise<ICart>;
    updateItemQuantity(productId: Types.ObjectId, quantity: number, variantId?: Types.ObjectId): Promise<ICart>;
    applyCoupon(couponCode: string): Promise<ICart>;
    removeCoupon(couponCode: string): Promise<ICart>;
    clearCart(): Promise<ICart>;
    calculateTotals(): void;
    validateStock(): Promise<{
        valid: boolean;
        outOfStock: string[];
    }>;
}
interface ICartModel extends Model<ICart> {
    findOrCreateCart(userId: Types.ObjectId): Promise<ICart>;
    getActiveCart(userId: Types.ObjectId): Promise<ICart | null>;
}
declare const Cart: ICartModel;
export default Cart;
//# sourceMappingURL=Cart.d.ts.map