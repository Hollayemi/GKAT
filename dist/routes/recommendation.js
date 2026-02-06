"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recommendationController_1 = require("../controllers/recommendationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.get('/trending', recommendationController_1.getTrendingProducts);
router.get('/by-category/:category', recommendationController_1.getRecommendationsByCategory);
router.get('/similar/:productId', recommendationController_1.getSimilarProducts);
router.get('/bought-together/:productId', recommendationController_1.getFrequentlyBoughtTogether);
// Protected routes (require authentication)
router.use(auth_1.protect);
router.get('/for-you', recommendationController_1.getPersonalizedRecommendations);
router.get('/cart-based', recommendationController_1.getCartBasedRecommendations);
router.get('/order-based', recommendationController_1.getOrderBasedRecommendations);
exports.default = router;
//# sourceMappingURL=recommendation.js.map