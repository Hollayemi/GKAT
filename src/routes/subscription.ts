import { Router } from 'express';
import {
    getActivePlans,
    getMySubscription,
    getSubscriptionHistory,
    subscribeToPlan,
    cancelSubscription,
    verifySubscriptionPayment
} from '../controllers/subscriptionController';
import {
    getAllPlans,
    getPlan,
    createPlan,
    updatePlan,
    togglePlan,
    deletePlan,
    getAllSubscriptions
} from '../controllers/admin/subscriptionPlanController';
import { protect, checkPermission } from '../middleware/auth';


const router = Router();

// Public
router.get('/plans', getActivePlans);

// Protected
router.use(protect);

router.get('/my-subscription', getMySubscription);
router.get('/history', getSubscriptionHistory);
router.post('/subscribe', subscribeToPlan);
router.post('/cancel', cancelSubscription);
router.post('/verify-payment', verifySubscriptionPayment);



// Admin routes
// Subscriber list (admin view)
router.get('/subscriptions', checkPermission('view_financial_dashboard'), getAllSubscriptions);
 
// Plan CRUD
router.get('/', checkPermission('view_financial_dashboard'), getAllPlans);
router.get('/:id', checkPermission('view_financial_dashboard'), getPlan);
router.post('/', checkPermission('manage_promotions'), createPlan);
router.put('/:id', checkPermission('manage_promotions'), updatePlan);
router.patch('/:id/toggle', checkPermission('manage_promotions'), togglePlan);
router.delete('/:id', checkPermission('manage_promotions'), deletePlan);

export default router;