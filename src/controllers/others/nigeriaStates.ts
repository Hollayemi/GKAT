import { Request, Response, NextFunction } from 'express';
import { AppError, AppResponse, asyncHandler } from "../../middleware/error";
import NigeriaStates from '../../models/config/nigeriaStates';
import {Banks} from '../../models/config/banks.model';

export const getNigeriaStates = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const states = await NigeriaStates.find().exec();
    (res as AppResponse).data(states, 'Nigeria states retrieved successfully');
});

export const getBanks = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const banks = await Banks.find().exec();
    (res as AppResponse).data(banks, 'Nigeria Banks retrieved successfully');
});