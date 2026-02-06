import mongoose, { Document, Types } from 'mongoose';
export interface IStaff extends Document {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role: Types.ObjectId;
    region?: string;
    branch?: string;
    status: 'active' | 'suspended' | 'disabled' | 'running';
    avatar?: string;
    customPermissions: string[];
    joinedDate: Date;
    lastLogin?: Date;
    suspendedAt?: Date;
    suspendedUntil?: Date;
    suspensionReason?: string;
    disabledAt?: Date;
    disablementReason?: string;
    passwordResetRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateTemporaryPassword(): string;
    getSignedJwtToken(): string;
    getRefreshToken(): string;
    generateOTP(): string;
    verifyOTP(otp: string): boolean;
}
declare const _default: mongoose.Model<IStaff, {}, {}, {}, mongoose.Document<unknown, {}, IStaff, {}, {}> & IStaff & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Staff.model.d.ts.map