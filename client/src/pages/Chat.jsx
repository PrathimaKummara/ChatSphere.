// Import React hooks
import { useState, useEffect, useRef } from 'react';
// Import custom components
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallModal from '../components/CallModal';
import Settings from '../components/Settings';
// Import hooks
import useSocket from '../hooks/useSocket';
import useWebRTC from '../hooks/useWebRTC';
import api from '../utils/api';
import { initE2EE } from '../utils/encryption';

const Chat = () => {
  // Authentication check (moved below hooks to follow React rules)
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');

  // --- 1. GLOBAL SOCKET INITIALIZATION ---
  // Note: Arguments order is (username, userId) as per useSocket definition
  const { socket, onlineUsers, typingUsers, sendTypingIndicator, sendReadReceipt } = useSocket(username, userId);

  // --- 2. GLOBAL WEBRTC INITIALIZATION ---
  // Shared state that persists across all chat rooms
  const { 
    callStatus, callType, remoteUser, localStream, remoteStream,
    isMicMuted, isCameraOff, callError,
    startCall, answerCall, rejectCall, endCall, toggleMic, toggleCamera
  } = useWebRTC(socket, userId, username);

  // Redirect if not authenticated (using an effect for safety, though ProtectedRoute handles this)
  useEffect(() => {
    if (!userId) {
      window.location.href = '/login';
    }
  }, [userId]);

  // Ensure E2EE keys are initialized for existing sessions
  useEffect(() => {
    if (userId) {
      initE2EE(api);
    }
  }, [userId]);

  if (!userId) return null;

  // --- 3. UI STATE ---
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('settings'); // 'settings' or 'profile'
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profile_pic') || '');

  // Fetch current user profile to sync name and profile pic
  useEffect(() => {
    if (!userId) return;
    api.get('/api/users/me').then(res => {
      if (res.data.profile_pic !== undefined) {
        setProfilePic(res.data.profile_pic);
        localStorage.setItem('profile_pic', res.data.profile_pic || '');
      }
    }).catch(() => {});
  }, [userId]);

  // --- 4. NOTIFICATION SOUND ---
  const notificationAudio = useRef(null);
  useEffect(() => {
    notificationAudio.current = new Audio(`/sounds/notification.mp3?t=${Date.now()}`);
    notificationAudio.current.volume = 0.4;

    // Unlock audio context on first user interaction to bypass browser autoplay policies
    const unlockAudio = () => {
      if (notificationAudio.current) {
        const playPromise = notificationAudio.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              notificationAudio.current.pause();
              notificationAudio.current.currentTime = 0;
            })
            .catch(() => {});
        }
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Load message history when room changes
  useEffect(() => {
    if (!activeRoom) return;
    
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/api/messages/${activeRoom.id}`);
        setMessages(res.data);
        if (socket) {
          socket.emit('readMessages', { roomId: activeRoom.id, userId });
        }
      } catch (err) { console.error('Failed to load history', err); }
    };
    
    fetchHistory();
    if (socket) socket.emit('joinRoom', activeRoom.id);
  }, [activeRoom, socket, userId]);

  // Handle incoming messages
  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (msg) => {
      if (activeRoom && msg.roomId === activeRoom.id) {
        // Emit read receipt if viewing the room and message is from recipient
        const isFromMe = String(msg.senderId) === String(userId);
        if (!isFromMe) {
          socket.emit('readMessages', { roomId: msg.roomId, userId });
        }

        setMessages(prev => {
          // Avoid duplicates (if we sent the message and got it back via socket)
          const exists = prev.find(m => 
            (msg._id && (m._id === msg._id || m.id === msg._id)) ||
            (msg.tempId && (m.tempId === msg.tempId || m.id === msg.tempId))
          );
          if (exists) {
            // Replace optimistic message with server-confirmed version
            if (exists.id === msg.tempId) {
              return prev.map(m => m.id === msg.tempId ? { ...msg, status: 'sent' } : m);
            }
            return prev;
          }
          return [...prev, msg];
        });
      }

      // Play notification sound if message is from someone else and not muted
      const isFromMe = String(msg.senderId) === String(userId);
      if (!isFromMe && msg.roomId) {
        const muteKey = `muted_${msg.roomId}`;
        const isMuted = localStorage.getItem(muteKey) === 'true';
        const globalEnabled = localStorage.getItem('notifications') !== 'false';
        
        if (!isMuted && globalEnabled) {
          notificationAudio.current?.play().catch(() => {});
        }
      }
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, activeRoom, userId]);

  // Handle real-time read receipts (messagesRead)
  useEffect(() => {
    if (!socket) return;

    const handleMessagesRead = ({ roomId, readerId }) => {
      if (activeRoom && activeRoom.id === roomId) {
        setMessages(prev =>
          prev.map(m => {
            if (String(m.senderId) !== String(readerId) && m.status !== 'read') {
              return { ...m, status: 'read' };
            }
            return m;
          })
        );
      }
    };

    socket.on('messagesRead', handleMessagesRead);
    return () => {
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [socket, activeRoom]);

  // Wrapper for sending messages
  const sendMessage = (messageData) => {
    if (socket) {
      const tempId = Date.now();
      const payload = { ...messageData, tempId };
      
      // Optimistic update
      setMessages(prev => [...prev, { 
        ...payload, 
        id: tempId, 
        createdAt: new Date().toISOString(),
        senderId: parseInt(userId)
      }]);
      
      socket.emit('sendMessage', payload);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden relative font-sans transition-colors duration-300">
      
      {/* GLOBAL CALL MODAL */}
      <CallModal 
        status={callStatus} 
        type={callType} 
        remoteUser={remoteUser}
        localStream={localStream} 
        remoteStream={remoteStream}
        isMicMuted={isMicMuted} 
        isCameraOff={isCameraOff}
        callError={callError}
        onAnswer={answerCall} 
        onReject={rejectCall} 
        onEnd={endCall}
        onToggleMic={toggleMic} 
        onToggleCamera={toggleCamera}
      />

      {/* SETTINGS PANEL — slide-in from left, overlays sidebar */}
      <Settings
        isOpen={isSettingsOpen}
        initialView={settingsView}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateName={(newName) => localStorage.setItem('username', newName)}
        onUpdateProfilePic={(newPic) => setProfilePic(newPic)}
        socket={socket}
      />

      {/* Left Sidebar - Full width on mobile when no chat is open, 380px on desktop */}
      <div className={`w-full md:w-[380px] flex-shrink-0 h-full ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          activeRoom={activeRoom} 
          setActiveRoom={setActiveRoom} 
          onlineUsers={onlineUsers} 
          username={username}
          profilePic={profilePic}
          socket={socket}
          onOpenSettings={() => { setSettingsView('settings'); setIsSettingsOpen(true); }}
          onOpenProfile={() => { setSettingsView('profile'); setIsSettingsOpen(true); }}
          startCall={startCall}
        />
      </div>

      {/* Primary Chat Interface - Full width on mobile when chat is open, flex-1 on desktop */}
      <div className={`flex-1 min-w-0 h-full ${!activeRoom ? 'hidden md:flex' : 'flex flex-col'}`}>
        <ChatWindow 
          activeRoom={activeRoom} 
          setActiveRoom={setActiveRoom} 
          messages={messages} 
          setMessages={setMessages} 
          sendMessage={sendMessage} 
          username={username} 
          typingUsers={typingUsers} 
          sendTypingIndicator={sendTypingIndicator} 
          sendReadReceipt={sendReadReceipt} 
          onlineUsers={onlineUsers} 
          socket={socket}
          callStatus={callStatus}
          callType={callType}
          remoteUser={remoteUser}
          localStream={localStream}
          remoteStream={remoteStream}
          isMicMuted={isMicMuted}
          isCameraOff={isCameraOff}
          startCall={startCall}
          answerCall={answerCall}
          rejectCall={rejectCall}
          endCall={endCall}
          toggleMic={toggleMic}
          toggleCamera={toggleCamera}
        />
      </div>
    </div>
  );
};

export default Chat;
