"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNigeriaStates = void 0;
const error_1 = require("../../middleware/error");
const nigeriaStates_1 = __importDefault(require("../../models/config/nigeriaStates"));
exports.getNigeriaStates = (0, error_1.asyncHandler)(async (req, res, next) => {
    const states = await nigeriaStates_1.default.find().exec();
    res.data(states, 'Nigeria states retrieved successfully');
});
//# sourceMappingURL=nigeriaStates.js.map