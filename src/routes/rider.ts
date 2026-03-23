import { Router } from 'express';

import {
    // sendLoginOTP,
    // verifyLoginOTP,
    setupPassword,
    toggleAvailability,
    getMe,
    updateFcmToken,
    // refreshToken
} from '../controllers/rider/auth';

import {
    getAvailableOrders,
    acceptOrder,
    rejectOrder,
    updateDeliveryStatus,
    confirmDelivery,
    cancelDelivery,
    getActiveDelivery,
    getDeliveryHistory,
    getDeliveryDetails,
    rateCustomer,
    dispatchOrderToDrivers
} from '../controllers/rider/orders';

import {
    getWallet,
    getTransactions,
    withdrawEarnings,
    addBankAccount,
    deleteBankAccount,
    setDefaultBankAccount,
    getAutoPayoutSettings,
    updateAutoPayoutSettings,
    getEarningsSummary
} from '../controllers/rider/earnings';

import {
    getHomeStats,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    updateProfile,
    getPerformanceStats,
    updateNotificationPreferences
} from '../controllers/rider/profile';

import { protectDriver } from '../middleware/driverAuth';
import { protect, checkPermission } from '../middleware/auth';
import { upload } from '../services/cloudinary';

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
// router.post('/auth/send-otp', sendLoginOTP);
// router.post('/auth/verify-otp', verifyLoginOTP);
router.post('/auth/set-password', setupPassword);
// router.post('/auth/refresh-token', refreshToken);

// ─── Protected - driver only ──────────────────────────────────────────────────
router.use(protectDriver);

// Auth / profile
router.get('/auth/me', getMe);
router.patch('/auth/toggle-availability', toggleAvailability);
router.patch('/auth/fcm-token', updateFcmToken);

// Profile
router.get('/profile/home', getHomeStats);
router.put('/profile', upload.single('profilePhoto'), updateProfile);
router.get('/profile/stats', getPerformanceStats);
router.put('/profile/notification-preferences', updateNotificationPreferences);

// Notifications
router.get('/profile/notifications', getNotifications);
router.patch('/profile/notifications/read-all', markAllNotificationsRead);
router.patch('/profile/notifications/:id/read', markNotificationRead);

// Orders
router.get('/orders/available', getAvailableOrders);
router.get('/orders/active', getActiveDelivery);
router.get('/orders/history', getDeliveryHistory);
router.get('/orders/:deliveryId', getDeliveryDetails);
router.post('/orders/:deliveryId/accept', acceptOrder);
router.post('/orders/:deliveryId/reject', rejectOrder);
router.patch('/orders/:deliveryId/status', updateDeliveryStatus);
router.post('/orders/:deliveryId/confirm-delivery', confirmDelivery);
router.post('/orders/:deliveryId/cancel', cancelDelivery);
router.post('/orders/:deliveryId/rate-customer', rateCustomer);

// Earnings & Wallet
router.get('/earnings/wallet', getWallet);
router.get('/earnings/transactions', getTransactions);
router.get('/earnings/summary', getEarningsSummary);
router.post('/earnings/withdraw', withdrawEarnings);
router.get('/earnings/auto-payout', getAutoPayoutSettings);
router.put('/earnings/auto-payout', updateAutoPayoutSettings);
router.post('/earnings/bank-accounts', addBankAccount);
router.delete('/earnings/bank-accounts/:accountId', deleteBankAccount);
router.patch('/earnings/bank-accounts/:accountId/default', setDefaultBankAccount);

// ─── Admin-only: dispatch order ───────────────────────────────────────────────
router.post('/dispatch', protect, checkPermission('manage_orders'), dispatchOrderToDrivers);

export default router;
