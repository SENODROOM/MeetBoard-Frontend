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
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [chatOpen, setChatOpen]           = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [messages, setMessages]           = useState([]);
  const [unread, setUnread]               = useState(0);
  const [copied, setCopied]               = useState(false);
  const [pinnedId, setPinnedId]           = useState(null);

  const [userName] = useState(
    () => localStorage.getItem('qm_userName') || 'Guest_' + Math.floor(Math.random() * 1000)
  );
  const [userId] = useState(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  });
  const isHost = !!localStorage.getItem(`qm_host_${roomId}`);

  // ── Private room: knock / admit state ──────────────────────────────────────
  const [roomInfo, setRoomInfo]       = useState(null);
  const [knockStatus, setKnockStatus] = useState(null); // null | 'knocking' | 'accepted' | 'rejected'
  const [knockRequests, setKnockRequests] = useState([]); // [{ socketId, userName }]
  const [admitted, setAdmitted]       = useState(false);

  // ── PiP ────────────────────────────────────────────────────────────────────
  const [pipVisible, setPipVisible]   = useState(false);
  const [pipDismissed, setPipDismissed] = useState(false);

  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!pipDismissed) setPipVisible(true);
      } else {
        setPipVisible(false);
        setPipDismissed(false);
      }
    };
    const onBlur  = () => { if (!pipDismissed) setPipVisible(true); };
    const onFocus = () => { setPipVisible(false); setPipDismissed(false); };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur',  onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur',  onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [pipDismissed]);

  const handlePin = useCallback((sid) => setPinnedId((p) => p === sid ? null : sid), []);

  // ── Init socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(API, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    s.on('chat-message', (msg) => {
      setMessages((p) => [...p, msg]);
      if (!chatOpen) setUnread((u) => u + 1);
    });

    // Private room: host sees knock requests
    s.on('knock-request', ({ socketId, userName: kName }) => {
      setKnockRequests((p) => [...p, { socketId, userName: kName }]);
    });

    // Guest gets admitted
    s.on('knock-accepted', () => {
      setKnockStatus('accepted');
      setAdmitted(true);
    });

    // Guest gets rejected
    s.on('knock-rejected', () => {
      setKnockStatus('rejected');
    });

    return () => { s.disconnect(); };
  }, []);

  // ── Fetch room info to determine public/private ────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/rooms/${roomId}`)
      .then((r) => r.json())
      .then((data) => setRoomInfo(data))
      .catch(() => setRoomInfo({ isPublic: true }));
  }, [roomId]);

  const {
    localStream, peers, audioEnabled, videoEnabled, screenSharing,
    initLocalStream, toggleAudio, toggleVideo, toggleScreenShare, cleanup,
  } = useWebRTC({ socket, roomId, userId, userName });

  // ── Join logic: public = join directly, private = knock first ─────────────
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!socket || !roomInfo || hasJoined.current) return;

    const doJoin = async () => {
      await initLocalStream();
      if (isHost || roomInfo.isPublic) {
        // Join immediately
        socket.emit('join-room', { roomId, userId, userName, isHost });
        hasJoined.current = true;
      } else {
        // Knock and wait
        setKnockStatus('knocking');
        socket.emit('knock', { roomId, userId, userName });
      }
    };
    doJoin();
  }, [socket, roomInfo]);

  // When admitted to private room
  useEffect(() => {
    if (!admitted || !socket || hasJoined.current) return;
    socket.emit('join-room', { roomId, userId, userName, isHost: false });
    hasJoined.current = true;
  }, [admitted, socket]);

  // Auto-unpin if peer leaves
  useEffect(() => {
    if (pinnedId && pinnedId !== 'local') {
      if (!peers.some((p) => p.socketId === pinnedId)) setPinnedId(null);
    }
  }, [peers, pinnedId]);

  const handleLeave = () => {
    cleanup();
    if (socketRef.current) socketRef.current.disconnect();
    localStorage.removeItem(`qm_host_${roomId}`);
    navigate('/');
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

  const admitUser = (sid) => {
    socketRef.current?.emit('admit-user', { roomId, socketId: sid });
    setKnockRequests((p) => p.filter((k) => k.socketId !== sid));
  };
  const rejectUser = (sid) => {
    socketRef.current?.emit('reject-user', { roomId, socketId: sid });
    setKnockRequests((p) => p.filter((k) => k.socketId !== sid));
  };

  const allParticipants = [
    { socketId: 'local', userName, stream: localStream, isLocal: true },
    ...peers.map((p) => ({ ...p, isLocal: false })),
  ];
  const pinnedParticipant = pinnedId ? allParticipants.find((p) => p.socketId === pinnedId) : null;
  const otherParticipants = pinnedParticipant
    ? allParticipants.filter((p) => p.socketId !== pinnedId)
    : allParticipants;
  const gridClass = !pinnedParticipant
    ? (allParticipants.length === 1 ? styles.grid1
       : allParticipants.length === 2 ? styles.grid2
       : allParticipants.length <= 4 ? styles.grid4
       : styles.gridMany) : null;

  // ── KNOCKING screen ─────────────────────────────────────────────────────────
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
          <p>The host has declined your request to join.</p>
          <button className={styles.waitLeave} onClick={() => navigate('/')}>Go back</button>
        </div>
      </div>
    );
  }

  // ── MAIN ROOM ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.room}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.roomInfo}>
          {roomInfo && !roomInfo.isPublic && <span className={styles.privatePill}>🔒 Private</span>}
          {roomInfo && roomInfo.isPublic  && <span className={styles.publicPill}>🌐 Public</span>}
          <span className={styles.roomId}>{roomId}</span>
          <button className={styles.copyBtn} onClick={handleCopyLink}>
            {copied ? '✓' : '⎘'} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <div className={styles.topRight}>
          <div className={styles.dot} />
          <span className={styles.participantCount}>{allParticipants.length} in call</span>
          {pinnedId && (
            <button className={styles.unpinAllBtn} onClick={() => setPinnedId(null)}>📌 Unpin</button>
          )}
        </div>
      </div>

      {/* Knock requests panel (host only) */}
      {isHost && knockRequests.length > 0 && (
        <div className={styles.knockPanel}>
          {knockRequests.map((k) => (
            <div key={k.socketId} className={styles.knockItem}>
              <span>🔔 <strong>{k.userName}</strong> wants to join</span>
              <div className={styles.knockBtns}>
                <button className={styles.admitBtn} onClick={() => admitUser(k.socketId)}>Admit</button>
                <button className={styles.rejectBtn} onClick={() => rejectUser(k.socketId)}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video area */}
      {pinnedParticipant ? (
        <div className={styles.pinnedLayout}>
          <div className={styles.pinnedMain}>
            <VideoTile stream={pinnedParticipant.stream} userName={pinnedParticipant.userName}
              isLocal={pinnedParticipant.isLocal} audioEnabled={pinnedParticipant.isLocal ? audioEnabled : true}
              videoEnabled={pinnedParticipant.isLocal ? videoEnabled : true}
              isPinned={true} onPin={() => handlePin(pinnedParticipant.socketId)} />
          </div>
          {otherParticipants.length > 0 && (
            <div className={styles.pinnedSidebar}>
              {otherParticipants.map((p) => (
                <VideoTile key={p.socketId} stream={p.stream} userName={p.userName}
                  isLocal={p.isLocal} audioEnabled={p.isLocal ? audioEnabled : true}
                  videoEnabled={p.isLocal ? videoEnabled : true}
                  isPinned={false} onPin={() => handlePin(p.socketId)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={`${styles.videoGrid} ${gridClass}`}>
          {allParticipants.map((p) => (
            <VideoTile key={p.socketId} stream={p.stream} userName={p.userName}
              isLocal={p.isLocal} audioEnabled={p.isLocal ? audioEnabled : true}
              videoEnabled={p.isLocal ? videoEnabled : true}
              isPinned={pinnedId === p.socketId} onPin={() => handlePin(p.socketId)} />
          ))}
        </div>
      )}

      <Controls
        audioEnabled={audioEnabled} videoEnabled={videoEnabled}
        screenSharing={screenSharing} chatOpen={chatOpen}
        whiteboardOpen={whiteboardOpen} unread={unread}
        onToggleAudio={toggleAudio} onToggleVideo={toggleVideo}
        onToggleScreen={toggleScreenShare}
        onToggleChat={() => { chatOpen ? setChatOpen(false) : (setChatOpen(true), setUnread(0)); }}
        onToggleWhiteboard={() => setWhiteboardOpen((o) => !o)}
        onLeave={handleLeave}
      />

      {chatOpen && (
        <ChatPanel messages={messages} userId={userId}
          onSend={sendMessage} onClose={() => setChatOpen(false)} />
      )}

      {whiteboardOpen && socket && (
        <Whiteboard socket={socket} roomId={roomId} userId={userId}
          userName={userName} onClose={() => setWhiteboardOpen(false)} />
      )}

      {/* PiP — always in DOM */}
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
        onDismiss={() => { setPipDismissed(true); setPipVisible(false); }}
        onReturnToMeet={() => { window.focus(); setPipVisible(false); setPipDismissed(false); }}
      />
    </div>
  );
}
