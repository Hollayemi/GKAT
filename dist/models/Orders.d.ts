import { Document, Model, Types } from 'mongoose';
export interface IOrderItem {
    productId: Types.ObjectId;
    variantId?: Types.ObjectId;
    name: string;
    brand?: string;
    category: string;
    price: number;
    quantity: number;
    image?: string;
    unitType: string;
    unitQuantity: string;
    totalPrice: number;
}
export interface IShippingAddress {
    label: string;
    fullname: string;
    address: string;
    phone: string;
    state: string;
    city?: string;
    zipCode?: string;
    email?: string;
    isDefault?: boolean;
}
export type PaymentMethod = 'palmpay' | 'paystack' | 'opay' | 'cash_on_delivery';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';
export interface IPaymentInfo {
    method: PaymentMethod;
    reference?: string;
    transactionId?: string;
    paymentStatus: PaymentStatus;
    paidAt?: Date;
    amount: number;
}
export interface IStatusHistory {
    status: OrderStatus;
    timestamp: Date;
    note?: string;
    updatedBy?: Types.ObjectId;
}
export interface IAppliedCoupon {
    code: string;
    promotionName: string;
    promoType: string;
    discountValue: number;
    discountAmount: number;
}
export interface IOrder extends Document {
    orderNumber: string;
    orderSlug: string;
    userId: Types.ObjectId;
    items: IOrderItem[];
    shippingAddress: string;
    deliveryMethod: 'pickup' | 'delivery';
    paymentInfo: IPaymentInfo;
    orderStatus: OrderStatus;
    subtotal: number;
    deliveryFee: number;
    serviceCharge: number;
    tax: number;
    discount: number;
    totalAmount: number;
    appliedCoupons: IAppliedCoupon[];
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    notes?: string;
    adminNotes?: string;
    statusHistory: IStatusHistory[];
    cancellationReason?: string;
    returnReason?: string;
    refundAmount: number;
    refundedAt?: Date;
    rating?: number;
    review?: string;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    orderAge: number;
    isRecent: boolean;
    canCancel: boolean;
    canReturn: boolean;
    updateStatus(newStatus: OrderStatus, note?: string, updatedBy?: Types.ObjectId): Promise<IOrder>;
    addTrackingInfo(trackingNumber: string, carrier: string, estimatedDelivery?: Date): Promise<IOrder>;
    processPayment(reference: string, transactionId: string, paidAmount: number): Promise<IOrder>;
    cancelOrder(reason: string, cancelledBy?: Types.ObjectId): Promise<IOrder>;
    returnOrder(reason: string): Promise<IOrder>;
    addRating(rating: number, review?: string): Promise<IOrder>;
}
interface IOrderModel extends Model<IOrder> {
    getOrderStats(userId?: Types.ObjectId): Promise<Array<{
        _id: OrderStatus;
        count: number;
        totalAmount: number;
    }>>;
    generateOrderNumber(): Promise<string>;
    generateOrderSlug(): Promise<string>;
}
declare const Order: IOrderModel;
export default Order;
//# sourceMappingURL=Orders.d.ts.map