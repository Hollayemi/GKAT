import { Router } from 'express';
import {
    getAllPlans,
    getPlan,
    createPlan,
    updatePlan,
    togglePlan,
    deletePlan,
    getAllSubscriptions
} from '../../controllers/admin/subscriptionPlanController';
import { protect, checkPermission } from '../../middleware/auth';


const router = Router();

router.use(protect);

router.get('/subscriptions', checkPermission('view_financial_dashboard'), getAllSubscriptions);
 
router.get('/', checkPermission('view_financial_dashboard'), getAllPlans);
router.get('/:id', checkPermission('view_financial_dashboard'), getPlan);
router.post('/', checkPermission('manage_promotions'), createPlan);
router.put('/:id', checkPermission('manage_promotions'), updatePlan);
router.patch('/:id/toggle', checkPermission('manage_promotions'), togglePlan);
router.delete('/:id', checkPermission('manage_promotions'), deletePlan);

export default router;