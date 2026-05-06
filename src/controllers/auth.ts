import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import Driver, { IDriver } from '../models/Driver';
import { AppError, asyncHandler, AppResponse } from '../middleware/error';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendOTPViaSMS } from '../services/sms';
import CloudinaryService from '../services/cloudinary';


const sendTokenResponse = (user: IUser, statusCode: number, res: AppResponse, message: string) => {
    const token = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken();

    user.save({ validateBeforeSave: false });

    const options = {
        expires: new Date(
            Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE || '7') * 24 * 60 * 60 * 1000)
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    };

    res
        .status(statusCode)
        .cookie('token', token, options)
        .data(
            {
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
            },
            message,
            statusCode
        );
};

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { phoneNumber, password } = req.body;

    console.log('Login attempt for phone number:', phoneNumber, password);

    if (!phoneNumber) {
        return next(new AppError('Please provide phone number', 400));
    }

    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry +password');

    if (!user) {
        return next(new AppError('No user found with this phone number', 404));
    }






    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    console.log(`OTP for ${phoneNumber}: ${otp}`);

    const smsResult = await sendOTPViaSMS(phoneNumber, otp);

    if (!smsResult.success && process.env.NODE_ENV === 'production') {
        return next(new AppError('Failed to resend OTP. Please try again.', 500));
    }


    const responseData: any = {
        phoneNumber,
        message: 'OTP sent successfully',
        requiresOTP: true
    };

    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp;
    }

    (res as AppResponse).data(responseData, 'OTP sent successfully for login');
});

export const verifyLoginOTP = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return next(new AppError('Please provide phone number and OTP', 400));
    }

    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry').populate('driverId');

    if (!user) {
        return next(new AppError('User not found', 404));
    }


    if (!user.verifyOTP(otp)) {
        return next(new AppError('Invalid or expired OTP', 401));
    }

    user.otp = undefined;
    user.otpExpiry = undefined;

    if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
    }

    await user.save({ validateBeforeSave: false });
    sendTokenResponse(user, 200, res as AppResponse, 'Login successful');
});

export const sendOTP = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { phoneNumber, residentArea } = req.body;

    if (!phoneNumber) {
        return next(new AppError('Please provide phone number', 400));
    }

    let user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');

    if (!user) {
        user = await User.create({
            phoneNumber,
            residentArea,
            name: `User${phoneNumber.slice(-10)}`
        });
    }

    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });


    const smsResult = await sendOTPViaSMS(phoneNumber, otp);

    if (!smsResult.success && process.env.NODE_ENV === 'production') {
        return next(new AppError('Failed to resend OTP. Please try again.', 500));
    }


    console.log(`OTP for ${phoneNumber}: ${otp}`);

    const responseData: any = {
        phoneNumber,
        message: 'OTP sent successfully'
    };

    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp;
    }

    (res as AppResponse).data(responseData, 'OTP sent successfully');
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
        return next(new AppError('Please provide phone number and OTP', 400));
    }

    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry').populate('driverId');

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    if (!user.verifyOTP(otp)) {
        return next(new AppError('Invalid or expired OTP', 401));
    }

    user.isPhoneVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res as AppResponse, 'Phone verified successfully');
});

export const resendOTP = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return next(new AppError('Please provide phone number', 400));
    }

    const user = await User.findOne({ phoneNumber }).select('+otp +otpExpiry');

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    console.log(`New OTP for ${phoneNumber}: ${otp}`);

    const smsResult = await sendOTPViaSMS(phoneNumber, otp);

    if (!smsResult.success && process.env.NODE_ENV === 'production') {
        return next(new AppError('Failed to resend OTP. Please try again.', 500));
    }


    const responseData: any = {
        phoneNumber,
        message: 'OTP resent successfully'
    };

    if (process.env.NODE_ENV === 'development') {
        responseData.otp = otp;
    }

    (res as AppResponse).data(responseData, 'OTP resent successfully');
});

export const completeProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, referredBy, avatar } = req.body; //avatar will be base64 string 

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    console.log(req.user);

    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    let imageUrl: any = "";
    let base64Data: any = avatar;

    if (avatar && !avatar.startsWith('data:image')) {
        base64Data = `data:image/png;base64,${avatar}`;
    }

    if (avatar) {
        try {
            imageUrl = await CloudinaryService.uploadImage(base64Data, 'go-kart/products');
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }


    if (name) user.name = name;
    if (imageUrl) user.avatar = imageUrl.url; // Store the URL of the uploaded image
    if (email) user.email = email;

    if (referredBy && !user.referredBy) {
        const referrer = await User.findOne({ referralCode: referredBy });
        if (referrer) {
            user.referredBy = referredBy;
        }
    }

    await user.save();

    (res as AppResponse).data(
        {
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
        },
        'Profile updated successfully'
    );
});

export const updateNotificationSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        push_notification,
        sound,
        vibrate,
        offers,
        order_updates,
        promos,
        payments,
        orders,
        app_update,
        policy,
    } = req.body;

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    push_notification !== undefined && (user.notification_pref.push_notification = push_notification);
    sound !== undefined && (user.notification_pref.sound = sound);
    vibrate !== undefined && (user.notification_pref.vibrate = vibrate);
    offers !== undefined && (user.notification_pref.offers = offers);
    order_updates !== undefined && (user.notification_pref.order_updates = order_updates);
    promos !== undefined && (user.notification_pref.promos = promos);
    payments !== undefined && (user.notification_pref.payments = payments);
    orders !== undefined && (user.notification_pref.orders = orders);
    app_update !== undefined && (user.notification_pref.app_update = app_update);
    policy !== undefined && (user.notification_pref.policy = policy);

    await user.save();

    (res as AppResponse).success('Notification settings updated');
});

export const updateBiometricSettings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { enabled } = req.body;

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    user.biometricsEnabled = enabled;
    await user.save();

    (res as AppResponse).success('Biometric settings updated');
});

export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const user = await User.findById(req.user.id).populate('defaultAddress').populate('driverId').lean();
    const { addresses, ...userData } = user || {};
    if (!user) {
        return next(new AppError('User not found', 404));
    }

    (res as AppResponse).data({ user: userData }, 'User retrieved successfully');
});

export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }
    const user = await User.findById(req.user.id).select('+refreshToken');
    if (user) {
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
    }

    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    (res as AppResponse).success('Logged out successfully');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return next(new AppError('Please provide refresh token', 400));
    }

    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);

    const user = await User.findById((decoded as any).id).select('+refreshToken').populate('driverId');

    if (!user || user.refreshToken !== refreshToken) {
        return next(new AppError('Invalid refresh token', 401));
    }

    sendTokenResponse(user, 200, res as AppResponse, 'Token refreshed successfully');
});

export const getSearchHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    if (!req.user) {
        return next(new AppError('Not authenticated', 401));
    }

    const users = await User.find().select('searchHistory');

    const searchCounts: { [key: string]: number } = {};
    users.forEach(user => {
        user.searchHistory.forEach(query => {
            searchCounts[query] = (searchCounts[query] || 0) + 1;
        });
    });

    const popularSearches = Object.entries(searchCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => ({ query: entry[0], count: entry[1] }));


    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    (res as AppResponse).data({ searchHistory: user.searchHistory, popularSearches }, 'Search history retrieved successfully');
});