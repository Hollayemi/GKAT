"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const paymentLogging_1 = __importDefault(require("./paymentLogging"));
class PaymentGateway extends paymentLogging_1.default {
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
    generatePalmPaySignature(data, timestamp) {
        const stringToSign = `${timestamp}${JSON.stringify(data)}`;
        return crypto_1.default
            .createHmac('sha256', this.palmpay?.secretKey || '')
            .update(stringToSign)
            .digest('hex');
    }
    generateOpaySignature(data, timestamp) {
        const orderedData = this.sortObjectKeys(data);
        const stringToSign = `${JSON.stringify(orderedData)}${timestamp}${this.opay.privateKey}`;
        return crypto_1.default
            .createHash('sha512')
            .update(stringToSign)
            .digest('hex');
    }
    sortObjectKeys(obj) {
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                sorted[key] = this.sortObjectKeys(obj[key]);
            }
            else {
                sorted[key] = obj[key];
            }
        });
        return sorted;
    }
    async initializePaystackPayment(paymentData) {
        try {
            const response = await axios_1.default.post(`${this.paystack.baseURL}/transaction/initialize`, {
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
            }, {
                headers: {
                    Authorization: `Bearer ${this.paystack.secretKey}`,
                    'Content-Type': 'application/json'
                }
            });
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
        }
        catch (error) {
            console.error('Paystack initialization error:', error.response?.data || error.message);
            this.initializationFailed({ meta: paymentData });
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'paystack'
            };
        }
    }
    async initializePalmPayPayment(paymentData) {
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
                callbackUrl: `${process.env.API_URL}/payment/callback?provider=palmpay&platform=mobile`,
                metadata: {
                    orderId: paymentData.orderId,
                    userId: paymentData.userId,
                    ...paymentData.metadata
                }
            };
            const signature = this.generatePalmPaySignature(requestData, timestamp);
            const response = await axios_1.default.post(`${this.palmpay.baseURL}/v1/payments/initialize`, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Timestamp': timestamp,
                    'X-Signature': signature,
                    'X-Merchant-Id': this.palmpay.merchantId
                }
            });
            return {
                success: true,
                data: response.data,
                provider: 'palmpay'
            };
        }
        catch (error) {
            console.error('PalmPay initialization error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'palmpay'
            };
        }
    }
    async initializeOpayPayment(paymentData) {
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
                callbackUrl: `${process.env.API_URL}/payment/callback?provider=opay&platform=mobile`,
                returnUrl: `${process.env.API_URL}/payment/callback?provider=opay&platform=mobile`,
                expireAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
                userClientIP: paymentData.userIp || '127.0.0.1'
            };
            const signature = this.generateOpaySignature(requestData, timestamp);
            const response = await axios_1.default.post(`${this.opay.baseURL}/api/v3/cashier/initialize`, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.opay.publicKey}`,
                    'MerchantId': this.opay.merchantId,
                    'Authorization-Signature': signature,
                    'Authorization-Timestamp': timestamp
                }
            });
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
            }
            else {
                return {
                    success: false,
                    error: response.data.message || 'Payment initialization failed',
                    provider: 'opay'
                };
            }
        }
        catch (error) {
            console.error('OPay initialization error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initialization failed',
                provider: 'opay'
            };
        }
    }
    async verifyPaystackPayment(reference) {
        try {
            const response = await axios_1.default.get(`${this.paystack.baseURL}/transaction/verify/${reference}`, {
                headers: {
                    Authorization: `Bearer ${this.paystack.secretKey}`
                }
            });
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
            return {
                success: true,
                data: {
                    ...metadata,
                    orderSlugs: metadata.orderSlugs || [],
                    reference: transactionData.reference,
                    amount: transactionData.amount / 100, // Convert from kobo
                    paidAt: transactionData.paid_at,
                    channel: transactionData.channel
                },
                provider: 'paystack'
            };
        }
        catch (error) {
            console.error('Paystack verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'paystack'
            };
        }
    }
    async verifyPalmPayPayment(reference) {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                merchantId: this.palmpay.merchantId,
                reference: reference
            };
            const signature = this.generatePalmPaySignature(requestData, timestamp);
            const response = await axios_1.default.post(`${this.palmpay.baseURL}/v1/payments/verify`, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Timestamp': timestamp,
                    'X-Signature': signature,
                    'X-Merchant-Id': this.palmpay.merchantId
                }
            });
            return {
                success: true,
                data: response.data,
                provider: 'palmpay'
            };
        }
        catch (error) {
            console.error('PalmPay verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'palmpay'
            };
        }
    }
    async verifyOpayPayment(reference) {
        try {
            const timestamp = Date.now().toString();
            const requestData = {
                reference: reference,
                orderNo: reference
            };
            const signature = this.generateOpaySignature(requestData, timestamp);
            const response = await axios_1.default.post(`${this.opay.baseURL}/api/v3/cashier/status`, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.opay.publicKey}`,
                    'MerchantId': this.opay.merchantId,
                    'Authorization-Signature': signature,
                    'Authorization-Timestamp': timestamp
                }
            });
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
            }
            else {
                return {
                    success: false,
                    error: response.data.message || 'Payment verification failed',
                    provider: 'opay'
                };
            }
        }
        catch (error) {
            console.error('OPay verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment verification failed',
                provider: 'opay'
            };
        }
    }
    async initializePayment(provider, paymentData) {
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
    async verifyPayment(provider, reference) {
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
    generatePaymentReference(orderId) {
        const timestamp = Date.now();
        return `PAY_${orderId}_${timestamp}`;
    }
    verifyPaystackWebhook(payload, signature) {
        const hash = crypto_1.default
            .createHmac('sha512', this.paystack?.secretKey || '')
            .update(JSON.stringify(payload))
            .digest('hex');
        return hash === signature;
    }
    verifyPalmPayWebhook(payload, signature, timestamp) {
        const expectedSignature = this.generatePalmPaySignature(payload, timestamp);
        return expectedSignature === signature;
    }
    verifyOpayWebhook(payload, signature, timestamp) {
        const expectedSignature = this.generateOpaySignature(payload, timestamp);
        return expectedSignature === signature;
    }
    getSupportedPaymentMethods() {
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
    getPaymentFees(provider, amount) {
        const fees = {
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
        if (!providerFees)
            return 0;
        const percentageFee = (amount * providerFees.percentage) / 100;
        const totalFee = Math.min(percentageFee, providerFees.cap) + providerFees.fixed;
        return Math.round(totalFee);
    }
}
exports.default = PaymentGateway;
//# sourceMappingURL=payment.js.map