import { Router } from 'express';
import {
    sendOTP,
    verifyOTP,
    resendOTP,
    completeProfile,
    updateNotificationSettings,
    updateBiometricSettings,
    getMe,
    logout,
    refreshToken,
    login,
    verifyLoginOTP
} from '../controllers/auth';
import { protect } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/refresh-token', refreshToken);

// Protected routes
router.use(protect); // All routes below this will be protected

router.get('/me', getMe);
router.post('/logout', logout);
router.put('/complete-profile', completeProfile);
router.put('/notifications', updateNotificationSettings);
router.put('/biometrics', updateBiometricSettings);

export default router;