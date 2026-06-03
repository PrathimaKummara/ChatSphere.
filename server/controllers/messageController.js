const Message = require('../models/Message');
const db = require('../config/db');
const fs = require('fs');

// ── GET /api/messages/:roomId ─────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const isDirect = roomId.toString().startsWith('dm_');
    let messages;

    if (isDirect) {
      const convId = roomId.toString().replace('dm_', '');
      
      // Ensure columns exist (Migration)
      try {
        const [columns] = await db.query('SHOW COLUMNS FROM DirectConversations');
        const columnNames = columns.map(c => c.Field);
        if (!columnNames.includes('user1_cleared_at')) {
          await db.query('ALTER TABLE DirectConversations ADD COLUMN user1_cleared_at TIMESTAMP NULL DEFAULT NULL');
        }
        if (!columnNames.includes('user2_cleared_at')) {
          await db.query('ALTER TABLE DirectConversations ADD COLUMN user2_cleared_at TIMESTAMP NULL DEFAULT NULL');
        }
      } catch (e) {
        console.error('Migration error in getMessages:', e.message);
      }

      // Fetch cleared_at for the current user
      const [convs] = await db.query(
        'SELECT user1_id, user2_id, user1_cleared_at, user2_cleared_at FROM DirectConversations WHERE id = ?',
        [convId]
      );

      let clearedAt = null;
      if (convs.length > 0) {
        const conv = convs[0];
        if (conv.user1_id === userId) clearedAt = conv.user1_cleared_at;
        else if (conv.user2_id === userId) clearedAt = conv.user2_cleared_at;
      }

      const query = { conversationId: convId };
      if (clearedAt) {
        query.createdAt = { $gt: new Date(clearedAt) };
      }

      messages = await Message.find(query).sort({ createdAt: 1 }).limit(100);
    } else {
      messages = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(100);
    }
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

// ── POST /api/messages/upload ─────────────────────────────────────────────────
exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
      fileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ message: 'Server error while uploading media' });
  }
};

// ── GET /api/messages/:conversationId/media ───────────────────────────────────
// Returns only media-type messages for the profile panel media grid
exports.getMediaMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const cleanId = conversationId.replace('dm_', '');

    const mediaMessages = await Message.find({
      $or: [{ conversationId: cleanId }, { roomId: `dm_${cleanId}` }],
      type: 'media'
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('fileUrl fileName fileType createdAt senderId')
      .lean();

    res.status(200).json(mediaMessages);
  } catch (error) {
    console.error('Error fetching media messages:', error);
    res.status(500).json({ message: 'Server error while deleting chat' });
  }
};

// ── POST /api/messages/:messageId/react ───────────────────────────────────────
exports.toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji, username } = req.body;
    const userId = req.user.id;

    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Find if reaction with this emoji exists
    let reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);

    if (reactionIndex > -1) {
      // Check if user already reacted with this emoji
      const userIndex = message.reactions[reactionIndex].users.findIndex(u => u.userId === userId);
      
      if (userIndex > -1) {
        // Remove reaction
        message.reactions[reactionIndex].users.splice(userIndex, 1);
        // If no users left for this emoji, remove the emoji entirely
        if (message.reactions[reactionIndex].users.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      } else {
        // Add user to existing emoji
        message.reactions[reactionIndex].users.push({ userId, username });
      }
    } else {
      // Create new emoji reaction
      message.reactions.push({
        emoji,
        users: [{ userId, username }]
      });
    }

    await message.save();

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(message.roomId).emit('messageReacted', message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ message: 'Server error while toggling reaction' });
  }
};

// ── DELETE /api/messages/:conversationId ──────────────────────────────────────
// "Clears" chat for the requesting user only by updating cleared_at timestamp in MySQL
exports.clearMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const cleanId = conversationId.replace('dm_', '');

    // Ensure columns exist (Migration)
    try {
      await db.query('ALTER TABLE DirectConversations ADD COLUMN user1_cleared_at TIMESTAMP NULL DEFAULT NULL');
      await db.query('ALTER TABLE DirectConversations ADD COLUMN user2_cleared_at TIMESTAMP NULL DEFAULT NULL');
    } catch (_) { /* ignore if already exist */ }

    // Find which user is requesting the clear
    const [convs] = await db.query(
      'SELECT user1_id, user2_id FROM DirectConversations WHERE id = ?',
      [cleanId]
    );

    if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found' });

    const conv = convs[0];
    const column = (conv.user1_id === userId) ? 'user1_cleared_at' : 'user2_cleared_at';

    await db.query(
      `UPDATE DirectConversations SET ${column} = NOW() WHERE id = ?`,
      [cleanId]
    );

    res.status(200).json({ message: 'Chat cleared for you successfully' });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({ message: 'Server error while clearing messages' });
  }
};

// ── POST /api/messages/request ────────────────────────────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user.id;
    const fromUsername = req.user.username;

    if (Number(toUserId) === fromUserId) {
      return res.status(400).json({ message: 'Cannot message yourself' });
    }

    // Check if conversation already exists
    const [existingConv] = await db.query(
      `SELECT * FROM DirectConversations 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [fromUserId, toUserId, toUserId, fromUserId]
    );
    if (existingConv.length > 0) {
      return res.status(200).json({ message: 'Conversation exists', conversationId: existingConv[0].id });
    }

    // Check if request already sent
    const [existingReq] = await db.query(
      `SELECT * FROM MessageRequests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
      [fromUserId, toUserId]
    );
    if (existingReq.length > 0) {
      return res.status(400).json({ message: 'Request already sent' });
    }

    await db.query(
      `INSERT INTO MessageRequests (from_user_id, from_username, to_user_id) VALUES (?, ?, ?)`,
      [fromUserId, fromUsername, toUserId]
    );

    res.status(201).json({ message: 'Message request sent successfully' });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/messages/requests/pending ───────────────────────────────────────
