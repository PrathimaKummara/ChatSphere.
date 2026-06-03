import { useState, useEffect, useRef } from 'react';
import { 
  X, Phone, Video, Search, Mail, Bell, BellOff, Calendar, 
  Image as ImageIcon, FileText, Download, Flag, ShieldOff,
  ChevronRight, Loader2, AlertTriangle
} from 'lucide-react';
import api from '../utils/api';

const REPORT_REASONS = [
  'Spam or unwanted messages',
  'Harassment or bullying',
  'Inappropriate content',
  'Fake profile',
  'Threats or violence',
  'Other',
];

const FileItem = ({ file }) => {
  const [isDownloaded, setIsDownloaded] = useState(() => {
    return localStorage.getItem(`dl_${file.id || file.fileUrl}`) === 'true';
  });

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `http://localhost:5000${file.fileUrl}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      
      setIsDownloaded(true);
      localStorage.setItem(`dl_${file.id || file.fileUrl}`, 'true');
    } catch (err) {
      console.error('Download failed', err);
      window.open(url, '_blank');
    }
  };

  return (
    <div 
      onClick={() => {
        if (isDownloaded) window.open(`http://localhost:5000${file.fileUrl}`, '_blank');
      }}
      className={`flex items-center gap-3 py-2 border-b border-gray-50 dark:border-white/5 last:border-0 ${isDownloaded ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
    >
      <div className="w-9 h-9 bg-brand-purple/10 rounded-lg flex items-center justify-center text-brand-purple flex-shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <span className="flex-1 text-xs font-medium dark:text-white truncate pr-2">{file.fileName}</span>
      {!isDownloaded && (
        <button onClick={handleDownload}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 hover:text-brand-purple transition-colors border-none bg-transparent cursor-pointer flex-shrink-0">
          <Download className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const ProfilePanel = ({ user, onClose, onlineUsers = {}, startCall, onOpenSearch, onBlock, conversationId }) => {
  const [profile, setProfile] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  const muteKey = `muted_${conversationId}`;

  if (!user) return null;

  const isOnline = onlineUsers[user.otherUserId];
  const avatarColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500'];
  const avatarColor = avatarColors[user.name?.charCodeAt(0) % avatarColors.length] || 'bg-brand-purple';

  // Load real profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.otherUserId) return;
      setIsLoadingProfile(true);
      try {
        const res = await api.get(`/api/users/profile/${user.otherUserId}`);
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user.otherUserId]);

  // Load media files
  useEffect(() => {
    const fetchMedia = async () => {
      if (!conversationId) return;
      setIsLoadingMedia(true);
      try {
        const res = await api.get(`/api/messages/${conversationId}/media`);
        setMediaFiles(res.data);
      } catch (err) {
        console.error('Failed to fetch media:', err);
      } finally {
        setIsLoadingMedia(false);
      }
    };
    fetchMedia();
  }, [conversationId]);

  // Load mute state
  useEffect(() => {
    setIsMuted(localStorage.getItem(muteKey) === 'true');
  }, [muteKey]);

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem(muteKey, String(newMuted));
  };

  const handleBlock = async () => {
    setIsBlocking(true);
    try {
      await api.post('/api/users/block', { blockedUserId: user.otherUserId });
      setActionFeedback({ type: 'success', msg: 'User blocked.' });
      setTimeout(() => {
        onBlock && onBlock(user.otherUserId);
        onClose();
      }, 1000);
    } catch (err) {
      setActionFeedback({ type: 'error', msg: 'Failed to block user.' });
    } finally {
      setIsBlocking(false);
      setShowBlockConfirm(false);
    }
  };

  const handleReport = async () => {
    if (!selectedReason) return;
    setIsReporting(true);
    try {
      await api.post('/api/users/report', { reportedUserId: user.otherUserId, reason: selectedReason });
      setActionFeedback({ type: 'success', msg: 'Report submitted. Thank you.' });
      setShowReportModal(false);
      setSelectedReason('');
    } catch (err) {
      setActionFeedback({ type: 'error', msg: 'Failed to submit report.' });
    } finally {
      setIsReporting(false);
    }
  };

  const handleSearchClick = () => {
    onClose();
    onOpenSearch && onOpenSearch();
  };

  const formatJoinDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const imageFiles = mediaFiles.filter(m => m.fileType?.startsWith('image/'));
  const docFiles = mediaFiles.filter(m => !m.fileType?.startsWith('image/'));

  return (
    <div className="absolute top-0 right-0 w-full md:w-[380px] h-full bg-white dark:bg-brand-black shadow-2xl z-[100] flex flex-col border-l border-gray-100 dark:border-white/10"
      style={{ animation: 'slideInRight 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
      
      <style>{`@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

      {/* Header */}
      <div className="h-[64px] px-5 flex items-center justify-between border-b border-gray-100 dark:border-white/5 flex-shrink-0">
        <h3 className="font-bold text-lg dark:text-white">Contact Info</h3>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all border-none bg-transparent cursor-pointer">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Feedback Toast */}
      {actionFeedback && (
        <div className={`mx-4 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-center ${actionFeedback.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600'}`}>
          {actionFeedback.msg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Profile Card */}
        <div className="p-8 flex flex-col items-center border-b border-gray-50 dark:border-white/5">
          <div className="relative mb-5">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl overflow-hidden ${profile?.profile_pic ? '' : avatarColor}`}>
              {profile?.profile_pic
                ? <img src={`http://localhost:5000${profile.profile_pic}`} className="w-full h-full object-cover" alt={user.name} />
                : user.name?.charAt(0).toUpperCase()}
            </div>
            {isOnline && <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-3 border-white dark:border-brand-black rounded-full" />}
          </div>
          <h2 className="text-2xl font-bold dark:text-white text-center">{user.name}</h2>
          <p className={`text-sm mt-1 font-semibold ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>
            {isOnline ? '● Online' : '○ Offline'}
          </p>

          {/* Quick Action Buttons */}
          <div className="flex gap-8 mt-7">
            <button onClick={() => startCall?.(user.otherUserId, user.name, 'audio')}
              className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple group-hover:bg-brand-purple group-hover:text-white transition-all border-none cursor-pointer">
                <Phone className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 group-hover:text-brand-purple transition-colors">Voice</span>
            </button>

            <button onClick={() => startCall?.(user.otherUserId, user.name, 'video')}
              className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple group-hover:bg-brand-purple group-hover:text-white transition-all border-none cursor-pointer">
                <Video className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 group-hover:text-brand-purple transition-colors">Video</span>
            </button>

            <button onClick={handleSearchClick}
              className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple group-hover:bg-brand-purple group-hover:text-white transition-all border-none cursor-pointer">
                <Search className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 group-hover:text-brand-purple transition-colors">Search</span>
            </button>
          </div>
        </div>

        {/* About Info */}
        <div className="p-5 border-b border-gray-50 dark:border-white/5">
          <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 mb-4">About</p>
          {isLoadingProfile ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400">Email</p>
                  <p className="text-sm font-medium dark:text-white">{profile?.email || 'Private'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400">Member Since</p>
                  <p className="text-sm font-medium dark:text-white">{formatJoinDate(profile?.created_at)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mute Toggle */}
        <div className="px-5 py-4 border-b border-gray-50 dark:border-white/5">
          <button onClick={handleMuteToggle}
            className="w-full flex items-center justify-between group border-none bg-transparent cursor-pointer">
            <div className="flex items-center gap-3">
              {isMuted ? <BellOff className="w-5 h-5 text-brand-purple" /> : <Bell className="w-5 h-5 text-gray-400 group-hover:text-brand-purple transition-colors" />}
              <span className="text-sm font-medium dark:text-white">{isMuted ? 'Notifications Muted' : 'Mute Notifications'}</span>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors ${isMuted ? 'bg-brand-purple' : 'bg-gray-200 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isMuted ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>

        {/* Media Section */}
        <div className="p-5 border-b border-gray-50 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">Media, Links & Docs</p>
            {mediaFiles.length > 0 && (
              <button onClick={() => setShowMediaGallery(true)}
                className="text-xs text-brand-purple font-bold flex items-center gap-1 border-none bg-transparent cursor-pointer hover:underline">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {isLoadingMedia ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading media...</div>
          ) : mediaFiles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No shared media yet</p>
          ) : (
            <>
              {/* Image Grid */}
              {imageFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {imageFiles.slice(0, 6).map((file, i) => (
                    <a key={i} href={`http://localhost:5000${file.fileUrl}`} target="_blank" rel="noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 block">
                      <img src={`http://localhost:5000${file.fileUrl}`} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </a>
                  ))}
                </div>
              )}
              {/* Document List */}
              {docFiles.slice(0, 3).map((file, i) => (
                <FileItem key={i} file={file} />
              ))}
            </>
          )}
        </div>

        {/* Danger Zone */}
        <div className="p-5 space-y-2">
          <button onClick={() => setShowReportModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all border-none bg-transparent cursor-pointer text-left">
            <Flag className="w-4 h-4" />
            <span className="text-sm font-semibold">Report User</span>
          </button>
          <button onClick={() => setShowBlockConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all border-none bg-transparent cursor-pointer text-left">
            <ShieldOff className="w-4 h-4" />
            <span className="text-sm font-semibold">Block User</span>
          </button>
        </div>
      </div>

      {/* Block Confirmation Dialog */}
      {showBlockConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-6">
          <div className="bg-white dark:bg-brand-gray-medium rounded-2xl p-6 w-full max-w-[300px] shadow-2xl">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h4 className="text-center font-bold dark:text-white mb-2">Block {user.name}?</h4>
            <p className="text-center text-xs text-gray-400 mb-6">They won't be able to message you and will be removed from your contacts.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBlockConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold dark:text-white bg-transparent cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button onClick={handleBlock} disabled={isBlocking} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold cursor-pointer hover:bg-red-600 transition-all border-none flex items-center justify-center gap-2">
                {isBlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-[200]">
          <div className="bg-white dark:bg-brand-gray-medium rounded-t-3xl p-6 w-full shadow-2xl">
            <div className="w-10 h-1 bg-gray-200 dark:bg-white/20 rounded-full mx-auto mb-5" />
            <h4 className="font-bold dark:text-white mb-1">Report {user.name}</h4>
            <p className="text-xs text-gray-400 mb-4">Select a reason for your report:</p>
            <div className="space-y-2 mb-5">
              {REPORT_REASONS.map(reason => (
                <button key={reason} onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border-none cursor-pointer ${selectedReason === reason ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/30' : 'bg-gray-50 dark:bg-white/5 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowReportModal(false); setSelectedReason(''); }} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-semibold dark:text-white bg-transparent cursor-pointer">
                Cancel
              </button>
              <button onClick={handleReport} disabled={!selectedReason || isReporting} className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2">
                {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Gallery Modal */}
      {showMediaGallery && (
        <div className="absolute inset-0 bg-white dark:bg-brand-black z-[200] flex flex-col">
          <div className="h-14 flex items-center justify-between px-5">
            <h4 className="text-white font-bold">Shared Media ({mediaFiles.length})</h4>
            <button onClick={() => setShowMediaGallery(false)} className="p-2 text-gray-400 hover:text-white border-none bg-transparent cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {imageFiles.length > 0 && (
              <>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-3">Images</p>
                <div className="grid grid-cols-3 gap-1 mb-6">
                  {imageFiles.map((file, i) => (
                    <a key={i} href={`http://localhost:5000${file.fileUrl}`} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden block">
                      <img src={`http://localhost:5000${file.fileUrl}`} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              </>
            )}
            {docFiles.length > 0 && (
              <>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-3">Documents</p>
                {docFiles.map((file, i) => (
                  <FileItem key={i} file={file} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePanel;
