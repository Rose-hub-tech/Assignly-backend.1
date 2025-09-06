import Subscription from '../../../subscription.js';
import User from '../../../user.js';

const MAX_TRIALS = 7;

export const checkSubscription = async (req, res, next) => {
    try {
        const subscription = await Subscription.findOne({ userId: req.user.id });

        // Condition 1: Check for free trials
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.trialsUsed < MAX_TRIALS) {
            // Increment the trial count on the backend
            user.trialsUsed += 1;
            await user.save();
            return next(); // User still has trials left, grant access
        }

        // Condition 2: Check for an active, unexpired subscription
        if (subscription && subscription.status === 'active' && subscription.expiresAt > new Date()) {
            return next(); // User has an active subscription, grant access
        }

        // Condition 3: No subscription and no trials left
        return res.json({
            error: "Your free trials have expired. Please subscribe to view more tasks.",
            subscriptionRequired: true
        });

    } catch (err) {
        console.error("Subscription check failed:", err);
        res.json({ error: "An internal server error occurred." });
    }
};
