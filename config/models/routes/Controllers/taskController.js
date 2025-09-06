// ✅ Correct import (make sure the path is right relative to this file)
import Task from "../../task.js";

// Create a new task
export const createTask = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: "Unauthorized: User not found" });
        }

        const task = await Task.create({
            ...req.body,
            postedBy: req.user._id   // ✅ always store ObjectId
        });

        console.log("📌 New task created:", task); // ✅ log in terminal
        res.status(201).json(task);
    } catch (err) {
        console.error("❌ Error creating task:", err);
        res.status(500).json({ message: err.message });
    }
};
export const getTasks = async (_req, res) => {
    try {
        const tasks = await Task.find().populate("postedBy", "username fullName");

        if (!tasks || tasks.length === 0) {
            return res.json({ tasks: [] }); // return an empty tasks array inside object
        }

        const formattedTasks = tasks.map(t => {
            let postedByName = "Unknown";

            if (t.postedBy && typeof t.postedBy === "object") {
                postedByName = t.postedBy.fullName || t.postedBy.username || "Unknown";
            }

            return {
                _id: t._id,
                title: t.title,
                description: t.description,
                budget: t.budget,
                deadline: t.deadline,
                taskLink: t.taskLink,
                submissionLink: t.submissionLink,
                paymentLink: t.paymentLink,
                postedBy: postedByName
            };
        });

        console.log("📌 Formatted tasks sent to frontend:", formattedTasks);
        res.json({ tasks: formattedTasks }); // ✅ return under tasks key
    } catch (err) {
        console.error("❌ Error fetching tasks:", err);
        res.status(500).json({ message: "Failed to fetch tasks." });
    }
};
