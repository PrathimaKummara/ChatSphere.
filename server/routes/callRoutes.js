// Import express and the controller
const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
// Protect routes with authMiddleware
const authMiddleware = require('../middleware/authMiddleware');

// Route to get current user's call history
router.get('/history', authMiddleware, callController.getCallHistory);

module.exports = router;
