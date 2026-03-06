import React from 'react';
import styles from './Controls.module.css';

function Btn({ onClick, active, danger, warn, badge, title, disabled, children }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        styles.btn,
        active   ? styles.active  : '',
        danger   ? styles.danger  : '',
        warn     ? styles.warn    : '',
        disabled ? styles.dimmed : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
      {badge > 0 && <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

export default function Controls({
  audioEnabled, videoEnabled, screenSharing,
  chatOpen, whiteboardOpen, unread,
  handRaised, isHost, recording,
  transcribeOpen, breakoutOpen, pollOpen, qnaOpen,
  pollBadge, qnaBadge,
  onToggleAudio, onToggleVideo, onToggleScreen,
  onToggleChat, onToggleWhiteboard,
  onRaiseHand, onOpenSettings, onReaction, onRecord, onLeave,
  onToggleTranscribe, onToggleBreakout, onTogglePoll, onToggleQnA,
}) {
  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <Btn onClick={onToggleAudio} active={!audioEnabled} title={audioEnabled ? 'Mute' : 'Unmute'}>
          <span className={styles.icon}>{audioEnabled ? '🎙️' : '🔇'}</span>
          <span className={styles.label}>{audioEnabled ? 'Mute' : 'Unmute'}</span>
        </Btn>
        <Btn onClick={onToggleVideo} active={!videoEnabled} title={videoEnabled ? 'Stop camera' : 'Start camera'}>
          <span className={styles.icon}>{videoEnabled ? '📷' : '📵'}</span>
          <span className={styles.label}>{videoEnabled ? 'Camera' : 'No cam'}</span>
        </Btn>
        <Btn onClick={onToggleScreen} active={screenSharing} title="Share screen">
          <span className={styles.icon}>🖥️</span>
          <span className={styles.label}>{screenSharing ? 'Sharing' : 'Share'}</span>
        </Btn>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <Btn onClick={onToggleChat} active={chatOpen} badge={!chatOpen ? unread : 0} title="Chat">
          <span className={styles.icon}>💬</span>
          <span className={styles.label}>Chat</span>
        </Btn>
        <Btn onClick={onToggleWhiteboard} active={whiteboardOpen} title="Whiteboard">
          <span className={styles.icon}>🖊️</span>
          <span className={styles.label}>Board</span>
        </Btn>
        <Btn onClick={onReaction} title="Reactions">
          <span className={styles.icon}>😊</span>
          <span className={styles.label}>React</span>
        </Btn>
        <Btn onClick={onRaiseHand} active={handRaised} title={handRaised ? 'Lower hand' : 'Raise hand'}>
          <span className={styles.icon}>✋</span>
          <span className={styles.label}>{handRaised ? 'Lower' : 'Hand'}</span>
        </Btn>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <Btn onClick={onToggleTranscribe} active={transcribeOpen} title="Live Transcription">
          <span className={styles.icon}>🎙</span>
          <span className={styles.label}>Transcribe</span>
        </Btn>
        {isHost && (
          <Btn onClick={onToggleBreakout} active={breakoutOpen} title="Breakout Rooms">
            <span className={styles.icon}>🚪</span>
            <span className={styles.label}>Breakout</span>
          </Btn>
        )}
        <Btn onClick={onTogglePoll} active={pollOpen} badge={pollBadge} title="Polls">
          <span className={styles.icon}>📊</span>
          <span className={styles.label}>Polls</span>
        </Btn>
        <Btn onClick={onToggleQnA} active={qnaOpen} badge={qnaBadge} title="Q&A">
          <span className={styles.icon}>❓</span>
          <span className={styles.label}>Q&amp;A</span>
        </Btn>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        {onRecord && (
          <Btn onClick={onRecord} warn={recording} title={recording ? 'Stop recording' : 'Record meeting'}>
            <span className={styles.icon}>{recording ? '⏹️' : '⏺️'}</span>
            <span className={styles.label}>{recording ? 'Stop' : 'Record'}</span>
          </Btn>
        )}
        <Btn onClick={onOpenSettings} title={isHost ? 'Manage meeting' : 'Settings'}>
          <span className={styles.icon}>⚙️</span>
          <span className={styles.label}>{isHost ? 'Manage' : 'Settings'}</span>
        </Btn>
        <Btn onClick={onLeave} danger title="Leave meeting">
          <span className={styles.icon}>📞</span>
          <span className={styles.label}>Leave</span>
        </Btn>
      </div>
    </div>
  );
}
