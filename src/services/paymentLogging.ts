import { Types } from 'mongoose';
import PurchaseLog from '../models/billing/productPurchaseLog';
import orderSchema from '../models/Orders';

interface LogPurchaseParams {
    paymentChannel: string;
    userId?: string;
    meta: any;
    amount: number;
    transaction_ref: string;
}

interface VerifyPaymentParams {
    metadata: any;
    response: any;
}

class PaymentLogging {
    protected paystack: {
        secretKey: string;
        publicKey: string;
        baseURL: string;
    };

    protected palmpay: {
        merchantId: string;
        secretKey: string;
        baseURL: string;
    };

    protected opay: {
        merchantId: string;
        publicKey: string;
        privateKey: string;
        baseURL: string;
    };

    constructor() {
        this.paystack = {
            secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
            baseURL: 'https://api.paystack.co'
        };

        this.palmpay = {
            merchantId: process.env.PALMPAY_MERCHANT_ID || '',
            secretKey: process.env.PALMPAY_SECRET_KEY || '',
            baseURL: process.env.PALMPAY_BASE_URL || 'https://api.palmpay.com'
        };

        this.opay = {
            merchantId: process.env.OPAY_MERCHANT_ID || '',
            publicKey: process.env.OPAY_PUBLIC_KEY || '',
            privateKey: process.env.OPAY_PRIVATE_KEY || '',
            baseURL: 'https://sandbox-cashierapi.opayweb.com'
        };
    }

    async logPurchasePending({ paymentChannel, userId, meta, amount, transaction_ref }: LogPurchaseParams): Promise<void> {
        await PurchaseLog.create({
            userId,
            payment_status: 'PENDING_PAYMENT_CONFIRMATION',
            amount,
            meta,
            date: Date.now(),
            paymentChannel,
            transaction_ref,
        });
    }

    async initializationFailed({ meta }: { meta: any }): Promise<void> {
        if (meta.orderIds && Array.isArray(meta.orderIds)) {
            await Promise.all(
                meta.orderIds.map(async (orderId: string) =>
                    await orderSchema.findByIdAndUpdate(orderId, {
                        $push: { statusHistory: { state: 'Unpaid', date: new Date() } },
                    })
                )
            );
        }
    }

    async VerifyPaymentLogging({ metadata, response }: VerifyPaymentParams): Promise<boolean> {
        try {
            console.log(metadata);
            let fromLog: any;
            const { new_plan = {}, type } = metadata;

            if (type === 'purchase') {
                fromLog = await PurchaseLog.findOne({ transaction_ref: response.data.data.reference });
            }

            if (!fromLog) {
                console.log('No log found for transaction reference');
                return false;
            }

            console.log(fromLog.amount, fromLog.amount * 100, response.data.data.amount);

            const payment_status = 'PAYMENT_CONFIRMED';

            console.log("fromLog===>", fromLog);

            if (type === 'purchase') {
                if (fromLog.meta?.orderIds && Array.isArray(fromLog.meta.orderIds)) {
                    await Promise.all(
                        fromLog.meta.orderIds.map(async (orderId: string) =>
                            await orderSchema.findByIdAndUpdate(orderId, {
                                $push: { statusHistory: { status: 'Paid', date: new Date() } },
                            })
                        )
                    );
                }

                await PurchaseLog.updateOne(
                    { userId: fromLog.userId },
                    { $set: { payment_status } }
                );

            }

            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
}

export default PaymentLogging;