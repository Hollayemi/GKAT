import mongoose, { Document, Types } from 'mongoose';
export interface IAddress extends Document {
    userId: Types.ObjectId;
    label: 'Home' | 'Shop' | 'Office' | 'Other';
    phone?: string;
    street: string;
    address: string;
    landmark: string;
    state: string;
    localGovernment: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IAddress, {}, {}, {}, mongoose.Document<unknown, {}, IAddress, {}, {}> & IAddress & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Address.d.ts.map