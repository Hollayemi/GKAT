"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderRegions = exports.toggleRegionActive = exports.searchRegions = exports.deleteRegion = exports.updateRegion = exports.createRegion = exports.getRegion = exports.getRegionsWithCount = exports.getAllRegions = void 0;
const error_1 = require("../../middleware/error");
const region_model_1 = __importDefault(require("../../models/config/region.model"));
// @desc    Get all regions
// @route   GET /api/v1/regions
// @access  Public
exports.getAllRegions = (0, error_1.asyncHandler)(async (req, res, next) => {
    const regions = await region_model_1.default.findActiveRegions();
    res.data(regions, 'Regions retrieved successfully');
});
// @desc    Get all regions with product count
// @route   GET /api/v1/regions/with-count
// @access  Public
exports.getRegionsWithCount = (0, error_1.asyncHandler)(async (req, res, next) => {
    const regionsWithCounts = await region_model_1.default.getRegionsWithProductCount();
    res.data({ regions: regionsWithCounts }, 'Regions with product count retrieved successfully');
});
// @desc    Get single region
// @route   GET /api/v1/regions/:id
// @access  Public
exports.getRegion = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { id } = req.params;
    const region = await region_model_1.default.findById(id);
    if (!region) {
        return next(new error_1.AppError('Region not found', 404));
    }
    res.data(region, 'Region retrieved successfully');
});
// @desc    Create new region
// @route   POST /api/v1/regions
// @access  Private/Admin
exports.createRegion = (0, error_1.asyncHandler)(async (req, res, next) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }
    const { name } = req.body;
    // Check if region already exists
    const existingRegion = await region_model_1.default.findByName(name);
    if (existingRegion) {
        return next(new error_1.AppError('Region with this name already exists', 400));
    }
    const region = await region_model_1.default.create({
        name,
        order: req.body.order || 0,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true
    });
    res.data({ region }, 'Region created successfully', 201);
});
// @desc    Update region
// @route   PUT /api/v1/regions/:id
// @access  Private/Admin
exports.updateRegion = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { id } = req.params;
    const updates = req.body;
    if (updates.name) {
        const existingRegion = await region_model_1.default.findOne({
            name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
            _id: { $ne: id }
        });
        if (existingRegion) {
            return next(new error_1.AppError('Region with this name already exists', 400));
        }
    }
    const region = await region_model_1.default.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true
    });
    if (!region) {
        return next(new error_1.AppError('Region not found', 404));
    }
    res.data({ region }, 'Region updated successfully');
});
// @desc    Delete region
// @route   DELETE /api/v1/regions/:id
// @access  Private/Admin
exports.deleteRegion = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { id } = req.params;
    const region = await region_model_1.default.findById(id);
    if (!region) {
        return next(new error_1.AppError('Region not found', 404));
    }
    await region.deleteOne();
    res.data(null, 'Region deleted successfully');
});
// @desc    Search regions
// @route   GET /api/v1/regions/search
// @access  Public
exports.searchRegions = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
        return next(new error_1.AppError('Search query is required', 400));
    }
    const regions = await region_model_1.default.findByPartialName(q);
    res.data({ regions }, 'Regions search completed');
});
// @desc    Toggle region active status
// @route   PATCH /api/v1/regions/:id/toggle-active
// @access  Private/Admin
exports.toggleRegionActive = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { id } = req.params;
    const region = await region_model_1.default.findById(id);
    if (!region) {
        return next(new error_1.AppError('Region not found', 404));
    }
    region.isActive = !region.isActive;
    await region.save();
    const status = region.isActive ? 'activated' : 'deactivated';
    res.data({ region }, `Region ${status} successfully`);
});
// @desc    Reorder regions
// @route   PUT /api/v1/regions/reorder
// @access  Private/Admin
exports.reorderRegions = (0, error_1.asyncHandler)(async (req, res, next) => {
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
    await region_model_1.default.bulkWrite(bulkOps);
    const regions = await region_model_1.default.findActiveRegions();
    res.data({ regions }, 'Regions reordered successfully');
});
//# sourceMappingURL=regionController.js.map