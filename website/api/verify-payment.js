// ─── Razorpay Payment Verification ───
// Vercel Serverless Function: POST /api/verify-payment
// Verifies HMAC signature to confirm payment is genuine.

const crypto = require('crypto');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            planId,
        } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Missing payment details' });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET || 'prmIZOuI0QMS0YXqQuBZEaub';

        // Verify HMAC SHA256 signature
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex');

        const isValid = expectedSignature === razorpay_signature;

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed — signature mismatch',
            });
        }

        // Payment verified — return success
        // The client (app) will activate premium via Firebase client SDK
        // For website purchases, the payment is recorded in Razorpay dashboard
        return res.status(200).json({
            success: true,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            planId: planId || 'unknown',
            message: 'Payment verified successfully',
        });
    } catch (err) {
        console.error('Verify payment error:', err);
        return res.status(500).json({ success: false, error: 'Verification failed', details: err.message });
    }
};
