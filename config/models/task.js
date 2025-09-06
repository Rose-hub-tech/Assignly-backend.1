import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    budget: { type: Number, required: true },
    description: { type: String, required: true },
    paymentLink: { type: String },
    taskLink: { type: String },
    submissionLink: { type: String },
    deadline: { type: Date },
    postedBy: { type: String, required: true } // ✅ Now stores username/email instead of ObjectId
}, { timestamps: true });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
export default Task;
