import mongoose, { Document, Types } from 'mongoose';
interface IEmergencyContact {
    name?: string;
    phone?: string;
    relationship?: string;
}
export interface IDriver extends Document {
    userId: Types.ObjectId;
    phone: string;
    vehicleType: 'motorcycle' | 'bicycle' | 'car' | 'van' | 'truck';
    vehicleModel?: string;
    vehiclePlateNumber: string;
    vehicleColor?: string;
    profilePhoto?: string;
    driversLicense?: string;
    licenseNumber?: string;
    licenseExpiry?: Date;
    region: string;
    assignedBranch?: string;
    employmentType: 'full-time' | 'part-time' | 'contract';
    status: 'pending' | 'active' | 'suspended' | 'disabled' | 'on-delivery';
    verificationStatus: 'pending' | 'verified' | 'rejected';
    isOnline: boolean;
    verifiedAt?: Date;
    verifiedBy?: Types.ObjectId;
    verificationNotes?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
    password?: string;
    hasSetPassword: boolean;
    passwordSetupToken?: string;
    passwordSetupExpiry?: Date;
    emergencyContact?: IEmergencyContact;
    suspendedAt?: Date;
    suspendedUntil?: Date;
    suspensionReason?: string;
    disabledAt?: Date;
    disablementReason?: string;
    totalDeliveries: number;
    completedDeliveries: number;
    cancelledDeliveries: number;
    rating: number;
    joinedDate: Date;
    lastActive?: Date;
    createdAt: Date;
    updatedAt: Date;
    otp?: string;
    otpExpiry?: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generatePasswordSetupToken(): string;
}
declare const _default: mongoose.Model<IDriver, {}, {}, {}, mongoose.Document<unknown, {}, IDriver, {}, {}> & IDriver & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Driver.d.ts.map