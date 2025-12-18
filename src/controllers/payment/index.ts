import { Request, Response } from 'express';
import PaymentGateway from '../../services/payment';
import Order from '../../models/Orders';
import Cart from '../../models/Cart';
import logger from '../../utils/logger';

class PurchaseController {
   
    static async paystackCallBackVerify(req: Request, res: Response): Promise<void> {
        const { reference, provider = 'paystack', platform = 'browser' } = req.query;

        logger.info('Payment callback received:', { reference, provider, platform });

        const redirectTo = platform === "mobile"
            ? 'corisio-app://'
            : process.env.FRONTEND_URL || 'http://localhost:3000';

        try {
            if (!reference) {
                logger.error('Payment callback: No reference provided');
                return res.redirect(`${redirectTo}/cart?payment=error&message=No payment reference provided`);
            }

            const paymentGateway = new PaymentGateway();
            const verificationResult = await paymentGateway.verifyPayment(
                provider as string,
                reference as string
            );

            logger.info('Payment verification result:', verificationResult);

            if (verificationResult.success) {
                // Get order slugs from the verification result
                const orderSlugs = verificationResult.data?.orderSlugs || [];
                const slugsParam = orderSlugs.length > 0 ? `&slugs=${orderSlugs.join("-")}` : '';

                return res.redirect(
                    `${redirectTo}/checkout/completed?payment=success&message=Payment verified successfully${slugsParam}`
                );
            } else {
                logger.error('Payment verification failed:', verificationResult.error);
                return res.redirect(
                    `${redirectTo}/cart?payment=error&message=${encodeURIComponent(verificationResult.error || 'Payment verification failed')}`
                );
            }
        } catch (error: any) {
            logger.error('Payment callback error:', error);
            return res.redirect(
                `${redirectTo}/cart?payment=error&message=${encodeURIComponent(error.message || 'Server Error')}`
            );
        }
    }

   
    static async handleWebhook(req: Request, res: Response): Promise<Response> {
        const { provider } = req.params;
        const signature = req.headers['x-paystack-signature'] as string;

        try {
            const paymentGateway = new PaymentGateway();

            // Verify webhook signature
            let isValid = false;
            switch (provider.toLowerCase()) {
                case 'paystack':
                    isValid = paymentGateway.verifyPaystackWebhook(req.body, signature);
                    break;
                case 'palmpay':
                    const timestamp = req.headers['x-timestamp'] as string;
                    isValid = paymentGateway.verifyPalmPayWebhook(req.body, signature, timestamp);
                    break;
                case 'opay':
                    const opayTimestamp = req.headers['authorization-timestamp'] as string;
                    isValid = paymentGateway.verifyOpayWebhook(req.body, signature, opayTimestamp);
                    break;
                default:
                    return res.status(400).json({ error: 'Unsupported provider' });
            }

            if (!isValid) {
                logger.warn(`Invalid webhook signature for ${provider}`);
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Process the webhook event
            const event = req.body;
            if (event.event === 'charge.success') {
                const reference = event.data.reference;
                await paymentGateway.verifyPayment(provider, reference);
            }

            return res.status(200).json({ status: 'success' });

        } catch (error: any) {
            logger.error('Webhook processing error:', error);
            return res.status(500).json({ error: 'Webhook processing failed' });
        }
    }

   
    static async getServiceCharge(req: Request, res: Response, next: any): Promise<Response | void> {
        try {
            const { subTotal, provider } = req.query;

            if (!subTotal || !provider) {
                return res.status(400).json({
                    error: 'subTotal and provider are required'
                });
            }

            const paymentGateway = new PaymentGateway();
            const gateWayFee = paymentGateway.getPaymentFees(
                provider as string,
                parseInt(subTotal as string)
            );

            return res.status(200).json({
                provider,
                subTotal: parseInt(subTotal as string),
                serviceCharge: gateWayFee,
                total: parseInt(subTotal as string) + gateWayFee
            });
        } catch (err) {
            return next(err);
        }
    }

   
    static async verifyPayment(req: Request, res: Response): Promise<Response> {
        try {
            const { reference, provider = 'paystack' } = req.body;

            if (!reference) {
                return res.status(400).json({ error: 'Reference is required' });
            }

            const paymentGateway = new PaymentGateway();
            const verificationResult = await paymentGateway.verifyPayment(
                provider as string,
                reference as string
            );

            if (verificationResult.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Payment verified successfully',
                    data: verificationResult.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: verificationResult.error
                });
            }
        } catch (error: any) {
            logger.error('Payment verification error:', error);
            return res.status(500).json({
                error: 'Payment verification failed',
                message: error.message
            });
        }
    }

   
    static async getPaymentMethods(req: Request, res: Response): Promise<Response> {
        try {
            const paymentGateway = new PaymentGateway();
            const methods = paymentGateway.getSupportedPaymentMethods();

            return res.status(200).json({
                success: true,
                data: methods
            });
        } catch (error: any) {
            logger.error('Get payment methods error:', error);
            return res.status(500).json({
                error: 'Failed to get payment methods'
            });
        }
    }
}

export default PurchaseController;