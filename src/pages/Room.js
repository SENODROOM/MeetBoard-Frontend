/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';
import Whiteboard from '../components/Whiteboard';
import PipWindow from '../components/PipWindow';
import SettingsPanel from '../components/SettingsPanel';
import FloatingVideos from '../components/FloatingVideos';
import styles from './Room.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const classroomId = new URLSearchParams(location.search).get('classroom');
  const sessionIdRef = useRef(null);

  // ── Track classroom session ───────────────────────────────────────────────
  useEffect(() => {
    if (!classroomId || !isHost || !nameConfirmed) return;
    // Session was already created on server by ClassroomPage; find it or create
    const roomIdParam = roomId;
    fetch(`${API}/api/classrooms/${classroomId}/sessions`)
      .then(r => r.json())
      .then(sessions => {
        const active = Array.isArray(sessions) && sessions.find(s => s.roomId === roomIdParam && !s.endedAt);
        if (active) sessionIdRef.current = active._id;
      }).catch(() => {});
  }, [classroomId, isHost, nameConfirmed]);

  // ── Save chat + attendees to session on leave ─────────────────────────────
  const saveSessionData = useCallback(async () => {
    if (!classroomId || !sessionIdRef.current) return;
    const chatPayload = messages.map(m => ({ userName: m.userName, message: m.message, timestamp: m.timestamp }));
    await fetch(`${API}/api/classrooms/${classroomId}/sessions/${sessionIdRef.current}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endedAt: new Date().toISOString(), chatLog: chatPayload }),
    }).catch(() => {});
  }, [classroomId, messages]);

  // ── Identity ─────────────────────────────────────────────────────────────────
  const [userName, setUserName] = useState(() => localStorage.getItem('qm_userName') || '');
  const [userId] = useState(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  });
  const isHost = !!localStorage.getItem(`qm_host_${roomId}`);

  // ── Username gate ─────────────────────────────────────────────────────────────
  const [nameConfirmed, setNameConfirmed] = useState(() => !!localStorage.getItem('qm_userName'));
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const confirmName = () => {
    if (!nameInput.trim()) { setNameError('Please enter your name'); return; }
    localStorage.setItem('qm_userName', nameInput.trim());
    setUserName(nameInput.trim()); setNameConfirmed(true);
  };

  // ── Core state ────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);
  const [kicked, setKicked] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // ── Peer meta (mute/video/hand state) for settings panel ─────────────────────
  const [peerMeta, setPeerMeta] = useState({}); // socketId → { audioMuted, videoStopped, handRaised }
  const [wbPermissions, setWbPermissions] = useState({}); // socketId → bool (true=allowed)
  const [wbAllowed, setWbAllowed] = useState(true); // this user's whiteboard permission

  // ── Private room ──────────────────────────────────────────────────────────────
  const [roomInfo, setRoomInfo] = useState(null);
  const [knockStatus, setKnockStatus] = useState(null);
  const [knockRequests, setKnockRequests] = useState([]);
  const hasJoined = useRef(false);

  // ── PiP — REAL IMPLEMENTATION ─────────────────────────────────────────────────
  // We show our own CSS overlay PipWindow when tab is hidden.
  // Key fix: only visibilitychange, never blur/focus.
  // pipDismissed is a ref so the event listener never gets stale.
  const [pipVisible, setPipVisible] = useState(false);
  const pipDismissedRef = useRef(false);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (!pipDismissedRef.current) setPipVisible(true);
      } else {
        setPipVisible(false);
        pipDismissedRef.current = false;
      }
    };
    // visibilitychange is the ONLY correct trigger — fires when switching tabs,
    // minimising the window, or screen off. NOT on blur (clicking other app).
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Kick / force-mute / force-stop-video events ───────────────────────────────
  useEffect(() => {
    const onKicked = () => setKicked(true);
    window.addEventListener('qm-kicked', onKicked);
    return () => window.removeEventListener('qm-kicked', onKicked);
  }, []);

  const handlePin = useCallback((sid) => setPinnedId(p => p === sid ? null : sid), []);

  // ── Socket init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nameConfirmed) return;
    const s = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = s; setSocket(s);

    // Chat — broadcast to room including sender
    s.on('chat-message', (msg) => {
      setMessages(p => [...p, msg]);
      // Only increment unread if chat is closed
      setChatOpen(prev => {
        if (!prev) setUnread(u => u + 1);
        return prev;
      });
    });

    // Knock
    s.on('knock-request', ({ socketId, userName: kName }) =>
      setKnockRequests(p => [...p, { socketId, userName: kName }]));
    s.on('knock-accepted', () => setKnockStatus('accepted'));
    s.on('knock-rejected', () => setKnockStatus('rejected'));

    // Host controls received by THIS user
    s.on('force-mute',        () => { /* handled inside useWebRTC via window event */ window.dispatchEvent(new Event('qm-force-mute')); });
    s.on('force-unmute',      () => { window.dispatchEvent(new Event('qm-force-unmute')); });
    s.on('force-stop-video',  () => { window.dispatchEvent(new Event('qm-force-stop-video')); });
    s.on('wb-permission',     ({ allowed }) => setWbAllowed(allowed));
    s.on('lower-hand',        () => setHandRaised(false));

    // Peer state updates (for settings panel)
    s.on('peer-audio-toggle',  ({ socketId, enabled }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], audioMuted: !enabled } })));
    s.on('peer-video-toggle',  ({ socketId, enabled }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], videoStopped: !enabled } })));
    s.on('peer-hand-raise',   ({ socketId, userName: n }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], handRaised: true, userName: n } })));
    s.on('peer-hand-lower',   ({ socketId }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], handRaised: false } })));
    s.on('user-left', ({ socketId }) =>
      setPeerMeta(m => { const n = {...m}; delete n[socketId]; return n; }));

    return () => s.disconnect();
  }, [nameConfirmed]);

  // ── Room info ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nameConfirmed) return;
    fetch(`${API}/api/rooms/${roomId}`)
      .then(r => r.json()).then(setRoomInfo)
      .catch(() => setRoomInfo({ isPublic: true }));
  }, [roomId, nameConfirmed]);

  // ── WebRTC ────────────────────────────────────────────────────────────────────
  const { localStream, peers, audioEnabled, videoEnabled, screenSharing,
          initLocalStream, toggleAudio, toggleVideo, toggleScreenShare, cleanup,
  } = useWebRTC({ socket, roomId, userId, userName });

  // ── Force mute/video from host → apply to own tracks ─────────────────────────
  useEffect(() => {
    const onForceMute       = () => { if (audioEnabled) toggleAudio(); };
    const onForceUnmute     = () => { if (!audioEnabled) toggleAudio(); };
    const onForceStopVideo  = () => { if (videoEnabled) toggleVideo(); };
    window.addEventListener('qm-force-mute',        onForceMute);
    window.addEventListener('qm-force-unmute',      onForceUnmute);
    window.addEventListener('qm-force-stop-video',  onForceStopVideo);
    return () => {
      window.removeEventListener('qm-force-mute',       onForceMute);
      window.removeEventListener('qm-force-unmute',     onForceUnmute);
      window.removeEventListener('qm-force-stop-video', onForceStopVideo);
    };
  }, [audioEnabled, videoEnabled, toggleAudio, toggleVideo]);

  // ── Join ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomInfo || hasJoined.current || !nameConfirmed) return;
    const doJoin = async () => {
      await initLocalStream();
      if (isHost || roomInfo.isPublic) {
        socket.emit('join-room', { roomId, userId, userName, isHost });
        hasJoined.current = true;
      } else {
        setKnockStatus('knocking');
        socket.emit('knock', { roomId, userId, userName });
      }
    };
    doJoin();
  }, [socket, roomInfo, nameConfirmed]);

  useEffect(() => {
    if (knockStatus !== 'accepted' || hasJoined.current || !socket) return;
    socket.emit('join-room', { roomId, userId, userName, isHost: false });
    hasJoined.current = true; setKnockStatus(null);
  }, [knockStatus, socket]);

  // ── Auto-unpin departed peer ──────────────────────────────────────────────────
  useEffect(() => {
    if (pinnedId && pinnedId !== 'local' && !peers.some(p => p.socketId === pinnedId))
      setPinnedId(null);
  }, [peers, pinnedId]);

  const handleLeave = async () => {
    await saveSessionData();
    cleanup(); socketRef.current?.disconnect();
    localStorage.removeItem(`qm_host_${roomId}`);
    navigate('/');
  };

  const handleKickUser = useCallback((targetSocketId) => {
    socketRef.current?.emit('kick-user', { roomId, targetSocketId });
  }, [roomId]);

  const admitUser  = sid => { socketRef.current?.emit('admit-user',  { roomId, socketId: sid }); setKnockRequests(p => p.filter(k => k.socketId !== sid)); };
  const rejectUser = sid => { socketRef.current?.emit('reject-user', { roomId, socketId: sid }); setKnockRequests(p => p.filter(k => k.socketId !== sid)); };

  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const sendMessage = useCallback((text) => {
    if (!socket || !text.trim()) return;
    socket.emit('chat-message', { roomId, message: text, userName, userId });
  }, [socket, roomId, userName, userId]);

  const handleToggleChat = useCallback(() => {
    setChatOpen(prev => { if (!prev) setUnread(0); return !prev; });
  }, []);

  const handleRaiseHand = useCallback(() => {
    setHandRaised(prev => {
      const next = !prev;
      if (next) socketRef.current?.emit('raise-hand', { roomId, userName });
      else      socketRef.current?.emit('lower-hand', { roomId });
      return next;
    });
  }, [roomId, userName]);

  // ── Enriched peers for settings ───────────────────────────────────────────────
  const enrichedPeers = peers.map(p => ({
    ...p,
    audioMuted:    peerMeta[p.socketId]?.audioMuted    || false,
    videoStopped:  peerMeta[p.socketId]?.videoStopped  || false,
    handRaised:    peerMeta[p.socketId]?.handRaised     || false,
  }));

  // ── Wait screens ──────────────────────────────────────────────────────────────
  if (!nameConfirmed) return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <div className={styles.waitLogo}>⬡ QuantumMeet</div>
      <h2>What's your name?</h2><p>Enter your name to join this meeting.</p>
      <input className={styles.waitInput} type="text" placeholder="Your name"
        value={nameInput} autoFocus
        onChange={e => { setNameInput(e.target.value); setNameError(''); }}
        onKeyDown={e => e.key === 'Enter' && confirmName()} />
      {nameError && <p className={styles.waitError}>{nameError}</p>}
      <button className={styles.waitJoinBtn} onClick={confirmName}>Join Meeting →</button>
      <button className={styles.waitLeave} onClick={() => navigate('/')}>← Back</button>
    </div></div>
  );

  if (kicked) return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <span style={{fontSize:48}}>🚫</span>
      <h2>You were removed</h2><p>The host removed you from this meeting.</p>
      <button className={styles.waitJoinBtn} onClick={() => navigate('/')}>Go home</button>
    </div></div>
  );

  if (knockStatus === 'knocking') return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <div className={styles.waitSpinner} />
      <h2>Waiting to be admitted</h2><p>The host will let you in shortly.</p>
      <code className={styles.waitRoom}>{roomId}</code>
      <button className={styles.waitLeave} onClick={() => navigate('/')}>Cancel</button>
    </div></div>
  );

  if (knockStatus === 'rejected') return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <span style={{fontSize:48}}>🚫</span>
      <h2>Entry denied</h2><p>The host declined your request.</p>
      <button className={styles.waitLeave} onClick={() => navigate('/')}>Go back</button>
    </div></div>
  );

  // ── Main room layout ──────────────────────────────────────────────────────────
  const allParticipants = [
    { socketId: 'local', userName, stream: localStream, isLocal: true },
    ...peers.map(p => ({ ...p, isLocal: false })),
  ];
  const pinnedP  = pinnedId ? allParticipants.find(p => p.socketId === pinnedId) : null;
  const others   = pinnedP  ? allParticipants.filter(p => p.socketId !== pinnedId) : allParticipants;
  const gridClass = !pinnedP
    ? (allParticipants.length === 1 ? styles.grid1
      : allParticipants.length === 2 ? styles.grid2
      : allParticipants.length <= 4  ? styles.grid4 : styles.gridMany) : null;

  // Hand-raise banners
  const raisedHands = enrichedPeers.filter(p => p.handRaised);

  return (
    <div className={styles.room}>
      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.roomInfo}>
          {roomInfo?.isPublic  && <span className={styles.publicPill}>🌐 Public</span>}
          {roomInfo && !roomInfo.isPublic && <span className={styles.privatePill}>🔒 Private</span>}
          <span className={styles.roomId}>{roomId}</span>
          <button className={styles.copyBtn} onClick={handleCopyLink}>
            {copied ? '✓ Copied' : '⎘ Copy link'}
          </button>
        </div>
        <div className={styles.topRight}>
          <div className={styles.dot} />
          <span className={styles.participantCount}>{allParticipants.length} in call</span>
          {pinnedId && <button className={styles.unpinAllBtn} onClick={() => setPinnedId(null)}>📌 Unpin</button>}
          {handRaised && <span className={styles.handBadge}>✋ Hand raised</span>}
        </div>
      </div>

      {/* ── Raised hand notifications ── */}
      {raisedHands.length > 0 && (
        <div className={styles.handNotifications}>
          {raisedHands.map(p => (
            <div key={p.socketId} className={styles.handNote}>
              ✋ <strong>{p.userName}</strong> raised their hand
            </div>
          ))}
        </div>
      )}

      {/* ── Knock panel (host) ── */}
      {isHost && knockRequests.length > 0 && (
        <div className={styles.knockPanel}>
          {knockRequests.map(k => (
            <div key={k.socketId} className={styles.knockItem}>
              <span>🔔 <strong>{k.userName}</strong> wants to join</span>
              <div className={styles.knockBtns}>
                <button className={styles.admitBtn}  onClick={() => admitUser(k.socketId)}>Admit</button>
                <button className={styles.rejectBtn} onClick={() => rejectUser(k.socketId)}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Video grid ── */}
      {pinnedP ? (
        <div className={styles.pinnedLayout}>
          <div className={styles.pinnedMain}>
            <VideoTile stream={pinnedP.stream} userName={pinnedP.userName} isLocal={pinnedP.isLocal}
              audioEnabled={pinnedP.isLocal ? audioEnabled : true}
              videoEnabled={pinnedP.isLocal ? videoEnabled : true}
              isPinned onPin={() => handlePin(pinnedP.socketId)}
              isHost={isHost} onKick={pinnedP.isLocal ? null : () => handleKickUser(pinnedP.socketId)} />
          </div>
          {others.length > 0 && (
            <div className={styles.pinnedSidebar}>
              {others.map(p => (
                <VideoTile key={p.socketId} stream={p.stream} userName={p.userName} isLocal={p.isLocal}
                  audioEnabled={p.isLocal ? audioEnabled : true}
                  videoEnabled={p.isLocal ? videoEnabled : true}
                  isPinned={false} onPin={() => handlePin(p.socketId)}
                  isHost={isHost} onKick={p.isLocal ? null : () => handleKickUser(p.socketId)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={`${styles.videoGrid} ${gridClass}`}>
          {allParticipants.map(p => (
            <VideoTile key={p.socketId} stream={p.stream} userName={p.userName} isLocal={p.isLocal}
              audioEnabled={p.isLocal ? audioEnabled : true}
              videoEnabled={p.isLocal ? videoEnabled : true}
              isPinned={pinnedId === p.socketId} onPin={() => handlePin(p.socketId)}
              isHost={isHost} onKick={p.isLocal ? null : () => handleKickUser(p.socketId)} />
          ))}
        </div>
      )}

      {/* ── Controls ── */}
      <Controls
        audioEnabled={audioEnabled} videoEnabled={videoEnabled}
        screenSharing={screenSharing} chatOpen={chatOpen}
        whiteboardOpen={whiteboardOpen} unread={unread}
        handRaised={handRaised} isHost={isHost}
        onToggleAudio={toggleAudio} onToggleVideo={toggleVideo}
        onToggleScreen={toggleScreenShare}
        onToggleChat={handleToggleChat}
        onToggleWhiteboard={() => setWhiteboardOpen(o => !o)}
        onRaiseHand={handleRaiseHand}
        onOpenSettings={() => setSettingsOpen(true)}
        onLeave={handleLeave}
      />

      {/* ── Chat panel ── */}
      {chatOpen && (
        <ChatPanel messages={messages} userId={userId}
          onSend={sendMessage} onClose={() => setChatOpen(false)} />
      )}

      {/* ── Whiteboard ── */}
      {whiteboardOpen && socket && (
        <Whiteboard socket={socket} roomId={roomId} userId={userId}
          userName={userName} wbAllowed={wbAllowed || isHost}
          onClose={() => setWhiteboardOpen(false)} />
      )}

      {/* ── Floating video strip on whiteboard ── */}
      {whiteboardOpen && (
        <FloatingVideos
          localStream={localStream} peers={peers}
          localUserName={userName} audioEnabled={audioEnabled} videoEnabled={videoEnabled} />
      )}

      {/* ── Settings ── */}
      {settingsOpen && (
        <SettingsPanel
          peers={enrichedPeers} socket={socket} roomId={roomId}
          isHost={isHost} wbPermissions={wbPermissions}
          onWbPermChange={(sid, allowed) => setWbPermissions(p => ({...p, [sid]: allowed}))}
          onClose={() => setSettingsOpen(false)} />
      )}

      {/* ── PiP ── */}
      <PipWindow
        visible={pipVisible}
        localStream={localStream} peers={peers} pinnedId={pinnedId}
        localUserName={userName} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
        onPin={handlePin} onUnpin={() => setPinnedId(null)}
        onDismiss={() => { pipDismissedRef.current = true; setPipVisible(false); }}
        onReturnToMeet={() => window.focus()}
      />
    </div>
  );
}
