// server.js
import dotenv from "dotenv";

import express from "express";
import session from "express-session";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

// Models
import Subscription from "./config/models/subscription.js";
import User from "./config/models/user.js";

// Routes & middleware
import authRoutes from "./config/models/routes/authRoutes.js";
import subscriptionRoutes from "./config/models/routes/subscriptionRoutes.js";
import taskRoutes from "./config/models/routes/taskRoutes.js";


dotenv.config();

const {
    MONGO_URI,
    PORT = 5000,
    SESSION_SECRET = "supersecretkey",
    NODE_ENV = "development",
} = process.env;

// --- Mongo Connection ---
if (!MONGO_URI) {
    console.error("❌ MONGO_URI environment variable is not set.");
    process.exit(1);
}
mongoose
    .connect(MONGO_URI, { autoIndex: true })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => {
        console.error("❌ Mongo error:", err);
        process.exit(1);
    });

// --- App setup ---
const app = express();

// IMPORTANT: Webhooks must be parsed BEFORE express.json()
app.post(
    "/api/paypal/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
        try {
            let event;
            try {
                if (!req.body || !req.body.length) {
                    console.warn("⚠️ Webhook body is empty");
                    return res.sendStatus(400);
                }
                event = JSON.parse(req.body.toString("utf8"));
            } catch (parseErr) {
                console.error("❌ Failed to parse webhook body:", parseErr);
                return res.sendStatus(400);
            }
            console.log("📩 PayPal event:", event.event_type);

            if (
                event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" ||
                event.event_type === "PAYMENT.CAPTURE.COMPLETED"
            ) {
                const userId =
                    event?.resource?.custom_id || event?.resource?.subscriber?.payer_id;
                if (!userId) {
                    console.warn("⚠️ Missing custom_id/payer_id on webhook resource");
                } else {
                    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    const subscription = await Subscription.findOneAndUpdate(
                        { userId },
                        { plan: "monthly", status: "active", expiresAt },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );

                    // Link the subscription to the user and reset trials
                    // Check if userId is a valid MongoDB ObjectId
                    let userUpdateResult;
                    if (mongoose.Types.ObjectId.isValid(userId)) {
                        userUpdateResult = await User.findByIdAndUpdate(userId, {
                            subscription: subscription._id,
                            trialsUsed: 0
                        });
                    } else {
                        // If not a valid ObjectId, try matching a custom field (e.g., paypalPayerId)
                        userUpdateResult = await User.findOneAndUpdate(
                            { paypalPayerId: userId },
                            { subscription: subscription._id, trialsUsed: 0 }
                        );
                    }

                    console.log(`✅ Subscription updated for user ${userId}`);
                }
            }

            return res.sendStatus(200);
        } catch (err) {
            console.error("❌ Webhook processing failed:", err);
            return res.sendStatus(500);
        }
    }
);
// --- Middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        "https://rose-hub-tech.github.io",  // ✅ works for your frontend
        "http://127.0.0.1:5500"             // ✅ local dev
    ],
    credentials: true
}));



app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: NODE_ENV === "production", // secure cookies only in production
            sameSite: NODE_ENV === "production" ? "none" : "lax"
        }

    })
);

// --- Main Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/tasks", taskRoutes);

// --- Simple Authentication Middleware ---
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        req.user = { id: req.session.userId };
        return next();
    }
    return res.status(401).json({ error: "Authentication required" });
}

// --- User Profile (for trialsUsed in frontend) ---
app.get("/api/user/profile", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) return res.status(404).json({ error: "User not found." });
        res.json(user);
    } catch (err) {
        console.error("❌ Error fetching user profile:", err.message);
        res.status(500).json({ error: "Failed to fetch profile." });
    }
});

// --- Health ---
app.get("/", (_req, res) => res.send("✅ Assignly Backend is running 🚀"));

// --- Start ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);

});
