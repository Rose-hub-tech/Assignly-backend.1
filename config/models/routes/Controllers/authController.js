import User from "../../../models/user.js";
import bcrypt from "bcryptjs";
import generateToken from "../Controllers/Middleware/utils/generateToken.js";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.NODEMAILER_USER, // Your Gmail address from .env
        pass: process.env.NODEMAILER_PASS, // Your Gmail App Password from .env
    },
});

// --- Helper Function to Send Email ---
const sendVerificationEmail = async (email, verificationCode) => {
    try {
        const mailOptions = {
            from: process.env.NODEMAILER_USER,
            to: email,
            subject: "Assignly: Email Verification Code",
            html: `<p>Your email verification code is:</p>
               <h2>${verificationCode}</h2>
               <p>This code is valid for 10 minutes.</p>`,
        };
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error("❌ Error sending verification email:", err);
    }
};

// --- Updated Registration Logic ---
export const registerUser = async (req, res) => {
    const { fullName, email, username, password } = req.body;

    // Generate a 6-digit verification code and its expiry time
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    try {
        const exists = await User.findOne({ $or: [{ email }, { username }, { password }] });
        if (exists) {
            return res.status(409).json({ message: "User already exists." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        console.log("📥 Raw password before hashing:", password);
        console.log("🔑 Hashed password being saved:", hashed);


        // Create the user but set isVerified to false and store the code
        const user = await User.create({
            fullName,
            email,
            username,
            password,
            isVerified: false,
            verificationCode,
            verificationCodeExpires,
        });
        await user.save();

        // Send the verification email to the user
        await sendVerificationEmail(user.email, verificationCode);

        // Don't send a token yet, just a success message
        res.status(201).json({
            message: "By clicking OK, You agree to the terms of service.",
        });
    } catch (err) {
        console.error("❌ Registration error:", err);
        res.status(500).json({ message: "Registration failed." });
    }
};

export const loginUser = async (req, res) => {
    const { username, email, password } = req.body;
    console.log("📥 Login request:", { username, email, password });

    try {
        const user = await User.findOne({ $or: [{ email }, { username }, { password }] });
        console.log("🔍 Found user:", user);

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials (no user)." });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email to log in.",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("🔑 Password match?", isMatch);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials (wrong password)." });
        }

        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            username: user.username,
            password: user.password,
            token: generateToken(user._id),
        });
    } catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ message: "Login failed." });
    }
};

// --- NEW: Verification Logic ---
export const verifyCode = async (req, res) => {
    console.log("Incoming body:", req.body); // Debugging line

    const { email, verificationCode } = req.body;

    // Validate request body
    if (!email || !verificationCode) {
        console.log("❌ Missing email or verificationCode");
        return res.status(400).json({ error: "Email and code are required." });
    }

    try {
        const user = await User.findOne({ email });
        console.log("🔍 Found user:", user);

        // Check if user exists
        if (!user) {
            console.log("❌ No user with this email");
            return res.status(404).json({ error: "User not found." });
        }

        // Already verified?
        if (user.isVerified) {
            console.log("ℹ️ User already verified");
            return res.status(200).json({ message: "Email is already verified." });
        }

        // Expired code?
        console.log("🕑 Expiry:", user.verificationCodeExpires, "Now:", Date.now());
        if (user.verificationCodeExpires < Date.now()) {
            console.log("❌ Code expired");
            return res.status(400).json({ error: "Verification code has expired." });
        }

        // Code mismatch?
        console.log("👉 Comparing codes:", user.verificationCode, "vs", verificationCode);
        if (user.verificationCode !== verificationCode) {
            console.log("❌ Invalid verification code");
            return res.status(400).json({ error: "Invalid verification code." });
        }

        // ✅ Passed all checks → verify the user
        user.isVerified = true;
        user.verificationCode = undefined; // optional: clear code
        user.verificationCodeExpires = undefined;
        await user.save();

        console.log("✅ Verification successful");
        return res.status(200).json({ message: "Email verified successfully!" });

    } catch (error) {
        console.error("Error verifying code:", error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

export default { registerUser, loginUser, verifyCode };