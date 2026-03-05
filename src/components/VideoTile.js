import React, { useRef, useEffect, useState } from 'react';
import styles from './VideoTile.module.css';

export default function VideoTile({
  stream, userName, isLocal,
  audioEnabled = true, videoEnabled = true,
  isPinned, onPin, isHost, onKick,
}) {
  const videoRef  = useRef(null);
  const [hover, setHover] = useState(false);
  const [vol, setVol]     = useState(0); // 0-1 audio level
  const analyserRef = useRef(null);
  const rafRef      = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  // Audio level meter (green glow when speaking)
  useEffect(() => {
    if (!stream || isLocal) return;
    let ctx, src;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVol(Math.min(avg / 60, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { src?.disconnect(); ctx?.close(); } catch {}
    };
  }, [stream, isLocal]);

  const isSpeaking = vol > 0.12 && audioEnabled && !isLocal;
  const initials   = (userName || '?').slice(0, 2).toUpperCase();
  const hueShift   = [...(userName || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`${styles.tile} ${isPinned ? styles.pinned : ''} ${isSpeaking ? styles.speaking : ''}`}
      style={isSpeaking ? { '--vol': vol } : {}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay playsInline
        muted={isLocal}
        className={styles.video}
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none', opacity: videoEnabled ? 1 : 0 }}
      />

      {/* Avatar when camera off */}
      {!videoEnabled && (
        <div className={styles.avatar} style={{ '--hue': hueShift }}>
          <span>{initials}</span>
        </div>
      )}

      {/* Speaking ring */}
      {isSpeaking && <div className={styles.speakRing} style={{ opacity: 0.4 + vol * 0.6 }} />}

      {/* Name tag */}
      <div className={styles.nameTag}>
        {!audioEnabled && <span className={styles.muteIcon}>🔇</span>}
        {isLocal && <span className={styles.youPill}>You</span>}
        <span className={styles.name}>{userName}</span>
      </div>

      {/* Pin badge */}
      {isPinned && <div className={styles.pinBadge}>📌</div>}

      {/* Hover overlay */}
      {hover && (
        <div className={styles.overlay}>
          <button className={styles.overlayBtn} onClick={onPin} title={isPinned ? 'Unpin' : 'Pin'}>
            {isPinned ? '📌 Unpin' : '📌 Pin'}
          </button>
          {isHost && onKick && (
            <button className={`${styles.overlayBtn} ${styles.kickBtn}`} onClick={onKick}>
              🚫 Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
