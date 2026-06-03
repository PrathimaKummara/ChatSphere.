require('dotenv').config();
const db = require('../config/db');

async function setupDB() {
  try {
    console.log('Running database setup...');
    
    // ── Users table additions ──────────────────────────────────────────────
    const userColumns = [
      ['last_seen', 'DATETIME DEFAULT NULL'],
      ['profile_pic', 'VARCHAR(500) DEFAULT NULL'],
    ];
    for (const [col, def] of userColumns) {
      try {
        await db.query(`ALTER TABLE Users ADD COLUMN ${col} ${def}`);
        console.log(`Column ${col} added to Users`);
      } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') console.log(`Column ${col} already exists`);
        else throw err;
      }
    }

    // ── CallHistory table ─────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS callhistory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caller_id INT NOT NULL,
        receiver_id INT NOT NULL,
        call_type ENUM('audio', 'video') NOT NULL,
        status ENUM('missed', 'answered', 'rejected') NOT NULL,
        started_at DATETIME DEFAULT NOW(),
        duration_seconds INT DEFAULT 0,
        FOREIGN KEY (caller_id) REFERENCES Users(id),
        FOREIGN KEY (receiver_id) REFERENCES Users(id)
      )
    `);
    console.log('callhistory table verified/created');

    // ── BlockedUsers table ────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS BlockedUsers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        blocker_id INT NOT NULL,
        blocked_id INT NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY unique_block (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);
    console.log('BlockedUsers table verified/created');

    // ── Reports table ─────────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS Reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (reporter_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);
    console.log('Reports table verified/created');

    // ── Rooms table (for group chats) ─────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS Rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(500) DEFAULT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);
    console.log('Rooms table verified/created');

    // ── RoomMembers table ─────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS RoomMembers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at DATETIME DEFAULT NOW(),
        UNIQUE KEY unique_member (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES Rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      )
    `);
    console.log('RoomMembers table verified/created');

    console.log('\n✅ Database setup complete — all tables verified.');
    process.exit(0);
  } catch (err) {
    console.error('Error during database setup:', err);
    process.exit(1);
  }
}

setupDB();
