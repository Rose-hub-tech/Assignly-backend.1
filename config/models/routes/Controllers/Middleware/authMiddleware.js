import jwt from 'jsonwebtoken';
import User from '../../../user.js'; // Adjust the path as needed

// Middleware to protect routes
export const protect = async (req, res, next) => {
    let token;

    try {
        // 1. Check if the token is present in the Authorization header
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            // Extract token
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Find the user by ID from the token
            req.user = await User.findById(decoded.id || decoded._id).select('-password');

            if (!req.user) {
                return res.status(401).json({ error: 'Not authorized, user not found.' });
            }

            // 4. Proceed to the next middleware
            return next();
        }

        // 5. No token provided
        return res.status(401).json({ error: 'Not authorized, no token.' });
    } catch (error) {
        console.error('Protect middleware error:', error);
        return res.status(401).json({ error: 'Not authorized, token failed.' });
    }
};
