"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderPayments = void 0;
const mongoose_1 = require("mongoose");
const productPurchaseLog_1 = __importDefault(require("../../models/billing/productPurchaseLog"));
const pipeline_1 = require("./pipeline");
const getOrderPayments = async (req, res, next) => {
    try {
        const { branchId, userId, store } = req.user;
        let match = {};
        if (branchId) {
            match = {
                "orderInfo.store": store
            };
        }
        if (userId) {
            match = {
                userId: new mongoose_1.Types.ObjectId(userId)
            };
        }
        const paymentLog = await productPurchaseLog_1.default.aggregate((0, pipeline_1.getOrdersPayment)(match));
        return res.status(200).json(paymentLog);
    }
    catch (error) {
        return next(error);
    }
};
exports.getOrderPayments = getOrderPayments;
//# sourceMappingURL=getPayments.js.map