"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderCategories = exports.toggleCategoryActive = exports.searchCategories = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryWithProducts = exports.getCategory = exports.getCategoriesWithCount = exports.getAllCategories = void 0;
const error_1 = require("../../middleware/error");
const category_model_1 = __importDefault(require("../../models/config/category.model"));
const Product_1 = __importDefault(require("../../models/admin/Product"));
const cloudinary_1 = __importDefault(require("../../services/cloudinary"));
// @desc    Get all categories
// @route   GET /api/v1/categories
// @access  Public
exports.getAllCategories = (0, error_1.asyncHandler)(async (req, res, next) => {
    const categories = await category_model_1.default.findActiveCategories();
    res.data(categories, 'Categories retrieved successfully');
});
// @desc    Get all categories with product count
// @route   GET /api/v1/categories/with-count
// @access  Public
exports.getCategoriesWithCount = (0, error_1.asyncHandler)(async (req, res, next) => {
    const categoriesWithCounts = await category_model_1.default.getCategoriesWithProductCount();
    res.data({ categories: categoriesWithCounts }, 'Categories with product count retrieved successfully');
});
// @desc    Get single category
// @route   GET /api/v1/categories/:id
// @access  Public
exports.getCategory = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { id } = req.params;
    const category = await category_model_1.default.findById(id);
    if (!category) {
        return next(new error_1.AppError('Category not found', 404));
    }
    res.data({ category }, 'Category retrieved successfully');
});
// @desc    Get category with related products
// @route   GET /api/v1/categories/filter/:id
// @access  Public
exports.getCategoryWithProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = '-createdAt', minPrice, maxPrice, status = 'active' } = req.query;
    const category = await category_model_1.default.findById(id);
    if (!category) {
        return next(new error_1.AppError('Category not found', 404));
    }
    // Build product query
    const productQuery = {
        category: id,
        status: status
    };
    // Add price filter if provided
    if (minPrice || maxPrice) {
        productQuery.salesPrice = {};
        if (minPrice)
            productQuery.salesPrice.$gte = parseFloat(minPrice);
        if (maxPrice)
            productQuery.salesPrice.$lte = parseFloat(maxPrice);
    }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    // Get products for this category
    const [products, totalProducts] = await Promise.all([
        Product_1.default.find(productQuery)
            .populate('category')
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .select('-__v'),
        Product_1.default.countDocuments(productQuery)
    ]);
    res.data({
        category: {
            _id: category._id,
            name: category.name,
            icon: category.icon,
            isActive: category.isActive,
            order: category.order
        },
        products,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalProducts,
            pages: Math.ceil(totalProducts / limitNum)
        }
    }, 'Category with products retrieved successfully');
});
// @desc    Create new category with icon upload
// @route   POST /api/v1/categories
// @access  Private/Admin
exports.createCategory = (0, error_1.asyncHandler)(async (req, res, next) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }
    const { name } = req.body;
    // Check if category already exists
    const existingCategory = await category_model_1.default.findByName(name);
    if (existingCategory) {
        return next(new error_1.AppError('Category with this name already exists', 400));
    }
    // Handle icon upload if provided
    let iconUrl = '';
    if (req.file) {
        try {
            const uploadResult = await cloudinary_1.default.uploadImage(req.file, 'go-kart/categories');
            iconUrl = uploadResult.url;
        }
        catch (error) {
            return next(new error_1.AppError(`Icon upload failed: ${error.message}`, 400));
        }
    }
    const category = await category_model_1.default.create({
        name,
        icon: iconUrl,
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });
    res.data({ category }, 'Category created successfully', 201);
});
// @desc    Update category with optional icon upload
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
exports.updateCategory = (0, error_1.asyncHandler)(async (req, res, next) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }
    const { id } = req.params;
    const updates = req.body;
    if (updates.name) {
        const existingCategory = await category_model_1.default.findOne({
            name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
            _id: { $ne: id }
        });
        if (existingCategory) {
            return next(new error_1.AppError('Category with this name already exists', 400));
        }
    }
    // Handle icon upload if new icon is provided
    if (req.file) {
        try {
            const category = await category_model_1.default.findById(id);
            // Delete old icon if exists
            if (category && category.icon) {
                await cloudinary_1.default.deleteImage(category.icon);
            }
            // Upload new icon
            const uploadResult = await cloudinary_1.default.uploadImage(req.file, 'go-kart/categories');
            updates.icon = uploadResult.url;
        }
        catch (error) {
            return next(new error_1.AppError(`Icon upload failed: ${error.message}`, 400));
        }
    }
    const category = await category_model_1.default.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true
    });
    if (!category) {
        return next(new error_1.AppError('Category not found', 404));
    }
    res.data({ category }, 'Category updated successfully');
});
// @desc    Delete category
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
exports.deleteCategory = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { id } = req.params;
    const category = await category_model_1.default.findById(id);
    if (!category) {
        return next(new error_1.AppError('Category not found', 404));
    }
    // Delete icon from Cloudinary if exists
    if (category.icon) {
        try {
            await cloudinary_1.default.deleteImage(category.icon);
        }
        catch (error) {
            console.error('Error deleting category icon:', error);
        }
    }
    await category.deleteOne();
    res.data(null, 'Category deleted successfully');
});
// @desc    Search categories
// @route   GET /api/v1/categories/search
// @access  Public
exports.searchCategories = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        return next(new error_1.AppError('Search query is required', 400));
    }
    const categories = await category_model_1.default.findByPartialName(q);
    res.data({ categories }, 'Categories search completed');
});
// @desc    Toggle category active status
// @route   PATCH /api/v1/categories/:id/toggle-active
// @access  Private/Admin
exports.toggleCategoryActive = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { id } = req.params;
    const category = await category_model_1.default.findById(id);
    if (!category) {
        return next(new error_1.AppError('Category not found', 404));
    }
    category.isActive = !category.isActive;
    await category.save();
    const status = category.isActive ? 'activated' : 'deactivated';
    res.data(category, `Category ${status} successfully`);
});
// @desc    Reorder categories
// @route   PUT /api/v1/categories/reorder
// @access  Private/Admin
exports.reorderCategories = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { orderList } = req.body;
    if (!Array.isArray(orderList)) {
        return next(new error_1.AppError('Order list must be an array', 400));
    }
    const bulkOps = orderList.map(({ id, order }) => ({
        updateOne: {
            filter: { _id: id },
            update: { order }
        }
    }));
    await category_model_1.default.bulkWrite(bulkOps);
    const categories = await category_model_1.default.findActiveCategories();
    res.data({ categories }, 'Categories reordered successfully');
});
//# sourceMappingURL=categoryController.js.map