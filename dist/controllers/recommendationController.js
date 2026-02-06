"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrequentlyBoughtTogether = exports.getSimilarProducts = exports.getRecommendationsByCategory = exports.getTrendingProducts = exports.getOrderBasedRecommendations = exports.getCartBasedRecommendations = exports.getPersonalizedRecommendations = void 0;
const Product_1 = __importDefault(require("../models/admin/Product"));
const Cart_1 = __importDefault(require("../models/Cart"));
const Orders_1 = __importDefault(require("../models/Orders"));
const error_1 = require("../middleware/error");
// @desc    Get personalized recommendations for user
// @route   GET /api/v1/recommendations/for-you
// @access  Private
exports.getPersonalizedRecommendations = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    // Get user's order history to find categories they've purchased from
    const orders = await Orders_1.default.find({
        userId: req.user.id,
        orderStatus: { $in: ['delivered', 'confirmed', 'processing'] }
    }).select('items').limit(20);
    // Extract categories from order items
    const categoryMap = new Map();
    orders.forEach(order => {
        order.items.forEach(item => {
            const count = categoryMap.get(item.category) || 0;
            categoryMap.set(item.category, count + item.quantity);
        });
    });
    // Sort categories by frequency
    const topCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category]) => category);
    // Get user's cart history
    const cart = await Cart_1.default.findOne({ userId: req.user.id, isActive: true });
    if (cart && cart.items.length > 0) {
        cart.items.forEach(item => {
            if (!topCategories.includes(item.category) && topCategories.length < 5) {
                topCategories.push(item.category);
            }
        });
    }
    // Get product IDs user has already purchased or in cart
    const purchasedProductIds = new Set();
    orders.forEach(order => {
        order.items.forEach(item => {
            purchasedProductIds.add(item.productId.toString());
        });
    });
    if (cart) {
        cart.items.forEach(item => {
            purchasedProductIds.add(item.productId.toString());
        });
    }
    // Find recommended products from top categories
    const recommendations = await Product_1.default.find({
        category: { $in: topCategories },
        _id: { $nin: Array.from(purchasedProductIds) },
        status: 'active',
        stockQuantity: { $gt: 0 }
    })
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .select('-__v');
    res.data({
        recommendations,
        basedOn: topCategories,
        count: recommendations.length
    }, 'Personalized recommendations retrieved successfully');
});
// @desc    Get recommendations based on cart
// @route   GET /api/v1/recommendations/cart-based
// @access  Private
exports.getCartBasedRecommendations = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    const cart = await Cart_1.default.findOne({ userId: req.user.id, isActive: true });
    if (!cart || cart.items.length === 0) {
        return res.data({ recommendations: [], count: 0 }, 'No cart items to base recommendations on');
    }
    // Extract categories and product IDs from cart
    const categories = Array.from(new Set(cart.items.map(item => item.category)));
    const cartProductIds = cart.items.map(item => item.productId.toString());
    // Find similar products from same categories
    const recommendations = await Product_1.default.find({
        category: { $in: categories },
        _id: { $nin: cartProductIds },
        status: 'active',
        stockQuantity: { $gt: 0 }
    })
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .select('-__v');
    res.data({
        recommendations,
        basedOn: categories,
        count: recommendations.length
    }, 'Cart-based recommendations retrieved successfully');
});
// @desc    Get recommendations based on order history
// @route   GET /api/v1/recommendations/order-based
// @access  Private
exports.getOrderBasedRecommendations = (0, error_1.asyncHandler)(async (req, res, next) => {
    if (!req.user) {
        return next(new error_1.AppError('Not authenticated', 401));
    }
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    // Get user's recent orders
    const orders = await Orders_1.default.find({
        userId: req.user.id,
        orderStatus: { $in: ['delivered', 'confirmed'] }
    })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('items');
    if (orders.length === 0) {
        return res.data({ recommendations: [], count: 0 }, 'No order history to base recommendations on');
    }
    // Extract frequently purchased categories
    const categoryFrequency = new Map();
    const purchasedProductIds = new Set();
    orders.forEach(order => {
        order.items.forEach(item => {
            const freq = categoryFrequency.get(item.category) || 0;
            categoryFrequency.set(item.category, freq + item.quantity);
            purchasedProductIds.add(item.productId.toString());
        });
    });
    const topCategories = Array.from(categoryFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => category);
    // Find products from frequently purchased categories
    const recommendations = await Product_1.default.find({
        category: { $in: topCategories },
        _id: { $nin: Array.from(purchasedProductIds) },
        status: 'active',
        stockQuantity: { $gt: 0 }
    })
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .select('-__v');
    res.data({
        recommendations,
        basedOn: topCategories,
        count: recommendations.length
    }, 'Order-based recommendations retrieved successfully');
});
// @desc    Get trending products
// @route   GET /api/v1/recommendations/trending
// @access  Public
exports.getTrendingProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { limit = 10, days = 7 } = req.query;
    const limitNum = parseInt(limit);
    const daysNum = parseInt(days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
    // Aggregate orders to find trending products
    const trendingProducts = await Orders_1.default.aggregate([
        {
            $match: {
                createdAt: { $gte: cutoffDate },
                orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
            }
        },
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.productId',
                totalQuantity: { $sum: '$items.quantity' },
                totalOrders: { $sum: 1 }
            }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: limitNum }
    ]);
    const productIds = trendingProducts.map(item => item._id);
    // Get full product details
    const products = await Product_1.default.find({
        _id: { $in: productIds },
        status: 'active',
        stockQuantity: { $gt: 0 }
    }).select('-__v');
    // Combine with sales data
    const productsWithStats = products.map(product => {
        const stats = trendingProducts.find(t => t._id.toString() === product._id.toString());
        return {
            ...product.toObject(),
            trending: {
                totalQuantitySold: stats?.totalQuantity || 0,
                totalOrders: stats?.totalOrders || 0
            }
        };
    });
    res.data({
        products: productsWithStats,
        count: productsWithStats.length
    }, 'Trending products retrieved successfully');
});
// @desc    Get recommendations by category
// @route   GET /api/v1/recommendations/by-category/:category
// @access  Public
exports.getRecommendationsByCategory = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { category } = req.params;
    const { limit = 10, excludeIds } = req.query;
    const limitNum = parseInt(limit);
    const query = {
        category,
        status: 'active',
        stockQuantity: { $gt: 0 }
    };
    // Exclude specific product IDs if provided
    if (excludeIds) {
        const idsArray = excludeIds.split(',');
        query._id = { $nin: idsArray };
    }
    const recommendations = await Product_1.default.find(query)
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .select('-__v');
    res.data({
        recommendations,
        category,
        count: recommendations.length
    }, 'Category-based recommendations retrieved successfully');
});
// @desc    Get similar products
// @route   GET /api/v1/recommendations/similar/:productId
// @access  Public
exports.getSimilarProducts = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { productId } = req.params;
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    const product = await Product_1.default.findById(productId);
    if (!product) {
        return next(new error_1.AppError('Product not found', 404));
    }
    // Find similar products in the same category with similar price range
    const priceRange = product.salesPrice * 0.3; // 30% price range
    const similarProducts = await Product_1.default.find({
        _id: { $ne: productId },
        category: product.category,
        salesPrice: {
            $gte: product.salesPrice - priceRange,
            $lte: product.salesPrice + priceRange
        },
        status: 'active',
        stockQuantity: { $gt: 0 }
    })
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .select('-__v');
    res.data({
        recommendations: similarProducts,
        basedOn: {
            productId: product._id,
            productName: product.productName,
            category: product.category,
            priceRange: {
                min: product.salesPrice - priceRange,
                max: product.salesPrice + priceRange
            }
        },
        count: similarProducts.length
    }, 'Similar products retrieved successfully');
});
// @desc    Get frequently bought together
// @route   GET /api/v1/recommendations/bought-together/:productId
// @access  Public
exports.getFrequentlyBoughtTogether = (0, error_1.asyncHandler)(async (req, res, next) => {
    const { productId } = req.params;
    const { limit = 5 } = req.query;
    const limitNum = parseInt(limit);
    // Find orders containing this product
    const orders = await Orders_1.default.find({
        'items.productId': productId,
        orderStatus: { $in: ['confirmed', 'delivered'] }
    }).select('items').limit(50);
    // Count occurrences of other products
    const productFrequency = new Map();
    orders.forEach(order => {
        const hasTargetProduct = order.items.some(item => item.productId.toString() === productId);
        if (hasTargetProduct) {
            order.items.forEach(item => {
                const id = item.productId.toString();
                if (id !== productId) {
                    const count = productFrequency.get(id) || 0;
                    productFrequency.set(id, count + 1);
                }
            });
        }
    });
    // Get top products
    const topProductIds = Array.from(productFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limitNum)
        .map(([id]) => id);
    const recommendations = await Product_1.default.find({
        _id: { $in: topProductIds },
        status: 'active',
        stockQuantity: { $gt: 0 }
    }).select('-__v');
    res.data({
        recommendations,
        count: recommendations.length
    }, 'Frequently bought together products retrieved successfully');
});
//# sourceMappingURL=recommendationController.js.map