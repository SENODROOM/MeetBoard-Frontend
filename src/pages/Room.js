/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';
import Whiteboard from '../components/Whiteboard';
import PipWindow from '../components/PipWindow';
import styles from './Room.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // ── Identity ────────────────────────────────────────────────────────────────
  const [userName, setUserName] = useState(() => localStorage.getItem('qm_userName') || '');
  const [userId] = useState(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  });
  const isHost = !!localStorage.getItem(`qm_host_${roomId}`);

  // ── Username gate ────────────────────────────────────────────────────────────
  const [nameConfirmed, setNameConfirmed] = useState(() => !!localStorage.getItem('qm_userName'));
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');

  const confirmName = () => {
    if (!nameInput.trim()) { setNameError('Please enter your name'); return; }
    localStorage.setItem('qm_userName', nameInput.trim());
    setUserName(nameInput.trim());
    setNameConfirmed(true);
  };

  // ── UI state ─────────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);
  const [kicked, setKicked] = useState(false);

  // ── Private room ─────────────────────────────────────────────────────────────
  const [roomInfo, setRoomInfo] = useState(null);
  const [knockStatus, setKnockStatus] = useState(null);
  const [knockRequests, setKnockRequests] = useState([]);
  const hasJoined = useRef(false);

  // ── PiP — only visibilitychange, no blur/focus ──────────────────────────────
  const [pipVisible, setPipVisible] = useState(false);
  const pipDismissedRef = useRef(false);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (!pipDismissedRef.current) setPipVisible(true);
      } else {
        setPipVisible(false);
        pipDismissedRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Kicked ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKicked = () => setKicked(true);
    window.addEventListener('qm-kicked', onKicked);
    return () => window.removeEventListener('qm-kicked', onKicked);
  }, []);

  const handlePin = useCallback((sid) => setPinnedId((p) => (p === sid ? null : sid)), []);

  // ── Socket init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nameConfirmed) return;
    const s = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);
    s.on('chat-message', (msg) => {
      setMessages((p) => [...p, msg]);
      setUnread((u) => u + 1);
    });
    s.on('knock-request', ({ socketId, userName: kName }) =>
      setKnockRequests((p) => [...p, { socketId, userName: kName }]));
    s.on('knock-accepted', () => setKnockStatus('accepted'));
    s.on('knock-rejected', () => setKnockStatus('rejected'));
    return () => s.disconnect();
  }, [nameConfirmed]);

  // ── Room info ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nameConfirmed) return;
    fetch(`${API}/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then(setRoomInfo)
      .catch(() => setRoomInfo({ isPublic: true }));
  }, [roomId, nameConfirmed]);

  const {
    localStream, peers, audioEnabled, videoEnabled, screenSharing,
    initLocalStream, toggleAudio, toggleVideo, toggleScreenShare, cleanup,
  } = useWebRTC({ socket, roomId, userId, userName });

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
  }, [socket, roomInfo, nameConfirmed]); // eslint-disable-line

  // ── Admitted ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (knockStatus !== 'accepted' || hasJoined.current || !socket) return;
    socket.emit('join-room', { roomId, userId, userName, isHost: false });
    hasJoined.current = true;
    setKnockStatus(null);
  }, [knockStatus, socket]); // eslint-disable-line

  // ── Auto-unpin ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pinnedId && pinnedId !== 'local' && !peers.some((p) => p.socketId === pinnedId)) {
      setPinnedId(null);
    }
  }, [peers, pinnedId]);

  const handleLeave = () => {
    cleanup();
    socketRef.current?.disconnect();
    localStorage.removeItem(`qm_host_${roomId}`);
    navigate('/');
  };

  const handleKickUser = useCallback((targetSocketId) => {
    socketRef.current?.emit('kick-user', { roomId, targetSocketId });
  }, [roomId]);

  const admitUser = (sid) => {
    socketRef.current?.emit('admit-user', { roomId, socketId: sid });
    setKnockRequests((p) => p.filter((k) => k.socketId !== sid));
  };

  const rejectUser = (sid) => {
    socketRef.current?.emit('reject-user', { roomId, socketId: sid });
    setKnockRequests((p) => p.filter((k) => k.socketId !== sid));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendMessage = useCallback((text) => {
    if (!socket || !text.trim()) return;
    socket.emit('chat-message', { roomId, message: text, userName, userId });
  }, [socket, roomId, userName, userId]);

  const openChat = useCallback(() => {
    setChatOpen(true);
    setUnread(0);
  }, []);

  const handleToggleChat = useCallback(() => {
    setChatOpen((prev) => {
      if (!prev) setUnread(0);
      return !prev;
    });
  }, []);

  // ── Screens ───────────────────────────────────────────────────────────────────
  if (!nameConfirmed) {
    return (
      <div className={styles.waitScreen}>
        <div className={styles.waitCard}>
          <div className={styles.waitLogo}>⬡ QuantumMeet</div>
          <h2>What's your name?</h2>
          <p>Enter your name to join this meeting.</p>
          <input
            className={styles.waitInput}
            type="text"
            placeholder="Your name"
            value={nameInput}
            autoFocus
            onChange={(e) => { setNameInput(e.target.value); setNameError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmName(); }}
          />
          {nameError && <p className={styles.waitError}>{nameError}</p>}
          <button className={styles.waitJoinBtn} onClick={confirmName}>Join Meeting →</button>
          <button className={styles.waitLeave} onClick={() => navigate('/')}>← Back</button>
        </div>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className={styles.waitScreen}>
        <div className={styles.waitCard}>
          <span style={{ fontSize: 48 }}>🚫</span>
          <h2>You were removed</h2>
          <p>The host removed you from this meeting.</p>
          <button className={styles.waitJoinBtn} onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }

  if (knockStatus === 'knocking') {
    return (
      <div className={styles.waitScreen}>
        <div className={styles.waitCard}>
          <div className={styles.waitSpinner} />
          <h2>Waiting to be admitted</h2>
          <p>The host will let you in shortly.</p>
          <code className={styles.waitRoom}>{roomId}</code>
          <button className={styles.waitLeave} onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>
    );
  }

  if (knockStatus === 'rejected') {
    return (
      <div className={styles.waitScreen}>
        <div className={styles.waitCard}>
          <span style={{ fontSize: 48 }}>🚫</span>
          <h2>Entry denied</h2>
          <p>The host declined your request.</p>
          <button className={styles.waitLeave} onClick={() => navigate('/')}>Go back</button>
        </div>
      </div>
    );
  }

  // ── Main room ─────────────────────────────────────────────────────────────────
  const allParticipants = [
    { socketId: 'local', userName, stream: localStream, isLocal: true },
    ...peers.map((p) => ({ ...p, isLocal: false })),
  ];
  const pinnedP = pinnedId ? allParticipants.find((p) => p.socketId === pinnedId) : null;
  const others = pinnedP
    ? allParticipants.filter((p) => p.socketId !== pinnedId)
    : allParticipants;
  const gridClass = !pinnedP
    ? (allParticipants.length === 1 ? styles.grid1
      : allParticipants.length === 2 ? styles.grid2
      : allParticipants.length <= 4 ? styles.grid4
      : styles.gridMany)
    : null;

  return (
    <div className={styles.room}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.roomInfo}>
          {roomInfo && roomInfo.isPublic && (
            <span className={styles.publicPill}>🌐 Public</span>
          )}
          {roomInfo && !roomInfo.isPublic && (
            <span className={styles.privatePill}>🔒 Private</span>
          )}
          <span className={styles.roomId}>{roomId}</span>
          <button className={styles.copyBtn} onClick={handleCopyLink}>
            {copied ? '✓' : '⎘'} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <div className={styles.topRight}>
          <div className={styles.dot} />
          <span className={styles.participantCount}>{allParticipants.length} in call</span>
          {pinnedId && (
            <button className={styles.unpinAllBtn} onClick={() => setPinnedId(null)}>
              📌 Unpin
            </button>
          )}
        </div>
      </div>

      {/* Knock requests (host only) */}
      {isHost && knockRequests.length > 0 && (
        <div className={styles.knockPanel}>
          {knockRequests.map((k) => (
            <div key={k.socketId} className={styles.knockItem}>
              <span>🔔 <strong>{k.userName}</strong> wants to join</span>
              <div className={styles.knockBtns}>
                <button className={styles.admitBtn} onClick={() => admitUser(k.socketId)}>
                  Admit
                </button>
                <button className={styles.rejectBtn} onClick={() => rejectUser(k.socketId)}>
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video grid */}
      {pinnedP ? (
        <div className={styles.pinnedLayout}>
          <div className={styles.pinnedMain}>
            <VideoTile
              stream={pinnedP.stream}
              userName={pinnedP.userName}
              isLocal={pinnedP.isLocal}
              audioEnabled={pinnedP.isLocal ? audioEnabled : true}
              videoEnabled={pinnedP.isLocal ? videoEnabled : true}
              isPinned
              onPin={() => handlePin(pinnedP.socketId)}
              isHost={isHost}
              onKick={pinnedP.isLocal ? null : () => handleKickUser(pinnedP.socketId)}
            />
          </div>
          {others.length > 0 && (
            <div className={styles.pinnedSidebar}>
              {others.map((p) => (
                <VideoTile
                  key={p.socketId}
                  stream={p.stream}
                  userName={p.userName}
                  isLocal={p.isLocal}
                  audioEnabled={p.isLocal ? audioEnabled : true}
                  videoEnabled={p.isLocal ? videoEnabled : true}
                  isPinned={false}
                  onPin={() => handlePin(p.socketId)}
                  isHost={isHost}
                  onKick={p.isLocal ? null : () => handleKickUser(p.socketId)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={`${styles.videoGrid} ${gridClass}`}>
          {allParticipants.map((p) => (
            <VideoTile
              key={p.socketId}
              stream={p.stream}
              userName={p.userName}
              isLocal={p.isLocal}
              audioEnabled={p.isLocal ? audioEnabled : true}
              videoEnabled={p.isLocal ? videoEnabled : true}
              isPinned={pinnedId === p.socketId}
              onPin={() => handlePin(p.socketId)}
              isHost={isHost}
              onKick={p.isLocal ? null : () => handleKickUser(p.socketId)}
            />
          ))}
        </div>
      )}

      <Controls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        screenSharing={screenSharing}
        chatOpen={chatOpen}
        whiteboardOpen={whiteboardOpen}
        unread={unread}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreen={toggleScreenShare}
        onToggleChat={handleToggleChat}
        onToggleWhiteboard={() => setWhiteboardOpen((o) => !o)}
        onLeave={handleLeave}
      />

      {chatOpen && (
        <ChatPanel
          messages={messages}
          userId={userId}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      )}

      {whiteboardOpen && socket && (
        <Whiteboard
          socket={socket}
          roomId={roomId}
          userId={userId}
          userName={userName}
          onClose={() => setWhiteboardOpen(false)}
        />
      )}

      <PipWindow
        visible={pipVisible}
        localStream={localStream}
        peers={peers}
        pinnedId={pinnedId}
        localUserName={userName}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onPin={handlePin}
        onUnpin={() => setPinnedId(null)}
        onDismiss={() => {
          pipDismissedRef.current = true;
          setPipVisible(false);
        }}
        onReturnToMeet={() => window.focus()}
      />
    </div>
  );
}
