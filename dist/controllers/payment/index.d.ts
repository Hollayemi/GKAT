import { Request, Response } from 'express';
declare class PurchaseController {
    static paystackCallBackVerify(req: Request, res: Response): Promise<void>;
    static handleWebhook(req: Request, res: Response): Promise<Response>;
    static getServiceCharge(req: Request, res: Response, next: any): Promise<Response | void>;
    static verifyPayment(req: Request, res: Response): Promise<Response>;
    static getPaymentMethods(req: Request, res: Response): Promise<Response>;
}
export default PurchaseController;
//# sourceMappingURL=index.d.ts.map