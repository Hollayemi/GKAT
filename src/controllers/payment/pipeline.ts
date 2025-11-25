import { PipelineStage } from 'mongoose';

export const getOrdersPayment = (match: any): PipelineStage[] => [
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