import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: {
        type: String,
        required: true, // This is the crucial line
        unique: true
    },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },             // add this
    verificationCodeExpires: { type: Date },        // add this
    trialsUsed: { type: Number, default: 0 },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', userSchema);
export default User;
