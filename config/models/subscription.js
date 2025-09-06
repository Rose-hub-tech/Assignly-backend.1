// models/Subscription.js

import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    plan: {
        type: String,
        enum: ['monthly'], // We only have one plan right now
        default: 'monthly'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'canceled'],
        default: 'inactive'
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
