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
const RegionSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});
// Indexes
RegionSchema.index({ name: 1 }, { unique: true });
RegionSchema.index({ order: 1, name: 1 });
RegionSchema.index({ isActive: 1, order: 1 });
RegionSchema.index({ name: 'text' }, {
    name: 'region_text_search',
    weights: { name: 10 }
});
// Static Methods
RegionSchema.statics.findActiveRegions = function () {
    return this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
};
RegionSchema.statics.findByName = function (name) {
    return this.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    }).exec();
};
RegionSchema.statics.findByPartialName = function (searchTerm) {
    return this.find({
        name: { $regex: searchTerm, $options: 'i' },
        isActive: true
    })
        .sort({ order: 1, name: 1 })
        .exec();
};
RegionSchema.statics.getRegionsWithProductCount = async function () {
    const categories = await this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
    // Note: This assumes you have a Product model with a 'region' field
    const Product = mongoose_1.default.model('Product');
    const categoriesWithCounts = await Promise.all(categories.map(async (region) => {
        const productCount = await Product.countDocuments({
            region: region._id,
            isActive: true
        });
        return {
            region,
            productCount
        };
    }));
    return categoriesWithCounts;
};
RegionSchema.virtual('displayName').get(function () {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});
RegionSchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'region',
    count: true
});
RegionSchema.pre('save', function (next) {
    // Trim whitespace
    this.name = this.name.trim();
    // Ensure name is properly capitalized (first letter of each word)
    this.name = this.name.toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    next();
});
RegionSchema.pre('deleteOne', async function (next) {
    try {
        const Product = mongoose_1.default.model('Product');
        const productCount = await Product.countDocuments({ region: this?._id });
        if (productCount > 0) {
            throw new Error('Cannot delete region that has products. Deactivate it instead.');
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
RegionSchema.post('save', function (doc) {
    console.log(`Region "${doc.name}" saved/updated`);
});
const Region = mongoose_1.default.model('Region', RegionSchema);
exports.default = Region;
//# sourceMappingURL=region.model.js.map