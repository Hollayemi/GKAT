import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import PaymentLogging from './paymentLogging';
import Order from '../models/Orders';
import UserSubscription from '../models/UserSubscription';

interface PaymentData {
    email: string;
    amount: number;
    reference: string;
    currency?: string;
    orderId?: string;
    userId?: string;
    description?: string;
    phone?: string;
    userIp?: string;
    metadata?: Record<string, any>;
    coin?: number;
}

interface PaymentResponse {
    success: boolean;
    data?: any;
    error?: string;
    provider: string;
}

interface PaymentConfig {
    secretKey?: string;
    publicKey?: string;
    baseURL: string;
    merchantId?: string;
    privateKey?: string;
}

class PaymentGateway extends PaymentLogging {
    protected paystack: {
        secretKey: string;
        publicKey: string;
        baseURL: string;
    };

    protected flutterwave: {
        publicKey: string;
        secretKey: string;
        encryptionKey: string;
        baseURL: string;
    };

    constructor() {
        super();
        this.paystack = {
            secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
            baseURL: 'https://api.paystack.co'
        };

        this.flutterwave = {
            publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
            secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
            encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
            baseURL: process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3'
        };
    }

    private generateFlutterwaveSignature(data: any): string {
        const jsonString = JSON.stringify(data);
        return crypto
            .createHmac('sha256', this.flutterwave.secretKey)
            .update(jsonString)
            .digest('hex');
    }

