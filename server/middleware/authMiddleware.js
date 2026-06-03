// Import jsonwebtoken to verify tokens
const jwt = require('jsonwebtoken');

// What is a JWT and why do we use it?
// A JSON Web Token (JWT) is a secure, encrypted string that acts like a digital ID card.
// When a user logs in, we give them a JWT. For every subsequent request they make,
// they send this token in the headers. We verify the token here to ensure the request
// comes from a logged-in user without having to check the database every time.

const authMiddleware = async (req, res, next) => {
  try {
    // Get the Authorization header from the incoming request
    const authHeader = req.header('Authorization');

    // If there is no header, block the request
    if (!authHeader) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // The header format is usually "Bearer <token>", so we split it to get just the token part
    const token = authHeader.split(' ')[1];

    // If the token is missing, block the request
    if (!token) {
      return res.status(401).json({ message: 'Access denied. Invalid token format.' });
    }

    // Verify the token using our secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user information to the request object
    // so the next functions (routes) can access it
    req.user = decoded;

    // Call next() to allow the request to proceed to the actual route handler
    next();
  } catch (error) {
    // If the token is invalid or expired, catch the error and block the request
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// Export the middleware so we can protect routes with it
module.exports = authMiddleware;
