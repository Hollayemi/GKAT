"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const productPurchaseLog_1 = __importDefault(require("../models/billing/productPurchaseLog"));
const Orders_1 = __importDefault(require("../models/Orders"));
const Cart_1 = __importDefault(require("../models/Cart"));
const logger_1 = __importDefault(require("../utils/logger"));
class PaymentLogging {
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
    async logPurchasePending({ paymentChannel, userId, meta, amount, transaction_ref }) {
        try {
            await productPurchaseLog_1.default.create({
                userId,
                payment_status: 'PENDING_PAYMENT_CONFIRMATION',
                amount,
                meta,
                date: new Date(),
                paymentChannel,
                transaction_ref,
            });
            logger_1.default.info(`Payment log created: ${transaction_ref}`);
        }
        catch (error) {
            logger_1.default.error('Error logging purchase pending:', error);
            throw error;
        }
    }
    async initializationFailed({ meta }) {
        try {
            if (meta.orderIds && Array.isArray(meta.orderIds)) {
                await Promise.all(meta.orderIds.map(async (orderId) => {
                    await Orders_1.default.findByIdAndUpdate(orderId, {
                        $set: {
                            orderStatus: 'cancelled',
                            'paymentInfo.paymentStatus': 'failed'
                        },
                        $push: {
                            statusHistory: {
                                status: 'cancelled',
                                timestamp: new Date(),
                                note: 'Payment initialization failed'
                            }
                        }
                    });
                }));
                logger_1.default.info('Orders marked as failed due to initialization failure');
            }
        }
        catch (error) {
            logger_1.default.error('Error marking orders as failed:', error);
        }
    }
    async VerifyPaymentLogging({ metadata, response }) {
        try {
            logger_1.default.info('Verifying payment logging:', { metadata, responseData: response.data });
            const { type, orderId, userId } = metadata;
            // Find the purchase log by transaction reference
            const fromLog = await productPurchaseLog_1.default.findOne({
                transaction_ref: response.reference
            });
            if (!fromLog) {
                logger_1.default.error('No purchase log found for transaction reference:', response.reference);
                return false;
            }
            // Verify the amount matches (Paystack returns amount in kobo)
            const expectedAmount = fromLog.amount * 100;
            const receivedAmount = response.amount;
            if (expectedAmount !== receivedAmount) {
                logger_1.default.error('Amount mismatch:', {
                    expected: expectedAmount,
                    received: receivedAmount
                });
                return false;
            }
            // Check if payment was successful
            if (response.status !== 'success') {
                logger_1.default.error('Payment status not successful:', response.status);
                await this.handleFailedPayment(fromLog);
                return false;
            }
            // Update purchase log
            await productPurchaseLog_1.default.updateOne({ _id: fromLog._id }, {
                $set: {
                    payment_status: 'PAYMENT_CONFIRMED',
                    date: new Date()
                }
            });
            // Get order slugs for redirect
            const orderSlugs = [];
            // Update orders if this is a purchase
            if (type === 'purchase' && fromLog.meta?.orderIds) {
                const orderIds = fromLog.meta.orderIds;
                for (const orderId of orderIds) {
                    try {
                        const order = await Orders_1.default.findByIdAndUpdate(orderId, {
                            $set: {
                                orderStatus: 'confirmed',
                                'paymentInfo.paymentStatus': 'completed',
                                'paymentInfo.paidAt': new Date(),
                                'paymentInfo.transactionId': response.id,
                                'paymentInfo.reference': response.reference
                            },
                            $push: {
                                statusHistory: {
                                    status: 'confirmed',
                                    timestamp: new Date(),
                                    note: 'Payment confirmed'
                                }
                            }
                        }, { new: true });
                        if (order) {
                            orderSlugs.push(order.orderSlug);
                            logger_1.default.info(`Order ${order.orderNumber} payment confirmed`);
                        }
                    }
                    catch (error) {
                        logger_1.default.error(`Error updating order ${orderId}:`, error);
                    }
                }
                // Clear user's cart after successful payment
                if (userId) {
                    try {
                        const cart = await Cart_1.default.findOne({ userId, isActive: true });
                        if (cart) {
                            await cart.clearCart();
                            logger_1.default.info(`Cart cleared for user ${userId}`);
                        }
                    }
                    catch (error) {
                        logger_1.default.error('Error clearing cart:', error);
                    }
                }
            }
            metadata.orderSlugs = orderSlugs;
            logger_1.default.info('Payment verification completed successfully');
            return true;
        }
        catch (error) {
            logger_1.default.error('Payment verification error:', error);
            return false;
        }
    }
    async handleFailedPayment(purchaseLog) {
        try {
            await productPurchaseLog_1.default.updateOne({ _id: purchaseLog._id }, {
                $set: {
                    payment_status: 'FAILED',
                    date: new Date()
                }
            });
            if (purchaseLog.meta?.orderIds) {
                await Promise.all(purchaseLog.meta.orderIds.map(async (orderId) => {
                    await Orders_1.default.findByIdAndUpdate(orderId, {
                        $set: {
                            orderStatus: 'cancelled',
                            'paymentInfo.paymentStatus': 'failed'
                        },
                        $push: {
                            statusHistory: {
                                status: 'cancelled',
                                timestamp: new Date(),
                                note: 'Payment failed'
                            }
                        }
                    });
                }));
            }
            logger_1.default.info('Failed payment handled');
        }
        catch (error) {
            logger_1.default.error('Error handling failed payment:', error);
        }
    }
}
exports.default = PaymentLogging;
//# sourceMappingURL=paymentLogging.js.map