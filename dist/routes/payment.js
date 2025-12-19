"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = __importDefault(require("../controllers/payment/index"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// @route   GET /api/v1/payment/callback
// @desc    Payment gateway callback handler
// @access  Public (called by payment providers)
router.get('/callback', index_1.default.paystackCallBackVerify);
// @route   POST /api/v1/payment/webhook/:provider
// @desc    Payment gateway webhook handler
// @access  Public (called by payment providers)
router.post('/webhook/:provider', index_1.default.handleWebhook);
// @route   GET /api/v1/payment/service-charge
// @desc    Get service charge for payment method
// @access  Public
router.get('/service-charge', index_1.default.getServiceCharge);
// @route   GET /api/v1/payment/methods
// @desc    Get supported payment methods
// @access  Public
router.get('/methods', index_1.default.getPaymentMethods);
// @route   POST /api/v1/payment/verify
// @desc    Manually verify a payment
// @access  Private
router.post('/verify', auth_1.protect, index_1.default.verifyPayment);
exports.default = router;
//# sourceMappingURL=payment.js.map