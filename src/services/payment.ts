// paymentGateway.ts
import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import PaymentLogging from './paymentLogging';

interface PaymentData {
    email: string;
    amount: number;
    reference: string;
    currency?: string;
    callback_url?: string;
    return_url?: string;
    orderId?: string;
    userId?: string;
    orderIds?: string[];
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

    // private palmpay: PaymentConfig;
    // private paystack: PaymentConfig;
    // private opay: PaymentConfig;

    constructor() {
        super();
        this.paystack = {
            secretKey: process.env.PAYSTACK_SECRET_KEY || '',
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
            baseURL: 'https://api.paystack.co'
        };

        this.palmpay = {
            merchantId: process.env.PALMPAY_MERCHANT_ID || '',
            secretKey: process.env.PALMPAY_SECRET_KEY || '',
            // publicKey: process.env.PALMPAY_PUBLIC_KEY || '',
            baseURL: process.env.PALMPAY_BASE_URL || 'https://api.palmpay.com'
        };
        
        this.opay = {
            // secretKey: process.env.OPAY_SECRET_KEY || '',
            merchantId: process.env.OPAY_MERCHANT_ID || '',
            publicKey: process.env.OPAY_PUBLIC_KEY || '',
            privateKey: process.env.OPAY_PRIVATE_KEY || '',
            baseURL: 'https://sandbox-cashierapi.opayweb.com'
        };
    }

    // Generate signature for PalmPay
    private generatePalmPaySignature(data: any, timestamp: string): string {
        const stringToSign = `${timestamp}${JSON.stringify(data)}`;
        return crypto
            .createHmac('sha256', this.palmpay?.secretKey || '')
            .update(stringToSign)
            .digest('hex');
    }

    // Generate signature for OPay
    private generateOpaySignature(data: any, timestamp: string): string {
        const orderedData = this.sortObjectKeys(data);
        const stringToSign = `${JSON.stringify(orderedData)}${timestamp}${this.opay.privateKey}`;
        return crypto
            .createHash('sha512')
            .update(stringToSign)
            .digest('hex');
    }

