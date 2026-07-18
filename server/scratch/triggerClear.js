require('dotenv').config({ path: 'd:/chatSphere/server/.env' });
const db = require('../config/db');
const mongoose = require('mongoose');

async function run() {
  try {
    console.log('Connecting to MySQL...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('DELETE FROM callhistory');
    await db.query('DELETE FROM RoomMembers');
    await db.query('DELETE FROM Rooms');
    await db.query('DELETE FROM DirectConversations');
    await db.query('DELETE FROM MessageRequests');
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✔ MySQL chat tables cleared.');

    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatsphere';
    await mongoose.connect(mongoUri);
    
    // Define a simple Message model schema or use connection to drop/deleteMany
    const messageSchema = new mongoose.Schema({}, { strict: false });
    const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
    const deleteRes = await Message.deleteMany({});
    console.log(`✔ MongoDB messages cleared (${deleteRes.deletedCount} documents deleted).`);

    await mongoose.disconnect();
    console.log('✔ Cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}
run();
