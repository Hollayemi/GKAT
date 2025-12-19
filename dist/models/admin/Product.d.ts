import mongoose, { Document } from 'mongoose';
interface IProductVariant {
    _id?: mongoose.Types.ObjectId;
    _v?: number;
    sku: string;
    productId: string;
    salesPrice: number;
    unitType: string;
    unitQuantity: number;
    stockQuantity: number;
    images?: string[];
}
interface IRegionalDistribution {
    region: string;
    mainProduct: number;
    variants: {
        variantId: string;
        quantity: number;
    }[];
}
export interface IProduct extends Document {
    productName: string;
    productId: string;
    sku: string;
    brand?: string;
    category: string;
    status: 'active' | 'inactive' | 'draft';
    description: string;
    tags: string[];
    images: string[];
    salesPrice: number;
    unitType: 'single' | 'pack' | 'carton' | 'kg' | 'litre';
    unitQuantity: number;
    stockQuantity: number;
    minimumStockAlert: number;
    variants: IProductVariant[];
    regionalDistribution: IRegionalDistribution[];
    inventoryRegions: string[];
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IProduct, {}, {}, {}, mongoose.Document<unknown, {}, IProduct, {}, {}> & IProduct & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=Product.d.ts.map