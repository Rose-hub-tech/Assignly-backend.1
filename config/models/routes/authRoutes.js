/**
 * @file authRoutes.js
 * @description Authentication routes for user registration, verification, and login.
 * Includes secure email verification flow, password hashing, and JWT authentication.
 */

// --- Imports ---
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import crypto from "crypto";
import Joi from "joi";
import User from "../user.js"; // Assuming your User model is in a parent 
import { registerUser, loginUser, verifyCode } from "./Controllers/authController.js";


// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // Use 'true' if port is 465 (SSL/TLS)
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
    },
});

// --- HELPER FUNCTIONS ---

/**
 * Handles server-side errors and sends a generic response.
 * @param {object} res The Express response object.
 * @param {Error} err The error object.
 * @param {string} context A string describing the context of the error (e.g., "Registration").
 */
const handleError = (res, err, context) => {
    console.error(`❌ ${context} error:`, err);
    return res.status(500).json({
        success: false,
        error: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
    });
};

/**
 * Sends a verification email to the user.
 * @param {string} email The user's email address.
 * @param {string} code The 6-digit verification code.
 */
const sendVerificationEmail = async (email, code) => {
    try {
        await transporter.sendMail({
            from: process.env.NODEMAILER_USER,
            to: email,
            subject: "Verify Your Email Address",
            html: `
                <p>Your verification code is: <strong>${code}</strong></p>
                <p>This code is valid for 15 minutes.</p>
            `,
        });
        console.log(`✅ Verification email sent to ${email}`);
    } catch (err) {
        console.error(`❌ Failed to send email to ${email}:`, err);
        throw new Error("Failed to send verification email.");
    }
};

// --- VALIDATION SCHEMAS ---

/** Joi schema for user registration data validation. */
const registerSchema = Joi.object({
    fullName: Joi.string().trim().min(3).required(),
    email: Joi.string().email().trim().required(),
    username: Joi.string().alphanum().min(3).max(10).required(),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp("^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])"))
        .required()
        .messages({
            "string.pattern.base":
                "Password must contain at least one uppercase letter, one number, and one special character.",
        }),
});

/** Joi schema for email verification data validation. */
const verifySchema = Joi.object({
    email: Joi.string().email().trim().required(),
    code: Joi.string().length(6).required(),
});

/** Joi schema for user login data validation. */
const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
});

// --- ROUTES ---
const router = express.Router();

/**
 * POST /api/auth/register
 * Step 1: Validates user data, sends a verification email, and saves the user.
 */
router.post("/register", registerUser); async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map(d => d.message);
            return res.json({ success: false, errors: messages });
        }

        const { fullName, email, username, password } = value;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });

        if (existingUser) {
            return res.status(422).json({
                success: false,
                errors: ["User with these credentials already exists."],
            });
        }

        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const codeExpiration = new Date(Date.now() + 15 * 60 * 1000);

        // Send the verification email before saving
        await sendVerificationEmail(email, verificationCode);

        const hashedPassword = await bcrypt.hash(password, 8);
        const user = new User({
            fullName,
            email,
            username,
            password: hashedPassword,
            isVerified: false,
            verificationCode,
            codeExpiration,
        });
        await user.save();

        return res.status(201).json({
            success: true,
            message: "User created. A verification code has been sent to your email.",
        });
    } catch (err) {
        if (err.message === "Failed to send verification email.") {
            return res.status(500).json({ success: false, errors: [err.message] });
        }
        return handleError(res, err, "Registration");
    }
};

/**
 * POST /api/auth/verify-code
 * Step 2: Finalizes registration by verifying the code.
 */
router.post("/verifycode", verifyCode); async (req, res) => {
    try {
        const { error, value } = verifySchema.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map(d => d.message);
            return res.status(422).json({ success: false, errors: messages });
        }

        const { email, code } = value;
        const user = await User.findOne({ email });

        if (!user) return res.json({ success: false, errors: ["User not found."] });
        if (user.isVerified) {
            return res.status(422).json({ success: false, errors: ["User already verified."] });
        }
        if (user.verificationCode !== code) {
            return res.status(422).json({ success: false, errors: ["Invalid verification code."] });
        }
        if (user.codeExpiration < new Date()) {
            return res.status(422).json({ success: false, errors: ["Verification code has expired."] });
        }

        // Mark the user as verified and remove the temporary fields
        user.isVerified = true;
        user.verificationCode = undefined;
        user.codeExpiration = undefined;
        await user.save();

        return res.json({ success: true, message: "Email verified successfully!" });
    } catch (err) {
        return handleError(res, err, "Verification");
    }
};

/**
 * POST /api/auth/login
 * Handles user login and JWT generation.
 */
router.post("/login", loginUser); async (req, res) => {
    try {
        const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const messages = error.details.map(d => d.message);
            return res.status(422).json({ success: false, errors: messages });
        }

        const { username, password } = value;
        const user = await User.findOne({ username });

        if (!user) return res.status(422).json({ success: false, errors: ["Invalid credentials."] });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(422).json({ success: false, errors: ["Invalid credentials."] });

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                errors: ["Email not verified. Please check your inbox for the verification code."],
            });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "50m" }
        );

        return res.json({
            success: true,
            token,
            expiresIn: 50 * 60,
            user: {
                fullName: user.fullName,
                username: user.username,
                email: user.email,
            },
        });
    } catch (err) {
        return handleError(res, err, "Login");
    }
};

export default router;
