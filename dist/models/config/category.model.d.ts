import { Document, Model } from 'mongoose';
export interface ICategory extends Document {
    name: string;
    icon?: string;
    isActive: boolean;
    order?: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ICategoryModel extends Model<ICategory> {
    findActiveCategories(): Promise<ICategory[]>;
    findByName(name: string): Promise<ICategory | null>;
    findByPartialName(searchTerm: string): Promise<ICategory[]>;
    getCategoriesWithProductCount(): Promise<Array<{
        category: ICategory;
        productCount: number;
    }>>;
}
declare const Category: ICategoryModel;
export default Category;
//# sourceMappingURL=category.model.d.ts.map