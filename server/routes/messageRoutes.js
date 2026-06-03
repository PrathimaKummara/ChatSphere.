const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ── Media upload ──────────────────────────────────────────────────────────────
// POST /api/messages/upload
router.post('/upload', authMiddleware, upload.single('file'), messageController.uploadMedia);

// ── Direct Messaging routes ───────────────────────────────────────────────────
// These MUST come before /:roomId to avoid route conflicts
router.post('/request', authMiddleware, messageController.createRequest);
router.get('/requests/pending', authMiddleware, messageController.getRequests);
router.put('/request/:id/accept', authMiddleware, messageController.acceptRequest);
router.put('/request/:id/block', authMiddleware, messageController.blockRequest);
router.get('/direct/conversations', authMiddleware, messageController.getDirectConversations);
router.get('/direct/:userId', authMiddleware, messageController.checkDirectConversation);

// ── Media-only fetch for profile panel ───────────────────────────────────────
// GET /api/messages/:conversationId/media
router.get('/:conversationId/media', authMiddleware, messageController.getMediaMessages);

// ── Reactions ────────────────────────────────────────────────────────────────
// POST /api/messages/:messageId/react
router.post('/:messageId/react', authMiddleware, messageController.toggleReaction);

// ── Clear all messages in a conversation ──────────────────────────────────────
// DELETE /api/messages/:conversationId
router.delete('/:conversationId', authMiddleware, messageController.clearMessages);

// ── General message history ───────────────────────────────────────────────────
// GET /api/messages/:roomId  (must be LAST to not swallow other routes)
router.get('/:roomId', authMiddleware, messageController.getMessages);

module.exports = router;
