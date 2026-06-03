// Import the Mongoose library
const mongoose = require('mongoose');

// Define the structure of a message in MongoDB
const messageSchema = new mongoose.Schema({
  // The ID of the direct conversation or group room
  roomId: { 
    type: String, 
    default: null 
  },
  conversationId: { 
    type: String, 
    default: null 
  },
  // Sender information
  senderId: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  senderName: { 
    type: String, 
    required: true 
  },
  senderProfilePic: {
    type: String,
    default: null
  },
  // Content is required for 'text' and 'media' types, but optional for 'call'
  content: { 
    type: String, 
    default: '' 
  },
  // Message meta-type
  type: {
    type: String,
    enum: ['text', 'media', 'call', 'ai'],
    default: 'text'
  },
  // Media fields (optional)
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileType: { type: String, default: null },
  size: { type: Number, default: 0 },
  
  // Call fields (optional) - defaults to null for non-call messages
  callType: { 
    type: String, 
    enum: ['audio', 'video', null], 
    required: false,
    default: null 
  },
  duration: { type: Number, default: 0 },
  
  // E2EE fields
  isEncrypted: { type: Boolean, default: false },
  encryptedKey: { type: String, default: null },
  senderEncryptedKey: { type: String, default: null },
  iv: { type: String, default: null },

  // Status tracking
  status: { 
    type: String, 
    enum: ['sent', 'delivered', 'read', 'missed', 'answered', 'rejected'], 
    default: 'sent' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create and export the 'Message' model
const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
