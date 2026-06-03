const express = require('express');
const router = express.Router();
const { onlineUsers } = require('../socket/socketHandler');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// GET /api/users/online — list of currently online users
router.get('/online', (req, res) => {
  const usersArray = Object.keys(onlineUsers).map((userId) => ({ userId }));
  res.status(200).json(usersArray);
});

// GET /api/users/profile/:userId — fetch a user's public profile
router.get('/profile/:userId', authMiddleware, userController.getUserProfile);

// GET /api/users/me — fetch logged-in user's own profile
router.get('/me', authMiddleware, userController.getOwnProfile);

// GET /api/users/search?q=query — search users by username
router.get('/search', authMiddleware, userController.searchUsers);

// PUT /api/users/update-name — update logged-in user's display name
router.put('/update-name', authMiddleware, userController.updateDisplayName);

// PUT /api/users/update-about — update logged-in user's about/bio text
router.put('/update-about', authMiddleware, userController.updateAbout);

// PUT /api/users/public-key — save user's RSA public key for E2EE
router.put('/public-key', authMiddleware, userController.updatePublicKey);

// GET /api/users/public-key/:userId — fetch recipient's RSA public key
router.get('/public-key/:userId', authMiddleware, userController.getPublicKey);

// POST /api/users/upload-avatar — upload a new profile picture
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);

// POST /api/users/block — block a user
router.post('/block', authMiddleware, userController.blockUser);

// POST /api/users/report — report a user with a reason
router.post('/report', authMiddleware, userController.reportUser);

module.exports = router;
