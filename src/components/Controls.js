import React from 'react';
import styles from './Controls.module.css';

const Btn = ({ onClick, active, danger, children, title }) => (
  <button
    title={title}
    onClick={onClick}
    className={`${styles.btn} ${active ? styles.active : ''} ${danger ? styles.danger : ''}`}
  >
    {children}
  </button>
);

export default function Controls({
  audioEnabled,
  videoEnabled,
  screenSharing,
  chatOpen,
  whiteboardOpen,
  unread,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleChat,
  onToggleWhiteboard,
  onLeave,
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <Btn onClick={onToggleAudio} active={!audioEnabled} title="Toggle Microphone">
          {audioEnabled ? '🎙️' : '🔇'}
          <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
        </Btn>

        <Btn onClick={onToggleVideo} active={!videoEnabled} title="Toggle Camera">
          {videoEnabled ? '📷' : '📵'}
          <span>{videoEnabled ? 'Stop video' : 'Start video'}</span>
        </Btn>

        <Btn onClick={onToggleScreen} active={screenSharing} title="Share Screen">
          🖥️
          <span>{screenSharing ? 'Stop share' : 'Share screen'}</span>
        </Btn>

        <Btn onClick={onToggleWhiteboard} active={whiteboardOpen} title="Collaborative Whiteboard">
          🖊️
          <span>Whiteboard</span>
        </Btn>

        <div className={styles.chatWrap}>
          <Btn onClick={onToggleChat} active={chatOpen} title="Chat">
            💬
            <span>Chat</span>
          </Btn>
          {unread > 0 && <span className={styles.badge}>{unread}</span>}
        </div>

        <Btn onClick={onLeave} danger title="Leave Meeting">
          📞
          <span>Leave</span>
        </Btn>
      </div>
    </div>
  );
}
