import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Driver from '../../models/Driver';
import User from '../../models/User';
import DriverWallet from '../../models/DriverWallet';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';

/**
 * Driver-specific auth actions.
 *
 * sendOTP / verifyOTP / refreshToken are NOT here — they live in
 * the shared auth controller and are imported directly into the route.
 * The shared controller already handles role differentiation via
 * User.role === 'driver' | 'user'.
 */

// ─── @desc    First-time password setup (token from onboarding email)
// ─── @route   POST /api/v1/driver-app/auth/set-password
// ─── @access  Public (token-based)
export const setupPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
        return next(new AppError('Token, password and confirmPassword are required', 400));
    }

    if (password !== confirmPassword) {
        return next(new AppError('Passwords do not match', 400));
    }

    if (password.length < 8) {
        return next(new AppError('Password must be at least 8 characters', 400));
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const driver = await Driver.findOne({
        passwordSetupToken: hashedToken,
        passwordSetupExpiry: { $gt: new Date() }
    });

    if (!driver) {
        return next(new AppError('Password setup link is invalid or has expired', 400));
    }

    const salt = await bcrypt.genSalt(10);
    driver.password = await bcrypt.hash(password, salt);
    driver.hasSetPassword = true;
    driver.passwordSetupToken = undefined;
    driver.passwordSetupExpiry = undefined;
    await driver.save();

    (res as AppResponse).success('Password set successfully. You can now log in.');
});

// ─── @desc    Toggle driver online / offline
// ─── @route   PATCH /api/v1/driver-app/auth/toggle-availability
// ─── @access  Private (driver)
export const toggleAvailability = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) return next(new AppError('Driver profile not found', 404));

    if (driver.verificationStatus !== 'verified') {
        return next(new AppError('Your account must be verified before going online', 403));
    }

    if (driver.status === 'suspended' || driver.status === 'disabled') {
        return next(new AppError('Your account is not active', 403));
    }

    driver.isOnline = !driver.isOnline;
    driver.lastActive = new Date();
    await driver.save();

    (res as AppResponse).data(
        { isOnline: driver.isOnline },
        driver.isOnline ? 'You are now online' : 'You are now offline'
    );
});

// ─── @desc    Get logged-in driver profile + wallet summary
// ─── @route   GET /api/v1/driver-app/auth/me
// ─── @access  Private (driver)
export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const driver = await Driver.findOne({ userId: req.user._id })
        .populate('userId', 'name email phoneNumber avatar notification_pref')
        .select('-password -passwordSetupToken -passwordSetupExpiry');

    if (!driver) return next(new AppError('Driver profile not found', 404));

    const wallet = await DriverWallet.findOne({ driverId: driver._id })
        .select('balance totalEarned totalWithdrawn totalDeliveries');

    (res as AppResponse).data({ driver, wallet }, 'Profile retrieved successfully');
});

// ─── @desc    Register / update FCM push token for this device
// ─── @route   PATCH /api/v1/driver-app/auth/fcm-token
// ─── @access  Private (driver)
export const updateFcmToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    const { fcmToken, deviceId, platform } = req.body;

    if (!fcmToken || !deviceId || !platform) {
        return next(new AppError('fcmToken, deviceId and platform are required', 400));
    }

    if (!['ios', 'android'].includes(platform)) {
        return next(new AppError('Platform must be ios or android', 400));
    }

    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404));

    const existingIndex = user.fcmTokens?.findIndex(t => t.deviceId === deviceId);

    if (existingIndex !== undefined && existingIndex >= 0) {
        user.fcmTokens[existingIndex].token = fcmToken;
        user.fcmTokens[existingIndex].platform = platform;
        (user.fcmTokens[existingIndex] as any).addedAt = new Date();
    } else {
        user.fcmTokens.push({ token: fcmToken, deviceId, platform, addedAt: new Date() });
    }

    await user.save({ validateBeforeSave: false });

    (res as AppResponse).success('FCM token updated successfully');
});