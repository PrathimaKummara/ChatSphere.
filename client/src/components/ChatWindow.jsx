// Import React hooks and icons
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Send, Phone, Video, Search, MoreVertical, 
  Paperclip, ChevronLeft, X,
  FileText, User, 
  MessageSquare, Info, BellOff, Trash2
} from 'lucide-react';
import api from '../utils/api';
import { encryptMessage } from '../utils/encryption';
import MessageBubble from './MessageBubble';
import ProfilePanel from './ProfilePanel';

const ChatWindow = ({ 
  activeRoom, setActiveRoom, messages, setMessages, sendMessage, 
  username, typingUsers, sendTypingIndicator, sendReadReceipt, onlineUsers, socket,
  callStatus, callType, remoteUser, localStream, remoteStream,
  isMicMuted, isCameraOff,
  startCall, answerCall, rejectCall, endCall, toggleMic, toggleCamera
}) => {
  const [inputText, setInputText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // E2EE state
  const [recipientPublicKey, setRecipientPublicKey] = useState(null);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Fetch recipient public key for E2EE when switching rooms
  useEffect(() => {
    if (activeRoom && activeRoom.isDirect && activeRoom.otherUserId) {
      api.get(`/api/users/public-key/${activeRoom.otherUserId}`)
        .then(res => setRecipientPublicKey(res.data.publicKey))
        .catch(err => {
          console.error('Failed to fetch public key', err);
          setRecipientPublicKey(null);
        });
    } else {
      setRecipientPublicKey(null);
    }
  }, [activeRoom]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC key — cascading close priority
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showProfile) setShowProfile(false);
        else if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else setActiveRoom(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showProfile, showSearch, setActiveRoom]);

  // Filtered messages for inline search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    return messages.filter(msg =>
      msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.fileName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  // Clear chat — permanently deletes from MongoDB
  const handleClearChat = async () => {
    if (!window.confirm('Are you sure you want to clear this chat? This permanently deletes all messages and cannot be undone.')) return;
    try {
      await api.delete(`/api/messages/${activeRoom.id}`);
      setMessages([]);
      // Notify other components and the recipient that the chat was cleared
      if (socket) {
        socket.emit('chatCleared', { roomId: activeRoom.id });
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
      alert('Failed to clear chat. Please try again.');
    }
    setShowMenu(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setFilePreview(event.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('file');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    let finalContent = inputText || '';
    let finalType = 'text';
    let isEncrypted = false;
    let encryptedKey = null;
    let senderEncryptedKey = null;
    let iv = null;

    const shouldEncrypt = recipientPublicKey && !selectedFile;

    if (shouldEncrypt) {
      try {
        const encryptedData = await encryptMessage(finalContent, recipientPublicKey);
        finalContent = encryptedData.encryptedContent;
        encryptedKey = encryptedData.encryptedKey;
        senderEncryptedKey = encryptedData.senderEncryptedKey;
        iv = encryptedData.iv;
        isEncrypted = true;
      } catch (err) {
        console.error('Encryption failed:', err);
        alert('Failed to encrypt message. Please try again.');
        return;
      }
    }

    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      try {
        const token = localStorage.getItem('token');
        const res = await api.post('/api/messages/upload', formData, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        sendMessage({
          senderId: localStorage.getItem('userId'),
          senderName: username,
          senderProfilePic: localStorage.getItem('profile_pic'),
          roomId: activeRoom.id,
          content: finalContent,
          type: 'media',
          fileUrl: res.data.fileUrl,
          fileName: res.data.fileName,
          fileType: res.data.fileType,
          size: res.data.size,
          isEncrypted,
          encryptedKey,
          senderEncryptedKey,
          iv
        });
      } catch (err) { console.error('Upload failed:', err); }
      setIsUploading(false);
      setSelectedFile(null);
      setFilePreview(null);
    } else {
      sendMessage({
        senderId: localStorage.getItem('userId'),
        senderName: username,
        senderProfilePic: localStorage.getItem('profile_pic'),
        roomId: activeRoom.id,
        type: finalType,
        content: finalContent,
        isEncrypted,
        encryptedKey,
        senderEncryptedKey,
        iv
      });
    }
    setInputText('');
    inputRef.current?.focus();
  };

  // Called by ProfilePanel search button
  const handleOpenSearch = useCallback(() => {
    setShowProfile(false);
    setShowSearch(true);
  }, []);

  // Called by ProfilePanel block button — remove room and go back
  const handleBlock = useCallback((blockedUserId) => {
    setActiveRoom(null);
  }, [setActiveRoom]);

  // Welcome screen when no room selected
  if (!activeRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-brand-black transition-colors">
        <div className="w-24 h-24 bg-brand-purple/10 rounded-full flex items-center justify-center mb-6">
          <MessageSquare className="w-12 h-12 text-brand-purple" />
        </div>
        <h2 className="text-2xl font-bold text-brand-black dark:text-white mb-2">Welcome to ChatSphere</h2>
        <p className="text-[#6b7280] dark:text-gray-400 text-center max-w-md px-6">
          Select a conversation from the sidebar to start messaging.
        </p>
      </div>
    );
  }

  const conversationId = activeRoom.id; // e.g. "dm_42"

  return (
    <div className="flex flex-col h-full bg-white dark:bg-brand-black relative flex-1 min-w-0 overflow-hidden">
      
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="h-[64px] px-4 flex items-center justify-between border-b border-[#e8e8f0] dark:border-brand-gray-light bg-white/80 dark:bg-brand-black/80 backdrop-blur-md z-20 shadow-sm relative flex-shrink-0">
        <div className="flex items-center flex-1 min-w-0">
          <button onClick={() => setActiveRoom(null)} className="mr-2 md:hidden p-2 hover:bg-gray-100 dark:hover:bg-brand-gray-medium rounded-full transition-colors border-none bg-transparent cursor-pointer">
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Avatar + name — clicking opens profile panel */}
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 min-w-0 border-none bg-transparent cursor-pointer group">
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm overflow-hidden ${activeRoom.profile_pic ? '' : 'bg-brand-purple'}`}>
                {activeRoom.profile_pic
                  ? <img src={`http://localhost:5000${activeRoom.profile_pic}`} className="w-full h-full object-cover rounded-full" alt="" />
                  : activeRoom.name?.charAt(0).toUpperCase()}
              </div>
              {onlineUsers[activeRoom.otherUserId] && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-brand-black rounded-full" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <h3 className="font-bold text-[15px] md:text-lg text-brand-black dark:text-white flex items-center gap-1.5 leading-tight">
                {activeRoom.name}
              </h3>
              <p className={`text-[11px] font-semibold ${onlineUsers[activeRoom.otherUserId] ? 'text-[#25d366]' : 'text-gray-400 dark:text-gray-500'}`}>
                {onlineUsers[activeRoom.otherUserId] ? 'Online' : 'Offline'}
              </p>
            </div>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <button onClick={() => startCall(activeRoom.otherUserId, activeRoom.name, 'video')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-brand-gray-medium text-gray-500 dark:text-gray-400 hover:text-brand-purple transition-all border-none bg-transparent cursor-pointer" title="Video Call">
            <Video className="w-5 h-5" />
          </button>
          <button onClick={() => startCall(activeRoom.otherUserId, activeRoom.name, 'audio')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-brand-gray-medium text-gray-500 dark:text-gray-400 hover:text-brand-purple transition-all border-none bg-transparent cursor-pointer" title="Voice Call">
            <Phone className="w-5 h-5" />
          </button>
          <button onClick={() => { setShowSearch(!showSearch); if (!showSearch) setSearchQuery(''); }}
            className={`p-2 rounded-full transition-all border-none bg-transparent cursor-pointer ${showSearch ? 'bg-brand-purple text-white' : 'hover:bg-gray-100 dark:hover:bg-brand-gray-medium text-gray-500 dark:text-gray-400 hover:text-brand-purple'}`} title="Search">
            <Search className="w-5 h-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-full transition-all border-none bg-transparent cursor-pointer ${showMenu ? 'bg-gray-100 dark:bg-brand-gray-medium' : 'hover:bg-gray-100 dark:hover:bg-brand-gray-medium text-gray-500 dark:text-gray-400 hover:text-brand-purple'}`} title="Options">
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-brand-gray-medium rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 py-2 z-[100]">
                <button onClick={() => { setShowProfile(true); setShowMenu(false); }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-brand-black dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-left border-none bg-transparent cursor-pointer">
                  <Info className="w-4 h-4" /> View Contact
                </button>
                <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-brand-black dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-left border-none bg-transparent cursor-pointer">
                  <BellOff className="w-4 h-4" /> Mute Notifications
                </button>
                <div className="h-[1px] bg-gray-100 dark:bg-white/5 my-1 mx-2" />
                <button onClick={handleClearChat}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all text-left border-none bg-transparent cursor-pointer font-semibold">
                  <Trash2 className="w-4 h-4" /> Clear Chat
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Search Overlay */}
        {showSearch && (
          <div className="absolute inset-0 bg-white dark:bg-brand-black px-4 flex items-center z-50">
            <button onClick={() => setShowSearch(false)} className="p-2 mr-2 text-gray-500 hover:text-brand-purple transition-all border-none bg-transparent cursor-pointer">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-gray-100 dark:bg-brand-gray-medium border-none rounded-full py-2.5 pl-10 pr-4 outline-none dark:text-white text-sm" />
            </div>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="ml-2 p-2 text-gray-400 hover:text-brand-purple border-none bg-transparent cursor-pointer transition-all">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── MESSAGES ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar bg-[#efeae2] dark:bg-[#0d1117] relative">
        {filteredMessages.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
            <Search className="w-12 h-12 mb-2" />
            <p>No matches found for "{searchQuery}"</p>
          </div>
        )}
        {filteredMessages.map((msg, index) => {
          const isGroup = activeRoom?.id && !activeRoom.id.toString().startsWith('dm_');
          
          const currentUserId = localStorage.getItem('userId');
          const isMe = String(msg.senderId) === String(currentUserId);
          let isLastSeen = false;
          if (isMe && msg.status === 'read' && !isGroup) {
            const hasSubsequentMeRead = filteredMessages.slice(index + 1).some(
              m => String(m.senderId) === String(currentUserId) && m.status === 'read'
            );
            if (!hasSubsequentMeRead) {
              isLastSeen = true;
            }
          }

          return (
            <MessageBubble 
              key={msg._id || msg.id || index} 
              message={msg} 
              isGroup={isGroup} 
              isLastSeen={isLastSeen} 
            />
          );
        })}
        {typingUsers[activeRoom.id] && (
          <div className="text-xs text-gray-500 italic ml-14 mt-2">
            {typingUsers[activeRoom.id]} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT BAR ──────────────────────────────────────────────────────── */}
      <div className="p-3 bg-white dark:bg-brand-black border-t border-[#e8e8f0] dark:border-brand-gray-light flex-shrink-0">
        {/* File preview */}
        {filePreview && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-brand-gray-medium rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filePreview === 'file'
                ? <FileText className="w-8 h-8 text-brand-purple" />
                : <img src={filePreview} className="w-12 h-12 rounded object-cover" alt="" />}
              <span className="text-xs truncate max-w-[200px] dark:text-white">{selectedFile?.name}</span>
            </div>
            <button onClick={() => { setSelectedFile(null); setFilePreview(null); }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full border-none bg-transparent cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-brand-purple transition-colors border-none bg-transparent cursor-pointer flex-shrink-0">
            <Paperclip className="w-6 h-6" />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          <div className="flex-1 relative">
            <input ref={inputRef} type="text" value={inputText}
              onChange={(e) => { setInputText(e.target.value); sendTypingIndicator(activeRoom.id); }}
              placeholder="Type a message..."
              className="w-full bg-gray-100 dark:bg-brand-gray-medium border-none rounded-full py-3 px-5 focus:ring-2 focus:ring-brand-purple/50 outline-none transition-all dark:text-white" />
          </div>
          <button type="submit" disabled={isUploading}
            className="p-3 bg-brand-purple text-white rounded-full hover:bg-brand-medium transition-all shadow-md active:scale-95 border-none cursor-pointer flex-shrink-0 disabled:opacity-50">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* ── PROFILE PANEL ─────────────────────────────────────────────────── */}
      {showProfile && (
        <ProfilePanel
          user={activeRoom}
          onClose={() => setShowProfile(false)}
          onlineUsers={onlineUsers}
          startCall={startCall}
          onOpenSearch={handleOpenSearch}
          onBlock={handleBlock}
          conversationId={conversationId}
        />
      )}
    </div>
  );
};

export default ChatWindow;
