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
const NigeriaStatesSchema = new mongoose_1.Schema({
    Abia: [String],
    Adamawa: [String],
    Anambra: [String],
    AkwaIbom: [String],
    Bauchi: [String],
    Bayelsa: [String],
    Benue: [String],
    Borno: [String],
    CrossRiver: [String],
    Delta: [String],
    Ebonyi: [String],
    Enugu: [String],
    Edo: [String],
    Ekiti: [String],
    FCT: [String],
    Gombe: [String],
    Imo: [String],
    Jigawa: [String],
    Kaduna: [String],
    Kano: [String],
    Katsina: [String],
    Kebbi: [String],
    Kogi: [String],
    Kwara: [String],
    Lagos: [String],
    Nasarawa: [String],
    Niger: [String],
    Ogun: [String],
    Ondo: [String],
    Osun: [String],
    Oyo: [String],
    Plateau: [String],
    Rivers: [String],
    Sokoto: [String],
    Taraba: [String],
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
NigeriaStatesSchema.index({ name: 1 }, { unique: true });
NigeriaStatesSchema.index({ order: 1, name: 1 });
NigeriaStatesSchema.index({ isActive: 1, order: 1 });
NigeriaStatesSchema.index({ name: 'text' }, {
    name: '',
    weights: { name: 10 }
});
// Static Methods
NigeriaStatesSchema.statics.findActiveCategories = function () {
    return this.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .exec();
};
NigeriaStatesSchema.statics.findByName = function (name) {
    return this.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    }).exec();
};
NigeriaStatesSchema.statics.findByPartialName = function (searchTerm) {
    return this.find({
        name: { $regex: searchTerm, $options: 'i' },
        isActive: true
    })
        .sort({ order: 1, name: 1 })
        .exec();
};
NigeriaStatesSchema.statics.getCategoriesWithProductCount = async function () {
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
NigeriaStatesSchema.pre('deleteOne', async function (next) {
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
const NigeriaStates = mongoose_1.default.model('nigeria_states', NigeriaStatesSchema);
exports.default = NigeriaStates;
//# sourceMappingURL=nigeriaStates.js.map