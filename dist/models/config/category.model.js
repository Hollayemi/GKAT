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
const CategorySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        unique: true,
        trim: true,
        minlength: [2, 'Category name must be at least 2 characters long'],
        maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    icon: {
        type: String,
        required: false,
        trim: true,
        validate: {
            validator: function (value) {
                // You can adjust this validation based on your icon system
                // This could be a URL, font-awesome class, or custom icon name
                return !!(value && value.length > 0);
            },
            message: 'Icon cannot be empty'
        }
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
CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ order: 1, name: 1 });
CategorySchema.index({ isActive: 1, order: 1 });
CategorySchema.index({ name: 'text' }, {
    name: 'category_text_search',
    weights: { name: 10 }
});
// Static Methods
CategorySchema.statics.findActiveCategories = function () {
    return this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
};
CategorySchema.statics.findByName = function (name) {
    return this.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    }).exec();
};
CategorySchema.statics.findByPartialName = function (searchTerm) {
    return this.find({
        name: { $regex: searchTerm, $options: 'i' },
        isActive: true
    })
        .sort({ order: 1, name: 1 })
        .exec();
};
CategorySchema.statics.getCategoriesWithProductCount = async function () {
    const categories = await this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
    // Note: This assumes you have a Product model with a 'category' field
    const Product = mongoose_1.default.model('Product');
    const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
        const productCount = await Product.countDocuments({
            category: category._id,
            isActive: true
        });
        return {
            category,
            productCount
        };
    }));
    return categoriesWithCounts;
};
// Virtuals
CategorySchema.virtual('displayName').get(function () {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});
CategorySchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'category',
    count: true
});
// Pre-save middleware
CategorySchema.pre('save', function (next) {
    // Trim whitespace
    this.name = this.name.trim();
    if (this.icon) {
        this.icon = this.icon.trim();
    }
    // Ensure name is properly capitalized (first letter of each word)
    this.name = this.name.toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    next();
});
CategorySchema.pre('deleteOne', async function (next) {
    try {
        const Product = mongoose_1.default.model('Product');
        const productCount = await Product.countDocuments({ category: this?._id });
        if (productCount > 0) {
            throw new Error('Cannot delete category that has products. Deactivate it instead.');
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
CategorySchema.post('save', function (doc) {
    console.log(`Category "${doc.name}" saved/updated`);
});
const Category = mongoose_1.default.model('Category', CategorySchema);
exports.default = Category;
//# sourceMappingURL=category.model.js.map