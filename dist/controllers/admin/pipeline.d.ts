import { Types } from "mongoose";
declare const salesReveniuePipeline: (productId: Types.ObjectId) => ({
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus: {
            $in: string[];
        };
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $group?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus?: undefined;
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $group: {
        _id: null;
        totalSales: {
            $sum: {
                $multiply: string[];
            };
        };
        totalQuantitySold: {
            $sum: string;
        };
        totalOrders: {
            $sum: number;
        };
    };
    $match?: undefined;
    $unwind?: undefined;
})[];
declare const salesTrendPipeline: (productId: Types.ObjectId, fourMonthsAgo: Date) => ({
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus: {
            $in: string[];
        };
        createdAt: {
            $gte: Date;
        };
    };
    $unwind?: undefined;
    $group?: undefined;
    $sort?: undefined;
    $project?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $group?: undefined;
    $sort?: undefined;
    $project?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus?: undefined;
        createdAt?: undefined;
    };
    $unwind?: undefined;
    $group?: undefined;
    $sort?: undefined;
    $project?: undefined;
} | {
    $group: {
        _id: {
            year: {
                $year: string;
            };
            month: {
                $month: string;
            };
        };
        revenue: {
            $sum: {
                $multiply: string[];
            };
        };
        quantity: {
            $sum: string;
        };
    };
    $match?: undefined;
    $unwind?: undefined;
    $sort?: undefined;
    $project?: undefined;
} | {
    $sort: {
        '_id.year': number;
        '_id.month': number;
    };
    $match?: undefined;
    $unwind?: undefined;
    $group?: undefined;
    $project?: undefined;
} | {
    $project: {
        _id: number;
        month: {
            $concat: (string | {
                $toString: string;
            })[];
        };
        revenue: number;
        quantity: number;
    };
    $match?: undefined;
    $unwind?: undefined;
    $group?: undefined;
    $sort?: undefined;
})[];
declare const lastMonthSalesPipeline: (productId: Types.ObjectId, lastMonth: Date, twoMonthsAgo: Date) => ({
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus: {
            $in: string[];
        };
        createdAt: {
            $gte: Date;
        };
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $group?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus?: undefined;
        createdAt?: undefined;
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $group: {
        _id: null;
        total: {
            $sum: {
                $multiply: string[];
            };
        };
    };
    $match?: undefined;
    $unwind?: undefined;
})[];
declare const previousMonthSalesPipeline: (productId: Types.ObjectId, twoMonthsAgo: Date, lastMonth: Date) => ({
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus: {
            $in: string[];
        };
        createdAt: {
            $gte: Date;
            $lt: Date;
        };
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $group?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        orderStatus?: undefined;
        createdAt?: undefined;
    };
    $unwind?: undefined;
    $group?: undefined;
} | {
    $group: {
        _id: null;
        total: {
            $sum: {
                $multiply: string[];
            };
        };
    };
    $match?: undefined;
    $unwind?: undefined;
})[];
declare const stockHistoryPipeline: (productId: Types.ObjectId, daysAgo: Date) => ({
    $match: {
        'items.productId': Types.ObjectId;
        createdAt: {
            $gte: Date;
        };
    };
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $limit?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $limit?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        createdAt?: undefined;
    };
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $limit?: undefined;
} | {
    $project: {
        date: {
            $dateToString: {
                format: string;
                date: string;
            };
        };
        action: {
            $cond: {
                if: {
                    $in: (string | string[])[];
                };
                then: string;
                else: string;
            };
        };
        quantity: {
            $cond: {
                if: {
                    $in: (string | string[])[];
                };
                then: string;
                else: {
                    $multiply: (string | number)[];
                };
            };
        };
    };
    $match?: undefined;
    $unwind?: undefined;
    $sort?: undefined;
    $limit?: undefined;
} | {
    $sort: {
        date: number;
    };
    $match?: undefined;
    $unwind?: undefined;
    $project?: undefined;
    $limit?: undefined;
} | {
    $limit: number;
    $match?: undefined;
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
})[];
declare const getStockHistoryPipeline: (productId: Types.ObjectId, daysAgo: Date, skip: number, limit: number) => ({
    $match: {
        'items.productId': Types.ObjectId;
        createdAt: {
            $gte: Date;
        };
    };
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $facet?: undefined;
} | {
    $unwind: string;
    $match?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $facet?: undefined;
} | {
    $match: {
        'items.productId': Types.ObjectId;
        createdAt?: undefined;
    };
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
    $facet?: undefined;
} | {
    $project: {
        date: {
            $dateToString: {
                format: string;
                date: string;
            };
        };
        action: {
            $cond: {
                if: {
                    $in: (string | string[])[];
                };
                then: string;
                else: string;
            };
        };
        quantity: {
            $cond: {
                if: {
                    $in: (string | string[])[];
                };
                then: string;
                else: {
                    $multiply: (string | number)[];
                };
            };
        };
        orderNumber: number;
        orderStatus: number;
    };
    $match?: undefined;
    $unwind?: undefined;
    $sort?: undefined;
    $facet?: undefined;
} | {
    $sort: {
        date: number;
    };
    $match?: undefined;
    $unwind?: undefined;
    $project?: undefined;
    $facet?: undefined;
} | {
    $facet: {
        history: ({
            $skip: number;
            $limit?: undefined;
        } | {
            $limit: number;
            $skip?: undefined;
        })[];
        total: {
            $count: string;
        }[];
    };
    $match?: undefined;
    $unwind?: undefined;
    $project?: undefined;
    $sort?: undefined;
})[];
export { salesReveniuePipeline, salesTrendPipeline, lastMonthSalesPipeline, previousMonthSalesPipeline, stockHistoryPipeline, getStockHistoryPipeline };
//# sourceMappingURL=pipeline.d.ts.map