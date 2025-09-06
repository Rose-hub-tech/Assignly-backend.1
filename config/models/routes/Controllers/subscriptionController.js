import Subscription from "../../subscription.js";
import { checkSubscription } from "../Controllers/Middleware/subscriptionCheck.js";

// --- PayPal Webhook ---
export const handlePayPalWebhook = async (req, res) => {
    try {
        console.log("PayPal webhook event received:", req.body);

        const { id, status, plan_id, subscriber } = req.body;

        const newSubscription = new Subscription({
            paypalId: id,
            status: status,
            planid: plan_id,
            subscriberEmail: subscriber.email_address,
        });

        await newSubscription.save();

        console.log("Subscription saved successfully!");
        res.sendStatus(200);
    } catch (error) {
        console.error("Error processing PayPal webhook:", error);
        res.sendStatus(500);
    }
};

// --- Get Tasks (with subscription check) ---
export const getTasks = async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            checkSubscription(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Replace with your actual DB call
        const task = await getTasksFromDatabase();

        res.status(200).json({
            message: "Tasks available.",
            data: task
        });
    } catch (error) {
        console.error("Error fetching Tasks.", error);
        res.status(500).json({ message: "Error fetching tasks" });
    }
};
