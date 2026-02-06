import mongoose, { Document } from 'mongoose';
export interface IRole extends Document {
    name: string;
    displayName: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IRole, {}, {}, {}, mongoose.Document<unknown, {}, IRole, {}, {}> & IRole & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Roles.models.d.ts.map