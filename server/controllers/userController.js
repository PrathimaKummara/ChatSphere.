// Import the database connection pool
const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// ── GET /api/users/profile/:userId ────────────────────────────────────────────
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.query(
      'SELECT id, username, email, is_online, last_seen, profile_pic, created_at, about FROM Users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// ── GET /api/users/me ──────────────────────────────────────────────────────────
exports.getOwnProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      'SELECT id, username, email, profile_pic, about FROM Users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching own profile:', error);
    res.status(500).json({ message: 'Server error while fetching own profile' });
  }
};

// ── PUT /api/users/update-name ────────────────────────────────────────────────
exports.updateDisplayName = async (req, res) => {
  try {
    const { newName } = req.body;
    const userId = req.user.id;
    if (!newName || newName.trim().length < 2) {
      return res.status(400).json({ message: 'Display name must be at least 2 characters long' });
    }
    await db.query('UPDATE Users SET username = ? WHERE id = ?', [newName.trim(), userId]);
    res.status(200).json({ message: 'Display name updated successfully', username: newName.trim() });
  } catch (error) {
    console.error('Error updating display name:', error);
    res.status(500).json({ message: 'Server error while updating display name' });
  }
};

// ── PUT /api/users/update-about ───────────────────────────────────────────────────────────
exports.updateAbout = async (req, res) => {
  try {
    const { about } = req.body;
    const userId = req.user.id;
    const safeAbout = (about || '').trim().substring(0, 160); // max 160 chars

    // Ensure the column exists (runs silently if already present)
    try {
      await db.query('ALTER TABLE Users ADD COLUMN about VARCHAR(160) DEFAULT NULL');
    } catch (_) { /* column already exists, ignore */ }

    await db.query('UPDATE Users SET about = ? WHERE id = ?', [safeAbout, userId]);
    res.status(200).json({ message: 'About updated successfully', about: safeAbout });
  } catch (error) {
    console.error('Error updating about:', error);
    res.status(500).json({ message: 'Server error while updating about' });
  }
};

// ── POST /api/users/upload-avatar ─────────────────────────────────────────────
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const userId = req.user.id;
    const fileUrl = `/uploads/avatars/${req.file.filename}`;
    await db.query('UPDATE Users SET profile_pic = ? WHERE id = ?', [fileUrl, userId]);
    res.status(200).json({ message: 'Avatar updated successfully', profile_pic: fileUrl });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Server error while uploading avatar' });
  }
};

// ── GET /api/users/search?q=query ─────────────────────────────────────────────
exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.q || req.query.username;
    const currentUserId = req.user.id;
    if (!query) return res.status(400).json({ message: 'Search query is required' });

    let rows;
    try {
      [rows] = await db.query(
        `SELECT id, username, email, profile_pic FROM Users 
         WHERE (username LIKE ? OR email LIKE ?) AND id != ?
         AND id NOT IN (SELECT blocked_id FROM BlockedUsers WHERE blocker_id = ?)
         LIMIT 15`,
        [`%${query}%`, `%${query}%`, currentUserId, currentUserId]
      );
    } catch (_) {
      // BlockedUsers table not created yet
      [rows] = await db.query(
        `SELECT id, username, email, profile_pic FROM Users 
         WHERE (username LIKE ? OR email LIKE ?) AND id != ? LIMIT 15`,
        [`%${query}%`, `%${query}%`, currentUserId]
      );
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
};

// ── PUT /api/users/public-key ────────────────────────────────────────────────
exports.updatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user.id;
    if (!publicKey) {
      return res.status(400).json({ message: 'Public key is required' });
    }
    const User = require('../models/User');
    await User.setPublicKey(userId, publicKey);
    res.status(200).json({ message: 'Public key updated successfully' });
  } catch (error) {
    console.error('Error updating public key:', error);
    res.status(500).json({ message: 'Server error while updating public key' });
  }
};

// ── GET /api/users/public-key/:userId ────────────────────────────────────────
exports.getPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;
    const User = require('../models/User');
    const publicKey = await User.getPublicKey(userId);
    if (!publicKey) return res.status(404).json({ message: 'Public key not found' });
    res.status(200).json({ publicKey });
  } catch (error) {
    console.error('Error fetching public key:', error);
    res.status(500).json({ message: 'Server error while fetching public key' });
  }
};


// ── POST /api/users/block ─────────────────────────────────────────────────────
exports.blockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const blockerId = req.user.id;

    if (!blockedUserId) return res.status(400).json({ message: 'blockedUserId is required' });
    if (Number(blockedUserId) === blockerId) return res.status(400).json({ message: 'Cannot block yourself' });

    // Insert block (ignore duplicate key if already blocked)
    await db.query(
      'INSERT IGNORE INTO BlockedUsers (blocker_id, blocked_id) VALUES (?, ?)',
      [blockerId, blockedUserId]
    );

    res.status(200).json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ message: 'Server error while blocking user' });
  }
};

// ── POST /api/users/report ────────────────────────────────────────────────────
exports.reportUser = async (req, res) => {
  try {
    const { reportedUserId, reason } = req.body;
    const reporterId = req.user.id;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: 'reportedUserId and reason are required' });
    }
    if (Number(reportedUserId) === reporterId) {
      return res.status(400).json({ message: 'Cannot report yourself' });
    }

    await db.query(
      'INSERT INTO Reports (reporter_id, reported_id, reason) VALUES (?, ?, ?)',
      [reporterId, reportedUserId, reason]
    );

    res.status(200).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error reporting user:', error);
    res.status(500).json({ message: 'Server error while reporting user' });
  }
};
