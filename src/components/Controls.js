import React from "react";
import styles from "./Controls.module.css";

function Btn({
  onClick,
  active,
  danger,
  warn,
  badge,
  title,
  ariaLabel,
  disabled,
  children,
}) {
  return (
    <button
      title={title}
      aria-label={ariaLabel || title}
      aria-pressed={active !== undefined ? !!active : undefined}
      onClick={onClick}
      disabled={disabled}
      className={[
        styles.btn,
        active ? styles.active : "",
        danger ? styles.danger : "",
        warn ? styles.warn : "",
        disabled ? styles.dimmed : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {badge > 0 && (
        <span className={styles.badge} aria-label={`${badge} unread`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export default function Controls({
  audioEnabled,
  videoEnabled,
  screenSharing,
  chatOpen,
  whiteboardOpen,
  unread,
  handRaised,
  isHost,
  recording,
  transcribeOpen,
  breakoutOpen,
  pollOpen,
  qnaOpen,
  pollBadge,
  qnaBadge,
  wbActive,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleChat,
  onToggleWhiteboard,
  onRaiseHand,
  onOpenSettings,
  onReaction,
  onRecord,
  onLeave,
  onToggleTranscribe,
  onToggleBreakout,
  onTogglePoll,
  onToggleQnA,
  docPipOpen,
  onToggleDocPip,
}) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Meeting controls">
      <div className={styles.group} role="group" aria-label="Audio and video">
        <Btn
          onClick={onToggleAudio}
          active={!audioEnabled}
          ariaLabel={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          title={audioEnabled ? "Mute" : "Unmute"}
        >
          <span className={styles.icon}>{audioEnabled ? "🎙️" : "🔇"}</span>
          <span className={styles.label}>
            {audioEnabled ? "Mute" : "Unmute"}
          </span>
        </Btn>

        <Btn
          onClick={onToggleVideo}
          active={!videoEnabled}
          ariaLabel={videoEnabled ? "Stop camera" : "Start camera"}
          title={videoEnabled ? "Stop camera" : "Start camera"}
        >
          <span className={styles.icon}>{videoEnabled ? "📷" : "📵"}</span>
          <span className={styles.label}>
            {videoEnabled ? "Camera" : "No cam"}
          </span>
        </Btn>

        <Btn
          onClick={onToggleScreen}
          active={screenSharing}
          ariaLabel={screenSharing ? "Stop sharing screen" : "Share screen"}
          title="Share screen"
        >
          <span className={styles.icon}>🖥️</span>
          <span className={styles.label}>
            {screenSharing ? "Sharing" : "Share"}
          </span>
        </Btn>

        <Btn
          onClick={onToggleDocPip}
          active={docPipOpen}
          ariaLabel={
            docPipOpen ? "Close picture-in-picture" : "Open picture-in-picture"
          }
          title={docPipOpen ? "Close PiP" : "Open PiP"}
        >
          <span className={styles.icon}>🪟</span>
          <span className={styles.label}>PiP</span>
        </Btn>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div
        className={styles.group}
        role="group"
        aria-label="Collaboration tools"
      >
        <Btn
          onClick={onToggleChat}
          active={chatOpen}
          badge={!chatOpen ? unread : 0}
          ariaLabel={
            chatOpen
              ? "Close chat"
              : `Open chat${unread > 0 ? `, ${unread} unread messages` : ""}`
          }
          title="Chat"
        >
          <span className={styles.icon}>💬</span>
          <span className={styles.label}>Chat</span>
        </Btn>

        <Btn
          onClick={onToggleWhiteboard}
          active={whiteboardOpen}
          ariaLabel={whiteboardOpen ? "Close whiteboard" : "Open whiteboard"}
          title="Whiteboard"
        >
          <span className={styles.icon} aria-hidden="true">
            🖊️
            {wbActive && (
              <span
                className={styles.wbActiveDot}
                role="status"
                aria-label="Someone is drawing"
              />
            )}
          </span>
          <span className={styles.label}>Board</span>
        </Btn>

        <Btn
          onClick={onReaction}
          ariaLabel="Send emoji reaction"
          title="Reactions"
        >
          <span className={styles.icon} aria-hidden="true">
            😊
          </span>
          <span className={styles.label}>React</span>
        </Btn>

        <Btn
          onClick={onRaiseHand}
          active={handRaised}
          ariaLabel={handRaised ? "Lower hand" : "Raise hand"}
          title={handRaised ? "Lower hand" : "Raise hand"}
        >
          <span className={styles.icon} aria-hidden="true">
            ✋
          </span>
          <span className={styles.label}>{handRaised ? "Lower" : "Hand"}</span>
        </Btn>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.group} role="group" aria-label="Feature panels">
        <Btn
          onClick={onToggleTranscribe}
          active={transcribeOpen}
          ariaLabel={
            transcribeOpen ? "Close transcription" : "Open live transcription"
          }
          title="Live Transcription"
        >
          <span className={styles.icon} aria-hidden="true">
            🎙
          </span>
          <span className={styles.label}>Transcribe</span>
        </Btn>

        {isHost && (
          <Btn
            onClick={onToggleBreakout}
            active={breakoutOpen}
            ariaLabel={
              breakoutOpen ? "Close breakout rooms" : "Open breakout rooms"
            }
            title="Breakout Rooms"
          >
            <span className={styles.icon} aria-hidden="true">
              🚪
            </span>
            <span className={styles.label}>Breakout</span>
          </Btn>
        )}

        <Btn
          onClick={onTogglePoll}
          active={pollOpen}
          badge={pollBadge}
          ariaLabel={
            pollOpen
              ? "Close polls"
              : `Open polls${pollBadge > 0 ? `, ${pollBadge} new` : ""}`
          }
          title="Polls"
        >
          <span className={styles.icon} aria-hidden="true">
            📊
          </span>
          <span className={styles.label}>Polls</span>
        </Btn>

        <Btn
          onClick={onToggleQnA}
          active={qnaOpen}
          badge={qnaBadge}
          ariaLabel={
            qnaOpen
              ? "Close Q&A"
              : `Open Q&A${qnaBadge > 0 ? `, ${qnaBadge} new questions` : ""}`
          }
          title="Q&A"
        >
          <span className={styles.icon} aria-hidden="true">
            ❓
          </span>
          <span className={styles.label}>Q&amp;A</span>
        </Btn>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div
        className={styles.group}
        role="group"
        aria-label="Meeting management"
      >
        {onRecord && (
          <Btn
            onClick={onRecord}
            warn={recording}
            ariaLabel={recording ? "Stop recording" : "Start recording meeting"}
            title={recording ? "Stop recording" : "Record meeting"}
          >
            <span className={styles.icon} aria-hidden="true">
              {recording ? "⏹️" : "⏺️"}
            </span>
            <span className={styles.label}>
              {recording ? "Stop" : "Record"}
            </span>
          </Btn>
        )}

        <Btn
          onClick={onOpenSettings}
          ariaLabel={
            isHost
              ? "Manage meeting participants and settings"
              : "Open settings"
          }
          title={isHost ? "Manage meeting" : "Settings"}
        >
          <span className={styles.icon} aria-hidden="true">
            ⚙️
          </span>
          <span className={styles.label}>{isHost ? "Manage" : "Settings"}</span>
        </Btn>

        <Btn
          onClick={onLeave}
          danger
          ariaLabel="Leave meeting"
          title="Leave meeting"
        >
          <span className={styles.icon} aria-hidden="true">
            📞
          </span>
          <span className={styles.label}>Leave</span>
        </Btn>
      </div>
    </div>
  );
}
