import { Request, Response, NextFunction } from 'express';
import Advert from '../../models/Advert';
import { AppError, asyncHandler, AppResponse } from '../../middleware/error';
import CloudinaryService from '../../services/cloudinary';

// @desc    Get all adverts (with filtering)
// @route   GET /api/v1/adverts
// @access  Public
export const getAdverts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
        isActive,
        page = 1,
        limit = 20,
        sort = 'position'
    } = req.query;

    const query: any = {};

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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [adverts, total] = await Promise.all([
        Advert.find(query)
            .sort(sort as string)
            .skip(skip)
            .limit(limitNum)
            .populate('createdBy', 'name email')
            .select('-__v'),
        Advert.countDocuments(query)
    ]);

    (res as AppResponse).data(
        {
            adverts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        },
        'Adverts retrieved successfully'
    );
});

// @desc    Get single advert
// @route   GET /api/v1/adverts/:id
// @access  Public
export const getAdvert = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const advert = await Advert.findById(req.params.id)
        .populate('createdBy', 'name email');

    if (!advert) {
        return next(new AppError('Advert not found', 404));
    }

    (res as AppResponse).data({ advert }, 'Advert retrieved successfully');
});

// @desc    Create new advert with image upload
// @route   POST /api/v1/adverts
// @access  Private/Admin
export const createAdvert = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }

    // Validate required fields
    const { title } = req.body;
    if (!title) {
        return next(new AppError('Title is required', 400));
    }

    // Handle image upload
    if (!req.file) {
        return next(new AppError('Advert image is required', 400));
    }

    let imageUrl = '';
    try {
        const uploadResult = await CloudinaryService.uploadImage(req.file, 'go-kart/adverts');
        imageUrl = uploadResult.url;
    } catch (error: any) {
        return next(new AppError(`Image upload failed: ${error.message}`, 400));
    }

    // Create advert
    const advert = await Advert.create({
        ...req.body,
        image: imageUrl,
        createdBy: req.user.id
    });

    (res as AppResponse).data(
        { advert },
        'Advert created successfully',
        201
    );
});

// @desc    Update advert with optional image upload
// @route   PUT /api/v1/adverts/:id
// @access  Private/Admin
export const updateAdvert = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    let advert = await Advert.findById(req.params.id);

    if (!advert) {
        return next(new AppError('Advert not found', 404));
    }

    // Handle image upload if new image is provided
    if (req.file) {
        try {
            // Delete old image
            if (advert.image) {
                await CloudinaryService.deleteImage(advert.image);
            }

            // Upload new image
            const uploadResult = await CloudinaryService.uploadImage(req.file, 'go-kart/adverts');
            req.body.image = uploadResult.url;
        } catch (error: any) {
            return next(new AppError(`Image upload failed: ${error.message}`, 400));
        }
    }

    advert = await Advert.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    (res as AppResponse).data({ advert }, 'Advert updated successfully');
});

// @desc    Delete advert
// @route   DELETE /api/v1/adverts/:id
// @access  Private/Admin
export const deleteAdvert = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // if (!req.user?.isAdmin) {
    //     return next(new AppError('Not authorized to perform this action', 403));
    // }

    const advert = await Advert.findById(req.params.id);

    if (!advert) {
        return next(new AppError('Advert not found', 404));
    }

    // Delete image from Cloudinary
    if (advert.image) {
        try {
            await CloudinaryService.deleteImage(advert.image);
        } catch (error) {
            console.error('Error deleting advert image:', error);
        }
    }

    await advert.deleteOne();

    (res as AppResponse).success('Advert deleted successfully');
});

// @desc    Toggle advert status
// @route   PATCH /api/v1/adverts/:id/toggle
// @access  Private/Admin
export const toggleAdvertStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const advert = await Advert.findById(req.params.id);

    if (!advert) {
        return next(new AppError('Advert not found', 404));
    }

    advert.isActive = !advert.isActive;
    await advert.save();

    const status = advert.isActive ? 'activated' : 'deactivated';

    (res as AppResponse).data(
        { advert },
        `Advert ${status} successfully`
    );
});

// @desc    Track advert click
// @route   POST /api/v1/adverts/:id/click
// @access  Public
export const trackAdvertClick = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const advert = await Advert.findById(req.params.id);

    if (!advert) {
        return next(new AppError('Advert not found', 404));
    }

    // Increment click count
    advert.clicks += 1;
    await advert.save();

    (res as AppResponse).data(
        { 
            targetUrl: advert.targetUrl,
            clicks: advert.clicks
        },
        'Click tracked successfully'
    );
});

// @desc    Get advert statistics
// @route   GET /api/v1/adverts/stats
// @access  Private/Admin
export const getAdvertStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const now = new Date();

    const [activeCount, totalClicks, topAdverts] = await Promise.all([
        Advert.countDocuments({ isActive: true }),
        Advert.aggregate([
            { $group: { _id: null, total: { $sum: '$clicks' } } }
        ]),
        Advert.find()
            .sort({ clicks: -1 })
            .limit(5)
            .select('title clicks image')
    ]);

    (res as AppResponse).data(
        {
            activeAdverts: activeCount,
            totalClicks: totalClicks[0]?.total || 0,
            topAdverts
        },
        'Advert statistics retrieved successfully'
    );
});

// @desc    Reorder adverts
// @route   PUT /api/v1/adverts/reorder
// @access  Private/Admin
export const reorderAdverts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
        return next(new AppError('Not authorized to perform this action', 403));
    }

    const { orderList } = req.body;

    if (!Array.isArray(orderList)) {
        return next(new AppError('Order list must be an array', 400));
    }

    const bulkOps = orderList.map(({ id, position }) => ({
        updateOne: {
            filter: { _id: id },
            update: { position }
        }
    }));

    await Advert.bulkWrite(bulkOps);

    const adverts = await Advert.find({ isActive: true }).sort({ position: 1 });

    (res as AppResponse).data(
        { adverts },
        'Adverts reordered successfully'
    );
});