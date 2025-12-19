"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const payment_1 = __importDefault(require("../../services/payment"));
const logger_1 = __importDefault(require("../../utils/logger"));
class PurchaseController {
    static async paystackCallBackVerify(req, res) {
        const { reference, provider = 'paystack', platform = 'browser' } = req.query;
        logger_1.default.info('Payment callback received:', { reference, provider, platform });
        const redirectTo = platform === "mobile"
            ? 'corisio-app://'
            : process.env.FRONTEND_URL || 'http://localhost:3000';
        try {
            if (!reference) {
                logger_1.default.error('Payment callback: No reference provided');
                return res.redirect(`${redirectTo}/cart?payment=error&message=No payment reference provided`);
            }
            const paymentGateway = new payment_1.default();
            const verificationResult = await paymentGateway.verifyPayment(provider, reference);
            logger_1.default.info('Payment verification result:', verificationResult);
            if (verificationResult.success) {
                // Get order slugs from the verification result
                const orderSlugs = verificationResult.data?.orderSlugs || [];
                const slugsParam = orderSlugs.length > 0 ? `&slugs=${orderSlugs.join("-")}` : '';
                return res.redirect(`${redirectTo}/checkout/completed?payment=success&message=Payment verified successfully${slugsParam}`);
            }
            else {
                logger_1.default.error('Payment verification failed:', verificationResult.error);
                return res.redirect(`${redirectTo}/cart?payment=error&message=${encodeURIComponent(verificationResult.error || 'Payment verification failed')}`);
            }
        }
        catch (error) {
            logger_1.default.error('Payment callback error:', error);
            return res.redirect(`${redirectTo}/cart?payment=error&message=${encodeURIComponent(error.message || 'Server Error')}`);
        }
    }
    static async handleWebhook(req, res) {
        const { provider } = req.params;
        const signature = req.headers['x-paystack-signature'];
        try {
            const paymentGateway = new payment_1.default();
            // Verify webhook signature
            let isValid = false;
            switch (provider.toLowerCase()) {
                case 'paystack':
                    isValid = paymentGateway.verifyPaystackWebhook(req.body, signature);
                    break;
                case 'palmpay':
                    const timestamp = req.headers['x-timestamp'];
                    isValid = paymentGateway.verifyPalmPayWebhook(req.body, signature, timestamp);
                    break;
                case 'opay':
                    const opayTimestamp = req.headers['authorization-timestamp'];
                    isValid = paymentGateway.verifyOpayWebhook(req.body, signature, opayTimestamp);
                    break;
                default:
                    return res.status(400).json({ error: 'Unsupported provider' });
            }
            if (!isValid) {
                logger_1.default.warn(`Invalid webhook signature for ${provider}`);
                return res.status(401).json({ error: 'Invalid signature' });
            }
            // Process the webhook event
            const event = req.body;
            if (event.event === 'charge.success') {
                const reference = event.data.reference;
                await paymentGateway.verifyPayment(provider, reference);
            }
            return res.status(200).json({ status: 'success' });
        }
        catch (error) {
            logger_1.default.error('Webhook processing error:', error);
            return res.status(500).json({ error: 'Webhook processing failed' });
        }
    }
    static async getServiceCharge(req, res, next) {
        try {
            const { subTotal, provider } = req.query;
            if (!subTotal || !provider) {
                return res.status(400).json({
                    error: 'subTotal and provider are required'
                });
            }
            const paymentGateway = new payment_1.default();
            const gateWayFee = paymentGateway.getPaymentFees(provider, parseInt(subTotal));
            return res.status(200).json({
                provider,
                subTotal: parseInt(subTotal),
                serviceCharge: gateWayFee,
                total: parseInt(subTotal) + gateWayFee
            });
        }
        catch (err) {
            return next(err);
        }
    }
    static async verifyPayment(req, res) {
        try {
            const { reference, provider = 'paystack' } = req.body;
            if (!reference) {
                return res.status(400).json({ error: 'Reference is required' });
            }
            const paymentGateway = new payment_1.default();
            const verificationResult = await paymentGateway.verifyPayment(provider, reference);
            if (verificationResult.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Payment verified successfully',
                    data: verificationResult.data
                });
            }
            else {
                return res.status(400).json({
                    success: false,
                    error: verificationResult.error
                });
            }
        }
        catch (error) {
            logger_1.default.error('Payment verification error:', error);
            return res.status(500).json({
                error: 'Payment verification failed',
                message: error.message
            });
        }
    }
    static async getPaymentMethods(req, res) {
        try {
            const paymentGateway = new payment_1.default();
            const methods = paymentGateway.getSupportedPaymentMethods();
            return res.status(200).json({
                success: true,
                data: methods
            });
        }
        catch (error) {
            logger_1.default.error('Get payment methods error:', error);
            return res.status(500).json({
                error: 'Failed to get payment methods'
            });
        }
    }
}
exports.default = PurchaseController;
//# sourceMappingURL=index.js.map