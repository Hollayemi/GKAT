import { Document, Model, Types } from 'mongoose';
export declare enum PaymentStatus {
    PENDING_PAYMENT_CONFIRMATION = "PENDING_PAYMENT_CONFIRMATION",
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentChannel {
    PAYSTACK = "PAYSTACK",
    PALMPAY = "PALMPAY",
    OPAY = "OPAY",
    CASH_ON_DELIVERY = "CASH_ON_DELIVERY"
}
export interface IPurchaseMeta {
    orderIds?: Types.ObjectId[];
    coin?: number;
    orderSlugs?: string[];
    items?: Array<{
        productId: Types.ObjectId;
        quantity: number;
        price: number;
    }>;
    shippingAddress?: {
        address: string;
        city: string;
        state: string;
        country: string;
        zipCode: string;
    };
    [key: string]: any;
}
export interface IPurchaseLog extends Document {
    userId: Types.ObjectId;
    amount: number;
    meta: IPurchaseMeta;
    payment_status: PaymentStatus;
    paymentChannel: PaymentChannel;
    transaction_ref: string;
    date?: Date;
    createdAt: Date;
    updatedAt: Date;
    formattedDate?: string;
    updateStatus(newStatus: PaymentStatus): Promise<IPurchaseLog>;
    isSuccessful(): boolean;
    isPending(): boolean;
}
interface IPurchaseLogModel extends Model<IPurchaseLog> {
    findByUserId(userId: Types.ObjectId | string): Promise<IPurchaseLog[]>;
    findByTransactionRef(transaction_ref: string): Promise<IPurchaseLog | null>;
    findByStatus(payment_status: PaymentStatus): Promise<IPurchaseLog[]>;
    findSuccessfulPayments(): Promise<IPurchaseLog[]>;
    findRecentPurchases(days?: number): Promise<IPurchaseLog[]>;
    getTotalRevenue(): Promise<number>;
    getRevenueByChannel(): Promise<Array<{
        channel: PaymentChannel;
        total: number;
    }>>;
}
declare const PurchaseLog: IPurchaseLogModel;
export default PurchaseLog;
//# sourceMappingURL=productPurchaseLog.d.ts.map