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
declare class PaymentLogging {
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
    logPurchasePending({ paymentChannel, userId, meta, amount, transaction_ref }: LogPurchaseParams): Promise<void>;
    initializationFailed({ meta }: {
        meta: any;
    }): Promise<void>;
    VerifyPaymentLogging({ metadata, response }: VerifyPaymentParams): Promise<boolean>;
    private handleFailedPayment;
}
export default PaymentLogging;
//# sourceMappingURL=paymentLogging.d.ts.map