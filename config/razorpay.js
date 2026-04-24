// Razorpay Configuration
// Switch to live key when approved (just change this one line)
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

// Company/App details shown on checkout
export const RAZORPAY_CONFIG = {
    name: 'Banana Chat',
    description: 'Premium Subscription',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/banana-logo.png', // Update with your logo
    currency: 'INR',
    theme: {
        color: '#FFD60A',
        backdrop_color: '#0a0a0a',
    },
};
