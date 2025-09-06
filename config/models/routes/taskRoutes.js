import { Router } from 'express';
import { protect } from '../routes/Controllers/Middleware/authMiddleware.js'; // Your authentication middleware
import checkAccessMiddleware from '../routes/Controllers/Middleware/checkAccess.js'; // The new middleware
import Task from '../task.js';
import { createTask, getTasks } from './Controllers/taskController.js';

const router = Router();

// Route for clients to create tasks
// Only requires authentication
router.post('/', protect, createTask, async (req, res) => {
    try {
        const { title, budget, description, paymentLink, taskLink, submissionLink, deadline } = req.body;
        const newTask = new Task({
            title,
            budget,
            description,
            paymentLink,
            taskLink,
            submissionLink,
            deadline,
            postedBy: req.user.id // Assign the current user's ID
        });
        await newTask.save();
        res.status(201).json({ message: "Task created successfully!", task: newTask });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create task." });
    }
});

// Route for freelancers to view tasks
router.get("/", protect, checkAccessMiddleware, getTasks);


export default router;
