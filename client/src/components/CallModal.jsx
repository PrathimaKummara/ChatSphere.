import { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone, 
  RotateCcw, Volume2, VolumeX, Wifi
} from 'lucide-react';

const CallModal = ({ 
  status, type, remoteUser, localStream, remoteStream, 
  isMicMuted, isCameraOff, callError,
  onAnswer, onReject, onEnd, onToggleMic, onToggleCamera 
}) => {
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Handle call timer
  useEffect(() => {
    let interval;
    if (status === 'active') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, status, isCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status, type]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerOff;
    }
  }, [isSpeakerOff]);

  // Show if any call-related activity (or error toast)
  if (status === 'idle' && !callError) return null;

  const avatarColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500'];
  const avatarColor = avatarColors[remoteUser?.name?.charCodeAt(0) % avatarColors.length] || 'bg-indigo-500';
  const initial = remoteUser?.name?.charAt(0)?.toUpperCase() || '?';
  const isConnecting = status === 'connecting';

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center text-white overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>

      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* ── ERROR / OFFLINE TOAST ─────────────────────────────────────── */}
      {callError && status === 'idle' && (
        <div className="fixed inset-0 flex items-center justify-center z-[2000] bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 px-8 py-6 rounded-2xl text-center max-w-[320px] shadow-2xl">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-white font-semibold text-base">{callError}</p>
          </div>
        </div>
      )}

      {/* ── OUTGOING / CONNECTING SCREEN ─────────────────────────────── */}
      {(status === 'calling' || status === 'connecting') && (
        <div className="flex flex-col items-center z-10 px-6 text-center w-full max-w-[90vw]">
          {/* Pulse rings */}
          <div className="relative mb-6 sm:mb-10">
            <div className="absolute -inset-4 sm:-inset-6 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute -inset-8 sm:-inset-12 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            
            <div className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-bold shadow-2xl z-10 overflow-hidden ${avatarColor}`}>
              {initial}
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold mb-1 truncate w-full">{remoteUser?.name}</h2>
          
          <p className="text-gray-400 text-sm font-medium tracking-widest uppercase flex items-center gap-2">
            {isConnecting ? (
              <><Wifi className="w-4 h-4 animate-pulse text-brand-purple" /> Connecting...</>
            ) : (
              <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" /> Ringing</>
            )}
          </p>

          <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">{type === 'video' ? 'Video Call' : 'Voice Call'}</p>

          {/* Cancel button */}
          <div className="mt-16 flex flex-col items-center">
            <button onClick={onEnd}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-xl hover:scale-110 active:scale-95 border-none cursor-pointer">
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <p className="text-[10px] uppercase tracking-widest font-bold mt-3 opacity-40">End Call</p>
          </div>
        </div>
      )}

      {/* ── INCOMING CALL SCREEN ──────────────────────────────────────── */}
      {status === 'incoming' && (
        <div className="flex flex-col items-center z-10 px-6">
          <div className="relative mb-8">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-white/20 shadow-2xl overflow-hidden ${avatarColor}`}>
              {initial}
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-white/20 animate-ping" style={{ animationDuration: '1.5s' }} />
          </div>
          <h2 className="text-3xl font-bold mb-1">{remoteUser?.name}</h2>
          <p className="text-gray-300 text-sm tracking-widest uppercase mb-16">
            Incoming {type === 'video' ? 'Video' : 'Voice'} Call
          </p>

          <div className="flex gap-16">
            <div className="flex flex-col items-center">
              <button onClick={onReject}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-xl hover:scale-110 border-none cursor-pointer">
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <span className="text-[10px] uppercase font-bold tracking-widest mt-3 opacity-40">Decline</span>
            </div>
            <div className="flex flex-col items-center">
              <button onClick={onAnswer}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-all shadow-xl hover:scale-110 animate-pulse border-none cursor-pointer">
                <Phone className="w-8 h-8 text-white" />
              </button>
              <span className="text-[10px] uppercase font-bold tracking-widest mt-3 opacity-40">Accept</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL SCREEN ────────────────────────────────────────── */}
      {status === 'active' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {type === 'video' ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {!isCameraOff && (
                  <div className="absolute top-8 right-8 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-gray-900 z-50">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center w-full max-w-[90vw]">
                <audio ref={remoteVideoRef} autoPlay playsInline />
                <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-5xl sm:text-6xl font-bold shadow-2xl mb-4 sm:mb-6 ${avatarColor}`}>
                  {initial}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-center truncate w-full">{remoteUser?.name}</h2>
                <p className="text-gray-400 mt-2 flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" /> Active Voice Call
                </p>
                <div className="text-4xl sm:text-5xl font-light font-mono mt-6 sm:mt-8 tracking-wider text-white">
                  {formatDuration(callDuration)}
                </div>
              </div>
            )}
          </div>

          {/* LIVE badge */}
          <div className="absolute top-8 left-8 flex items-center gap-3 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-black tracking-widest uppercase">Live · {type}</span>
            </div>
            {type === 'video' && (
              <>
                <div className="w-[1px] h-3 bg-white/20" />
                <span className="text-xs font-mono tracking-wider">{formatDuration(callDuration)}</span>
              </>
            )}
          </div>

          {/* In-call error toast */}
          {callError && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-[2000] animate-bounce uppercase tracking-widest flex items-center gap-2">
              <PhoneOff className="w-4 h-4" /> {callError}
            </div>
          )}

          {/* Control bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-4 bg-black/50 backdrop-blur-2xl px-4 sm:px-6 py-3 sm:py-4 rounded-full border border-white/10 shadow-2xl z-[100] w-[95%] max-w-[400px]">
            <button onClick={onToggleMic}
              className={`p-3 sm:p-4 rounded-full transition-all border-none cursor-pointer ${isMicMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Toggle Microphone">
              {isMicMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {type === 'video' && (
              <>
                <button onClick={onToggleCamera}
                  className={`p-3 sm:p-4 rounded-full transition-all border-none cursor-pointer ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Toggle Camera">
                  {isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
                <button className="hidden sm:block p-3 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border-none cursor-pointer">
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </>
            )}

            <button onClick={() => setIsSpeakerOff(!isSpeakerOff)}
              className={`p-3 sm:p-4 rounded-full transition-all border-none cursor-pointer ${isSpeakerOff ? 'bg-yellow-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Mute Output Audio">
              {isSpeakerOff ? <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" /> : <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <div className="w-[1px] h-8 bg-white/10 mx-1 sm:mx-2" />

            <button onClick={onEnd} className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg hover:scale-110 active:scale-95 border-none cursor-pointer" title="End Call">
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallModal;
