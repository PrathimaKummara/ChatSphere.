import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { decryptMessage, loadPrivateKey } from '../utils/encryption';
import { Moon, Sun, MessageSquarePlus, Settings2, Search, Phone, MessageSquare, Video, ArrowUpRight, ArrowDownLeft, X, Users, ChevronDown, Loader2, Check, Link } from 'lucide-react';

const Sidebar = ({ activeRoom, setActiveRoom, onlineUsers, username, profilePic, socket, onOpenSettings, onOpenProfile, startCall }) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [directConversations, setDirectConversations] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [selectedCallUser, setSelectedCallUser] = useState(null);

  // Message Requests state
  const [pendingRequests, setPendingRequests] = useState([]);

  // New Chat dropdown
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const dropdownRef = useRef(null);
  // Cache the private key so we don't hit IndexedDB on every message
  const privateKeyRef = useRef(null);

  // Load private key once on mount and fetch initial requests
  useEffect(() => {
    loadPrivateKey().then(k => { privateKeyRef.current = k; }).catch(() => {});
    fetchPendingRequests();
  }, []);

  // New DM flow
  const [showDMSearch, setShowDMSearch] = useState(false);
  const [dmQuery, setDmQuery] = useState('');
  const [dmResults, setDmResults] = useState([]);
  const [isDmSearching, setIsDmSearching] = useState(false);
  const [dmFeedback, setDmFeedback] = useState(null);

  // Create Group flow
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupResults, setGroupResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get('/api/messages/requests/pending');
      setPendingRequests(res.data);
    } catch (e) {
      console.error('Failed to fetch pending requests', e);
    }
  };

  const handleAcceptRequest = async (reqId) => {
    try {
      const res = await api.put(`/api/messages/request/${reqId}/accept`);
      setPendingRequests(prev => prev.filter(r => r.id !== reqId));
      fetchConversations();
      
      const conv = res.data.conversation;
      if (conv) {
        setActiveRoom({
          id: `dm_${conv.id}`,
          name: conv.otherUsername,
          isDirect: true,
          isJoined: true,
          otherUserId: conv.otherUserId,
          profile_pic: conv.profile_pic || ''
        });
        setActiveTab('chats');
      }
    } catch (e) {
      console.error('Failed to accept request', e);
    }
  };

  const handleBlockRequest = async (reqId) => {
    try {
      await api.put(`/api/messages/request/${reqId}/block`);
      setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (e) {
      console.error('Failed to block request', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'chats') fetchConversations();
    else if (activeTab === 'calls') fetchCallHistory();
    else if (activeTab === 'requests') fetchPendingRequests();
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    socket.on('sidebarUpdate', async ({ conversationId, content, senderId, type, fileName, isEncrypted, encryptedKey, senderEncryptedKey, iv }) => {
      const roomId = `dm_${conversationId}`;
      const currentUserId = localStorage.getItem('userId');

      let displayContent = content;

      // Decrypt if encrypted
      if (isEncrypted && content) {
        try {
          // Ensure private key is loaded
          if (!privateKeyRef.current) {
            privateKeyRef.current = await loadPrivateKey();
          }

          if (privateKeyRef.current) {
            const isSender = String(senderId) === String(currentUserId);
            const keyToUse = isSender ? senderEncryptedKey : encryptedKey;
            if (keyToUse && iv) {
              displayContent = await decryptMessage(content, keyToUse, iv, privateKeyRef.current);
            }
          }
        } catch (err) {
          console.error('Sidebar real-time decrypt failed:', err);
          displayContent = '🔒 Encrypted message';
        }
      }

      setLastMessages(prev => ({ 
        ...prev, 
        [roomId]: { 
          content: displayContent, 
          senderId, 
          type, 
          fileName, 
          isEncrypted: (displayContent === content && isEncrypted), // Flag as encrypted only if decryption failed
          createdAt: new Date() 
        } 
      }));
      const isFromMe = String(senderId) === String(currentUserId);
      const isActiveRoom = activeRoom?.id === roomId;
      if (!isFromMe && !isActiveRoom) {
        setUnreadCounts(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
      }
    });

    socket.on('chatHistoryUpdate', () => {
      fetchCallHistory();
    });

    socket.on('chatCleared', ({ roomId }) => {
      setLastMessages(prev => {
        const newState = { ...prev };
        delete newState[roomId];
        return newState;
      });
    });

    socket.on('incomingRequest', (req) => {
      setPendingRequests(prev => {
        if (prev.some(r => r.id === req.id)) return prev;
        return [req, ...prev];
      });
    });

    socket.on('requestAccepted', ({ conversationId, requestId }) => {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      fetchConversations();
    });

    socket.on('requestBlocked', ({ requestId }) => {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    });

    return () => {
      socket.off('sidebarUpdate');
      socket.off('chatHistoryUpdate');
      socket.off('chatCleared');
      socket.off('incomingRequest');
      socket.off('requestAccepted');
      socket.off('requestBlocked');
    };
  }, [socket, activeRoom]);

  useEffect(() => {
    const handleOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowNewDropdown(false); };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/api/messages/direct/conversations');
      setDirectConversations(res.data);

      // Load private key once for decrypting all last messages
      const privateKey = await loadPrivateKey();
      const currentUserId = localStorage.getItem('userId');

      const initialLast = {};
      await Promise.all(res.data.map(async (c) => {
        if (!c.lastMessage) return;
        const lm = c.lastMessage;
        const roomId = `dm_${c.conversationId}`;

        if (lm.isEncrypted && privateKey) {
          try {
            // Use senderEncryptedKey if we are the sender, otherwise use encryptedKey
            const isSender = String(lm.senderId) === String(currentUserId);
            const keyToUse = isSender ? lm.senderEncryptedKey : lm.encryptedKey;
            if (keyToUse && lm.iv) {
              const plaintext = await decryptMessage(lm.content, keyToUse, lm.iv, privateKey);
              initialLast[roomId] = { ...lm, content: plaintext, isEncrypted: false };
            } else {
              initialLast[roomId] = { ...lm, content: '🔒 Encrypted message' };
            }
          } catch {
            // Decryption failed (e.g. old key) — show fallback
            initialLast[roomId] = { ...lm, content: '🔒 Encrypted message' };
          }
        } else {
          initialLast[roomId] = lm;
        }
      }));

      setLastMessages(initialLast);
    } catch (e) { console.error('Failed to fetch conversations', e); }
  };

  const fetchCallHistory = async () => {
    try {
      const res = await api.get('/api/calls/history');
      setCallHistory(res.data);
    } catch (e) { console.error('Failed to fetch call history', e); }
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500'];
    return colors[name?.charCodeAt(0) % colors.length] || 'bg-brand-purple';
  };

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  // DM Search
  useEffect(() => {
    if (!dmQuery.trim()) { setDmResults([]); return; }
    const t = setTimeout(async () => {
      setIsDmSearching(true);
      try {
        const res = await api.get(`/api/users/search?q=${encodeURIComponent(dmQuery)}`);
        setDmResults(res.data);
      } catch (e) { console.error(e); }
      setIsDmSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [dmQuery]);

  const handleSelectDMUser = async (user) => {
    try {
      const res = await api.get(`/api/messages/direct/${user.id}`);
      if (res.data.exists) {
        const convId = res.data.conversationId;
        setActiveRoom({ id: `dm_${convId}`, name: user.username, isDirect: true, isJoined: true, otherUserId: user.id, profile_pic: user.profile_pic });
        setShowDMSearch(false); setDmQuery(''); setDmResults([]);
      } else {
        await api.post('/api/messages/request', { toUserId: user.id });
        setDmFeedback(`Message request sent to ${user.username}`);
        setTimeout(() => setDmFeedback(null), 3000);
        setShowDMSearch(false); setDmQuery(''); setDmResults([]);
      }
    } catch (e) {
      console.error(e);
      setDmFeedback(e.response?.data?.message || 'Failed to start conversation');
      setTimeout(() => setDmFeedback(null), 3000);
    }
  };

  const handleInvite = () => {
    setShowNewDropdown(false);
    const inviteLink = `${window.location.origin}/register`;
    navigator.clipboard.writeText(`Hey! Join me on ChatSphere, a professional communication platform. Sign up here: ${inviteLink}`);
    setDmFeedback('Invite link copied to clipboard!');
    setTimeout(() => setDmFeedback(null), 3000);
  };

  // Group search
  useEffect(() => {
    if (!groupQuery.trim()) { setGroupResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/users/search?q=${encodeURIComponent(groupQuery)}`);
        setGroupResults(res.data);
      } catch (e) { console.error(e); }
    }, 350);
    return () => clearTimeout(t);
  }, [groupQuery]);

  const toggleMember = (user) => {
    setSelectedMembers(prev => prev.find(m => m.id === user.id) ? prev.filter(m => m.id !== user.id) : [...prev, user]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      await api.post('/api/rooms/create', { name: groupName, memberIds: selectedMembers.map(m => m.id) });
      setShowGroupModal(false); setGroupName(''); setSelectedMembers([]); setGroupQuery('');
      fetchConversations();
    } catch (e) { console.error(e); alert('Failed to create group'); }
    setIsCreatingGroup(false);
  };

  const filteredConvos = directConversations.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCalls = callHistory.filter(c => c.otherPerson?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRequests = pendingRequests.filter(r => r.fromUsername?.toLowerCase().includes(searchQuery.toLowerCase()));

  // Helper to display last message preview safely
  const getLastMessagePreview = (last) => {
    if (!last) return 'No messages yet';
    if (!last.content) return 'No messages yet';
    
    // If the flag is set and decryption hasn't happened yet, or if it looks like base64
    if (last.isEncrypted) return '🔒 Encrypted message';
    
    // Fallback heuristic: base64-looking string with no spaces (catches edge cases)
    // Only apply if it's long and doesn't look like a standard call/file label
    const content = last.content;
    const looksEncrypted = content.length > 24
      && !content.includes(' ')
      && /^[A-Za-z0-9+/]+=*$/.test(content);
      
    if (looksEncrypted) return '🔒 Encrypted message';
    
    return content.length > 40 ? content.substring(0, 40) + '...' : content;
  };

  return (
    <div className="w-full h-full bg-white dark:bg-brand-gray-dark flex flex-col border-r border-[#e8e8f0] dark:border-brand-gray-light relative transition-colors shadow-2xl z-20">

      {/* Header */}
      <div className="h-[60px] px-4 flex items-center justify-between border-b border-[#e8e8f0] dark:border-brand-gray-light flex-shrink-0">
        <button onClick={onOpenProfile} className="relative group transition-transform hover:scale-105 active:scale-95 border-none bg-transparent cursor-pointer p-0">
          <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-brand-purple text-white font-bold text-lg shadow-sm border-2 border-white dark:border-brand-black`}>
            {profilePic 
              ? <img src={`http://localhost:5000${profilePic}`} className="w-full h-full object-cover" alt="" />
              : username?.charAt(0).toUpperCase()}
          </div>
        </button>
        <div className="flex items-center space-x-1">
          <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 hover:text-brand-purple hover:bg-gray-100 dark:hover:bg-brand-gray-medium transition-all border-none bg-transparent cursor-pointer">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {/* New Chat dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setShowNewDropdown(!showNewDropdown)} className="p-2 rounded-full text-gray-500 hover:text-brand-purple hover:bg-gray-100 dark:hover:bg-brand-gray-medium transition-all border-none bg-transparent cursor-pointer">
              <MessageSquarePlus className="w-5 h-5" />
            </button>
            {showNewDropdown && (
              <div className="absolute right-0 top-10 w-52 bg-white dark:bg-brand-gray-medium rounded-xl shadow-2xl border border-gray-100 dark:border-white/10 py-2 z-50">
                <button onClick={() => { setShowNewDropdown(false); setShowDMSearch(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand-black dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-none bg-transparent cursor-pointer text-left">
                  <MessageSquare className="w-4 h-4 text-brand-purple" /> New Direct Message
                </button>
                <button onClick={() => { setShowNewDropdown(false); setShowGroupModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand-black dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-none bg-transparent cursor-pointer text-left">
                  <Users className="w-4 h-4 text-brand-purple" /> Create Group
                </button>
                <div className="h-[1px] bg-gray-100 dark:bg-white/5 my-1 mx-2" />
                <button onClick={handleInvite}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-brand-black dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-none bg-transparent cursor-pointer text-left">
                  <Link className="w-4 h-4 text-brand-purple" /> Invite to ChatSphere
                </button>
              </div>
            )}
          </div>
          <button onClick={onOpenSettings} className="p-2 rounded-full text-gray-500 hover:text-brand-purple hover:bg-gray-100 dark:hover:bg-brand-gray-medium transition-all border-none bg-transparent cursor-pointer">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feedback toast */}
      {dmFeedback && (
        <div className="mx-3 mt-2 px-4 py-2 bg-brand-purple/10 text-brand-purple rounded-lg text-xs font-medium text-center">
          {dmFeedback}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#e8e8f0] dark:border-brand-gray-light flex-shrink-0">
        <button onClick={() => setActiveTab('chats')} className={`flex-1 py-3 flex items-center justify-center gap-1.5 font-bold text-sm transition-all border-none bg-transparent cursor-pointer ${activeTab === 'chats' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}>
          <MessageSquare className="w-4 h-4" /> Chats
        </button>
        <button onClick={() => setActiveTab('calls')} className={`flex-1 py-3 flex items-center justify-center gap-1.5 font-bold text-sm transition-all border-none bg-transparent cursor-pointer ${activeTab === 'calls' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}>
          <Phone className="w-4 h-4" /> Calls
        </button>
        <button onClick={() => setActiveTab('requests')} className={`flex-1 py-3 flex items-center justify-center gap-1.5 font-bold text-sm transition-all border-none bg-transparent cursor-pointer ${activeTab === 'requests' ? 'text-brand-purple border-b-2 border-brand-purple' : 'text-gray-400 hover:text-gray-600'} relative`}>
          <Users className="w-4 h-4" /> Requests
          {pendingRequests.length > 0 && (
            <span className="absolute top-2.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-purple opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-purple"></span>
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-3 flex-shrink-0">
        <div className="bg-gray-100 dark:bg-brand-gray-medium rounded-xl h-10 flex items-center px-3 border border-transparent focus-within:border-brand-purple transition-all">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input type="text" placeholder={`Search ${activeTab}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm text-brand-black dark:text-white" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' ? (
          filteredConvos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button onClick={() => setShowDMSearch(true)} className="mt-3 text-brand-purple text-xs font-bold border-none bg-transparent cursor-pointer hover:underline">Start one →</button>
            </div>
          ) : filteredConvos.map((conv) => {
            const roomId = `dm_${conv.conversationId}`;
            const isActive = activeRoom?.id === roomId;
            const last = lastMessages[roomId];
            return (
              <button key={conv.conversationId}
                onClick={() => {
                  setActiveRoom({ id: roomId, name: conv.name, isDirect: true, isJoined: true, otherUserId: conv.otherUserId, profile_pic: conv.profile_pic });
                  // Clear unread count when opening the conversation
                  setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
                }}
                className={`w-full flex items-center h-[72px] px-3 border-none outline-none cursor-pointer relative transition-all ${isActive ? 'bg-gray-100 dark:bg-brand-gray-medium/50' : 'bg-transparent hover:bg-gray-50 dark:hover:bg-brand-gray-medium/20'}`}>
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-purple" />}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg shadow-sm overflow-hidden ${conv.profile_pic ? '' : getAvatarColor(conv.name)}`}>
                    {conv.profile_pic ? <img src={`http://localhost:5000${conv.profile_pic}`} className="w-full h-full object-cover" alt="" /> : conv.name?.charAt(0).toUpperCase()}
                  </div>
                  {onlineUsers[conv.otherUserId] && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-brand-gray-dark rounded-full" />}
                </div>
                <div className="ml-3 flex-1 text-left border-b border-gray-50 dark:border-brand-gray-light h-full flex flex-col justify-center overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold truncate text-sm ${isActive ? 'text-brand-purple' : 'text-brand-black dark:text-white'}`}>{conv.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {last?.createdAt && <span className={`text-[10px] ${unreadCounts[roomId] > 0 && !isActive ? 'text-brand-purple font-bold' : 'text-gray-400'}`}>{new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      {unreadCounts[roomId] > 0 && !isActive && (
                        <span className="min-w-[18px] h-[18px] bg-brand-purple text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                          {unreadCounts[roomId] > 99 ? '99+' : unreadCounts[roomId]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-[13px] truncate mt-0.5 ${unreadCounts[roomId] > 0 && !isActive ? 'text-brand-black dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                    {last ? (last.type === 'media' ? `📎 ${last.fileName || 'File'}` : getLastMessagePreview(last)) : 'No messages yet'}
                  </div>
                </div>
              </button>
            );
          })
        ) : activeTab === 'calls' ? (
          filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Phone className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No call history</p>
            </div>
          ) : filteredCalls.map((call) => (
            <button key={call.id} onClick={() => setSelectedCallUser(call.otherPerson)}
              className="w-full flex items-center h-[72px] px-3 border-none bg-transparent hover:bg-gray-50 dark:hover:bg-brand-gray-medium/20 cursor-pointer transition-all group">
              <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-lg overflow-hidden ${call.otherPerson.profile_pic ? '' : getAvatarColor(call.otherPerson.name)}`}>
                {call.otherPerson.profile_pic ? <img src={`http://localhost:5000${call.otherPerson.profile_pic}`} className="w-full h-full object-cover" alt="" /> : call.otherPerson.name?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 flex-1 text-left border-b border-gray-50 dark:border-brand-gray-light h-full flex flex-col justify-center overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className={`font-bold truncate text-sm ${call.status === 'missed' ? 'text-red-500' : 'text-brand-black dark:text-white'}`}>{call.otherPerson.name}</span>
                  <div className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-brand-gray-medium transition-all text-brand-purple opacity-0 group-hover:opacity-100">
                    {call.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {call.isOutgoing ? <ArrowUpRight className="w-3 h-3 text-green-500" /> : <ArrowDownLeft className={`w-3 h-3 ${call.status === 'missed' ? 'text-red-500' : 'text-blue-500'}`} />}
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">
                    {new Date(call.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </button>
          ))
        ) : (
          filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Users className="w-10 h-10 mb-2 opacity-30 text-brand-purple" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : filteredRequests.map((req) => (
            <div key={req.id} className="w-full flex items-center justify-between h-[72px] px-3 border-b border-gray-50 dark:border-brand-gray-light bg-transparent hover:bg-gray-50 dark:hover:bg-brand-gray-medium/10 transition-all">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base shadow-sm ${getAvatarColor(req.fromUsername)}`}>
                  {req.fromUsername?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="font-bold text-sm text-brand-black dark:text-white truncate">{req.fromUsername}</p>
                  <p className="text-xs text-gray-400 truncate">Wants to message you</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => handleAcceptRequest(req.id)}
                  title="Accept request"
                  className="p-2 bg-green-500/10 hover:bg-green-500 text-green-600 hover:text-white rounded-xl transition-all border-none cursor-pointer flex items-center justify-center active:scale-95"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleBlockRequest(req.id)}
                  title="Block request"
                  className="p-2 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white rounded-xl transition-all border-none cursor-pointer flex items-center justify-center active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Premium Call Action Popup */}
      {selectedCallUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setSelectedCallUser(null)} />
          
          <div className="relative w-full max-w-[320px] bg-white dark:bg-brand-gray-dark rounded-3xl shadow-2xl overflow-hidden z-10 transform transition-all animate-in zoom-in-95 duration-300">
            {/* Top decorative gradient */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-brand-purple to-indigo-600 opacity-90 dark:opacity-40" />
            
            <button onClick={() => setSelectedCallUser(null)} className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-white transition-all border-none cursor-pointer z-20">
              <X className="w-4 h-4" />
            </button>

            <div className="pt-16 pb-6 px-6 flex flex-col items-center relative z-10">
              {/* Avatar with glow */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-xl overflow-hidden ring-4 ring-white dark:ring-brand-gray-dark ${selectedCallUser.profile_pic ? '' : getAvatarColor(selectedCallUser.name)}`}>
                {selectedCallUser.profile_pic ? <img src={`http://localhost:5000${selectedCallUser.profile_pic}`} className="w-full h-full object-cover rounded-full" alt="" /> : selectedCallUser.name?.charAt(0).toUpperCase()}
              </div>
              
              <h3 className="text-2xl font-black text-brand-black dark:text-white tracking-tight">{selectedCallUser.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium text-center">Start a secure call</p>
            </div>

            <div className="px-6 pb-6 space-y-3">
              <button 
                onClick={() => { startCall(selectedCallUser.id, selectedCallUser.name, 'audio'); setSelectedCallUser(null); }} 
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gray-50 hover:bg-green-50 dark:bg-brand-gray-medium dark:hover:bg-green-500/10 border border-gray-100 dark:border-white/5 hover:border-green-200 dark:hover:border-green-500/30 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="p-2 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full group-hover:scale-110 transition-transform"><Phone className="w-5 h-5 fill-current" /></div>
                <span className="font-bold text-gray-700 dark:text-gray-200 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">Voice Call</span>
              </button>
              
              <button 
                onClick={() => { startCall(selectedCallUser.id, selectedCallUser.name, 'video'); setSelectedCallUser(null); }} 
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gray-50 hover:bg-brand-purple/10 dark:bg-brand-gray-medium dark:hover:bg-brand-purple/20 border border-gray-100 dark:border-white/5 hover:border-brand-purple/30 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="p-2 bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple rounded-full group-hover:scale-110 transition-transform"><Video className="w-5 h-5 fill-current" /></div>
                <span className="font-bold text-gray-700 dark:text-gray-200 group-hover:text-brand-purple transition-colors">Video Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New DM Search Panel */}
      {showDMSearch && (
        <div className="absolute inset-0 bg-white dark:bg-brand-gray-dark z-[200] flex flex-col">
          <div className="h-14 flex items-center gap-3 px-4 border-b border-gray-100 dark:border-white/5">
            <button onClick={() => { setShowDMSearch(false); setDmQuery(''); setDmResults([]); }} className="p-2 border-none bg-transparent cursor-pointer text-gray-500 hover:text-brand-purple"><X className="w-5 h-5" /></button>
            <h3 className="font-bold dark:text-white">New Message</h3>
          </div>
          <div className="p-3">
            <div className="bg-gray-100 dark:bg-brand-gray-medium rounded-xl h-10 flex items-center px-3">
              <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
              <input autoFocus type="text" placeholder="Search by username..." value={dmQuery} onChange={e => setDmQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm dark:text-white" />
              {isDmSearching && <Loader2 className="w-4 h-4 animate-spin text-brand-purple flex-shrink-0" />}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dmResults.map(user => (
              <button key={user.id} onClick={() => handleSelectDMUser(user)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-none bg-transparent cursor-pointer">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${user.profile_pic ? '' : getAvatarColor(user.username)}`}>
                  {user.profile_pic ? <img src={`http://localhost:5000${user.profile_pic}`} className="w-full h-full object-cover" alt="" /> : user.username?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm dark:text-white">{user.username}</p>
                  {onlineUsers[user.id] && <p className="text-xs text-green-500">Online</p>}
                </div>
              </button>
            ))}
            {dmQuery && dmResults.length === 0 && !isDmSearching && (
              <p className="text-center text-gray-400 text-sm mt-8">No users found</p>
            )}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGroupModal(false)} />
          <div className="bg-white dark:bg-brand-gray-medium w-full max-w-[380px] rounded-2xl shadow-2xl z-10 flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg dark:text-white">Create Group</h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 border-none bg-transparent cursor-pointer text-gray-400 hover:text-brand-purple"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <input type="text" placeholder="Group name..." value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-brand-purple rounded-xl px-4 py-3 outline-none text-sm dark:text-white transition-all" />
              <div className="bg-gray-100 dark:bg-white/5 rounded-xl h-10 flex items-center px-3">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input type="text" placeholder="Add members..." value={groupQuery} onChange={e => setGroupQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm dark:text-white" />
              </div>
            </div>
            {selectedMembers.length > 0 && (
              <div className="px-4 flex flex-wrap gap-2 mb-3">
                {selectedMembers.map(m => (
                  <span key={m.id} className="flex items-center gap-1 bg-brand-purple/10 text-brand-purple text-xs font-bold px-3 py-1 rounded-full">
                    {m.username} <button onClick={() => toggleMember(m)} className="border-none bg-transparent cursor-pointer text-brand-purple hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {groupResults.map(user => {
                const isSelected = selectedMembers.find(m => m.id === user.id);
                return (
                  <button key={user.id} onClick={() => toggleMember(user)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border-none cursor-pointer ${isSelected ? 'bg-brand-purple/10' : 'bg-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden ${getAvatarColor(user.username)}`}>
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <span className={`flex-1 text-sm font-medium text-left ${isSelected ? 'text-brand-purple' : 'dark:text-white'}`}>{user.username}</span>
                    {isSelected && <Check className="w-4 h-4 text-brand-purple" />}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/5">
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || isCreatingGroup}
                className="w-full py-3 bg-brand-purple text-white rounded-xl font-bold border-none cursor-pointer hover:bg-opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {isCreatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Create Group {selectedMembers.length > 0 ? `(${selectedMembers.length + 1})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
