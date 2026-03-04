import React from 'react';
import styles from './Controls.module.css';

const Btn = ({ onClick, active, danger, badge, children, title }) => (
  <button
    title={title}
    onClick={onClick}
    className={`${styles.btn} ${active ? styles.active : ''} ${danger ? styles.danger : ''}`}
  >
    {children}
    {badge > 0 && <span className={styles.badge}>{badge}</span>}
  </button>
);

export default function Controls({
  audioEnabled, videoEnabled, screenSharing,
  chatOpen, whiteboardOpen, unread,
  handRaised, isHost,
  onToggleAudio, onToggleVideo, onToggleScreen,
  onToggleChat, onToggleWhiteboard,
  onRaiseHand, onOpenSettings, onLeave,
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <Btn onClick={onToggleAudio} active={!audioEnabled} title={audioEnabled ? 'Mute' : 'Unmute'}>
          <span className={styles.icon}>{audioEnabled ? '🎙️' : '🔇'}</span>
          <span className={styles.label}>{audioEnabled ? 'Mute' : 'Unmute'}</span>
        </Btn>

        <Btn onClick={onToggleVideo} active={!videoEnabled} title={videoEnabled ? 'Stop video' : 'Start video'}>
          <span className={styles.icon}>{videoEnabled ? '📷' : '📵'}</span>
          <span className={styles.label}>{videoEnabled ? 'Stop video' : 'Start video'}</span>
        </Btn>

        <Btn onClick={onToggleScreen} active={screenSharing} title="Share screen">
          <span className={styles.icon}>🖥️</span>
          <span className={styles.label}>{screenSharing ? 'Stop share' : 'Share'}</span>
        </Btn>

        <Btn onClick={onToggleWhiteboard} active={whiteboardOpen} title="Whiteboard">
          <span className={styles.icon}>🖊️</span>
          <span className={styles.label}>Whiteboard</span>
        </Btn>

        <Btn onClick={onToggleChat} active={chatOpen} badge={!chatOpen ? unread : 0} title="Chat">
          <span className={styles.icon}>💬</span>
          <span className={styles.label}>Chat</span>
        </Btn>

        <Btn onClick={onRaiseHand} active={handRaised} title={handRaised ? 'Lower hand' : 'Raise hand'}>
          <span className={styles.icon}>✋</span>
          <span className={styles.label}>{handRaised ? 'Lower hand' : 'Raise hand'}</span>
        </Btn>

        <Btn onClick={onOpenSettings} title="Settings">
          <span className={styles.icon}>⚙️</span>
          <span className={styles.label}>{isHost ? 'Manage' : 'Settings'}</span>
        </Btn>

        <Btn onClick={onLeave} danger title="Leave">
          <span className={styles.icon}>📞</span>
          <span className={styles.label}>Leave</span>
        </Btn>
      </div>
    </div>
  );
}
