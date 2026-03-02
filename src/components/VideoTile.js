import React, { useRef, useEffect } from 'react';
import styles from './VideoTile.module.css';

export default function VideoTile({ stream, userName, isLocal, audioEnabled, videoEnabled }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && videoEnabled !== false);

  return (
    <div className={styles.tile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`${styles.video} ${!hasVideo ? styles.hidden : ''}`}
      />
      {!hasVideo && (
        <div className={styles.avatar}>
          <span>{initials}</span>
        </div>
      )}
      <div className={styles.nameTag}>
        {!audioEnabled && <span className={styles.mutedIcon}>🔇</span>}
        <span>{isLocal ? `${userName} (You)` : userName}</span>
      </div>
      {isLocal && <div className={styles.localBadge}>You</div>}
    </div>
  );
}
