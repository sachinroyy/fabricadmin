import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller.js';

const router = Router();

// POST /api/payment/create-order
router.post('/create-order', createOrder);

// POST /api/payment/verify-payment
router.post('/verify-payment', verifyPayment);

export default router;
