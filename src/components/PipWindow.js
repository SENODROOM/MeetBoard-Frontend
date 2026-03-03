import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './PipWindow.module.css';

/**
 * PipWindow — TWO modes:
 * 1. Native browser Picture-in-Picture API (real PiP that floats over other apps)
 * 2. Fallback: fixed overlay widget shown when tab is hidden
 *
 * The native PiP is the real fix — it works exactly like Google Meet.
 */
export default function PipWindow({
  visible,
  localStream,
  peers,
  pinnedId,
  localUserName,
  audioEnabled,
  videoEnabled,
  onPin,
  onUnpin,
  onDismiss,
  onReturnToMeet,
}) {
  // Native PiP refs
  const pipVideoRef = useRef(null);   // hidden <video> used for native PiP
  const pipActiveRef = useRef(false);

  // Fallback overlay refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pipRef = useRef(null);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null });
  const [hoveredTile, setHoveredTile] = useState(null);
  const [nativePipSupported] = useState(() => !!document.pictureInPictureEnabled);
  const [nativePipActive, setNativePipActive] = useState(false);

  // Which remote peer to show
  const shownPeer = (pinnedId && pinnedId !== 'local')
    ? peers.find((p) => p.socketId === pinnedId)
    : peers[0] || null;

  // ─────────────────────────────────────────────────────────────────────────
  // NATIVE PiP: compose local + remote into a canvas, stream it into a video
  // ─────────────────────────────────────────────────────────────────────────
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const localVidRef = useRef(document.createElement('video'));
  const remoteVidRef = useRef(document.createElement('video'));

  // Keep hidden video elements updated with streams
  useEffect(() => {
    const lv = localVidRef.current;
    lv.srcObject = localStream || null;
    lv.muted = true;
    lv.autoplay = true;
    lv.playsInline = true;
    if (localStream) lv.play().catch(() => {});
  }, [localStream]);

  useEffect(() => {
    const rv = remoteVidRef.current;
    rv.srcObject = shownPeer?.stream || null;
    rv.autoplay = true;
    rv.playsInline = true;
    rv.muted = false;
    if (shownPeer?.stream) rv.play().catch(() => {});
  }, [shownPeer]);

  // Draw composite frame to canvas
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    const lv = localVidRef.current;
    const rv = remoteVidRef.current;

    if (shownPeer && rv.readyState >= 2) {
      // Remote takes left 3/4
      ctx.save();
      ctx.drawImage(rv, 0, 0, W * 0.72, H);
      ctx.restore();
      // Local takes right 1/4 (mirrored)
      const lx = W * 0.74;
      const lw = W * 0.26;
      if (lv.readyState >= 2) {
        ctx.save();
        ctx.translate(lx + lw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(lv, 0, 0, lw, H);
        ctx.restore();
      }
      // Divider
      ctx.fillStyle = 'rgba(0,212,255,0.3)';
      ctx.fillRect(W * 0.73, 0, 1, H);
    } else {
      // Only local
      if (lv.readyState >= 2) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(lv, 0, 0, W, H);
        ctx.restore();
      }
    }

    // Name labels
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(4, H - 20, shownPeer ? W * 0.72 - 8 : W - 8, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    if (shownPeer) {
      ctx.fillText(shownPeer.userName || 'Remote', 8, H - 6);
      ctx.fillRect(W * 0.74 + 2, H - 20, W * 0.26 - 6, 18);
      ctx.fillStyle = '#00d4ff';
      ctx.fillText(`${localUserName} (You)`, W * 0.74 + 6, H - 6);
    } else {
      ctx.fillText(`${localUserName} (You)`, 8, H - 6);
    }

    // Mute indicator
    if (!audioEnabled) {
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.beginPath();
      ctx.arc(W - 14, 14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.fillText('🔇', W - 20, 19);
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [shownPeer, localUserName, audioEnabled]);

  // Start/stop canvas animation
  useEffect(() => {
    if (nativePipActive) {
      drawFrame();
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [nativePipActive, drawFrame]);

  // Enter native PiP
  const enterNativePip = useCallback(async () => {
    if (!canvasRef.current || !pipVideoRef.current) return;
    try {
      // Stream canvas to video element
      const stream = canvasRef.current.captureStream(25);
      pipVideoRef.current.srcObject = stream;
      await pipVideoRef.current.play();
      await pipVideoRef.current.requestPictureInPicture();
      setNativePipActive(true);
      pipActiveRef.current = true;
    } catch (err) {
      console.warn('Native PiP failed:', err);
      setNativePipActive(false);
    }
  }, []);

  // Exit native PiP
  const exitNativePip = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch (e) {}
    setNativePipActive(false);
    pipActiveRef.current = false;
  }, []);

  // Auto-enter PiP when visible + supported
  useEffect(() => {
    if (!nativePipSupported) return;
    if (visible && !pipActiveRef.current) {
      // Small delay so canvas has a frame to capture
      const t = setTimeout(() => enterNativePip(), 200);
      return () => clearTimeout(t);
    } else if (!visible && pipActiveRef.current) {
      exitNativePip();
    }
  }, [visible, nativePipSupported, enterNativePip, exitNativePip]);

  // Listen for pip window close (user closes the floating window)
  useEffect(() => {
    const vid = pipVideoRef.current;
    if (!vid) return;
    const onLeave = () => {
      setNativePipActive(false);
      pipActiveRef.current = false;
      onReturnToMeet?.();
    };
    vid.addEventListener('leavepictureinpicture', onLeave);
    return () => vid.removeEventListener('leavepictureinpicture', onLeave);
  }, [onReturnToMeet]);

  // ─────────────────────────────────────────────────────────────────────────
  // FALLBACK overlay: shown when native PiP not supported, and tab is hidden
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = shownPeer?.stream || null;
    }
  }, [shownPeer]);

  useEffect(() => {
    if (visible && !nativePipSupported) setPos({ x: null, y: null });
  }, [visible, nativePipSupported]);

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !pipRef.current) return;
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - pipRef.current.offsetWidth;
      const maxY = window.innerHeight - pipRef.current.offsetHeight;
      setPos({ x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const posStyle = pos.x !== null ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};
  const showFallback = visible && !nativePipSupported;

  return (
    <>
      {/* Hidden canvas + video for native PiP */}
      <canvas ref={canvasRef} width={480} height={270} style={{ display: 'none' }} />
      <video ref={pipVideoRef} style={{ display: 'none' }} muted playsInline />

      {/* Fallback overlay widget (only when native PiP not available) */}
      <div
        ref={pipRef}
        className={`${styles.pip} ${showFallback ? styles.pipVisible : styles.pipHidden}`}
        style={posStyle}
        onMouseDown={onMouseDown}
      >
        <div className={styles.pipHeader}>
          <span className={styles.pipLogo}>⬡ QuantumMeet</span>
          <button className={styles.returnBtn} onClick={onReturnToMeet}>↩ Return</button>
        </div>

        <div className={styles.tilesRow}>
          {shownPeer ? (
            <div
              className={`${styles.tile} ${pinnedId === shownPeer.socketId ? styles.tilePinned : ''}`}
              onMouseEnter={() => setHoveredTile(shownPeer.socketId)}
              onMouseLeave={() => setHoveredTile(null)}
            >
              <video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
              <div className={styles.tileLabel}>{shownPeer.userName}</div>
              {hoveredTile === shownPeer.socketId && (
                <div className={styles.tileActions}>
                  <button className={styles.tileActionBtn}
                    onClick={() => pinnedId === shownPeer.socketId ? onUnpin?.() : onPin?.(shownPeer.socketId)}>
                    📌 {pinnedId === shownPeer.socketId ? 'Unpin' : 'Pin'}
                  </button>
                  <button className={`${styles.tileActionBtn} ${styles.removeBtn}`} onClick={onDismiss}>
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.tileEmpty}><span>Waiting for others…</span></div>
          )}

          <div
            className={`${styles.tile} ${styles.tileLocal} ${pinnedId === 'local' ? styles.tilePinned : ''}`}
            onMouseEnter={() => setHoveredTile('local')}
            onMouseLeave={() => setHoveredTile(null)}
          >
            <video ref={localVideoRef} autoPlay playsInline muted className={styles.video} style={{ transform: 'scaleX(-1)' }} />
            {!videoEnabled && (
              <div className={styles.noVideo}><span>{localUserName?.[0]?.toUpperCase() || '?'}</span></div>
            )}
            <div className={styles.tileLabel}>{!audioEnabled && '🔇 '}{localUserName} (You)</div>
            {hoveredTile === 'local' && (
              <div className={styles.tileActions}>
                <button className={styles.tileActionBtn}
                  onClick={() => pinnedId === 'local' ? onUnpin?.() : onPin?.('local')}>
                  📌 {pinnedId === 'local' ? 'Unpin' : 'Pin'}
                </button>
                <button className={`${styles.tileActionBtn} ${styles.removeBtn}`} onClick={onDismiss}>
                  ✕ Remove
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.pipControls}>
          <span>{audioEnabled ? '🎙️' : '🔇'} {videoEnabled ? '📷' : '📵'}</span>
          <span className={styles.pipPeerCount}>{peers.length + 1} in call</span>
        </div>
      </div>

      {/* Manual PiP toggle button (shown in room when native PiP supported) */}
      {nativePipSupported && visible && !nativePipActive && (
        <button className={styles.pipTriggerBtn} onClick={enterNativePip}>
          ⧉ Open mini window
        </button>
      )}
    </>
  );
}