    // Helper method to sort object keys (required for OPay)
    private sortObjectKeys(obj: any): any {
        const sorted: any = {};
        Object.keys(obj).sort().forEach(key => {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                sorted[key] = this.sortObjectKeys(obj[key]);
            } else {
                sorted[key] = obj[key];
            }
        });
        return sorted;
    }

    // Paystack payment initialization
    async initializePaystackPayment(paymentData: PaymentData): Promise<PaymentResponse> {
        try {
            const response: AxiosResponse = await axios.post(
                `${this.paystack.baseURL}/transaction/initialize`,
                {
                    email: paymentData.email,
                    amount: paymentData.amount * 100, // Convert to kobo
                    reference: paymentData.reference,
                    currency: paymentData.currency || 'NGN',
                    callback_url: paymentData.callback_url,
                    metadata: {
                        type: 'purchase',
                        orderId: paymentData.orderId,
                        userId: paymentData.userId,
                        orderIds: paymentData.orderIds,
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

    // PalmPay payment initialization
    async initializePalmPayPayment(paymentData: PaymentData): Promise<PaymentResponse> {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                merchantId: this.palmpay.merchantId,
                amount: paymentData.amount,
                currency: paymentData.currency || 'NGN',
                reference: paymentData.reference,
                description: paymentData.description || 'Order Payment',
                customerEmail: paymentData.email,
                customerPhone: paymentData.phone,
                callbackUrl: paymentData.callback_url,
                metadata: {
                    orderId: paymentData.orderId,
                    userId: paymentData.userId,
                    ...paymentData.metadata
                }
            };

            const signature = this.generatePalmPaySignature(requestData, timestamp);

            const response: AxiosResponse = await axios.post(
                `${this.palmpay.baseURL}/v1/payments/initialize`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Timestamp': timestamp,
                        'X-Signature': signature,
                        'X-Merchant-Id': this.palmpay.merchantId
                    }
                }
            );

            return {
                success: true,
                data: response.data,
                provider: 'palmpay'
            };
        } catch (error: any) {
            console.error('PalmPay initialization error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'palmpay'
            };
        }
    }

    // OPay payment initialization
    async initializeOpayPayment(paymentData: PaymentData): Promise<PaymentResponse> {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                reference: paymentData.reference,
                mchShortName: this.opay.merchantId,
                productName: paymentData.description || 'Order Payment',
                productDesc: paymentData.description || 'Order Payment',
                userPhone: paymentData.phone,
                userRequestIp: paymentData.userIp || '127.0.0.1',
                amount: Math.round(paymentData.amount * 100), // Convert to kobo
                currency: paymentData.currency || 'NGN',
                osType: 'WEB',
                callbackUrl: paymentData.callback_url,
                returnUrl: paymentData.return_url || paymentData.callback_url,
                expireAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
                userClientIP: paymentData.userIp || '127.0.0.1'
            };

            const signature = this.generateOpaySignature(requestData, timestamp);

            const response: AxiosResponse = await axios.post(
                `${this.opay.baseURL}/api/v3/cashier/initialize`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.opay.publicKey}`,
                        'MerchantId': this.opay.merchantId,
                        'Authorization-Signature': signature,
                        'Authorization-Timestamp': timestamp
                    }
                }
            );

            if (response.data.code === '00000') {
                return {
                    success: true,
                    data: {
                        ...response.data.data,
                        authorization_url: response.data.data.cashierUrl,
                        paymentUrl: response.data.data.cashierUrl
                    },
                    provider: 'opay'
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Payment initialization failed',
                    provider: 'opay'
                };
            }
        } catch (error: any) {
            console.error('OPay initialization error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'opay'
            };
        }
    }

    // Verify Paystack payment
    async verifyPaystackPayment(reference: string): Promise<PaymentResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: AxiosResponse = await axios.get(
                    `${this.paystack.baseURL}/transaction/verify/${reference}`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.paystack.secretKey}`
                        }
                    }
                );

                const { ...metadata } = response.data.data.metadata;
                console.log(response.data.data);

                const verified = await this.VerifyPaymentLogging({ metadata, response });
                console.log(verified);

                resolve({
                    success: verified,
                    data: metadata,
                    provider: 'paystack'
                });
            } catch (error: any) {
                console.error('Paystack verification error:', error.response?.data || error.message);
                reject(error);
            }
        });
    }

    // Verify PalmPay payment
    async verifyPalmPayPayment(reference: string): Promise<PaymentResponse> {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                merchantId: this.palmpay.merchantId,
                reference: reference
            };

            const signature = this.generatePalmPaySignature(requestData, timestamp);

            const response: AxiosResponse = await axios.post(
                `${this.palmpay.baseURL}/v1/payments/verify`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Timestamp': timestamp,
                        'X-Signature': signature,
                        'X-Merchant-Id': this.palmpay.merchantId
                    }
                }
            );

            return {
                success: true,
                data: response.data,
                provider: 'palmpay'
            };
        } catch (error: any) {
            console.error('PalmPay verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'palmpay'
            };
        }
    }

    // Verify OPay payment
    async verifyOpayPayment(reference: string): Promise<PaymentResponse> {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                reference: reference,
                orderNo: reference
            };

            const signature = this.generateOpaySignature(requestData, timestamp);

            const response: AxiosResponse = await axios.post(
                `${this.opay.baseURL}/api/v3/cashier/status`,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.opay.publicKey}`,
                        'MerchantId': this.opay.merchantId,
                        'Authorization-Signature': signature,
                        'Authorization-Timestamp': timestamp
                    }
                }
            );

            if (response.data.code === '00000') {
                return {
                    success: true,
                    data: {
                        ...response.data.data,
                        id: response.data.data.orderNo,
                        status: response.data.data.status,
                        reference: response.data.data.reference
                    },
                    provider: 'opay'
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Payment verification failed',
                    provider: 'opay'
                };
            }
        } catch (error: any) {
            console.error('OPay verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'opay'
            };
        }
    }

    // Main payment initialization method
    async initializePayment(provider: string, paymentData: PaymentData): Promise<PaymentResponse> {
        switch (provider.toLowerCase()) {
            case 'paystack':
                return await this.initializePaystackPayment(paymentData);
            case 'palmpay':
                return await this.initializePalmPayPayment(paymentData);
            case 'opay':
                return await this.initializeOpayPayment(paymentData);
            default:
                return {
                    success: false,
                    error: 'Unsupported payment provider',
                    provider: provider
                };
        }
    }

    // Main payment verification method
    async verifyPayment(provider: string, reference: string): Promise<PaymentResponse> {
        switch (provider.toLowerCase()) {
            case 'paystack':
                return await this.verifyPaystackPayment(reference);
            case 'palmpay':
                return await this.verifyPalmPayPayment(reference);
            case 'opay':
                return await this.verifyOpayPayment(reference);
            default:
                return {
                    success: false,
                    error: 'Unsupported payment provider',
                    provider: provider
                };
        }
    }

    // Generate unique payment reference
    generatePaymentReference(orderId: string): string {
        const timestamp = Date.now();
        return `PAY_${orderId}_${timestamp}`;
    }

    // Webhook signature verification for Paystack
    verifyPaystackWebhook(payload: any, signature: string): boolean {
        const hash = crypto
            .createHmac('sha512', this.paystack?.secretKey || '')
            .update(JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }

    // Webhook signature verification for PalmPay
    verifyPalmPayWebhook(payload: any, signature: string, timestamp: string): boolean {
        const expectedSignature = this.generatePalmPaySignature(payload, timestamp);
        return expectedSignature === signature;
    }

    // Webhook signature verification for OPay
    verifyOpayWebhook(payload: any, signature: string, timestamp: string): boolean {
        const expectedSignature = this.generateOpaySignature(payload, timestamp);
        return expectedSignature === signature;
    }

    // Get supported payment methods
    getSupportedPaymentMethods(): Array<{
        id: string;
        name: string;
        description: string;
        logo: string;
        enabled: boolean;
    }> {
        return [
            {
                id: 'paystack',
                name: 'Paystack',
                description: 'Pay with Cards, Bank Transfer, USSD',
                logo: '/images/paystack-logo.png',
                enabled: !!this.paystack.secretKey
            },
            {
                id: 'palmpay',
                name: 'PalmPay',
                description: 'Pay with PalmPay Wallet',
                logo: '/images/palmpay-logo.png',
                enabled: !!this.palmpay.secretKey
            },
            {
                id: 'opay',
                name: 'OPay',
                description: 'Pay with OPay Wallet, Cards, Bank Transfer',
                logo: '/images/opay-logo.png',
                enabled: !!this.opay.privateKey
            },
            {
                id: 'cash_on_delivery',
                name: 'Cash on Delivery',
                description: 'Pay when your order is delivered',
                logo: '/images/cod-logo.png',
                enabled: true
            }
        ];
    }

    // Get payment provider fees (if applicable)
    getPaymentFees(provider: string, amount: number): number {
        const fees: Record<string, { percentage: number; cap: number; fixed: number }> = {
            paystack: {
                percentage: 1.5,
                cap: 200000,
                fixed: 0
            },
            palmpay: {
                percentage: 1.4,
                cap: 200000,
                fixed: 0
            },
            opay: {
                percentage: 2.5,
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