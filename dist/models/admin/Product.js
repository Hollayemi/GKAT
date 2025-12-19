"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const ProductVariantSchema = new mongoose_1.Schema({
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
        type: Number,
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
const RegionalDistributionSchema = new mongoose_1.Schema({
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
const ProductSchema = new mongoose_1.Schema({
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
        type: Number,
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
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
    const variantStock = this.variants?.reduce((sum, variant) => sum + variant.stockQuantity, 0) || 0;
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
async function generateUniqueProductId() {
    const prefix = 'PROD';
    let isUnique = false;
    let productId = '';
    while (!isUnique) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        productId = `${prefix}-${randomNum}`;
        const existingProduct = await mongoose_1.default.model('Product').findOne({ productId });
        if (!existingProduct) {
            isUnique = true;
        }
    }
    return productId;
}
exports.default = mongoose_1.default.model('Product', ProductSchema);
//# sourceMappingURL=Product.js.map