// Import models and database
const Message = require('../models/Message');
const User = require('../models/User');
const db = require('../config/db');

// In-memory mappings
// CRITICAL: onlineUsers now stores userId -> socketId mapping for direct targeting
const onlineUsers = {};
const socketToUser = {};
const callStartTimes = {};

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // --- 1. USER IDENTITY & ROOM JOINING ---
    socket.on('userOnline', async (userData) => {
      try {
        const { userId, username } = userData;
        if (!userId) return;

        // Store both directions for lookup
        const uId = String(userId);
        onlineUsers[uId] = socket.id; // Map userId to the primary socketId
        socketToUser[socket.id] = uId;

        // Join the user-specific room (Backup for multi-tab support)
        socket.join(`user_${uId}`);

        if (!isNaN(userId)) {
          await User.setOnlineStatus(userId, true);
        }

        // Broadcast the name list (userId: username) to everyone for UI status
        const statusMap = {};
        Object.keys(onlineUsers).forEach(uid => {
          statusMap[uid] = 'Online';
        });
        io.emit('onlineUsersUpdated', statusMap);

        console.log(`[Presence] User ${uId} is online on socket ${socket.id}`);
      } catch (error) { console.error('userOnline error:', error); }
    });

    // --- 2. WEBRTC SIGNALING (Hybrid Lookup Fix) ---
    socket.on('callUser', (data) => {
      const { userToCall, signalData, from, name, callType } = data;

      console.log('📞 callUser received, to:', userToCall, typeof userToCall);
      console.log('🗺️ Current Online Map:', JSON.stringify(onlineUsers));

      // HYBRID LOOKUP: Try String, Number, and Raw to be 100% sure
      const targetSocketId = onlineUsers[String(userToCall)] ||
        onlineUsers[parseInt(userToCall)] ||
        onlineUsers[userToCall];

      console.log('📡 targetSocketId found:', targetSocketId);

      if (!targetSocketId) {
        // Receiver is offline — tell caller immediately
        socket.emit('callRejected', {
          reason: 'offline',
          message: 'User is currently offline'
        });
        return; // stop here
      }

      if (targetSocketId) {
        // Emit to the specific socket
        io.to(targetSocketId).emit('incomingCall', {
          signal: signalData,
          from: socket.id,
          fromUserId: from,
          username: name,
          callType
        });
        console.log(`✅ incomingCall emitted to socket ${targetSocketId}`);
      }

      // REDUNDANT EMIT: Also emit to the User Room for safety
      const targetRoom = `user_${String(userToCall)}`;
      io.to(targetRoom).emit('incomingCall', {
        signal: signalData,
        from: socket.id,
        fromUserId: from,
        username: name,
        callType
      });
      console.log(`📡 Secondary signal sent to room: ${targetRoom}`);
    });

    const resolveTarget = (to) => {
      // If 'to' is already a socket ID (usually > 15 chars), return it directly
      if (typeof to === 'string' && to.length > 15) return [to];
      // Otherwise it's a userId, try to find the socket or the user room
      const targetSocketId = onlineUsers[String(to)] || onlineUsers[parseInt(to)] || onlineUsers[to];
      return targetSocketId ? [targetSocketId, `user_${to}`] : [`user_${to}`];
    };

    socket.on('answerCall', async (data) => {
      const { to, signal } = data;
      resolveTarget(to).forEach(t => io.to(t).emit('callAccepted', signal));
    });

    // When receiver answers the call, relay to caller (new callAnswered event)
    socket.on('callAnswered', (data) => {
      // data contains: { to: callerSocketId, signal: rtcSignal }
      io.to(data.to).emit('callAnswered', { signal: data.signal, from: socket.id });
    });

    socket.on('rejectCall', async (data) => {
      const { to } = data;
      resolveTarget(to).forEach(t => io.to(t).emit('callRejected'));
    });

    socket.on('endCall', async (data) => {
      const { to } = data;
      resolveTarget(to).forEach(t => io.to(t).emit('callEnded'));
    });

    socket.on('iceCandidate', (data) => {
      // data contains: { to: targetSocketId, candidate: iceCandidate }
      const { to, candidate } = data;
      resolveTarget(to).forEach(t => io.to(t).emit('iceCandidate', { candidate, from: socket.id }));
    });

    // --- 3. CALL HISTORY PERSISTENCE ---
    socket.on('saveCallHistory', async (data) => {
      try {
        const { callerId, receiverId, callType, status, durationSeconds } = data;
        if (!callerId || !receiverId) return;
        // Create the callhistory table if it doesn't exist yet (safe self-healing)
        await db.query(`
          CREATE TABLE IF NOT EXISTS callhistory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            caller_id INT NOT NULL,
            receiver_id INT NOT NULL,
            call_type ENUM('audio','video') DEFAULT 'audio',
            status ENUM('answered','missed','rejected') DEFAULT 'answered',
            duration_seconds INT DEFAULT 0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.query(
          `INSERT INTO callhistory (caller_id, receiver_id, call_type, status, duration_seconds) VALUES (?, ?, ?, ?, ?)`,
          [callerId, receiverId, callType || 'audio', status || 'answered', durationSeconds || 0]
        );

        // Notify both parties that call history has changed
        // Emit to user-specific rooms to handle multi-tab scenarios
        io.to(`user_${callerId}`).to(`user_${receiverId}`).emit('callHistoryUpdate');
      } catch (error) {
        // Silently log errors to avoid console noise
      }
    });

    socket.on('chatCleared', ({ roomId }) => {
      // Only notify the user who cleared it (and their other tabs)
      const userId = socketToUser[socket.id];
      if (userId) {
        io.to(`user_${userId}`).emit('chatCleared', { roomId });
      }
    });

    // --- 4. MESSAGING ---
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
    });

    socket.on('sendMessage', async (messageData) => {
      try {
        if (!messageData.content && !messageData.fileUrl) return;
        const {
          senderId, senderName, senderProfilePic, roomId, type = 'text', fileUrl, fileName, fileType, size,
          isEncrypted = false, encryptedKey = null, senderEncryptedKey = null, iv = null
        } = messageData;
        const content = (messageData.content || '').toString();
        const cleanId = (roomId || '').replace('dm_', '');

        const newMessage = new Message({
          senderId, senderName, senderProfilePic, content, roomId, conversationId: cleanId, status: 'sent', type, fileUrl, fileName, fileType, size,
          isEncrypted, encryptedKey, senderEncryptedKey, iv,
          ...(type === 'call' ? { callType: messageData.callType || 'audio', duration: messageData.duration || 0 } : {})
        });

        const savedMessage = await newMessage.save();
        // Include tempId in broadcast for client-side dedup
        const messageToEmit = savedMessage.toJSON();
        messageToEmit.tempId = messageData.tempId;
        io.to(roomId).emit('newMessage', messageToEmit);
        const previewText = type === 'media' ? `📎 ${fileName || 'Media'}`
          : type === 'call' ? (messageData.callType === 'video' ? '📹 Video call' : '📞 Voice call')
          : content; // for text: raw content (encrypted or plain)

        io.emit('sidebarUpdate', {
          conversationId: cleanId,
          content: previewText,
          senderId,
          createdAt: savedMessage.createdAt,
          type,
          fileName,
          isEncrypted,
          // Include E2EE keys so the client can decrypt the preview
          // These are RSA-wrapped, so only the key-holder can unwrap them
          encryptedKey: isEncrypted ? encryptedKey : null,
          senderEncryptedKey: isEncrypted ? senderEncryptedKey : null,
          iv: isEncrypted ? iv : null
        });
      } catch (error) { console.error('sendMessage error:', error); }
    });

    socket.on('readMessages', async ({ roomId, userId }) => {
      try {
        if (!roomId || !userId) return;
        const cleanId = (roomId || '').replace('dm_', '');
        await Message.updateMany(
          {
            $or: [
              { conversationId: cleanId },
              { roomId: roomId }
            ],
            senderId: { $ne: userId },
            status: { $ne: 'read' }
          },
          { $set: { status: 'read' } }
        );
        io.to(roomId).emit('messagesRead', { roomId, readerId: userId });
      } catch (error) {
        console.error('readMessages error:', error);
      }
    });

    socket.on('typing', (data) => socket.to(data.roomId).emit('userTyping', data));
    socket.on('stopTyping', (data) => socket.to(data.roomId).emit('userStoppedTyping', data));
    socket.on('updateProfile', (data) => io.emit('profileUpdated', data));

    socket.on('disconnect', () => {
      const userId = socketToUser[socket.id];
      if (userId) {
        delete onlineUsers[userId];
        delete socketToUser[socket.id];
        io.emit('onlineUsersUpdated', onlineUsers);
      }
    });
  });
};

module.exports = { socketHandler, onlineUsers };
