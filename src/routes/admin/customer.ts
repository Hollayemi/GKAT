import { Router } from "express";
import {
  getAllCustomers,
  getCustomerStats,
  getSingleCustomer,
  getCustomerOrders,
  exportCustomers,
} from "../../controllers/admin/customerController";

import { protect, authorize } from "../../middleware/auth";

const router = Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/", getAllCustomers);
router.get("/stats", getCustomerStats);
router.get("/export", exportCustomers);
router.get("/:id", getSingleCustomer);
router.get("/:id/orders", getCustomerOrders);

export default router;