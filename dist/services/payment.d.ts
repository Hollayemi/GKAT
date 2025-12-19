import PaymentLogging from './paymentLogging';
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
declare class PaymentGateway extends PaymentLogging {
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
    constructor();
    private generatePalmPaySignature;
    private generateOpaySignature;
    private sortObjectKeys;
    initializePaystackPayment(paymentData: PaymentData): Promise<PaymentResponse>;
    initializePalmPayPayment(paymentData: PaymentData): Promise<PaymentResponse>;
    initializeOpayPayment(paymentData: PaymentData): Promise<PaymentResponse>;
    verifyPaystackPayment(reference: string): Promise<PaymentResponse>;
    verifyPalmPayPayment(reference: string): Promise<PaymentResponse>;
    verifyOpayPayment(reference: string): Promise<PaymentResponse>;
    initializePayment(provider: string, paymentData: PaymentData): Promise<PaymentResponse>;
    verifyPayment(provider: string, reference: string): Promise<PaymentResponse>;
    generatePaymentReference(orderId: string): string;
    verifyPaystackWebhook(payload: any, signature: string): boolean;
    verifyPalmPayWebhook(payload: any, signature: string, timestamp: string): boolean;
    verifyOpayWebhook(payload: any, signature: string, timestamp: string): boolean;
    getSupportedPaymentMethods(): Array<{
        id: string;
        name: string;
        description: string;
        logo: string;
        enabled: boolean;
    }>;
    getPaymentFees(provider: string, amount: number): number;
}
export default PaymentGateway;
//# sourceMappingURL=payment.d.ts.map