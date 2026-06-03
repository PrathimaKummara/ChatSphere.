import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Camera, LogOut, Moon, Sun, Bell, User as UserIcon, Check, Loader2, ChevronLeft } from 'lucide-react';

const Settings = ({ isOpen, initialView = 'settings', onClose, onUpdateName, onUpdateProfilePic, socket }) => {
  const [currentView, setCurrentView] = useState(initialView);

  // Profile and preference states
  const [displayName, setDisplayName] = useState(localStorage.getItem('username') || '');
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profile_pic') || null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [aboutSuccess, setAboutSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notifications') !== 'false');
  const [aboutText, setAboutText] = useState(localStorage.getItem('about') || 'Hey there! I am using ChatSphere.');
  
  // Ref for file input trigger
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Sync notifications option to localStorage
  useEffect(() => {
    localStorage.setItem('notifications', notificationsEnabled ? 'true' : 'false');
  }, [notificationsEnabled]);

  // Sync currentView when opened
  useEffect(() => {
    if (isOpen) setCurrentView(initialView);
  }, [isOpen, initialView]);

  // Sync theme detection
  useEffect(() => {
    setIsDarkMode(localStorage.getItem('theme') === 'dark');
  }, [isOpen]);

  // Update display name logic
  const handleSaveName = async () => {
    try {
      setIsUpdating(true);
      await api.put('/api/users/update-name', { newName: displayName });
      
      localStorage.setItem('username', displayName);
      if (onUpdateName) onUpdateName(displayName);
      if (socket) socket.emit('updateProfile', { userId: localStorage.getItem('userId'), username: displayName });
      
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (error) { 
      console.error('Update name failed', error);
      alert('Failed to update name'); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleSaveAbout = async () => {
    try {
      setIsUpdating(true);
      await api.put('/api/users/update-about', { about: aboutText });
      localStorage.setItem('about', aboutText);
      setAboutSuccess(true);
      setTimeout(() => setAboutSuccess(false), 3000);
    } catch (error) {
      console.error('Update about failed', error);
      alert('Failed to update about');
    } finally {
      setIsUpdating(false);
    }
  };

  // Avatar upload logic
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedAvatar(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!selectedAvatar) return;
    try {
      setIsUpdating(true);
      const formData = new FormData();
      formData.append('avatar', selectedAvatar);
      
      const response = await api.post('/api/users/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newUrl = response.data.profile_pic;
      localStorage.setItem('profile_pic', newUrl);
      setProfilePic(newUrl);
      setAvatarPreview(null);
      setSelectedAvatar(null);
      
      if (socket) socket.emit('updateProfile', { userId: localStorage.getItem('userId'), profile_pic: newUrl });
      if (onUpdateProfilePic) onUpdateProfilePic(newUrl);
      alert('Profile picture updated!');
    } catch (error) { 
      console.error('Avatar upload failed', error);
      alert('Upload failed'); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleThemeToggle = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    document.documentElement.classList.toggle('dark', newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.clear();
      window.location.href = '/login';
    }, 800); // brief delay to show spinner
  };

  const handleBack = () => {
    if (currentView === 'profile' && initialView === 'settings') {
      setCurrentView('settings');
    } else {
      onClose(); // Otherwise close the whole panel
    }
  };

  return (
    <div className={`absolute top-0 bottom-0 left-0 w-full md:w-[380px] bg-gray-50/60 dark:bg-brand-black/95 backdrop-blur-xl border-r border-[#e8e8f0] dark:border-brand-gray-light z-[100] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl overflow-hidden`}>
      
      {/* ── Sleek Header ── */}
      <div className="h-[64px] px-4 flex items-center justify-between border-b border-[#e8e8f0] dark:border-brand-gray-light bg-white/90 dark:bg-brand-black/90 backdrop-blur-md z-20 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-brand-gray-medium hover:text-brand-purple p-2 rounded-full transition-colors bg-transparent border-none cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-brand-black dark:text-white">{currentView === 'settings' ? 'Settings' : 'Profile'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {currentView === 'settings' ? (
          <div className="space-y-4 py-2">
            {/* Premium Profile Summary Card */}
            <div 
              onClick={() => setCurrentView('profile')} 
              className="mx-2 p-4 bg-white dark:bg-brand-gray-dark border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center gap-4 group"
            >
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-lg overflow-hidden shadow-md ring-2 ring-brand-purple ring-offset-2 dark:ring-offset-brand-gray-dark transition-all duration-300 group-hover:ring-4">
                  {profilePic 
                    ? <img src={`http://localhost:5000${profilePic}`} className="w-full h-full object-cover" alt="" /> 
                    : displayName?.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-extrabold text-brand-black dark:text-white truncate text-base leading-tight group-hover:text-brand-purple transition-colors">{displayName}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{aboutText}</p>
              </div>
            </div>

            {/* General Preferences Group */}
            <div className="mx-2 bg-white dark:bg-brand-gray-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm space-y-5">
              <span className="text-[11px] font-bold text-brand-purple uppercase tracking-wider block">Preferences</span>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 dark:bg-brand-gray-medium rounded-xl text-gray-500 dark:text-gray-400">
                    {isDarkMode ? <Sun className="w-4 h-4 text-brand-purple" /> : <Moon className="w-4 h-4 text-brand-purple" />}
                  </div>
                  <span className="font-bold text-xs text-brand-black dark:text-gray-200">Dark Mode</span>
                </div>
                <button 
                  onClick={handleThemeToggle} 
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer border-none ${isDarkMode ? 'bg-brand-purple' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 dark:bg-brand-gray-medium rounded-xl text-gray-500 dark:text-gray-400">
                    <Bell className="w-4 h-4 text-brand-purple" />
                  </div>
                  <span className="font-bold text-xs text-brand-black dark:text-gray-200">Notifications</span>
                </div>
                <button 
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)} 
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer border-none ${notificationsEnabled ? 'bg-brand-purple' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Sign Out Card */}
            <div className="mx-2 pt-2">
              <button 
                onClick={handleLogout} 
                disabled={isLoggingOut} 
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/15 dark:hover:bg-red-950/25 text-red-500 rounded-2xl font-bold transition-all duration-300 border-none cursor-pointer shadow-sm disabled:opacity-70 hover:-translate-y-0.5"
              >
                {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span className="text-xs">{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Profile Editing View */}
            <div className="mx-2 flex flex-col items-center p-6 bg-white dark:bg-brand-gray-dark border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => fileInputRef.current.click()}
              >
                <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-brand-gray-medium flex items-center justify-center overflow-hidden ring-4 ring-brand-purple/20 shadow-lg">
                  {avatarPreview 
                    ? <img src={avatarPreview} className="w-full h-full object-cover" alt="" /> 
                    : profilePic 
                      ? <img src={`http://localhost:5000${profilePic}`} className="w-full h-full object-cover" alt="" /> 
                      : <UserIcon className="w-12 h-12 text-gray-400" />}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              
              {selectedAvatar && (
                <button 
                  onClick={handleUploadAvatar} 
                  className="mt-5 bg-brand-purple hover:bg-brand-medium text-white px-5 py-2.5 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all border-none cursor-pointer flex items-center gap-2 text-xs"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply Photo
                </button>
              )}
            </div>

            {/* Display Name Input Card */}
            <div className="mx-2 bg-white dark:bg-brand-gray-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-brand-purple uppercase tracking-wider block">Your Name</span>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  className="flex-1 bg-gray-50 dark:bg-brand-black/40 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-brand-black dark:text-white font-bold focus:ring-2 focus:ring-brand-purple/35 outline-none transition-all text-sm" 
                />
                <button 
                  onClick={handleSaveName} 
                  className="px-4 py-2.5 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold rounded-xl transition-all border-none cursor-pointer text-xs"
                >
                  Save
                </button>
              </div>
              {nameSuccess && <p className="text-[10px] text-green-500 font-bold mt-1">✓ Name updated successfully</p>}
            </div>
            
            {/* About / Bio Input Card */}
            <div className="mx-2 bg-white dark:bg-brand-gray-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-brand-purple uppercase tracking-wider block">About</span>
              <textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full bg-gray-50 dark:bg-brand-black/40 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-brand-black dark:text-white font-semibold focus:ring-2 focus:ring-brand-purple/35 outline-none resize-none transition-all text-sm"
                placeholder="Write something about yourself..."
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400 font-medium">{aboutText.length}/160</span>
                <button 
                  onClick={handleSaveAbout} 
                  disabled={isUpdating}
                  className="px-4 py-2 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold rounded-lg transition-all border-none cursor-pointer disabled:opacity-50 flex items-center gap-1 text-xs"
                >
                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save
                </button>
              </div>
              {aboutSuccess && <p className="text-[10px] text-green-500 font-bold mt-1">✓ About bio updated</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
