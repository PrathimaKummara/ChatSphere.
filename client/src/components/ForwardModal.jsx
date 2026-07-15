import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Send } from 'lucide-react';
import api, { BASE_URL } from '../utils/api';
import { encryptMessage } from '../utils/encryption';

const ForwardModal = ({ onClose, message, decryptedText, username, socket }) => {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState({});

  // Fetch active conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get('/api/messages/direct/conversations');
        setConversations(res.data);
      } catch (err) {
        console.error('Failed to load conversations for forward', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, []);

  const handleForwardToRoom = async (conv) => {
    const targetRoomId = `dm_${conv.conversationId}`;
    if (isSending[targetRoomId]) return;

    try {
      setIsSending(prev => ({ ...prev, [targetRoomId]: true }));
      const userId = localStorage.getItem('userId');

      let finalContent = decryptedText || '';
      let isEncrypted = false;
      let encryptedKey = null;
      let senderEncryptedKey = null;
      let iv = null;

      // 1. Handle E2EE if direct message
      if (conv.otherUserId && message.type !== 'media') {
        try {
          const keyRes = await api.get(`/api/users/public-key/${conv.otherUserId}`);
          const recipientPublicKey = keyRes.data.publicKey;
          
          if (recipientPublicKey) {
            const encryptedData = await encryptMessage(finalContent, recipientPublicKey);
            finalContent = encryptedData.encryptedContent;
            encryptedKey = encryptedData.encryptedKey;
            senderEncryptedKey = encryptedData.senderEncryptedKey;
            iv = encryptedData.iv;
            isEncrypted = true;
          }
        } catch (err) {
          console.error('Failed to fetch key or encrypt for forward', err);
        }
      }

      // 2. Build the message payload
      const payload = {
        senderId: parseInt(userId),
        senderName: username,
        senderProfilePic: localStorage.getItem('profile_pic'),
        roomId: targetRoomId,
        type: message.type || 'text',
        content: finalContent,
        isEncrypted,
        encryptedKey,
        senderEncryptedKey,
        iv,
        isForwarded: true,
        // Media fields if original message is media
        fileUrl: message.fileUrl || null,
        fileName: message.fileName || null,
        fileType: message.fileType || null,
        size: message.size || 0,
        tempId: Date.now()
      };

      // 3. Emit sendMessage via socket
      if (socket) {
        socket.emit('sendMessage', payload);
      }

      alert(`Message forwarded to ${conv.name}!`);
      onClose();
    } catch (error) {
      console.error('Error forwarding message:', error);
      alert('Failed to forward message');
    } finally {
      setIsSending(prev => ({ ...prev, [targetRoomId]: false }));
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="bg-white dark:bg-brand-gray-medium w-full max-w-[400px] rounded-2xl shadow-2xl z-10 flex flex-col max-h-[80vh] overflow-hidden border border-gray-100 dark:border-white/5 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between flex-shrink-0">
          <h3 className="font-extrabold text-lg text-brand-black dark:text-white tracking-tight">Forward Message</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full border-none bg-transparent cursor-pointer text-gray-400 hover:text-brand-purple transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
          <div className="bg-gray-100 dark:bg-brand-black/40 rounded-xl h-11 flex items-center px-3 border border-transparent focus-within:border-brand-purple transition-all">
            <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Search chat..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full bg-transparent border-none outline-none text-sm dark:text-white" 
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-purple" />
              <span className="text-xs font-semibold">Loading chats...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10 font-medium">No chats found</div>
          ) : (
            filteredConversations.map(conv => {
              const targetRoomId = `dm_${conv.conversationId}`;
              const sending = isSending[targetRoomId];
              return (
                <button
                  key={conv.conversationId}
                  onClick={() => handleForwardToRoom(conv)}
                  disabled={sending}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all border-none bg-transparent cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar circle */}
                    <div className="w-10 h-10 rounded-full bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {conv.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-brand-black dark:text-white truncate">{conv.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5 font-medium">{conv.email || 'Direct Chat'}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-purple" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-purple/10 text-brand-purple opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <Send className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
