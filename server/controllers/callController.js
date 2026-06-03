// Import the database connection
const db = require('../config/db');

// Controller to handle call history retrieval
exports.getCallHistory = async (req, res) => {
  try {
    const userId = req.user.id; // From authMiddleware

    // Query to fetch calls where the user was either the caller or receiver
    // Join with Users table twice to get both party names and avatars
    const [calls] = await db.query(`
      SELECT 
        ch.id,
        ch.call_type,
        ch.status,
        ch.started_at,
        ch.duration_seconds,
        ch.caller_id,
        ch.receiver_id,
        u1.username as caller_name,
        u1.profile_pic as caller_pic,
        u2.username as receiver_name,
        u2.profile_pic as receiver_pic
      FROM callhistory ch
      JOIN Users u1 ON ch.caller_id = u1.id
      JOIN Users u2 ON ch.receiver_id = u2.id
      WHERE ch.caller_id = ? OR ch.receiver_id = ?
      ORDER BY ch.started_at DESC
      LIMIT 50
    `, [userId, userId]);

    // Format the response for the frontend (determine "other person")
    const formattedCalls = calls.map(call => {
      const isCaller = call.caller_id === userId;
      return {
        id: call.id,
        type: call.call_type,
        status: call.status,
        started_at: call.started_at,
        duration: call.duration_seconds,
        isOutgoing: isCaller,
        otherPerson: {
          id: isCaller ? call.receiver_id : call.caller_id,
          name: isCaller ? call.receiver_name : call.caller_name,
          profile_pic: isCaller ? call.receiver_pic : call.caller_pic
        }
      };
    });

    res.json(formattedCalls);
  } catch (error) {
    console.error('Error fetching call history:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
