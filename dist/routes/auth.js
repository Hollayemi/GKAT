"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.post('/send-otp', auth_1.sendOTP);
router.post('/login', auth_1.login);
router.post('/verify-login-otp', auth_1.verifyLoginOTP);
router.post('/verify-otp', auth_1.verifyOTP);
router.post('/resend-otp', auth_1.resendOTP);
router.post('/refresh-token', auth_1.refreshToken);
// Protected routes
router.use(auth_2.protect);
router.get('/me', auth_1.getMe);
router.post('/logout', auth_1.logout);
router.put('/complete-profile', auth_1.completeProfile);
router.put('/notifications', auth_1.updateNotificationSettings);
router.put('/biometrics', auth_1.updateBiometricSettings);
exports.default = router;
//# sourceMappingURL=auth.js.map