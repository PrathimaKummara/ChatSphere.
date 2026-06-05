// Import required React hooks
import { useEffect, useState, useCallback, useRef } from 'react';
// Import Socket.IO client library
import { io } from 'socket.io-client';
// Import api for making HTTP requests
import api from '../utils/api';

// Custom hook to manage real-time communication via Socket.IO
export const useSocket = (username, userId) => {
  // Instance of the socket connection (persistent across renders)
  const [socket, setSocket] = useState(null);
  // List of messages in the currently active chat room
  const [messages, setMessages] = useState([]);
  // ID of the room the user is currently looking at
  const [currentRoom, setCurrentRoom] = useState(null);
  // List of users currently typing in the active room
  const [typingUsers, setTypingUsers] = useState({});
  // List of all online users in the system
  const [onlineUsers, setOnlineUsers] = useState({});
  // Track the current connection status
  const [isConnected, setIsConnected] = useState(false);
  // Authentication token from localStorage
  const token = localStorage.getItem('token');

  const userIdRef = useRef(userId);
  const usernameRef = useRef(username);
  const currentRoomRef = useRef(currentRoom);

  // Sync refs when credentials change
  useEffect(() => {
    userIdRef.current = userId;
    usernameRef.current = username;
    currentRoomRef.current = currentRoom;
  }, [userId, username, currentRoom]);

  // Initialize the socket connection when the component mounts
  useEffect(() => {
    // Connect using configured socket URL or fallback to localhost:5000
    const socketUrl = 'https://chatsphere-ijss.onrender.com';
    const newSocket = io(socketUrl, {
      transports: ['websocket'] // Force WebSocket only
    });

    setSocket(newSocket);

    // Handle connection success
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      // Tell the server this user is now online
      newSocket.emit('userOnline', { 
        userId: userIdRef.current || localStorage.getItem('userId'), 
        username: usernameRef.current || localStorage.getItem('username') 
      });
    });

    // Handle connection errors
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error details:', err.message, err.description, err.context);
    });

    // Handle disconnection
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    // --- REAL-TIME LISTENERS ---

    // Listener for receiving new messages (Optimized for Optimistic UI - Fix 2)
    newSocket.on('newMessage', (message) => {
      // If we are currently looking at this room and the message is from someone else, mark it as read immediately
      const activeRoomId = currentRoomRef.current;
      const currentUId = userIdRef.current || localStorage.getItem('userId');
      if (activeRoomId === message.roomId && String(message.senderId) !== String(currentUId)) {
        newSocket.emit('readMessages', { roomId: message.roomId, userId: currentUId });
      }

      setMessages((prev) => {
        // Find if we have a temporary message that matches this new real message
        // We match by tempId OR by content/sender/time if tempId is missing
        const tempIndex = prev.findIndex(
          (m) => (message.tempId && m._id === message.tempId) || 
                 (m.isTemp && m.senderName === message.senderName && m.content === message.content)
        );

        // If a matching optimistic message was found
        if (tempIndex !== -1) {
          // Replace the "sending..." message with the real message from the database
          const updatedMessages = [...prev];
          updatedMessages[tempIndex] = { ...message, status: 'sent' };
          return updatedMessages;
        }

        // If it's a message from someone else, just append it to the list
        return [...prev, { ...message, status: 'delivered' }];
      });
    });

    // Listener for messages being read
    newSocket.on('messagesRead', ({ roomId, readerId }) => {
      const activeRoomId = currentRoomRef.current;
      if (activeRoomId === roomId) {
        setMessages((prev) => {
          return prev.map((m) => {
            if (String(m.senderId) !== String(readerId) && m.status !== 'read') {
              return { ...m, status: 'read' };
            }
            return m;
          });
        });
      }
    });

    // Listener for messages that failed to save on the server
    newSocket.on('messageFailed', ({ tempId }) => {
      setMessages((prev) => 
        // Update the temporary message to show an error state
        prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m)
      );
    });

    // Listener for user typing events
    newSocket.on('userTyping', ({ username, roomId }) => {
      setTypingUsers((prev) => ({ ...prev, [username]: true }));
    });

    // Listener for user stopped typing events
    newSocket.on('userStoppedTyping', ({ username, roomId }) => {
      setTypingUsers((prev) => {
        const newState = { ...prev };
        delete newState[username];
        return newState;
      });
    });

    // Listener for global online user updates
    newSocket.on('onlineUsersUpdated', (users) => {
      setOnlineUsers(users);
    });

    // Store the socket instance in state
    setSocket(newSocket);

    // Cleanup: Disconnect the socket when the component is destroyed
    return () => newSocket.disconnect();
  }, []);

  // Function to switch between different chat rooms
  const joinRoom = useCallback((roomId) => {
    if (!socket) return;

    // Leave the previous room if there was one
    if (currentRoom) {
      socket.emit('leaveRoom', currentRoom);
    }

    // Join the new room on the server
    socket.emit('joinRoom', roomId);
    setCurrentRoom(roomId);
    
    // Clear messages and set to loading while we fetch history
    setMessages([]);

    // Load message history from the backend API
    const fetchHistory = async () => {
      try {
        // Strip dm_ prefix for the API call if present
        const response = await api.get(`/api/messages/${roomId}`);
        setMessages(response.data);
        // Mark all messages as read since we just opened the conversation
        socket.emit('readMessages', { roomId, userId: userIdRef.current || localStorage.getItem('userId') });
      } catch (error) {
        console.error('History load error:', error);
      }
    };
    
    fetchHistory();
  }, [socket, currentRoom, token]);

  // Function to send a message via the socket
  const sendMessage = useCallback((content, roomId, tempId) => {
    if (!socket) return;
    // We use the tempId generated by the ChatWindow component for tracking
    socket.emit('sendMessage', {
      senderId: userId,
      senderName: username,
      roomId,
      content,
      tempId
    });
  }, [socket, userId, username]);

  // Function to notify others about typing status
  const sendTypingIndicator = useCallback((isTyping) => {
    if (!socket || !currentRoom) return;
    socket.emit(isTyping ? 'typing' : 'stopTyping', {
      username,
      roomId: currentRoom
    });
  }, [socket, currentRoom, username]);

  // Return the state and functions for the UI to use
  return { 
    messages, 
    setMessages, // Exposed so ChatWindow can perform optimistic updates
    joinRoom, 
    sendMessage, 
    typingUsers, 
    sendTypingIndicator, 
    onlineUsers,
    socket,
    isConnected
  };
};

// Export the hook as default so it can be imported without curly braces
export default useSocket;
