"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderAdverts = exports.getAdvertStats = exports.trackAdvertClick = exports.toggleAdvertStatus = exports.deleteAdvert = exports.updateAdvert = exports.createAdvert = exports.getAdvert = exports.getAdverts = void 0;
const Advert_1 = __importDefault(require("../../models/Advert"));
const error_1 = require("../../middleware/error");
const cloudinary_1 = __importDefault(require("../../services/cloudinary"));
// @desc    Get all adverts (with filtering)
// @route   GET /api/v1/adverts
// @access  Public
exports.getAdverts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { isActive, page = 1, limit = 20, sort = 'position' } = req.query;
    const query = {};
    // Filter by active status if provided
    if (isActive !== undefined) {
        query.isActive = isActive === 'true';
    }
    // Filter by date range (show only current/upcoming adverts)
    // const now = new Date();
    // if (!req.user?.isAdmin) {
    //     // For public users, only show active and valid adverts
    //     query.isActive = true;
    //     query.$or = [
    //         { startDate: { $lte: now }, endDate: { $gte: now } },
    //         { startDate: { $lte: now }, endDate: null },
    //         { startDate: null, endDate: { $gte: now } },
    //         { startDate: null, endDate: null }
    //     ];
    // }
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const [adverts, total] = await Promise.all([
        Advert_1.default.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .populate('createdBy', 'name email')
            .select('-__v'),
        Advert_1.default.countDocuments(query)
    ]);
    res.data({
        adverts,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        }
    }, 'Adverts retrieved successfully');
});
// @desc    Get single advert
// @route   GET /api/v1/adverts/:id
// @access  Public
exports.getAdvert = (0, error_1.asyncHandler)(async (req, res, next) => {
    const advert = await Advert_1.default.findById(req.params.id)
        .populate('createdBy', 'name email');
    if (!advert) {
        return next(new error_1.AppError('Advert not found', 404));
    }
    res.data({ advert }, 'Advert retrieved successfully');
});
// @desc    Create new advert with image upload
// @route   POST /api/v1/adverts
// @access  Private/Admin
exports.createAdvert = (0, error_1.asyncHandler)(async (req, res, next) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }
    // Validate required fields
    const { title } = req.body;
    if (!title) {
        return next(new error_1.AppError('Title is required', 400));
    }
    // Handle image upload
    if (!req.file) {
        return next(new error_1.AppError('Advert image is required', 400));
    }
    let imageUrl = '';
    try {
        const uploadResult = await cloudinary_1.default.uploadImage(req.file, 'go-kart/adverts');
        imageUrl = uploadResult.url;
    }
    catch (error) {
        return next(new error_1.AppError(`Image upload failed: ${error.message}`, 400));
    }
    // Create advert
    const advert = await Advert_1.default.create({
        ...req.body,
        image: imageUrl,
        createdBy: req.user.id
    });
    res.data({ advert }, 'Advert created successfully', 201);
});
// @desc    Update advert with optional image upload
// @route   PUT /api/v1/adverts/:id
// @access  Private/Admin
exports.updateAdvert = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    let advert = await Advert_1.default.findById(req.params.id);
    if (!advert) {
        return next(new error_1.AppError('Advert not found', 404));
    }
    // Handle image upload if new image is provided
    if (req.file) {
        try {
            // Delete old image
            if (advert.image) {
                await cloudinary_1.default.deleteImage(advert.image);
            }
            // Upload new image
            const uploadResult = await cloudinary_1.default.uploadImage(req.file, 'go-kart/adverts');
            req.body.image = uploadResult.url;
        }
        catch (error) {
            return next(new error_1.AppError(`Image upload failed: ${error.message}`, 400));
        }
    }
    advert = await Advert_1.default.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });
    res.data({ advert }, 'Advert updated successfully');
});
// @desc    Delete advert
// @route   DELETE /api/v1/adverts/:id
// @access  Private/Admin
exports.deleteAdvert = (0, error_1.asyncHandler)(async (req, res, next) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }
    const advert = await Advert_1.default.findById(req.params.id);
    if (!advert) {
        return next(new error_1.AppError('Advert not found', 404));
    }
    // Delete image from Cloudinary
    if (advert.image) {
        try {
            await cloudinary_1.default.deleteImage(advert.image);
        }
        catch (error) {
            console.error('Error deleting advert image:', error);
        }
    }
    await advert.deleteOne();
    res.success('Advert deleted successfully');
});
// @desc    Toggle advert status
// @route   PATCH /api/v1/adverts/:id/toggle
// @access  Private/Admin
exports.toggleAdvertStatus = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const advert = await Advert_1.default.findById(req.params.id);
    if (!advert) {
        return next(new error_1.AppError('Advert not found', 404));
    }
    advert.isActive = !advert.isActive;
    await advert.save();
    const status = advert.isActive ? 'activated' : 'deactivated';
    res.data({ advert }, `Advert ${status} successfully`);
});
// @desc    Track advert click
// @route   POST /api/v1/adverts/:id/click
// @access  Public
exports.trackAdvertClick = (0, error_1.asyncHandler)(async (req, res, next) => {
    const advert = await Advert_1.default.findById(req.params.id);
    if (!advert) {
        return next(new error_1.AppError('Advert not found', 404));
    }
    // Increment click count
    advert.clicks += 1;
    await advert.save();
    res.data({
        targetUrl: advert.targetUrl,
        clicks: advert.clicks
    }, 'Click tracked successfully');
});
// @desc    Get advert statistics
// @route   GET /api/v1/adverts/stats
// @access  Private/Admin
exports.getAdvertStats = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const now = new Date();
    const [activeCount, totalClicks, topAdverts] = await Promise.all([
        Advert_1.default.countDocuments({ isActive: true }),
        Advert_1.default.aggregate([
            { $group: { _id: null, total: { $sum: '$clicks' } } }
        ]),
        Advert_1.default.find()
            .sort({ clicks: -1 })
            .limit(5)
            .select('title clicks image')
    ]);
    res.data({
        activeAdverts: activeCount,
        totalClicks: totalClicks[0]?.total || 0,
        topAdverts
    }, 'Advert statistics retrieved successfully');
});
// @desc    Reorder adverts
// @route   PUT /api/v1/adverts/reorder
// @access  Private/Admin
exports.reorderAdverts = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user?.isAdmin) {
        return next(new error_1.AppError('Not authorized to perform this action', 403));
    }
    const { orderList } = req.body;
    if (!Array.isArray(orderList)) {
        return next(new error_1.AppError('Order list must be an array', 400));
    }
    const bulkOps = orderList.map(({ id, position }) => ({
        updateOne: {
            filter: { _id: id },
            update: { position }
        }
    }));
    await Advert_1.default.bulkWrite(bulkOps);
    const adverts = await Advert_1.default.find({ isActive: true }).sort({ position: 1 });
    res.data({ adverts }, 'Adverts reordered successfully');
});
//# sourceMappingURL=advertController.js.map