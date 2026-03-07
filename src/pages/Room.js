/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import { useMeetingRecorder } from '../hooks/useMeetingRecorder';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';
import Whiteboard from '../components/Whiteboard';
import PipWindow from '../components/PipWindow';
import SettingsPanel from '../components/SettingsPanel';
import FloatingVideos from '../components/FloatingVideos';
import TranscribePanel from '../components/TranscribePanel';
import BreakoutPanel from '../components/BreakoutPanel';
import PollPanel from '../components/PollPanel';
import QnAPanel from '../components/QnAPanel';
import styles from './Room.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Room() {
  const { roomId }  = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const classroomId = new URLSearchParams(location.search).get('classroom');

  // ── Identity — ALL declared first, nothing above these ──────────────────────
  const [userName, setUserName] = useState(() => localStorage.getItem('qm_userName') || '');
  const [userId] = useState(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  });
  const isHost = !!localStorage.getItem(`qm_host_${roomId}`);

  // ── Username gate ────────────────────────────────────────────────────────────
  const [nameConfirmed, setNameConfirmed] = useState(() => !!localStorage.getItem('qm_userName'));
  const [nameInput,  setNameInput]  = useState('');
  const [nameError,  setNameError]  = useState('');
  const confirmName = () => {
    if (!nameInput.trim()) { setNameError('Please enter your name'); return; }
    localStorage.setItem('qm_userName', nameInput.trim());
    setUserName(nameInput.trim());
    setNameConfirmed(true);
  };

  // ── Core UI state ────────────────────────────────────────────────────────────
  const socketRef      = useRef(null);
  const [socket, setSocket]               = useState(null);
  const [chatOpen, setChatOpen]           = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [reactionOpen, setReactionOpen]   = useState(false);
  const [messages, setMessages]           = useState([]);
  const [unread, setUnread]               = useState(0);
  const [copied, setCopied]               = useState(false);
  const [pinnedId, setPinnedId]           = useState(null);
  const [kicked, setKicked]               = useState(false);
  const [handRaised, setHandRaised]       = useState(false);
  const [layout, setLayout]               = useState('grid');
  const [reactions, setReactions]         = useState([]);

  // ── New feature panels ───────────────────────────────────────────────────────
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [breakoutOpen, setBreakoutOpen]     = useState(false);
  const [pollOpen, setPollOpen]             = useState(false);
  const [qnaOpen, setQnaOpen]               = useState(false);

  // ── Permissions (host grants to participants) ─────────────────────────────
  const [transcribePermitted, setTranscribePermitted] = useState(false);
  const [pollBadge, setPollBadge]           = useState(0);
  const [qnaBadge, setQnaBadge]             = useState(0);

  // ── Peer meta ────────────────────────────────────────────────────────────────
  const [peerMeta, setPeerMeta]           = useState({});
  const [wbPermissions, setWbPermissions] = useState({});
  const [wbAllowed, setWbAllowed]         = useState(true);

  // ── Private room ─────────────────────────────────────────────────────────────
  const [roomInfo, setRoomInfo]         = useState(null);
  const [knockStatus, setKnockStatus]   = useState(null);
  const [knockRequests, setKnockRequests] = useState([]);
  const hasJoined = useRef(false);

  // ── PiP ──────────────────────────────────────────────────────────────────────
  const [pipVisible, setPipVisible] = useState(false);
  const pipDismissedRef = useRef(false);

  // ── Classroom session tracking ───────────────────────────────────────────────
  const sessionIdRef = useRef(null);

  // ── All useEffects AFTER all state declarations ──────────────────────────────

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (!pipDismissedRef.current) setPipVisible(true);
      } else {
        setPipVisible(false);
        pipDismissedRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const onKicked = () => setKicked(true);
    window.addEventListener('qm-kicked', onKicked);
    return () => window.removeEventListener('qm-kicked', onKicked);
  }, []);

  // Classroom session lookup — safe because isHost/nameConfirmed already declared
  useEffect(() => {
    if (!classroomId || !isHost || !nameConfirmed) return;
    fetch(`${API}/api/classrooms/${classroomId}/sessions`)
      .then(r => r.json())
      .then(sessions => {
        if (!Array.isArray(sessions)) return;
        const active = sessions.find(s => s.roomId === roomId && !s.endedAt);
        if (active) sessionIdRef.current = active._id;
      }).catch(() => {});
  }, [classroomId, isHost, nameConfirmed]);

  const saveSessionData = useCallback(async () => {
    if (!classroomId || !sessionIdRef.current) return;
    const chatPayload = messages.map(m => ({
      userName: m.userName, message: m.message, timestamp: m.timestamp,
    }));
    await fetch(`${API}/api/classrooms/${classroomId}/sessions/${sessionIdRef.current}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endedAt: new Date().toISOString(), chatLog: chatPayload }),
    }).catch(() => {});
  }, [classroomId, messages]);

  // ── Socket init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nameConfirmed) return;
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('chat-message', msg => {
      setMessages(p => [...p, msg]);
      setChatOpen(prev => { if (!prev) setUnread(u => u + 1); return prev; });
    });
    s.on('knock-request',  ({ socketId, userName: kName }) =>
      setKnockRequests(p => [...p, { socketId, userName: kName }]));
    s.on('knock-accepted', () => setKnockStatus('accepted'));
    s.on('knock-rejected', () => setKnockStatus('rejected'));

    // Host controls
    s.on('force-mute',       () => window.dispatchEvent(new Event('qm-force-mute')));
    s.on('force-unmute',     () => window.dispatchEvent(new Event('qm-force-unmute')));
    s.on('force-stop-video', () => window.dispatchEvent(new Event('qm-force-stop-video')));
    s.on('wb-permission',    ({ allowed }) => setWbAllowed(allowed));
    s.on('lower-hand',       () => setHandRaised(false));

    // Reactions from peers
    s.on('peer-reaction', ({ emoji, x, y }) => spawnReaction(emoji, x, y));

    // Peer state
    s.on('peer-audio-toggle', ({ socketId, enabled }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], audioMuted: !enabled } })));
    s.on('peer-video-toggle', ({ socketId, enabled }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], videoStopped: !enabled } })));
    s.on('peer-hand-raise',   ({ socketId, userName: n }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], handRaised: true, userName: n } })));
    s.on('peer-hand-lower',   ({ socketId }) =>
      setPeerMeta(m => ({ ...m, [socketId]: { ...m[socketId], handRaised: false } })));
    s.on('user-left', ({ socketId }) =>
      setPeerMeta(m => { const n = { ...m }; delete n[socketId]; return n; }));

    // Transcription permission
    s.on('transcribe-permission', ({ allowed }) => setTranscribePermitted(allowed));

    // Poll/QnA badges when panels are closed
    s.on('poll-new', () => { setPollBadge(b => b + 1); });
    s.on('qna-new',  () => { setQnaBadge(b => b + 1);  });

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

  // ── Meeting recorder (admin only) ─────────────────────────────────────────
  const { recording, duration, startRecording, stopRecording } = useMeetingRecorder({ localStream, peers });
  const handleRecord = useCallback(() => {
    if (recording) stopRecording(); else startRecording();
  }, [recording, startRecording, stopRecording]);

  // ── Host force controls ───────────────────────────────────────────────────────
  useEffect(() => {
    const onFM  = () => { if (audioEnabled)  toggleAudio(); };
    const onFU  = () => { if (!audioEnabled) toggleAudio(); };
    const onFSV = () => { if (videoEnabled)  toggleVideo(); };
    window.addEventListener('qm-force-mute',       onFM);
    window.addEventListener('qm-force-unmute',     onFU);
    window.addEventListener('qm-force-stop-video', onFSV);
    return () => {
      window.removeEventListener('qm-force-mute',       onFM);
      window.removeEventListener('qm-force-unmute',     onFU);
      window.removeEventListener('qm-force-stop-video', onFSV);
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
    hasJoined.current = true;
    setKnockStatus(null);
  }, [knockStatus, socket]);

  // ── Auto-unpin departed peer ──────────────────────────────────────────────────
  useEffect(() => {
    if (pinnedId && pinnedId !== 'local' && !peers.some(p => p.socketId === pinnedId))
      setPinnedId(null);
  }, [peers, pinnedId]);

  // ── Reactions helper ─────────────────────────────────────────────────────────
  const spawnReaction = useCallback((emoji, x, y) => {
    const id = crypto.randomUUID();
    setReactions(r => [...r, { id, emoji, x: x ?? Math.random() * 80 + 10, y: y ?? Math.random() * 60 + 20 }]);
    setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 3000);
  }, []);

  const sendReaction = useCallback((emoji) => {
    const x = Math.random() * 80 + 10;
    const y = Math.random() * 60 + 20;
    spawnReaction(emoji, x, y);
    socketRef.current?.emit('room-reaction', { roomId, emoji, x, y });
    setReactionOpen(false);
  }, [roomId, spawnReaction]);

  // ── Leave ─────────────────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    await saveSessionData();
    cleanup();
    socketRef.current?.disconnect();
    localStorage.removeItem(`qm_host_${roomId}`);
    navigate(classroomId ? `/classroom/${classroomId}` : '/');
  }, [saveSessionData, cleanup, roomId, classroomId]);

  const handlePin      = useCallback(sid  => setPinnedId(p => p === sid ? null : sid), []);
  const handleKickUser = useCallback(sid  => socketRef.current?.emit('kick-user', { roomId, targetSocketId: sid }), [roomId]);
  const admitUser      = sid => { socketRef.current?.emit('admit-user',  { roomId, socketId: sid }); setKnockRequests(p => p.filter(k => k.socketId !== sid)); };
  const rejectUser     = sid => { socketRef.current?.emit('reject-user', { roomId, socketId: sid }); setKnockRequests(p => p.filter(k => k.socketId !== sid)); };
  const handleCopyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const sendMessage = useCallback(text => {
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

  // ── Enriched peers ────────────────────────────────────────────────────────────
  const enrichedPeers = peers.map(p => ({
    ...p,
    audioMuted:   peerMeta[p.socketId]?.audioMuted   || false,
    videoStopped: peerMeta[p.socketId]?.videoStopped || false,
    handRaised:   peerMeta[p.socketId]?.handRaised   || false,
  }));

  // ── Wait screens ──────────────────────────────────────────────────────────────
  if (!nameConfirmed) return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <div className={styles.waitLogo}><img src="/logo.png" alt="QuantumMeet" className={styles.waitLogoImage} /> QuantumMeet</div>
      <h2>What's your name?</h2>
      <p>Enter your display name to join this meeting.</p>
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
      <span style={{ fontSize: 48 }}>🚫</span>
      <h2>You were removed</h2>
      <p>The host removed you from this meeting.</p>
      <button className={styles.waitJoinBtn} onClick={() => navigate('/')}>Go home</button>
    </div></div>
  );

  if (knockStatus === 'knocking') return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <div className={styles.waitSpinner} />
      <h2>Waiting to be admitted</h2>
      <p>The host will let you in shortly.</p>
      <code className={styles.waitRoom}>{roomId}</code>
      <button className={styles.waitLeave} onClick={() => navigate('/')}>Cancel</button>
    </div></div>
  );

  if (knockStatus === 'rejected') return (
    <div className={styles.waitScreen}><div className={styles.waitCard}>
      <span style={{ fontSize: 48 }}>🚫</span>
      <h2>Entry denied</h2>
      <p>The host declined your request.</p>
      <button className={styles.waitLeave} onClick={() => navigate('/')}>Go back</button>
    </div></div>
  );

  // ── Layout helpers ────────────────────────────────────────────────────────────
  const allParticipants = [
    { socketId: 'local', userName, stream: localStream, isLocal: true },
    ...peers.map(p => ({ ...p, isLocal: false })),
  ];
  const pinnedP = pinnedId ? allParticipants.find(p => p.socketId === pinnedId) : null;
  const others  = pinnedP  ? allParticipants.filter(p => p.socketId !== pinnedId) : allParticipants;
  const n = allParticipants.length;
  const gridClass = n === 1 ? styles.grid1 : n === 2 ? styles.grid2 : n <= 4 ? styles.grid4 : styles.gridMany;
  const raisedHands = enrichedPeers.filter(p => p.handRaised);

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.room}>

      {/* Floating emoji reactions */}
      {reactions.map(r => (
        <div key={r.id} className={styles.reaction}
          style={{ left: `${r.x}%`, top: `${r.y}%` }}>
          {r.emoji}
        </div>
      ))}

      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <img src="/logo.png" alt="QuantumMeet" className={styles.logoIconImage} />
          <span>Quantum<strong>Meet</strong></span>
          {classroomId && <span className={styles.classroomPill}>🎓 Class</span>}
        </div>
        <div className={styles.roomInfo}>
          {roomInfo?.isPublic
            ? <span className={styles.publicPill}>🌐 Public</span>
            : roomInfo && <span className={styles.privatePill}>🔒 Private</span>}
          <span className={styles.roomId}>{roomId}</span>
          <button className={styles.copyBtn} onClick={handleCopyLink}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
          {isHost && <span className={styles.hostPill}>👑 Host</span>}
        </div>
        <div className={styles.topRight}>
          {/* Layout switcher */}
          <div className={styles.layoutSwitch}>
            {[['grid','⊞'],['spotlight','◉'],['sidebar','⊡']].map(([l, icon]) => (
              <button key={l}
                className={`${styles.layoutBtn} ${layout === l ? styles.layoutBtnActive : ''}`}
                onClick={() => { setLayout(l); setPinnedId(null); }} title={l}>
                {icon}
              </button>
            ))}
          </div>
          {recording && (
            <span className={styles.recBadge}>
              <span className={styles.recDot}/>
              {String(Math.floor(duration/60)).padStart(2,'0')}:{String(duration%60).padStart(2,'0')}
            </span>
          )}
          <div className={styles.liveDot} />
          <span className={styles.participantCount}>{n} in call</span>
          {pinnedId && <button className={styles.unpinAllBtn} onClick={() => setPinnedId(null)}>📌 Unpin</button>}
          {handRaised && <span className={styles.handBadge}>✋</span>}
        </div>
      </div>

      {/* ── Raised hand toasts ── */}
      {raisedHands.length > 0 && (
        <div className={styles.handNotifications}>
          {raisedHands.map(p => (
            <div key={p.socketId} className={styles.handNote}>
              ✋ <strong>{p.userName}</strong> raised their hand
            </div>
          ))}
        </div>
      )}

      {/* ── Knock requests (host) ── */}
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

      {/* ── Video area ── */}
      {layout === 'spotlight' && allParticipants.length > 0 ? (
        // Spotlight: biggest tile top, strip below
        <div className={styles.spotlightLayout}>
          <div className={styles.spotlightMain}>
            {(() => { const sp = pinnedP || allParticipants[0]; return (
              <VideoTile stream={sp.stream} userName={sp.userName} isLocal={sp.isLocal}
                audioEnabled={sp.isLocal ? audioEnabled : true}
                videoEnabled={sp.isLocal ? videoEnabled : true}
                isPinned={!!pinnedP} onPin={() => handlePin(sp.socketId)}
                isHost={isHost} onKick={sp.isLocal ? null : () => handleKickUser(sp.socketId)} />
            );})()}
          </div>
          <div className={styles.spotlightStrip}>
            {allParticipants.slice(pinnedP ? 0 : 1).filter(p => p.socketId !== (pinnedP?.socketId)).map(p => (
              <div key={p.socketId} className={styles.stripTile}>
                <VideoTile stream={p.stream} userName={p.userName} isLocal={p.isLocal}
                  audioEnabled={p.isLocal ? audioEnabled : true}
                  videoEnabled={p.isLocal ? videoEnabled : true}
                  isPinned={pinnedId === p.socketId} onPin={() => handlePin(p.socketId)}
                  isHost={isHost} onKick={p.isLocal ? null : () => handleKickUser(p.socketId)} />
              </div>
            ))}
          </div>
        </div>
      ) : layout === 'sidebar' ? (
        // Sidebar: main + right sidebar
        <div className={styles.pinnedLayout}>
          <div className={styles.pinnedMain}>
            {(() => { const sp = pinnedP || allParticipants[0]; return (
              <VideoTile stream={sp.stream} userName={sp.userName} isLocal={sp.isLocal}
                audioEnabled={sp.isLocal ? audioEnabled : true}
                videoEnabled={sp.isLocal ? videoEnabled : true}
                isPinned={!!pinnedP} onPin={() => handlePin(sp.socketId)}
                isHost={isHost} onKick={sp.isLocal ? null : () => handleKickUser(sp.socketId)} />
            );})()}
          </div>
          <div className={styles.pinnedSidebar}>
            {allParticipants.filter(p => p.socketId !== (pinnedP?.socketId || allParticipants[0]?.socketId)).map(p => (
              <VideoTile key={p.socketId} stream={p.stream} userName={p.userName} isLocal={p.isLocal}
                audioEnabled={p.isLocal ? audioEnabled : true}
                videoEnabled={p.isLocal ? videoEnabled : true}
                isPinned={pinnedId === p.socketId} onPin={() => handlePin(p.socketId)}
                isHost={isHost} onKick={p.isLocal ? null : () => handleKickUser(p.socketId)} />
            ))}
          </div>
        </div>
      ) : pinnedP ? (
        // Pinned tile layout
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
        // Default grid
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

      {/* ── Controls bar ── */}
      <Controls
        audioEnabled={audioEnabled} videoEnabled={videoEnabled}
        screenSharing={screenSharing} chatOpen={chatOpen}
        whiteboardOpen={whiteboardOpen} unread={unread}
        handRaised={handRaised} isHost={isHost}
        recording={recording}
        transcribeOpen={transcribeOpen}
        breakoutOpen={breakoutOpen}
        pollOpen={pollOpen}
        qnaOpen={qnaOpen}
        pollBadge={pollOpen ? 0 : pollBadge}
        qnaBadge={qnaOpen ? 0 : qnaBadge}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreen={toggleScreenShare}
        onToggleChat={handleToggleChat}
        onToggleWhiteboard={() => setWhiteboardOpen(o => !o)}
        onRaiseHand={handleRaiseHand}
        onOpenSettings={() => setSettingsOpen(true)}
        onReaction={() => setReactionOpen(o => !o)}
        onRecord={isHost ? handleRecord : null}
        onLeave={handleLeave}
        onToggleTranscribe={() => setTranscribeOpen(o => !o)}
        onToggleBreakout={() => setBreakoutOpen(o => !o)}
        onTogglePoll={() => { setPollOpen(o => !o); setPollBadge(0); }}
        onToggleQnA={() => { setQnaOpen(o => !o); setQnaBadge(0); }}
      />

      {/* ── Emoji reaction picker ── */}
      {reactionOpen && (
        <div className={styles.reactionPicker}>
          {['👍','❤️','😂','😮','👏','🔥','🎉','😢','💯','🤔'].map(e => (
            <button key={e} className={styles.reactionBtn} onClick={() => sendReaction(e)}>{e}</button>
          ))}
        </div>
      )}

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

      {/* ── Floating video strip (whiteboard overlay) ── */}
      {whiteboardOpen && (
        <FloatingVideos localStream={localStream} peers={peers}
          localUserName={userName} audioEnabled={audioEnabled} videoEnabled={videoEnabled} />
      )}

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <SettingsPanel
          peers={enrichedPeers} socket={socket} roomId={roomId}
          isHost={isHost} wbPermissions={wbPermissions}
          onWbPermChange={(sid, allowed) => setWbPermissions(p => ({ ...p, [sid]: allowed }))}
          onClose={() => setSettingsOpen(false)} />
      )}

      {/* ── PiP overlay ── */}
      <PipWindow
        visible={pipVisible}
        localStream={localStream} peers={peers} pinnedId={pinnedId}
        localUserName={userName} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
        onPin={handlePin} onUnpin={() => setPinnedId(null)}
        onDismiss={() => { pipDismissedRef.current = true; setPipVisible(false); }}
        onReturnToMeet={() => window.focus()}
      />

      {/* ── Transcribe panel ── */}
      {transcribeOpen && (
        <TranscribePanel
          isHost={isHost} socket={socket} roomId={roomId}
          userId={userId} userName={userName}
          permitted={transcribePermitted}
          onClose={() => setTranscribeOpen(false)}
        />
      )}

      {/* ── Breakout panel ── */}
      {breakoutOpen && (
        <BreakoutPanel
          isHost={isHost} socket={socket} roomId={roomId}
          userId={userId} userName={userName} peers={enrichedPeers}
          onClose={() => setBreakoutOpen(false)}
        />
      )}

      {/* ── Poll panel ── */}
      {pollOpen && (
        <PollPanel
          isHost={isHost} socket={socket} roomId={roomId}
          userId={userId}
          onClose={() => setPollOpen(false)}
        />
      )}

      {/* ── Q&A panel ── */}
      {qnaOpen && (
        <QnAPanel
          isHost={isHost} socket={socket} roomId={roomId}
          userId={userId} userName={userName}
          onClose={() => setQnaOpen(false)}
        />
      )}
    </div>
  );
}
