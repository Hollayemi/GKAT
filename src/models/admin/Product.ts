import mongoose, { Document, Schema } from 'mongoose';

// Product Variant Interface
interface IProductVariant {
    _id?: mongoose.Types.ObjectId;
    _v?: number;
    sku: string;
    productId: string;
    salesPrice: number;
    unitType: string;
    unitQuantity: string;
    stockQuantity: number;
    images?: string[];
}

// Regional Distribution Interface
interface IRegionalDistribution {
    region: string;
    mainProduct: number;
    variants: {
        variantId: string;
        quantity: number;
    }[];
}

// Product Interface
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

    // Pricing & Inventory
    salesPrice: number;
    unitType: 'single' | 'pack' | 'carton' | 'kg' | 'litre';
    unitQuantity: string;
    stockQuantity: number;
    minimumStockAlert: number;

    // Variants
    variants: IProductVariant[];

    // Regional Distribution
    regionalDistribution: IRegionalDistribution[];
    inventoryRegions: string[];

    // Metadata
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
    sku: {
        type: String,
        required: true,
        unique: true
    },
    productId: {
        type: String,
        required: true
    },
    salesPrice: {
        type: Number,
        required: true,
        min: 0
    },
    unitType: {
        type: String,
        required: true,
        enum: ['single', 'pack', 'carton', 'kg', 'litre', 'box']
    },
    unitQuantity: {
        type: String,
        required: true
    },
    stockQuantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    images: [{
        type: String
    }]
}, { _id: true });

const RegionalDistributionSchema = new Schema<IRegionalDistribution>({
    region: {
        type: String,
        required: true
    },
    mainProduct: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    variants: [{
        variantId: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        }
    }]
}, { _id: false });

const ProductSchema = new Schema<IProduct>({
    productName: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true,
        maxlength: [200, 'Product name cannot be more than 200 characters']
    },
    productId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sku: {
        type: String,
        required: [true, 'Please add a SKU'],
        unique: true,
        index: true,
        uppercase: true,
        trim: true
    },
    brand: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
        enum: ['Packaged Foods', 'Beverages', 'Fresh Produce', 'Dairy', 'Meat & Seafood',
            'Bakery', 'Snacks', 'Household', 'Personal Care', 'Other']
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'draft'
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    images: [{
        type: String,
        required: true
    }],
    salesPrice: {
        type: Number,
        required: [true, 'Please add a sales price'],
        min: [0, 'Price cannot be negative']
    },
    unitType: {
        type: String,
        required: true,
        enum: ['single', 'pack', 'carton', 'kg', 'litre', 'box']
    },
    unitQuantity: {
        type: String,
        required: true
    },
    stockQuantity: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Stock cannot be negative']
    },
    minimumStockAlert: {
        type: Number,
        required: true,
        default: 20,
        min: 0
    },
    variants: [ProductVariantSchema],
    regionalDistribution: [RegionalDistributionSchema],
    inventoryRegions: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
ProductSchema.index({ productName: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ createdAt: -1 });

// Virtual for low stock check
ProductSchema.virtual('isLowStock').get(function () {
    return this.stockQuantity <= this.minimumStockAlert;
});

// Virtual for total stock (including variants)
ProductSchema.virtual('totalStock').get(function () {
    const variantStock = this.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
    return this.stockQuantity + variantStock;
});

// Generate unique product ID before saving
ProductSchema.pre('save', async function (next) {
    if (!this.productId) {
        this.productId = await generateUniqueProductId();
    }
    next();
});

// Helper function to generate unique product ID
async function generateUniqueProductId(): Promise<string> {
    const prefix = 'PROD';
    let isUnique = false;
    let productId = '';

    while (!isUnique) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        productId = `${prefix}-${randomNum}`;

        const existingProduct = await mongoose.model('Product').findOne({ productId });
        if (!existingProduct) {
            isUnique = true;
        }
    }

    return productId;
}

export default mongoose.model<IProduct>('Product', ProductSchema);