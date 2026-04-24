// ─── Razorpay Order Creation ───
// Vercel Serverless Function: POST /api/create-order
// Creates a Razorpay order and returns order_id to the client.

const Razorpay = require('razorpay');

// Plan prices in paise (₹ × 100)
const PLAN_PRICES = {
    standard: 9900,
    premium: 19900,
    premium_plus: 29900,
    elite: 39900,
    super: 49900,
    vip: 99900,
};

const PLAN_NAMES = {
    standard: 'Standard',
    premium: 'Premium',
    premium_plus: 'Premium+',
    elite: 'Elite',
    super: 'Super',
    vip: 'VIP',
};

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { planId } = req.body;

        if (!planId || !PLAN_PRICES[planId]) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }

        const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_Sdm1Maa8AVpLOG';
        const keySecret = process.env.RAZORPAY_KEY_SECRET || 'prmIZOuI0QMS0YXqQuBZEaub';

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

        const order = await razorpay.orders.create({
            amount: PLAN_PRICES[planId],
            currency: 'INR',
            receipt: `banana_${planId}_${Date.now()}`,
            notes: {
                planId,
                planName: PLAN_NAMES[planId],
                app: 'Banana Chat',
            },
        });

        return res.status(200).json({
            success: true,
            order_id: order.id,
            key_id: keyId,
            amount: PLAN_PRICES[planId],
            currency: 'INR',
            planId,
            planName: PLAN_NAMES[planId],
        });
    } catch (err) {
        console.error('Create order error:', err);
        return res.status(500).json({ error: 'Failed to create order', details: err.message });
    }
};
