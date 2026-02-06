import mongoose, { Document, Types } from 'mongoose';
export interface IAdvert extends Document {
    title: string;
    description?: string;
    image: string;
    targetUrl?: string;
    isActive: boolean;
    position: string;
    clicks: number;
    startDate?: Date;
    endDate?: Date;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IAdvert, {}, {}, {}, mongoose.Document<unknown, {}, IAdvert, {}, {}> & IAdvert & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Advert.d.ts.map