const db = require('../config/db');

// ── POST /api/rooms/create ────────────────────────────────────────────────────
// Creates a group room and adds the creator + selected members
exports.createRoom = async (req, res) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const { name, memberIds = [] } = req.body;
    const createdBy = req.user.id;

    if (!name || name.trim().length < 2) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Group name must be at least 2 characters' });
    }

    // 1. Create the room
    const [result] = await connection.query(
      'INSERT INTO Rooms (name, created_by) VALUES (?, ?)',
      [name.trim(), createdBy]
    );
    const roomId = result.insertId;

    // 2. Add creator as member
    await connection.query(
      'INSERT INTO RoomMembers (room_id, user_id) VALUES (?, ?)',
      [roomId, createdBy]
    );

    // 3. Add other selected members (deduplicate and exclude creator)
    const uniqueMembers = [...new Set(memberIds.map(Number))].filter(id => id !== createdBy);
    if (uniqueMembers.length > 0) {
      const values = uniqueMembers.map(uid => [roomId, uid]);
      await connection.query('INSERT INTO RoomMembers (room_id, user_id) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: 'Group created successfully',
      room: { id: roomId, name: name.trim(), created_by: createdBy }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error creating room:', error);
    res.status(500).json({ message: 'Server error while creating group' });
  }
};

// ── GET /api/rooms ─────────────────────────────────────────────────────────────
// Returns rooms the logged-in user is a member of
exports.getRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rooms] = await db.query(`
      SELECT 
        r.id, r.name, r.created_at,
        u.username as created_by_name,
        COUNT(rm2.user_id) as member_count
      FROM Rooms r
      JOIN RoomMembers rm ON r.id = rm.room_id AND rm.user_id = ?
      LEFT JOIN Users u ON r.created_by = u.id
      LEFT JOIN RoomMembers rm2 ON r.id = rm2.room_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `, [userId]);
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Server error while fetching rooms' });
  }
};

// ── DELETE /api/rooms/:roomId/leave ──────────────────────────────────────────
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    await db.query('DELETE FROM RoomMembers WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    res.status(200).json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ message: 'Server error while leaving group' });
  }
};
