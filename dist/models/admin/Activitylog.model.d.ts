import mongoose, { Document, Types } from 'mongoose';
export interface IActivityLog extends Document {
    userId: Types.ObjectId;
    userName: string;
    action: string;
    description: string;
    metadata?: any;
    timestamp: Date;
    ipAddress?: string;
}
declare const _default: mongoose.Model<IActivityLog, {}, {}, {}, mongoose.Document<unknown, {}, IActivityLog, {}, {}> & IActivityLog & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Activitylog.model.d.ts.map