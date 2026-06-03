// Import our database connection pool
const db = require('../config/db');

// Helper object containing functions to interact with the Users table
const User = {
  // Find a user by their email address
  findByEmail: async (email) => {
    // Run the SQL query to select all matching rows
    const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    // Return the first matching user, or undefined if not found
    return rows[0];
  },
  
  // Find a user by their username
  findByUsername: async (username) => {
    // Run the SQL query to select all matching rows
    const [rows] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
    // Return the first matching user, or undefined if not found
    return rows[0];
  },

  // Create a new user in the database
  createUser: async (username, email, hashedPassword) => {
    // Run the SQL query to insert a new row
    const [result] = await db.query(
      'INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    // Return the ID of the newly created user
    return result.insertId;
  },

  // Set user's online status and record last seen (Fix)
  setOnlineStatus: async (userId, isOnline) => {
    // Convert boolean true/false to 1/0 for MySQL TINYINT
    const status = isOnline ? 1 : 0;
    const now = new Date();
    
    if (isOnline) {
      await db.query('UPDATE Users SET is_online = ? WHERE id = ?', [status, userId]);
    } else {
      // When going offline, also update last_seen
      await db.query('UPDATE Users SET is_online = ?, last_seen = ? WHERE id = ?', [status, now, userId]);
    }
  },

  // Update a user's password (used for forgot password flow)
  updatePassword: async (email, newHashedPassword) => {
    await db.query('UPDATE Users SET password = ? WHERE email = ?', [newHashedPassword, email]);
  },

  // Save the user's RSA public key for E2EE
  setPublicKey: async (userId, publicKeyBase64) => {
    // Ensure column exists first
    try { await db.query('ALTER TABLE Users ADD COLUMN public_key TEXT DEFAULT NULL'); } catch (_) {}
    await db.query('UPDATE Users SET public_key = ? WHERE id = ?', [publicKeyBase64, userId]);
  },

  // Retrieve a user's RSA public key
  getPublicKey: async (userId) => {
    // Ensure column exists first
    try { await db.query('ALTER TABLE Users ADD COLUMN public_key TEXT DEFAULT NULL'); } catch (_) {}
    const [rows] = await db.query('SELECT public_key FROM Users WHERE id = ?', [userId]);
    return rows[0]?.public_key;
  }
};

// Export the User helper so it can be used in controllers
module.exports = User;
