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
    getSearchHistory
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
router.use(protect);


router.post('/logout', logout);
router.put('/complete-profile', completeProfile);
router.put('/notifications', updateNotificationSettings);
router.put('/biometrics', updateBiometricSettings);

// information about the currently logged in user
router.get('/me', getMe);
router.get('/search-history', getSearchHistory);

export default router;

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               residentArea:
 *                 type: string
 *                 example: "Lagos"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     phoneNumber:
 *                       type: string
 *                     otp:
 *                       type: string
 *                       description: Only present in development
 */
router.post('/send-otp', sendOTP);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get JWT token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otp]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', verifyOTP);