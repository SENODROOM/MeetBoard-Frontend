import React, { useRef, useEffect } from 'react';
import styles from './VideoTile.module.css';

export default function VideoTile({ stream, userName, isLocal, audioEnabled, videoEnabled, isPinned, onPin, isHost, onKick }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && videoEnabled !== false);

  return (
    <div className={`${styles.tile} ${isPinned ? styles.pinned : ''}`}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal}
        className={`${styles.video} ${!hasVideo ? styles.hidden : ''}`} />

      {!hasVideo && <div className={styles.avatar}><span>{initials}</span></div>}

      {/* Hover overlay */}
      <div className={styles.overlay}>
        <div className={styles.overlayActions}>
          <button
            className={`${styles.pinBtn} ${isPinned ? styles.pinBtnActive : ''}`}
            onClick={() => onPin && onPin()}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <span>📌</span>
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
          </button>

          {/* Kick button — only shown to host for remote participants */}
          {isHost && !isLocal && onKick && (
            <button
              className={styles.kickBtn}
              onClick={(e) => { e.stopPropagation(); onKick(); }}
              title="Remove from meeting"
            >
              <span>🚫</span>
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>

      {isPinned && <div className={styles.pinnedBadge} title="Pinned">📌</div>}

      <div className={styles.nameTag}>
        {!audioEnabled && <span className={styles.mutedIcon}>🔇</span>}
        <span>{isLocal ? `${userName} (You)` : userName}</span>
      </div>

      {isLocal && <div className={styles.localBadge}>You</div>}
    </div>
  );
}
