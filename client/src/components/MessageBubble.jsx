import React, { useState, useEffect, useRef } from 'react';
import { Download, FileText, ZoomIn, Phone, Video, ChevronDown, CornerUpLeft, Forward, Copy, Trash2 } from 'lucide-react';
import { loadPrivateKey, decryptMessage } from '../utils/encryption';
import { BASE_URL } from '../utils/api';

const MessageBubble = ({ message, onAvatarClick, isGroup, isLastSeen, onReply, onForward, onDelete }) => {
  const currentUserId = localStorage.getItem('userId');
  const isMe = String(message.senderId) === String(currentUserId);
  const menuRef = useRef(null);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [isDownloaded, setIsDownloaded] = useState(() => {
    return localStorage.getItem(`dl_${message.id}`) === 'true';
  });

  const [showActions, setShowActions] = useState(false);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };
    if (showActions) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showActions]);

  const handleDownload = async (e, url, filename) => {
    e.preventDefault();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      
      setIsDownloaded(true);
      localStorage.setItem(`dl_${message.id}`, 'true');
    } catch (err) {
      console.error('Download failed', err);
      window.open(url, '_blank');
    }
  };

  const [decryptedContent, setDecryptedContent] = useState(null);
  const [decryptedReplyContent, setDecryptedReplyContent] = useState(null);
  const [decryptionError, setDecryptionError] = useState(false);

  useEffect(() => {
    if (message.isEncrypted && !message.isDeleted) {
      const keyToUse = isMe ? (message.senderEncryptedKey || message.encryptedKey) : message.encryptedKey;
      if (!keyToUse || !message.iv || !message.content) {
        setDecryptionError(true);
        return;
      }
      const decrypt = async () => {
        try {
          const privateKey = await loadPrivateKey();
          if (!privateKey) throw new Error('Private key not found locally');
          const text = await decryptMessage(message.content, keyToUse, message.iv, privateKey);
          setDecryptedContent(text);

          // Decrypt reply quote preview if it exists
          if (message.replyToText && message.replyToTextIv) {
            const replyText = await decryptMessage(message.replyToText, keyToUse, message.replyToTextIv, privateKey);
            setDecryptedReplyContent(replyText);
          }
        } catch (err) {
          console.error('Decryption failed:', err);
          setDecryptionError(true);
        }
      };
      decrypt();
    }
  }, [message, isMe]);

  const getEffectiveContent = () => {
    if (message.isDeleted) return 'This message was deleted';
    if (message.type === 'text' || !message.type) {
      if (message.isEncrypted) {
        if (decryptedContent !== null) return decryptedContent;
        if (decryptionError) return '[Encrypted message]';
        return 'Decrypting...';
      }
      return message.content;
    }
    return message.fileName || 'Attachment';
  };

  const getEffectiveReplyContent = () => {
    if (message.replyToText) {
      if (message.isEncrypted) {
        if (decryptedReplyContent !== null) return decryptedReplyContent;
        return 'Decrypting reply...';
      }
      return message.replyToText;
    }
    return 'Attachment';
  };

  const handleCopy = () => {
    const textToCopy = getEffectiveContent();
    navigator.clipboard.writeText(textToCopy);
    setShowActions(false);
  };

  const renderContent = () => {
    if (message.isDeleted) {
      return (
        <p className="text-[14.5px] italic text-gray-400 dark:text-gray-500 flex items-center gap-1.5 select-none">
          <Trash2 className="w-3.5 h-3.5" /> This message was deleted
        </p>
      );
    }

    if (message.type === 'text' || !message.type) {
      const displayContent = getEffectiveContent();
      return <p className="text-[14.5px] leading-relaxed break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{displayContent}</p>;
    }

    const fullUrl = `${BASE_URL}${message.fileUrl}`;
    const isImage = message.fileType?.startsWith('image/');
    const isVideo = message.fileType?.startsWith('video/');

    if (isImage) {
      return (
        <div className="relative group cursor-zoom-in rounded-lg overflow-hidden mb-1 shadow-sm">
          <img src={fullUrl} alt="attachment" className="max-w-full max-h-[300px] object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8" />
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="relative rounded-lg overflow-hidden mb-1 shadow-lg bg-black">
          <video src={fullUrl} className="max-w-full max-h-[300px]" controls />
        </div>
      );
    }

    return (
      <div 
        onClick={() => {
          if (isDownloaded || isMe) {
            window.open(fullUrl, '_blank');
          }
        }}
        className={`flex items-center gap-3 p-3 rounded-xl mb-1 border ${isMe ? 'bg-white/10 border-white/20' : 'bg-gray-100 dark:bg-gray-700 border-transparent'} ${(isDownloaded || isMe) ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20' : 'bg-[#6c3bd4] text-white'}`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1 min-w-0 pr-2">
          <span className={`text-[13px] font-bold truncate ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{message.fileName}</span>
          <span className={`text-[11px] ${isMe ? 'text-white/60' : 'text-gray-500'}`}>{(message.size / 1024).toFixed(1)} KB</span>
        </div>
        {(!isDownloaded && !isMe) && (
          <button 
            onClick={(e) => handleDownload(e, fullUrl, message.fileName)} 
            className={`p-2 rounded-full border-none cursor-pointer flex-shrink-0 ${isMe ? 'text-white hover:bg-white/20 bg-transparent' : 'text-[#6c3bd4] hover:bg-gray-200 bg-transparent'} transition-colors`}>
            <Download className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  };

  const renderCallBubble = () => {
    if (message.type !== 'call') return null;
    
    const isMissed = message.status === 'missed';
    const isVideoCall = message.callType === 'video';
    
    const iconColor = isMissed ? 'text-red-500' : (isVideoCall ? 'text-[#6c3bd4]' : 'text-green-500');
    const textColor = isMissed ? 'text-red-500' : 'text-gray-900 dark:text-gray-200';
    
    return (
      <div className="w-full flex flex-col items-center my-4 animate-in fade-in duration-500">
        <div className="max-w-[280px] mx-auto bg-gray-100 dark:bg-gray-800/60 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm border border-transparent dark:border-white/5">
          <div className={`${iconColor}`}>
            {isVideoCall ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </div>
          <div className="flex flex-1 items-center justify-between gap-4">
            <span className={`text-[13px] font-medium ${textColor}`}>
              {isMissed ? 'Missed ' : (isMe ? 'Outgoing ' : 'Incoming ')} {isVideoCall ? 'Video' : 'Voice'}
            </span>
            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
              {isMissed ? 'No answer' : (message.duration ? `${Math.floor(message.duration / 60)}m ${message.duration % 60}s` : 'Call ended')}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium">
          {formatTime(message.createdAt)}
        </span>
      </div>
    );
  };

  if (message.type === 'call') return renderCallBubble();

  return (
    <div className={`flex items-end px-[10px] md:px-[20px] animate-in slide-in-from-bottom-1 duration-300 group ${isMe ? 'justify-end' : 'justify-start'}`}>
      {(!isMe && isGroup) && (
        <div onClick={() => onAvatarClick && onAvatarClick(message.senderId)} className="w-8 h-8 rounded-full bg-[#6c3bd4] flex items-center justify-center text-white text-[10px] font-bold mb-1 mr-2 cursor-pointer shadow-sm flex-shrink-0 overflow-hidden relative">
          {message.senderProfilePic && (
            <img 
              src={message.senderProfilePic && /^(https?:\/\/|data:)/.test(message.senderProfilePic) ? message.senderProfilePic : `${BASE_URL}${message.senderProfilePic}`} 
              className="w-full h-full object-cover absolute top-0 left-0 animate-in fade-in duration-300" 
              onError={(e) => {
                e.target.style.display = 'none';
                const fb = e.target.parentElement.querySelector('.bubble-fallback');
                if (fb) fb.style.display = 'flex';
              }}
              alt="" 
            />
          )}
          <div 
            className="bubble-fallback w-full h-full flex items-center justify-center text-white bg-[#6c3bd4]"
            style={{ display: message.senderProfilePic ? 'none' : 'flex' }}
          >
            {(message.senderName || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
        {/* Forwarded Header Indicator */}
        {message.isForwarded && !message.isDeleted && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic mb-1 flex items-center gap-1 select-none">
            <Forward className="w-3 h-3" /> Forwarded
          </span>
        )}

        {/* Message bubble core wrapper (horizontal alignment for hover action trigger) */}
        <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`relative px-4 py-2.5 shadow-sm ${isMe 
            ? 'bg-[#6c3bd4] text-white rounded-2xl rounded-tr-none' 
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-tl-none border border-[#e8e8f0] dark:border-transparent'}`}>
            
            {/* Quoted Reply Block */}
            {message.replyTo && !message.isDeleted && (
              <div className={`border-l-4 ${isMe ? 'border-white/50 bg-white/10' : 'border-brand-purple bg-brand-purple/5'} px-3 py-1.5 rounded-r-lg mb-2 text-left text-xs select-none max-w-full overflow-hidden`}>
                <p className={`font-bold ${isMe ? 'text-white' : 'text-brand-purple'}`}>{message.replyToSenderName}</p>
                <p className={`truncate mt-0.5 ${isMe ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{getEffectiveReplyContent()}</p>
              </div>
            )}

            {renderContent()}

            <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
              <span className="text-[10px] font-medium">{formatTime(message.createdAt)}</span>
            </div>
          </div>

          {/* Hover Menu Button (Hidden for deleted messages) */}
          {!message.isDeleted && (
            <div className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" ref={menuRef}>
              <button 
                onClick={() => setShowActions(!showActions)}
                className="w-7 h-7 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-brand-purple hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Actions Dropdown */}
              {showActions && (
                <div className={`absolute z-30 bottom-8 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 shadow-2xl rounded-2xl p-1.5 w-36 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
                  <button 
                    onClick={() => { onReply(message, getEffectiveContent()); setShowActions(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl border-none bg-transparent cursor-pointer text-left"
                  >
                    <CornerUpLeft className="w-4 h-4 text-gray-400" /> Reply
                  </button>
                  {message.type === 'text' && (
                    <button 
                      onClick={handleCopy}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl border-none bg-transparent cursor-pointer text-left"
                    >
                      <Copy className="w-4 h-4 text-gray-400" /> Copy
                    </button>
                  )}
                  <button 
                    onClick={() => { onForward(message, getEffectiveContent()); setShowActions(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl border-none bg-transparent cursor-pointer text-left"
                  >
                    <Forward className="w-4 h-4 text-gray-400" /> Forward
                  </button>
                  {isMe && (
                    <button 
                      onClick={() => { if (window.confirm('Delete this message?')) onDelete(message._id || message.id); setShowActions(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/15 rounded-xl border-none bg-transparent cursor-pointer text-left"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isLastSeen && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 mr-1 animate-in fade-in duration-300">seen</span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
