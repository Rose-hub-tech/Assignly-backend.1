import { Router } from 'express';
import { protect } from '../routes/Controllers/Middleware/authMiddleware.js'; // Your authentication middleware
import Subscription from '../subscription.js';
import User from '../user.js';
import { handlePayPalWebhook } from './Controllers/subscriptionController.js';
import { checkSubscription } from './Controllers/Middleware/subscriptionCheck.js';
import { getTasks } from './Controllers/subscriptionController.js';

const router = Router();

// Endpoint to receive PayPal webhook notifications
router.post("/paypal/webhook", async (req, res) => {
    const event = req.body;
    console.log("Received PayPal webhook event:", event.event_type);

    try {
        const userId = event.resource.custom_id;

        if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

            // Find the user's subscription or create a new one
            const sub = await Subscription.findOneAndUpdate(
                { userId: userId },
                { status: 'active', expiresAt: expiresAt },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Link the subscription to the user's profile
            await User.findByIdAndUpdate(userId, { subscription: sub._id, trialsUsed: 0 });

            console.log(`Subscription for user ${userId} activated/renewed automatically.`);
        }

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook processing failed:", err);
        res.status(500).send("Error");
    }
});

// Frontend endpoint to check user's status for the UI
router.get("/api/subscription", checkSubscription, handlePayPalWebhook, protect, getTasks, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('subscription');

        if (!user) {
            return res.status(404).json({ active: false });
        }

        if (user.subscription && user.subscription.status === 'active' && user.subscription.expiresAt > new Date()) {
            return res.json({ active: true, expiresAt: user.subscription.expiresAt });
        }

        // If no active subscription, return trial info
        return res.json({ active: false, trialsUsed: user.trialsUsed });

    } catch (err) {
        console.error("Subscription check failed:", err);
        res.status(500).json({ error: "Failed to check subscription status" });
    }
});

export default router;
