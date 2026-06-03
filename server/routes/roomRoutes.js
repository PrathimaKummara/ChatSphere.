const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/rooms — fetch rooms the logged-in user belongs to
router.get('/', authMiddleware, roomController.getRooms);

// POST /api/rooms/create — create a new group room
router.post('/create', authMiddleware, roomController.createRoom);

// DELETE /api/rooms/:roomId/leave — leave a group room
router.delete('/:roomId/leave', authMiddleware, roomController.leaveRoom);

module.exports = router;
