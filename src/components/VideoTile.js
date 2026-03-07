import React, { useRef, useEffect, useState } from "react";
import styles from "./VideoTile.module.css";

export default function VideoTile({
  stream,
  userName,
  isLocal,
  isScreen = false,
  audioEnabled = true,
  videoEnabled = true,
  isPinned,
  onPin,
  isHost,
  onKick,
}) {
  const videoRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [vol, setVol] = useState(0);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream || null;

    if (stream) {
      const tryPlay = () => {
        video.play().catch(() => {});
      };
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
      if (video.readyState >= 1) tryPlay();

      if (!isLocal && "autoPictureInPicture" in video) {
        video.autoPictureInPicture = true;
      }

      const onTrackAdded = () => {
        video.srcObject = null;
        video.srcObject = stream;
      };
      stream.addEventListener("addtrack", onTrackAdded);
      return () => {
        video.removeEventListener("loadedmetadata", tryPlay);
        stream.removeEventListener("addtrack", onTrackAdded);
      };
    }
  }, [stream, isLocal]);

  // Audio level meter
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
      try {
        src?.disconnect();
        ctx?.close();
      } catch {}
    };
  }, [stream, isLocal]);

  const isSpeaking = vol > 0.12 && audioEnabled && !isLocal;
  const initials = (userName || "?").slice(0, 2).toUpperCase();
  const hueShift =
    [...(userName || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  // PiP: show for all screen tiles and all remote camera tiles
  const showPip = document.pictureInPictureEnabled && (!isLocal || isScreen);

  const handlePip = async (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error", err);
    }
  };

  // FIX: keep overlay visible while pinned so users can see and click Unpin
  const showOverlay = hover || isPinned;

  return (
    <div
      className={`${styles.tile} ${isPinned ? styles.pinned : ""} ${isSpeaking ? styles.speaking : ""}`}
      style={isSpeaking ? { "--vol": vol } : {}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal && !isScreen}
        className={styles.video}
        style={{
          transform: isLocal && !isScreen ? "scaleX(-1)" : "none",
          opacity: videoEnabled ? 1 : 0,
        }}
      />

      {!videoEnabled && !isScreen && (
        <div className={styles.avatar} style={{ "--hue": hueShift }}>
          <span>{initials}</span>
        </div>
      )}

      {isSpeaking && (
        <div
          className={styles.speakRing}
          style={{ opacity: 0.4 + vol * 0.6 }}
        />
      )}

      <div className={styles.nameTag}>
        {!audioEnabled && <span className={styles.muteIcon}>🔇</span>}
        {isLocal && !isScreen && <span className={styles.youPill}>You</span>}
        {isScreen && <span className={styles.screenPill}>Screen</span>}
        <span className={styles.name}>{userName}</span>
      </div>

      {isPinned && <div className={styles.pinBadge}>📌</div>}

      {showOverlay && (
        <div className={styles.overlay}>
          {/* FIX: stopPropagation prevents the click from bubbling to the tile
              div, which was triggering onMouseLeave → hover=false → overlay
              disappears before onPin could register, making pin feel broken. */}
          <button
            className={styles.overlayBtn}
            onClick={(e) => {
              e.stopPropagation();
              onPin && onPin();
            }}
            title={isPinned ? "Unpin" : "Pin"}
          >
            {isPinned ? "📌 Unpin" : "📌 Pin"}
          </button>

          {showPip && (
            <button
              className={styles.overlayBtn}
              onClick={handlePip}
              title="Picture in Picture"
            >
              🖥️ PiP
            </button>
          )}

          {/* Never show kick on screen tiles — they are not real participants */}
          {isHost && onKick && !isScreen && (
            <button
              className={`${styles.overlayBtn} ${styles.kickBtn}`}
              onClick={(e) => {
                e.stopPropagation();
                onKick();
              }}
            >
              🚫 Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
