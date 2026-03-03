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

const SERVER = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [userName] = useState(
    () => localStorage.getItem('qm_userName') || 'Guest_' + Math.floor(Math.random() * 1000)
  );
  const [userId] = useState(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  });
  const [copied, setCopied] = useState(false);
  const [pinnedId, setPinnedId] = useState(null);

  // PiP: show when tab is hidden
  const [tabHidden, setTabHidden] = useState(false);
  const [pipDismissed, setPipDismissed] = useState(false);

  useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setTabHidden(hidden);
      if (!hidden) setPipDismissed(false); // restore PiP next time tab hides
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const showPip = tabHidden && !pipDismissed;

  const handlePin = useCallback((socketId) => {
    setPinnedId((prev) => (prev === socketId ? null : socketId));
  }, []);

  // Init socket
  useEffect(() => {
    const s = io(SERVER, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);
    s.on('chat-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!chatOpen) setUnread((u) => u + 1);
    });
    return () => { s.disconnect(); };
  }, []);

  const {
    localStream, peers, audioEnabled, videoEnabled, screenSharing,
    initLocalStream, toggleAudio, toggleVideo, toggleScreenShare, cleanup,
  } = useWebRTC({ socket, roomId, userId, userName });

  useEffect(() => {
    if (!socket) return;
    (async () => {
      await initLocalStream();
      socket.emit('join-room', { roomId, userId, userName });
    })();
    return () => cleanup();
  }, [socket]);

  useEffect(() => {
    if (pinnedId && pinnedId !== 'local') {
      const stillPresent = peers.some((p) => p.socketId === pinnedId);
      if (!stillPresent) setPinnedId(null);
    }
  }, [peers, pinnedId]);

  const handleLeave = () => {
    cleanup();
    if (socketRef.current) socketRef.current.disconnect();
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

  const openChat = () => { setChatOpen(true); setUnread(0); };

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
      : styles.gridMany)
    : null;

  return (
    <div className={styles.room}>
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.roomInfo}>
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
              📌 Unpin all
            </button>
          )}
        </div>
      </div>

      {pinnedParticipant ? (
        <div className={styles.pinnedLayout}>
          <div className={styles.pinnedMain}>
            <VideoTile
              stream={pinnedParticipant.stream}
              userName={pinnedParticipant.userName}
              isLocal={pinnedParticipant.isLocal}
              audioEnabled={pinnedParticipant.isLocal ? audioEnabled : true}
              videoEnabled={pinnedParticipant.isLocal ? videoEnabled : true}
              isPinned={true}
              onPin={() => handlePin(pinnedParticipant.socketId)}
            />
          </div>
          {otherParticipants.length > 0 && (
            <div className={styles.pinnedSidebar}>
              {otherParticipants.map((p) => (
                <VideoTile
                  key={p.socketId}
                  stream={p.stream}
                  userName={p.userName}
                  isLocal={p.isLocal}
                  audioEnabled={p.isLocal ? audioEnabled : true}
                  videoEnabled={p.isLocal ? videoEnabled : true}
                  isPinned={false}
                  onPin={() => handlePin(p.socketId)}
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
        onToggleChat={() => { chatOpen ? setChatOpen(false) : openChat(); }}
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

      {showPip && (
        <PipWindow
          localStream={localStream}
          peers={peers}
          pinnedId={pinnedId}
          localUserName={userName}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onPin={handlePin}
          onUnpin={() => setPinnedId(null)}
          onReturnToMeet={() => window.focus()}
        />
      )}
    </div>
  );
}
