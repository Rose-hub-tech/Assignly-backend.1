// db.js
import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://f97935875:Assignly123!@assignly-cluster.7sp7e6f.mongodb.net/?retryWrites=true&w=majority&appName=Assignly-cluster", {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
        process.exit(1);
    }
};

export default connectDB;
