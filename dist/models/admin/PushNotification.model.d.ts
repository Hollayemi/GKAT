import mongoose, { Document, Types } from 'mongoose';
interface IActionButton {
    text: string;
    link: string;
}
interface IFilters {
    region?: string[];
    city?: string[];
    userStatus?: string[];
    orderHistory?: 'has-ordered' | 'never-ordered' | 'frequent-buyers';
}
export interface IPushNotification extends Document {
    title: string;
    message: string;
    image?: string;
    targetAudience: 'all' | 'customers' | 'drivers' | 'specific';
    specificUserIds: Types.ObjectId[];
    specificDriverIds: Types.ObjectId[];
    filters?: IFilters;
    scheduleType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
    deepLink?: string;
    actionButton?: IActionButton;
    status: 'draft' | 'scheduled' | 'sent' | 'failed';
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    clickedCount: number;
    failedCount: number;
    createdBy: Types.ObjectId;
    createdByName: string;
    sentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IPushNotification, {}, {}, {}, mongoose.Document<unknown, {}, IPushNotification, {}, {}> & IPushNotification & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=PushNotification.model.d.ts.map