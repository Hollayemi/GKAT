import { Types } from "mongoose";

const salesReveniuePipeline = (productId: Types.ObjectId) => [
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
]


const salesTrendPipeline = (productId: Types.ObjectId, fourMonthsAgo: Date) => [
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


const lastMonthSalesPipeline = (productId: Types.ObjectId, lastMonth: Date, twoMonthsAgo: Date) => [
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
]


const previousMonthSalesPipeline = (productId: Types.ObjectId, twoMonthsAgo: Date, lastMonth: Date) => [
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


const stockHistoryPipeline = (productId: Types.ObjectId, daysAgo: Date) => [
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


const getStockHistoryPipeline = (productId: Types.ObjectId, daysAgo: Date, skip: number, limit: number) => [
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
export {
    salesReveniuePipeline,
    salesTrendPipeline,
    lastMonthSalesPipeline,
    previousMonthSalesPipeline,
    stockHistoryPipeline,
    getStockHistoryPipeline
};