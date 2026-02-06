"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrdersPayment = void 0;
const getOrdersPayment = (match) => [
    {
        $unwind: {
            path: "$meta.orderIds",
            preserveNullAndEmptyArrays: false
        }
    },
    {
        $lookup: {
            from: "orders",
            localField: "meta.orderIds",
            foreignField: "_id",
            as: "orderInfo"
        }
    },
    {
        $unwind: {
            path: "$orderInfo",
            preserveNullAndEmptyArrays: false
        }
    },
    {
        $match: match
    }
];
exports.getOrdersPayment = getOrdersPayment;
//# sourceMappingURL=pipeline.js.map