import React, { useRef, useEffect, useState } from 'react';
import styles from './VideoTile.module.css';

export default function VideoTile({
  stream, userName, isLocal, isScreen = false,
  audioEnabled = true, videoEnabled = true,
  isPinned, onPin, isHost, onKick,
}) {
  const videoRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [vol, setVol] = useState(0); // 0-1 audio level
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream || null;

    if (stream) {
      // Force play — needed when stream arrives after mount or tracks added late
      const tryPlay = () => {
        video.play().catch(() => {});
      };
      video.addEventListener('loadedmetadata', tryPlay, { once: true });
      // Also try immediately in case metadata already loaded
      if (video.readyState >= 1) tryPlay();

      // Auto PiP when moving to another tab (Chromium feature)
      if (!isLocal && 'autoPictureInPicture' in video) {
        video.autoPictureInPicture = true;
      }

      // If a new track is added to the stream after mount, re-attach
      const onTrackAdded = () => { video.srcObject = null; video.srcObject = stream; };
      stream.addEventListener('addtrack', onTrackAdded);
      return () => {
        video.removeEventListener('loadedmetadata', tryPlay);
        stream.removeEventListener('addtrack', onTrackAdded);
      };
    }
  }, [stream, isLocal]);

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
    } catch { }
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { src?.disconnect(); ctx?.close(); } catch { }
    };
  }, [stream, isLocal]);

  const isSpeaking = vol > 0.12 && audioEnabled && !isLocal;
  const initials = (userName || '?').slice(0, 2).toUpperCase();
  const hueShift = [...(userName || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

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
        style={{ transform: (isLocal && !isScreen) ? 'scaleX(-1)' : 'none', opacity: videoEnabled ? 1 : 0 }}
      />

      {/* Avatar when camera off (not for screen-share tiles) */}
      {!videoEnabled && !isScreen && (
        <div className={styles.avatar} style={{ '--hue': hueShift }}>
          <span>{initials}</span>
        </div>
      )}

      {/* Speaking ring */}
      {isSpeaking && <div className={styles.speakRing} style={{ opacity: 0.4 + vol * 0.6 }} />}

      {/* Name tag */}
      <div className={styles.nameTag}>
        {!audioEnabled && <span className={styles.muteIcon}>🔇</span>}
        {isLocal && !isScreen && <span className={styles.youPill}>You</span>}
        {isScreen && <span className={styles.screenPill}>Screen</span>}
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
          {!isLocal && document.pictureInPictureEnabled && (
            <button
              className={styles.overlayBtn}
              onClick={async (e) => {
                e.stopPropagation();
                if (!videoRef.current) return;
                try {
                  if (document.pictureInPictureElement === videoRef.current) {
                    await document.exitPictureInPicture();
                  } else {
                    await videoRef.current.requestPictureInPicture();
                  }
                } catch (err) {
                  console.error('PiP error', err);
                }
              }}
              title="Toggle PiP"
            >
              🖥️ PiP
            </button>
          )}
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