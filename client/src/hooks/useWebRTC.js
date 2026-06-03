// Import React hooks
import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const useWebRTC = (socket, userId, username) => {
  // Call Status: idle | calling | connecting | incoming | active
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [callError, setCallError] = useState(null);

  // Media Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // ── Caller/Receiver MP3 Audio Players ──
  const ringtoneAudio = useRef(null);
  const incomingAudio = useRef(null);

  useEffect(() => {
    ringtoneAudio.current = new Audio(`/sounds/ringtone.mp3?t=${Date.now()}`);
    ringtoneAudio.current.loop = true;
    ringtoneAudio.current.volume = 0.5;

    incomingAudio.current = new Audio(`/sounds/incoming.mp3?t=${Date.now()}`);
    incomingAudio.current.loop = true;
    incomingAudio.current.volume = 0.5;

    // Unlock WebRTC call audios on first user interaction to bypass autoplay restrictions
    const unlockWebRTCAudio = () => {
      if (ringtoneAudio.current && incomingAudio.current) {
        const playRingtone = ringtoneAudio.current.play();
        if (playRingtone !== undefined) {
          playRingtone.then(() => {
            ringtoneAudio.current.pause();
            ringtoneAudio.current.currentTime = 0;
          }).catch(() => {});
        }

        const playIncoming = incomingAudio.current.play();
        if (playIncoming !== undefined) {
          playIncoming.then(() => {
            incomingAudio.current.pause();
            incomingAudio.current.currentTime = 0;
          }).catch(() => {});
        }
      }
      document.removeEventListener('click', unlockWebRTCAudio);
      document.removeEventListener('keydown', unlockWebRTCAudio);
    };

    document.addEventListener('click', unlockWebRTCAudio);
    document.addEventListener('keydown', unlockWebRTCAudio);

    return () => {
      ringtoneAudio.current?.pause();
      incomingAudio.current?.pause();
      document.removeEventListener('click', unlockWebRTCAudio);
      document.removeEventListener('keydown', unlockWebRTCAudio);
    };
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneAudio.current) {
      ringtoneAudio.current.pause();
    }
  }, []);

  const startRingtone = useCallback(() => {
    stopRingtone();
    const isEnabled = localStorage.getItem('notifications') !== 'false';
    if (!isEnabled) return;
    if (ringtoneAudio.current) {
      ringtoneAudio.current.currentTime = 0;
      ringtoneAudio.current.play().catch(() => {});
    }
  }, [stopRingtone]);

  const stopIncomingRing = useCallback(() => {
    if (incomingAudio.current) {
      incomingAudio.current.pause();
    }
  }, []);

  const startIncomingRing = useCallback(() => {
    stopIncomingRing();
    const isEnabled = localStorage.getItem('notifications') !== 'false';
    if (!isEnabled) return;
    if (incomingAudio.current) {
      incomingAudio.current.currentTime = 0;
      incomingAudio.current.play().catch(() => {});
    }
  }, [stopIncomingRing]);

  const stopSounds = useCallback(() => {
    stopRingtone();
    stopIncomingRing();
  }, [stopRingtone, stopIncomingRing]);

  // Auto-decline timeout ref (30 seconds)
  const autoDeclineTimer = useRef(null);


  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);
  const remoteUserRef = useRef(null);
  const isCaller = useRef(false);
  const callStartTime = useRef(null);
  // Store the pending offer signal for when media becomes available
  const pendingOfferRef = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setCallError_timed = useCallback((msg, ms = 4000) => {
    setCallError(msg);
    setTimeout(() => setCallError(null), ms);
  }, []);

  const createPeerConnection = useCallback((targetUserId) => {
    if (peerConnection.current) peerConnection.current.close();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.ontrack = (event) => {
      console.log('Remote stream received');
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('iceCandidate', { to: targetUserId, candidate: event.candidate });
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnection.current = pc;
    return pc;
  }, [socket]);

  // ── START CALL (non-blocking UI) ─────────────────────────────────────────
  const startCall = useCallback(async (targetUserId, targetName, type) => {
    try {
      // ① Show the outgoing call screen IMMEDIATELY — no delay
      isCaller.current = true;
      callStartTime.current = null;
      setCallStatus('calling');
      setCallType(type);
      const userObj = { id: targetUserId, name: targetName };
      setRemoteUser(userObj);
      remoteUserRef.current = userObj;

      // Play caller ringback tone (distinct low-pitched double-beep)
      startRingtone();

      // ② THEN get media (this is the blocking operation)
      setCallStatus('connecting'); // Sub-state: waiting for permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      setCallStatus('calling'); // Back to calling now that we have media

      // ③ Create offer and emit
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('callUser', {
          userToCall: targetUserId,
          signalData: offer,
          from: userId,
          name: username,
          callType: type
        });
      }
    } catch (error) {
      console.error('Call failed:', error);
      stopSounds();

      // Handle permission denial gracefully
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCallError_timed('Camera/microphone access denied. Please allow permissions and try again.');
      } else {
        setCallError_timed('Failed to start call. Please try again.');
      }

      // Reset state fully
      setCallStatus('idle');
      setLocalStream(null);
      setRemoteStream(null);
      setRemoteUser(null);
      localStreamRef.current = null;
      if (peerConnection.current) peerConnection.current.close();
      peerConnection.current = null;
    }
  }, [socket, userId, username, createPeerConnection, stopSounds, startRingtone, setCallError_timed]);

  // ── ANSWER CALL ───────────────────────────────────────────────────────────
  const answerCall = useCallback(async () => {
    try {
      isCaller.current = false;
      callStartTime.current = Date.now();
      // Clear auto-decline timer since user answered
      if (autoDeclineTimer.current) { clearTimeout(autoDeclineTimer.current); autoDeclineTimer.current = null; }
      stopSounds();
      setCallStatus('active');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(remoteUser.id);
      await pc.setRemoteDescription(new RTCSessionDescription(remoteUser.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        // Emit callAnswered so the server relays signal back to the caller
        socket.emit('callAnswered', { to: remoteUser.id, signal: answer });
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
      if (error.name === 'NotAllowedError') {
        setCallError_timed('Camera/microphone access denied.');
      }
      endCall();
    }
  }, [socket, remoteUser, callType, createPeerConnection, stopSounds, setCallError_timed]);

  // ── REJECT CALL ───────────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (socket && remoteUser) {
      socket.emit('rejectCall', { to: remoteUser.id, callType });
    }
    endCall();
  }, [socket, remoteUser, callType]);

  // ── LOG CALL HELPER ───────────────────────────────────────────────────────
  const logCallIfCaller = useCallback((remote, status = 'answered') => {
    if (!isCaller.current || !remote?.id || !socket) return;
    let duration = 0;
    if (callStartTime.current && status === 'answered') {
      duration = Math.floor((Date.now() - callStartTime.current) / 1000);
    }
    const ct = callType || 'audio';

    // 1. Save to MySQL callhistory table (persistent call log)
    socket.emit('saveCallHistory', {
      callerId: parseInt(userId),
      receiverId: parseInt(remote.id),
      callType: ct,
      status: duration > 0 ? 'answered' : status,
      durationSeconds: duration
    });

    // 2. Post a visual call-summary message in the chat (MongoDB)
    const ids = [String(userId), String(remote.id)].sort();
    const roomId = `dm_${ids[0]}_${ids[1]}`;
    socket.emit('sendMessage', {
      senderId: userId,
      senderName: username,
      content: duration > 0
        ? `${ct === 'video' ? '📹' : '📞'} Call ended (${Math.floor(duration / 60)}m ${duration % 60}s)`
        : status === 'missed' ? `${ct === 'video' ? '📹' : '📞'} Missed call`
        : `${ct === 'video' ? '📹' : '📞'} Call declined`,
      roomId,
      type: 'call',
      callType: ct,
      duration
    });
  }, [socket, userId, username, callType]);

  // ── END CALL ──────────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    stopSounds();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (peerConnection.current) peerConnection.current.close();
    
    if (remoteUser?.id && socket) {
      socket.emit('endCall', { to: remoteUser.id, callType });
      // If we hang up before they answer, it's a missed call.
      const status = callStatus === 'active' ? 'answered' : 'missed';
      logCallIfCaller(remoteUser, status);
    }

    setCallStatus('idle');
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteUser(null);
    remoteUserRef.current = null;
    setCallType(null);
    localStreamRef.current = null;
    peerConnection.current = null;
    isCaller.current = false;
    callStartTime.current = null;
    setIsMicMuted(false);
    setIsCameraOff(false);
  }, [remoteUser, socket, stopSounds, callType, logCallIfCaller]);

  // ── CONTROLS ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  }, []);

  // ── SOCKET EVENT LISTENERS ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('incomingCall', ({ signal, from, username: callerName, callType: incomingCallType }) => {
      console.log('📞 Incoming call from:', callerName);
      setCallStatus('incoming');
      setCallType(incomingCallType);
      const userObj = { id: from, name: callerName, signal };
      setRemoteUser(userObj);
      remoteUserRef.current = userObj;

      // Play receiver ring (distinct high-pitched dual-tone)
      startIncomingRing();

      // Auto-decline after 30 seconds if not answered
      if (autoDeclineTimer.current) clearTimeout(autoDeclineTimer.current);
      autoDeclineTimer.current = setTimeout(() => {
        autoDeclineTimer.current = null;
        // Emit rejection to caller with 'no-answer' reason
        if (socket && remoteUserRef.current) {
          socket.emit('rejectCall', { to: remoteUserRef.current.id });
        }
        stopSounds();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        if (peerConnection.current) peerConnection.current.close();
        setCallStatus('idle');
        setLocalStream(null);
        setRemoteStream(null);
        setRemoteUser(null);
        remoteUserRef.current = null;
        setCallType(null);
        localStreamRef.current = null;
        peerConnection.current = null;
        isCaller.current = false;
        callStartTime.current = null;
      }, 30000);
    });

    // Caller side: receiver answered — set remote description and go active
    socket.on('callAnswered', async ({ signal }) => {
      console.log('✅ callAnswered received — activating call');
      callStartTime.current = Date.now();
      if (autoDeclineTimer.current) { clearTimeout(autoDeclineTimer.current); autoDeclineTimer.current = null; }
      stopSounds();
      setCallStatus('active');
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on('callAccepted', async (signal) => {
      console.log('✅ Call accepted (legacy)');
      callStartTime.current = Date.now();
      if (autoDeclineTimer.current) { clearTimeout(autoDeclineTimer.current); autoDeclineTimer.current = null; }
      stopSounds();
      setCallStatus('active');
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on('iceCandidate', async ({ candidate }) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { console.error('ICE error:', e); }
      }
    });

    socket.on('callRejected', (data) => {
      stopSounds();
      if (autoDeclineTimer.current) { clearTimeout(autoDeclineTimer.current); autoDeclineTimer.current = null; }
      if (data?.reason === 'offline') {
        setCallError_timed('User is currently offline');
      } else {
        setCallError_timed('Call was declined');
      }
      // Log as 'missed' (never answered) or 'rejected' (user declined)
      const rejectStatus = data?.reason === 'offline' ? 'missed' : 'rejected';
      logCallIfCaller(remoteUserRef.current, rejectStatus);

      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (peerConnection.current) peerConnection.current.close();
      setCallStatus('idle');
      setLocalStream(null);
      setRemoteStream(null);
      setRemoteUser(null);
      remoteUserRef.current = null;
      setCallType(null);
      localStreamRef.current = null;
      peerConnection.current = null;
      isCaller.current = false;
      callStartTime.current = null;
    });

    socket.on('callEnded', () => {
      stopSounds();
      if (autoDeclineTimer.current) { clearTimeout(autoDeclineTimer.current); autoDeclineTimer.current = null; }
      // Log as answered (peer ended the call, so it was active)
      logCallIfCaller(remoteUserRef.current, 'answered');

      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (peerConnection.current) peerConnection.current.close();
      setCallStatus('idle');
      setLocalStream(null);
      setRemoteStream(null);
      setRemoteUser(null);
      remoteUserRef.current = null;
      setCallType(null);
      localStreamRef.current = null;
      peerConnection.current = null;
      isCaller.current = false;
      callStartTime.current = null;
    });

    return () => {
      socket.off('incomingCall');
      socket.off('callAnswered');
      socket.off('callAccepted');
      socket.off('iceCandidate');
      socket.off('callRejected');
      socket.off('callEnded');
    };
  }, [socket, endCall, stopSounds, setCallError_timed]);

  return {
    callStatus, callType, remoteUser, localStream, remoteStream,
    isMicMuted, isCameraOff, callError,
    startCall, answerCall, rejectCall, endCall, toggleMic, toggleCamera
  };
};

export default useWebRTC;
