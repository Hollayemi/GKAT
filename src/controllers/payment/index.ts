import { Request, Response } from 'express';
import PaymentGateway from '../../services/payment';
import PaystackService from '../../services/PaystackService';

class PurchaseController {
    static async subscribe(req: Request, res: Response): Promise<Response> {
        try {
            const { gateWayId } = req.body;
            switch (gateWayId) {
                case 'GATEWAY_OO501':
                    return PaystackService.payWithPaystack(req, res);

                default:
                    return res.status(404).send({ message: 'Invalid payment Gateway' });
            }
        } catch (error) {
            return res.status(500).send({ message: 'internal server error' });
        }
    }

    static async paystackCallBackVerify2(req: Request, res: Response): Promise<void> {
        try {
            console.log('asdasda', req.query.reference);
            const billing = await PaystackService.verifyTransaction(
                req.query.reference as string
            );

            if (process.env.WEB_PURCHASE_CALLBACK && req.query.platform === 'browser') {
                return res.redirect(
                    `${process.env.WEB_PURCHASE_CALLBACK}?reference=${req.query.reference}&success=true}`
                );
            }

            return res.redirect(
                `${process.env.WEB_PURCHASE_CALLBACK}?reference=${req.query.reference}&success=true}`
            );

        } catch (error) {
            console.log(error);
            if (process.env.PAYMENT_FAILURE_CALLBACK) {
                return res.redirect(
                    `${process.env.PAYMENT_FAILURE_CALLBACK}?reference=${req.query.reference}`
                );
            }
            return res
                .status(500)
                .send({ message: 'Payment verification failed', description: error });
        }
    }

    static async paystackCallBackVerify(req: Request, res: Response): Promise<void> {
        const { reference, provider, platform } = req.query;
        console.log(reference, provider, platform);

        const redirectTo = platform === "mobile"
            ? 'https://corisio-app.app:/'
            : process.env.FRONTEND_URL || 'https://corisio.com';

        try {
            const paymentGateway = new PaymentGateway();
            const verificationResult = await paymentGateway.verifyPayment(provider as string, reference as string);

            console.log("verificationResult", verificationResult);

            if (verificationResult.success) {
                return res.redirect(`${redirectTo}/checkout/completed?payment=completed&message=Payment verified successfully&slugs=${verificationResult.data.orderSlugs.join("-")}`);
            } else {
                return res.redirect(`${redirectTo}/cart?paymant=error&message=Payment verification failed`);
            }
        } catch (error) {
            console.log(error);
            return res.redirect(`${redirectTo}/cart?paymant=error&message=Server Error`);
        }
    }

    static async getServiceCharge(req: Request, res: Response, next: any): Promise<Response | void> {
        try {
            const { subTotal, provider } = req.query;
            const paymentGateway = new PaymentGateway();
            const gateWayFee = await paymentGateway.getPaymentFees(provider as string, parseInt(subTotal as string));

            return res.status(200).json(gateWayFee);
        } catch (err) {
            return next(err);
        }
    }
}

export default PurchaseController;