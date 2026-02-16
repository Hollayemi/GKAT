"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nigeriaStates_1 = require("../controllers/others/nigeriaStates");
const router = (0, express_1.Router)();
// Public routes
router.get('/nigeria-states', nigeriaStates_1.getNigeriaStates);
exports.default = router;
//# sourceMappingURL=others.js.map