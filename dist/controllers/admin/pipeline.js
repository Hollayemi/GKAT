"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockHistoryPipeline = exports.stockHistoryPipeline = exports.previousMonthSalesPipeline = exports.lastMonthSalesPipeline = exports.salesTrendPipeline = exports.salesReveniuePipeline = void 0;
const salesReveniuePipeline = (productId) => [
    {
        $match: {
            'items.productId': productId,
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $group: {
            _id: null,
            totalSales: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
            totalQuantitySold: { $sum: '$items.quantity' },
            totalOrders: { $sum: 1 }
        }
    }
];
exports.salesReveniuePipeline = salesReveniuePipeline;
const salesTrendPipeline = (productId, fourMonthsAgo) => [
    {
        $match: {
            'items.productId': productId,
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: fourMonthsAgo }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $group: {
            _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
            },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
            quantity: { $sum: '$items.quantity' }
        }
    },
    {
        $sort: { '_id.year': 1, '_id.month': 1 }
    },
    {
        $project: {
            _id: 0,
            month: {
                $concat: [
                    { $toString: '$_id.year' },
                    '-',
                    { $toString: '$_id.month' }
                ]
            },
            revenue: 1,
            quantity: 1
        }
    }
];
exports.salesTrendPipeline = salesTrendPipeline;
const lastMonthSalesPipeline = (productId, lastMonth, twoMonthsAgo) => [
    {
        $match: {
            'items.productId': productId,
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: lastMonth }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $group: {
            _id: null,
            total: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
    }
];
exports.lastMonthSalesPipeline = lastMonthSalesPipeline;
const previousMonthSalesPipeline = (productId, twoMonthsAgo, lastMonth) => [
    {
        $match: {
            'items.productId': productId,
            orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
            createdAt: { $gte: twoMonthsAgo, $lt: lastMonth }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $group: {
            _id: null,
            total: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
    }
];
exports.previousMonthSalesPipeline = previousMonthSalesPipeline;
const stockHistoryPipeline = (productId, daysAgo) => [
    {
        $match: {
            'items.productId': productId,
            createdAt: { $gte: daysAgo }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $project: {
            date: {
                $dateToString: {
                    format: '%d/%m/%Y',
                    date: '$createdAt'
                }
            },
            action: {
                $cond: {
                    if: { $in: ['$orderStatus', ['confirmed', 'processing', 'shipped', 'delivered']] },
                    then: 'Stock Reduced',
                    else: 'Stock Added'
                }
            },
            quantity: {
                $cond: {
                    if: { $in: ['$orderStatus', ['cancelled', 'returned']] },
                    then: '$items.quantity',
                    else: { $multiply: ['$items.quantity', -1] }
                }
            }
        }
    },
    {
        $sort: { date: -1 }
    },
    {
        $limit: 10
    }
];
exports.stockHistoryPipeline = stockHistoryPipeline;
const getStockHistoryPipeline = (productId, daysAgo, skip, limit) => [
    {
        $match: {
            'items.productId': productId,
            createdAt: { $gte: daysAgo }
        }
    },
    {
        $unwind: '$items'
    },
    {
        $match: {
            'items.productId': productId
        }
    },
    {
        $project: {
            date: {
                $dateToString: {
                    format: '%d/%m/%Y',
                    date: '$createdAt'
                }
            },
            action: {
                $cond: {
                    if: { $in: ['$orderStatus', ['cancelled', 'returned']] },
                    then: 'Stock Added',
                    else: 'Stock Reduced'
                }
            },
            quantity: {
                $cond: {
                    if: { $in: ['$orderStatus', ['cancelled', 'returned']] },
                    then: '$items.quantity',
                    else: { $multiply: ['$items.quantity', -1] }
                }
            },
            orderNumber: 1,
            orderStatus: 1
        }
    },
    {
        $sort: { date: -1 }
    },
    {
        $facet: {
            history: [
                { $skip: skip },
                { $limit: Number(limit) }
            ],
            total: [
                { $count: 'count' }
            ]
        }
    }
];
exports.getStockHistoryPipeline = getStockHistoryPipeline;
//# sourceMappingURL=pipeline.js.map