exports.getRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const [requests] = await db.query(
      `SELECT * FROM MessageRequests WHERE to_user_id = ? AND status = 'pending'`,
      [userId]
    );
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /api/messages/request/:id/accept ─────────────────────────────────────
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [requests] = await db.query(`SELECT * FROM MessageRequests WHERE id = ?`, [id]);
    if (requests.length === 0) return res.status(404).json({ message: 'Request not found' });

    const request = requests[0];
    if (request.to_user_id !== userId) return res.status(403).json({ message: 'Unauthorized' });

    await db.query(`UPDATE MessageRequests SET status = 'accepted' WHERE id = ?`, [id]);

    const user1 = request.from_user_id;
    const user2 = userId;

    const [existingConv] = await db.query(
      `SELECT * FROM DirectConversations 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [user1, user2, user2, user1]
    );

    let conversationId;
    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [result] = await db.query(
        `INSERT INTO DirectConversations (user1_id, user2_id) VALUES (?, ?)`,
        [user1, user2]
      );
      conversationId = result.insertId;
    }

    res.status(200).json({
      message: 'Request accepted',
      conversation: {
        id: conversationId,
        user1_id: user1,
        user2_id: user2,
        otherUsername: request.from_username,
        otherUserId: request.from_user_id
      }
    });
  } catch (error) {
    console.error('Error accepting request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PUT /api/messages/request/:id/block ──────────────────────────────────────
exports.blockRequest = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE MessageRequests SET status = 'blocked' WHERE id = ?`, [id]);
    res.status(200).json({ message: 'User blocked' });
  } catch (error) {
    console.error('Error blocking request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/messages/direct/conversations ────────────────────────────────────
exports.getDirectConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure columns exist (Migration)
    try {
      const [columns] = await db.query('SHOW COLUMNS FROM DirectConversations');
      const columnNames = columns.map(c => c.Field);
      if (!columnNames.includes('user1_cleared_at')) {
        await db.query('ALTER TABLE DirectConversations ADD COLUMN user1_cleared_at TIMESTAMP NULL DEFAULT NULL');
      }
      if (!columnNames.includes('user2_cleared_at')) {
        await db.query('ALTER TABLE DirectConversations ADD COLUMN user2_cleared_at TIMESTAMP NULL DEFAULT NULL');
      }
    } catch (e) {
      console.error('Migration error:', e.message);
    }

    // Try with BlockedUsers JOIN — falls back if table doesn't exist yet
    let convos;
    try {
      [convos] = await db.query(`
        SELECT dc.id as conversationId, u.id as otherUserId, u.username as name, u.profile_pic,
               dc.user1_id, dc.user2_id, dc.user1_cleared_at, dc.user2_cleared_at
        FROM DirectConversations dc
        JOIN Users u ON (u.id = dc.user1_id OR u.id = dc.user2_id) AND u.id != ?
        LEFT JOIN BlockedUsers bu ON bu.blocker_id = ? AND bu.blocked_id = u.id
        WHERE (dc.user1_id = ? OR dc.user2_id = ?) AND bu.id IS NULL
      `, [userId, userId, userId, userId]);
    } catch (_) {
      // BlockedUsers table not created yet — query without it
      [convos] = await db.query(`
        SELECT dc.id as conversationId, u.id as otherUserId, u.username as name, u.profile_pic,
               dc.user1_id, dc.user2_id, dc.user1_cleared_at, dc.user2_cleared_at
        FROM DirectConversations dc
        JOIN Users u ON (u.id = dc.user1_id OR u.id = dc.user2_id) AND u.id != ?
        WHERE dc.user1_id = ? OR dc.user2_id = ?
      `, [userId, userId, userId]);
    }

    const conversationsWithLastMessage = await Promise.all(convos.map(async (convo) => {
      const convIdStr = String(convo.conversationId);
      const roomIdStr = `dm_${convIdStr}`;

      // Handle user1 vs user2 cleared_at logic from the query result
      // Note: convo should now include user1_cleared_at and user2_cleared_at
      let clearedAt = null;
      if (convo.user1_id === userId) clearedAt = convo.user1_cleared_at;
      else if (convo.user2_id === userId) clearedAt = convo.user2_cleared_at;

      const query = {
        $or: [{ conversationId: convIdStr }, { roomId: roomIdStr }]
      };
      
      if (clearedAt) {
        query.createdAt = { $gt: new Date(clearedAt) };
      }

      const lastMessage = await Message.findOne(query).sort({ createdAt: -1 }).select('content senderId status createdAt type fileName isEncrypted encryptedKey senderEncryptedKey iv').lean();
      return { ...convo, lastMessage: lastMessage || null };
    }));

    conversationsWithLastMessage.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
      return timeB - timeA;
    });

    res.status(200).json(conversationsWithLastMessage);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// ── GET /api/messages/direct/:userId ─────────────────────────────────────────
exports.checkDirectConversation = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId: otherUserId } = req.params;

    const [existingConv] = await db.query(
      `SELECT * FROM DirectConversations 
       WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    if (existingConv.length > 0) {
      return res.status(200).json({ exists: true, conversationId: existingConv[0].id });
    }
    res.status(200).json({ exists: false });
  } catch (error) {
    console.error('Error checking conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