    async initializePaystackPayment(paymentData: PaymentData): Promise<PaymentResponse> {
        try {
            const response: AxiosResponse = await axios.post(
                `${this.paystack.baseURL}/transaction/initialize`,
                {
                    email: paymentData.email,
                    amount: paymentData.amount * 100, // Convert to kobo
                    reference: paymentData.reference,
                    currency: paymentData.currency || 'NGN',
                    callback_url: `${process.env.API_URL}/payment/callback?provider=paystack&platform=browser`,
                    return_url: `${process.env.API_URL}/payment/callback?provider=paystack&platform=browser`,
                    metadata: {
                        type: 'purchase',
                        orderId: paymentData.orderId,
                        userId: paymentData.userId,
                        ...paymentData.metadata
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystack.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await this.logPurchasePending({
                paymentChannel: 'PAYSTACK',
                transaction_ref: response.data.data.reference,
                meta: paymentData,
                amount: paymentData.amount,
                userId: paymentData.userId
            });

            return {
                success: true,
                data: response.data.data,
                provider: 'paystack'
            };
        } catch (error: any) {
            console.error('Paystack initialization error:', error.response?.data || error.message);
            this.initializationFailed({ meta: paymentData });
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'paystack'
            };
        }
    }

    async initializeFlutterwavePayment(paymentData: PaymentData): Promise<PaymentResponse> {
        try {
            const requestData = {
                tx_ref: paymentData.reference,
                amount: paymentData.amount,
                currency: paymentData.currency || 'NGN',
                redirect_url: `${process.env.API_URL}/payment/callback?provider=flutterwave&platform=browser`,
                payment_options: 'card,ussd, banktransfer, mobilemoney',
                customer: {
                    email: paymentData.email,
                    phonenumber: paymentData.phone || '08012345678',
                    name: paymentData.metadata?.customerName || 'Customer'
                },
                customizations: {
                    title: 'Order Payment',
                    description: paymentData.description || 'Payment for order',
                    logo: process.env.COMPANY_LOGO_URL || ''
                },
                meta: {
                    orderId: paymentData.orderId,
                    userId: paymentData.userId,
                    ...paymentData.metadata
                }
            };

            console.log('Initializing Flutterwave payment with data:', requestData);

            const response: AxiosResponse = await axios.post(
                `${this.flutterwave.baseURL}/payments`,
                requestData,
                {
                    headers: {
                        Authorization: `Bearer ${this.flutterwave.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Flutterwave initialization response:', response.data, paymentData);

            await this.logPurchasePending({
                paymentChannel: 'FLUTTERWAVE',
                transaction_ref: paymentData.reference,
                meta: paymentData,
                amount: paymentData.amount,
                userId: paymentData.userId
            });

            if (response.data.status === 'success') {
                return {
                    success: true,
                    data: {
                        authorization_url: response.data.data.link,
                        reference: response.data.data.tx_ref,
                        ...response.data.data
                    },
                    provider: 'flutterwave'
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Payment initialization failed',
                    provider: 'flutterwave'
                };
            }
        } catch (error: any) {
            console.error('Flutterwave initialization error:', error.response?.data || error.message);
            this.initializationFailed({ meta: paymentData });
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'flutterwave'
            };
        }
    }

    async verifyPaystackPayment(reference: string): Promise<PaymentResponse> {
        try {
            const response: AxiosResponse = await axios.get(
                `${this.paystack.baseURL}/transaction/verify/${reference}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.paystack.secretKey}`
                    }
                }
            );

            if (!response.data || !response.data.data) {
                return {
                    success: false,
                    error: 'Invalid response from payment gateway',
                    provider: 'paystack'
                };
            }

            const transactionData = response.data.data;

            // Check if transaction was successful
            if (transactionData.status !== 'success') {
                return {
                    success: false,
                    error: `Payment ${transactionData.status}`,
                    provider: 'paystack',
                    data: {
                        status: transactionData.status,
                        message: transactionData.gateway_response
                    }
                };
            }

            // Extract metadata
            const metadata = transactionData.metadata || {};

            // Verify the payment in our database
            const verified = await this.VerifyPaymentLogging({
                metadata,
                response: transactionData
            });

            if (!verified) {
                return {
                    success: false,
                    error: 'Payment verification failed',
                    provider: 'paystack'
                };
            }

            const { orderId, userId } = metadata

            if (reference?.startsWith("PAY_SUB")) {
                const subscription = await UserSubscription.findOne({
                    userId: userId,
                    paymentReference: reference
                }).populate('planId');

                if (!subscription) return {
                    success: false,
                    error: 'Subscription record not found for this reference',
                    provider: 'paystack'
                }

                if (subscription.paymentStatus === 'completed') {
                    return {
                        success: false,
                        error: 'Subscription is already active',
                        provider: 'paystack'
                    }
                }

                // Activate subscription
                const plan = subscription.planSnapshot;
                const now = new Date();
                const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

                subscription.paymentStatus = 'completed';
                subscription.paymentCompletedAt = now;
                subscription.status = 'active';
                subscription.startDate = now;
                subscription.endDate = endDate;
                await subscription.save();
            }

            if (reference?.startsWith("PAY_ORD")) {
                const order = await Order.findOne({ _id: metadata.orderId });
                if (!order) {
                    return {
                        success: false,
                        error: 'Order not found for this payment',
                        provider: 'paystack'
                    }
                }
                await order?.updateStatus("paid", 'Payment completed successfully');
            }

            return {
                success: true,
                data: {
                    ...metadata,
                    orderSlugs: metadata.orderSlugs || [],
                    deliveryPin: metadata.pin,
                    reference: transactionData.reference,
                    amount: transactionData.amount / 100, // Convert from kobo
                    paidAt: transactionData.paid_at,
                    channel: transactionData.channel
                },
                provider: 'paystack'
            };

        } catch (error: any) {
            console.error('Paystack verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'paystack'
            };
        }
    }

    async verifyFlutterwavePayment(reference: string): Promise<PaymentResponse> {
        try {
            const response: AxiosResponse = await axios.get(
                `${this.flutterwave.baseURL}/transactions/${reference}/verify`,
                {
                    headers: {
                        Authorization: `Bearer ${this.flutterwave.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data || !response.data.data) {
                return {
                    success: false,
                    error: 'Invalid response from payment gateway',
                    provider: 'flutterwave'
                };
            }

            const transactionData = response.data.data;

            // Check if transaction was successful
            if (transactionData.status !== 'successful') {
                return {
                    success: false,
                    error: `Payment ${transactionData.status}`,
                    provider: 'flutterwave',
                    data: {
                        status: transactionData.status,
                        message: transactionData.processor_response
                    }
                };
            }

            // Extract metadata
            const metadata = transactionData.meta || {};

            // Verify the payment in our database
            const verified = await this.VerifyPaymentLogging({
                metadata,
                response: transactionData
            });

            if (!verified) {
                return {
                    success: false,
                    error: 'Payment verification failed',
                    provider: 'flutterwave'
                };
            }

            const { orderId, userId } = metadata

            if (reference?.startsWith("PAY_SUB")) {
                const subscription = await UserSubscription.findOne({
                    userId: userId,
                    paymentReference: reference
                }).populate('planId');

                if (!subscription) return {
                    success: false,
                    error: 'Subscription record not found for this reference',
                    provider: 'flutterwave'
                }

                if (subscription.paymentStatus === 'completed') {
                    return {
                        success: false,
                        error: 'Subscription is already active',
                        provider: 'flutterwave'
                    }
                }

                // Activate subscription
                const plan = subscription.planSnapshot;
                const now = new Date();
                const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

                subscription.paymentStatus = 'completed';
                subscription.paymentCompletedAt = now;
                subscription.status = 'active';
                subscription.startDate = now;
                subscription.endDate = endDate;
                await subscription.save();
            }

            if (reference?.startsWith("PAY_ORD")) {
                const order = await Order.findOne({ _id: metadata.orderId });
                if (!order) {
                    return {
                        success: false,
                        error: 'Order not found for this payment',
                        provider: 'flutterwave'
                    }
                }
                await order?.updateStatus("paid", 'Payment completed successfully');
            }

            return {
                success: true,
                data: {
                    ...metadata,
                    orderSlugs: metadata.orderSlugs || [],
                    deliveryPin: metadata.pin,
                    reference: transactionData.tx_ref,
                    amount: transactionData.amount,
                    paidAt: transactionData.created_at,
                    channel: transactionData.payment_type
                },
                provider: 'flutterwave'
            };

        } catch (error: any) {
            console.error('Flutterwave verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'flutterwave'
            };
        }
    }

    async initializePayment(provider: string, paymentData: PaymentData): Promise<PaymentResponse> {
        switch (provider.toLowerCase()) {
            case 'paystack':
                return await this.initializePaystackPayment(paymentData);
            case 'flutterwave':
                return await this.initializeFlutterwavePayment(paymentData);
            default:
                return {
                    success: false,
                    error: 'Unsupported payment provider',
                    provider: provider
                };
        }
    }

    async verifyPayment(provider: string, reference: string): Promise<PaymentResponse> {
        switch (provider.toLowerCase()) {
            case 'paystack':
                return await this.verifyPaystackPayment(reference);
            case 'flutterwave':
                return await this.verifyFlutterwavePayment(reference);
            default:
                return {
                    success: false,
                    error: 'Unsupported payment provider',
                    provider: provider
                };
        }
    }

    generatePaymentReference(orderId: string): string {
        const timestamp = Date.now();
        return `PAY_${orderId}_${timestamp}`;
    }

    verifyPaystackWebhook(payload: any, signature: string): boolean {
        const hash = crypto
            .createHmac('sha512', this.paystack?.secretKey || '')
            .update(JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }

    verifyFlutterwaveWebhook(payload: any, signature: string): boolean {
        const hash = crypto
            .createHmac('sha256', this.flutterwave.secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }

    getPaymentFees(provider: string, amount: number): number {
        const fees: Record<string, { percentage: number; cap: number; fixed: number }> = {
            paystack: {
                percentage: 1.5,
                cap: 200000,
                fixed: 0
            },
            flutterwave: {
                percentage: 1.4,
                cap: 200000,
                fixed: 0
            },
            cash_on_delivery: {
                percentage: 0,
                cap: 0,
                fixed: 0
            }
        };

        const providerFees = fees[provider.toLowerCase()];
        if (!providerFees) return 0;

        const percentageFee = (amount * providerFees.percentage) / 100;
        const totalFee = Math.min(percentageFee, providerFees.cap) + providerFees.fixed;
        return Math.round(totalFee);
    }
}

export default PaymentGateway;