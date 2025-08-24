import Razorpay from 'razorpay';
import crypto from 'crypto';


export const createOrder = async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const { RAZORPAY_KEY_SECRET } = process.env;
    if (!keyId || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay keys not configured on server' });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: RAZORPAY_KEY_SECRET });

    const { amount, currency = 'INR', receipt } = req.body || {};
    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount (in paise) is required' });
    }

    const options = {
      amount: Math.round(Number(amount)), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order, keyId });
  } catch (err) {
    console.error('[razorpay] createOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { RAZORPAY_KEY_SECRET } = process.env;
    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Razorpay secret not configured on server' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification payload' });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const valid = expectedSignature === razorpay_signature;

    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // No DB tracking; just confirm verification
    return res.json({ success: true, message: 'Payment verified' });
  } catch (err) {
    console.error('[razorpay] verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};
