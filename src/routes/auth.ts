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
    verifyLoginOTP,
    getSearchHistory,
    getMyReferredUsers,
} from '../controllers/auth';
// add these imports at the top
import { guestSession, convertGuest } from '../controllers/guest';


import { protect } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/send-otp', sendOTP);
router.post('/login', login);
router.post('/verify-login-otp', verifyLoginOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/refresh-token', refreshToken);


router.post('/guest-session', guestSession);

// Protected routes
router.use(protect);

router.post('/guest-convert', convertGuest);

router.post('/logout', logout);
router.put('/complete-profile', completeProfile);
router.put('/notifications', updateNotificationSettings);
router.put('/biometrics', updateBiometricSettings);

// information about the currently logged in user
router.get('/me', getMe);
router.get('/search-history', getSearchHistory);
router.get('/referrals', getMyReferredUsers);

export default router;