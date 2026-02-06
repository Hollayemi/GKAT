import mongoose, { Document, Types } from 'mongoose';
interface ILocation {
    lat: number;
    lng: number;
    address?: string;
}
export interface IDriverActivity extends Document {
    driverId: Types.ObjectId;
    driverName: string;
    action: string;
    description: string;
    metadata?: any;
    timestamp: Date;
    location?: ILocation;
    ipAddress?: string;
}
declare const _default: mongoose.Model<IDriverActivity, {}, {}, {}, mongoose.Document<unknown, {}, IDriverActivity, {}, {}> & IDriverActivity & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=driver.d.ts.map