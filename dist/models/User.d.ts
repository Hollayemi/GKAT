import mongoose, { Document, Types } from 'mongoose';
interface FCMToken {
    token: string;
    deviceId: string;
    platform: 'ios' | 'android';
    addedAt: Date;
}
interface NotificationPreferences {
    push_notification: boolean;
    in_app_notification: boolean;
    email_notification: boolean;
    notification_sound: boolean;
    order_updates: boolean;
    promotions: boolean;
    system_updates: boolean;
}
export interface IUser extends Document {
    name: string;
    email?: string;
    password?: string;
    phoneNumber: string;
    residentArea: string;
    avatar?: string;
    role: 'user' | 'admin' | 'driver';
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    referralCode: string;
    referredBy?: string;
    notification_pref: NotificationPreferences;
    biometricsEnabled: boolean;
    otp?: string;
    otpExpiry?: Date;
    refreshToken?: string;
    fcmTokens: FCMToken[];
    addresses: Types.ObjectId[];
    defaultAddress?: Types.ObjectId;
    totalOrders: number;
    totalSpent: number;
    createdAt: Date;
    updatedAt: Date;
    getSignedJwtToken(): string;
    getRefreshToken(): string;
    generateOTP(): string;
    verifyOTP(otp: string): boolean;
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=User.d.ts.map