import User from '../../../user.js';
import dotenv from 'dotenv';
dotenv.config();

const MAX_TRIALS = 7;

const checkAccessMiddleware = async (req, res, next) => {
    try {
        // 0. Ensure req.user exists
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized: User not found or not logged in." });
        }

        // 1. Get the user from the DB, including subscription info
        const user = await User.findById(req.user._id).populate('subscription');

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // 2. Check for an active subscription
        if (user.subscription && user.subscription.status === 'active' && user.subscription.expiresAt > new Date()) {
            return next(); // User has an active, unexpired subscription
        }

        // 3. If no subscription, check the trial count
        if (user.trialsUsed < MAX_TRIALS) {
            // User is within their trial limit, increment the count and grant access
            user.trialsUsed += 1;
            await user.save();
            return next();
        }

        // 4. If the trial limit is reached, deny access
        return res.status(402).json({ error: "Your free trials are over. Please subscribe to continue." });

    } catch (error) {
        console.error("Access check failed:", error);
        return res.status(500).json({ error: "An internal server error occurred." });
    }
};

export default checkAccessMiddleware;
