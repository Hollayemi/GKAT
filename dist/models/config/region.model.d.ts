import { Document, Model } from 'mongoose';
interface coordinate {
    coordinates: [number, number];
    point: string;
}
export interface IRegion extends Document {
    name: string;
    isActive: boolean;
    coordinate: coordinate;
    order?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface IRegionModel extends Model<IRegion> {
    findActiveRegions(): Promise<IRegion[]>;
    findByName(name: string): Promise<IRegion | null>;
    findByPartialName(searchTerm: string): Promise<IRegion[]>;
    getRegionsWithProductCount(): Promise<Array<{
        region: IRegion;
        productCount: number;
    }>>;
}
declare const Region: IRegionModel;
export default Region;
//# sourceMappingURL=region.model.d.ts.map