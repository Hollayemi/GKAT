import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRegion extends Document {
    name: string;
    isActive: boolean;
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

const RegionSchema: Schema<IRegion> = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Region name is required'],
            unique: true,
            trim: true,
            minlength: [2, 'Region name must be at least 2 characters long'],
            maxlength: [100, 'Region name cannot exceed 100 characters']
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        order: {
            type: Number,
            default: 0,
            min: [0, 'Order cannot be negative']
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret: any) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);

// Indexes
RegionSchema.index({ name: 1 }, { unique: true });
RegionSchema.index({ order: 1, name: 1 });
RegionSchema.index({ isActive: 1, order: 1 });
RegionSchema.index({ name: 'text' }, {
    name: 'region_text_search',
    weights: { name: 10 }
});

// Static Methods
RegionSchema.statics.findActiveRegions = function (): Promise<IRegion[]> {
    return this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
};

RegionSchema.statics.findByName = function (name: string): Promise<IRegion | null> {
    return this.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    }).exec();
};

RegionSchema.statics.findByPartialName = function (searchTerm: string): Promise<IRegion[]> {
    return this.find({
        name: { $regex: searchTerm, $options: 'i' },
        isActive: true
    })
        .sort({ order: 1, name: 1 })
        .exec();
};

RegionSchema.statics.getRegionsWithProductCount = async function (): Promise<Array<{
    region: IRegion;
    productCount: number;
}>> {
    const categories = await this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();

    // Note: This assumes you have a Product model with a 'region' field
    const Product = mongoose.model('Product');

    const categoriesWithCounts = await Promise.all(
        categories.map(async (region: IRegion) => {
            const productCount = await Product.countDocuments({
                region: region._id,
                isActive: true
            });

            return {
                region,
                productCount
            };
        })
    );

    return categoriesWithCounts;
};

RegionSchema.virtual('displayName').get(function (this: IRegion) {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

RegionSchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'region',
    count: true
});

RegionSchema.pre<IRegion>('save', function (next) {
    // Trim whitespace
    this.name = this.name.trim();

    // Ensure name is properly capitalized (first letter of each word)
    this.name = this.name.toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    next();
});

RegionSchema.pre<IRegion>('deleteOne', async function (next:any) {
    try {

        const Product = mongoose.model('Product');
        const productCount = await Product.countDocuments({ region: this?._id });

        if (productCount > 0) {
            throw new Error('Cannot delete region that has products. Deactivate it instead.');
        }

        next();
    } catch (error) {
        next(error as Error);
    }
});

RegionSchema.post<IRegion>('save', function (doc) {
    console.log(`Region "${doc.name}" saved/updated`);
});

const Region: IRegionModel = mongoose.model<IRegion, IRegionModel>('Region', RegionSchema);

export default Region;