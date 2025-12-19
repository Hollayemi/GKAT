"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.logout = exports.getMe = exports.updateBiometricSettings = exports.updateNotificationSettings = exports.completeProfile = exports.resendOTP = exports.verifyOTP = exports.sendOTP = exports.verifyLoginOTP = exports.login = void 0;
const User_1 = __importDefault(require("../models/User"));
const error_1 = require("../middleware/error");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sendTokenResponse = (user, statusCode, res, message) => {
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();
    user.save({ validateBeforeSave: false });
    const options = {
        expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000)),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };
    res
        .status(statusCode)
        .cookie('token', token, options)
        .data({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            avatar: user.avatar,
            isPhoneVerified: user.isPhoneVerified,
            referralCode: user.referralCode
        },
        token,
        refreshToken
    }, message, statusCode);
};
// @desc    Login user with phone number and send OTP
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { phoneNumber, password } = req.body;
    console.log('Login attempt for phone number:', phoneNumber, password);
    if (!phoneNumber) {
        return next(new error_1.AppError('Please provide phone number', 400));
    }
    // Find user by phone number
    const user = await User_1.default.findOne({ phoneNumber }).select('+otp +otpExpiry +password');
    if (!user) {
        return next(new error_1.AppError('No user found with this phone number', 404));
    }
    // If user is admin, verify password
    // if (user.role === 'admin') {
    //     if (!password) {
    //         return next(new AppError('Please provide password for admin login', 400));
    //     }
    //     // Check if password is correct
    //     const isPasswordMatch = await bcrypt.compare(password, user?.password || '');
    //     if (!isPasswordMatch) {
    //         return next(new AppError('Invalid password', 401));
    //     }
    //     // For admin, send token immediately without OTP
    //     sendTokenResponse(user, 200, res as AppResponse, 'Admin login successful');
    //     return;
    // }
    // For non-admin users, generate and send OTP
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });
    // TODO: Send OTP via SMS service (Twilio)
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    const responseData = {
        phoneNumber,
        message: 'OTP sent successfully',
        requiresOTP: true
    };
    // Include OTP in response for development
    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp;
    }
    res.data(responseData, 'OTP sent successfully for login');
});
// @desc    Verify OTP for login
// @route   POST /api/v1/auth/verify-login-otp
// @access  Public
exports.verifyLoginOTP = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
        return next(new error_1.AppError('Please provide phone number and OTP', 400));
    }
    const user = await User_1.default.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    // Skip OTP verification for admin users
    // if (user.role === 'admin') {
    //     return next(new AppError('Admin users should use password login', 400));
    // }
    if (!user.verifyOTP(otp)) {
        return next(new error_1.AppError('Invalid or expired OTP', 401));
    }
    // Clear OTP fields
    user.otp = undefined;
    user.otpExpiry = undefined;
    // Mark phone as verified if not already
    if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
    }
    await user.save({ validateBeforeSave: false });
    sendTokenResponse(user, 200, res, 'Login successful');
});
// @desc    Send OTP to phone number
// @route   POST /api/v1/auth/send-otp
// @access  Public
exports.sendOTP = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { phoneNumber, residentArea } = req.body;
    if (!phoneNumber) {
        return next(new error_1.AppError('Please provide phone number', 400));
    }
    let user = await User_1.default.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
        user = await User_1.default.create({
            phoneNumber,
            residentArea,
            name: `User${phoneNumber.slice(-10)}`
        });
    }
    // Generate OTP
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });
    // TODO Reminder: Send OTP via SMS service (Twilio)
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    // For development, include OTP in response
    const responseData = {
        phoneNumber,
        message: 'OTP sent successfully'
    };
    // this will be deleted in production
    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp; // Only in development
    }
    res.data(responseData, 'OTP sent successfully');
});
// @desc    Verify OTP
// @route   POST /api/v1/auth/verify-otp
// @access  Public
exports.verifyOTP = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
        return next(new error_1.AppError('Please provide phone number and OTP', 400));
    }
    const user = await User_1.default.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    if (!user.verifyOTP(otp)) {
        return next(new error_1.AppError('Invalid or expired OTP', 401));
    }
    user.isPhoneVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    sendTokenResponse(user, 200, res, 'Phone verified successfully');
});
// @desc    Resend OTP
// @route   POST /api/v1/auth/resend-otp
// @access  Public
exports.resendOTP = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return next(new error_1.AppError('Please provide phone number', 400));
    }
    const user = await User_1.default.findOne({ phoneNumber }).select('+otp +otpExpiry');
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    // Generate new OTP
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });
    // when the twilio service is ready, iwill handle it here
    console.log(`New OTP for ${phoneNumber}: ${otp}`);
    const responseData = {
        phoneNumber,
        message: 'OTP resent successfully'
    };
    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp;
    }
    res.data(responseData, 'OTP resent successfully');
});
// @desc    Complete profile
// @route   PUT /api/v1/auth/complete-profile
// @access  Private
exports.completeProfile = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { name, email, referredBy } = req.body;
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    console.log(req.user);
    const user = await User_1.default.findById(req.user.id);
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    // Update profile
    if (name)
        user.name = name;
    if (email)
        user.email = email;
    // Handle referral
    if (referredBy && !user.referredBy) {
        const referrer = await User_1.default.findOne({ referralCode: referredBy });
        if (referrer) {
            user.referredBy = referredBy;
        }
    }
    await user.save();
    res.data({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            avatar: user.avatar,
            isPhoneVerified: user.isPhoneVerified,
            referralCode: user.referralCode
        }
    }, 'Profile updated successfully');
});
// @desc    Update notification settings
// @route   PUT /api/v1/auth/notifications
// @access  Private
exports.updateNotificationSettings = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { enabled } = req.body;
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const user = await User_1.default.findById(req.user.id);
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    user.notification_pref.push_notification = enabled;
    await user.save();
    res.success('Notification settings updated');
});
// @desc    Update biometric settings
// @route   PUT /api/v1/auth/biometrics
// @access  Private
exports.updateBiometricSettings = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { enabled } = req.body;
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const user = await User_1.default.findById(req.user.id);
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    user.biometricsEnabled = enabled;
    await user.save();
    res.success('Biometric settings updated');
});
// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const user = await User_1.default.findById(req.user.id);
    if (!user) {
        return next(new error_1.AppError('User not found', 404));
    }
    res.data({ user }, 'User retrieved successfully');
});
// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const user = await User_1.default.findById(req.user.id).select('+refreshToken');
    if (user) {
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
    }
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.success('Logged out successfully');
});
// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
exports.refreshToken = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return next(new error_1.AppError('Please provide refresh token', 400));
    }
    const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User_1.default.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
        return next(new error_1.AppError('Invalid refresh token', 401));
    }
    sendTokenResponse(user, 200, res, 'Token refreshed successfully');
});
//# sourceMappingURL=auth.js.map