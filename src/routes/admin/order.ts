import { Router } from 'express';
import {
  getAllOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
  transferOrder
} from '../../controllers/admin/orderController';

import { protect, authorize } from '../../middleware/auth';

const router = Router();

router.use(protect);

router.use(authorize('admin'));

router.get('/', getAllOrders);

router.get('/:orderNumber', getOrderById);

router.patch('/:orderNumber/status', updateOrderStatus);

router.patch('/:orderNumber/cancel', cancelOrder);

router.patch('/:orderNumber/transfer', transferOrder);

export default router;