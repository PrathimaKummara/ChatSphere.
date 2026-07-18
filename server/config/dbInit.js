const db = require('./db');

async function initDatabase() {
  console.log('Running database schema initialization...');
  try {
    // 1. Create Users Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        profile_color VARCHAR(10) DEFAULT '#7F77DD',
        is_online TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT NULL,
        profile_pic VARCHAR(500) DEFAULT NULL,
        public_key TEXT DEFAULT NULL,
        about VARCHAR(160) DEFAULT 'Hey there! I am using ChatSphere.'
      ) ENGINE=InnoDB;
    `);
    console.log('Users table verified/created.');

    // 2. Create callhistory Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS callhistory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        caller_id INT NOT NULL,
        receiver_id INT NOT NULL,
        call_type ENUM('audio', 'video') NOT NULL,
        status ENUM('missed', 'answered', 'rejected') NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration_seconds INT DEFAULT 0,
        FOREIGN KEY (caller_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('callhistory table verified/created.');

    // 3. Create BlockedUsers Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS BlockedUsers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        blocker_id INT NOT NULL,
        blocked_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_block (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('BlockedUsers table verified/created.');

    // 4. Create Reports Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Reports table verified/created.');

    // 5. Create Rooms Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(500) DEFAULT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Rooms table verified/created.');

    // 6. Create RoomMembers Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS RoomMembers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_member (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES Rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('RoomMembers table verified/created.');

    // 7. Create DirectConversations Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS DirectConversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user1_id INT NOT NULL,
        user2_id INT NOT NULL,
        user1_cleared_at TIMESTAMP NULL DEFAULT NULL,
        user2_cleared_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('DirectConversations table verified/created.');

    // 8. Create MessageRequests Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS MessageRequests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT NOT NULL,
        from_username VARCHAR(255) NOT NULL,
        to_user_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    // Convert public_key and private_key columns to MEDIUMTEXT to prevent key truncation issues
    try {
      await db.query('ALTER TABLE Users MODIFY COLUMN public_key MEDIUMTEXT DEFAULT NULL');
      await db.query('ALTER TABLE Users MODIFY COLUMN private_key MEDIUMTEXT DEFAULT NULL');
      console.log('E2EE key columns verified/converted to MEDIUMTEXT.');
    } catch (e) {
      console.error('Column conversion failed or skipped:', e.message);
    }

    console.log('Database initialization completed successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

module.exports = initDatabase;
