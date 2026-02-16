import mongoose, { Document, Types } from 'mongoose';
export interface INigeriaStates extends Document {
    Abia: [string];
    Adamawa: [string];
    Anambra: [string];
    AkwaIbom: [string];
    Bauchi: [string];
    Bayelsa: [string];
    Benue: [string];
    Borno: [string];
    CrossRiver: [string];
    Delta: [string];
    Ebonyi: [string];
    Enugu: [string];
    Edo: [string];
    Ekiti: [string];
    FCT: [string];
    Gombe: [string];
    Imo: [string];
    Jigawa: [string];
    Kaduna: [string];
    Kano: [string];
    Katsina: [string];
    Kebbi: [string];
    Kogi: [string];
    Kwara: [string];
    Lagos: [string];
    Nasarawa: [string];
    Niger: [string];
    Ogun: [string];
    Ondo: [string];
    Osun: [string];
    Oyo: [string];
    Plateau: [string];
    Rivers: [string];
    Sokoto: [string];
    Taraba: [string];
    Yobe: [string];
    Zamfara: [string];
}
declare const NigeriaStates: mongoose.Model<INigeriaStates, {}, {}, {}, mongoose.Document<unknown, {}, INigeriaStates, {}, {}> & INigeriaStates & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default NigeriaStates;
//# sourceMappingURL=nigeriaStates.d.ts.map