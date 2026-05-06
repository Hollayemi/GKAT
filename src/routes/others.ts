import { Router } from 'express';
import {
    getNigeriaStates,
    getBanks
} from '../controllers/others/nigeriaStates';

const router = Router();

// Public routes
router.get('/nigeria-states', getNigeriaStates);
router.get('/banks', getBanks);

export default router;