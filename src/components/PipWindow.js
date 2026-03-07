import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './PipWindow.module.css';

/*
 * PipWindow
 * Always mounted in DOM. Shown/hidden via CSS only (no unmount).
 * Direct <video>.srcObject — instant, no canvas, no native PiP API.
 *
 * Layout (like Google Meet mini-window):
 *   ┌────────────────────────────┐
 *   │ Header: logo  [Return] [✕] │
 *   ├────────────────────────────┤
 *   │                    ┌──── ┐ │
 *   │  Main peer (big)   │ You │ │
 *   │                    └─────┘ │
 *   ├────────────────────────────┤
 *   │ strip: other peers (scroll)│ ← only when >1 remote
 *   ├────────────────────────────┤
 *   │ 🎙 📷  ·  N participants   │
 *   └────────────────────────────┘
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
  const pipRef   = useRef(null);
  const dragging = useRef(false);
  const dragOff  = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null });
  const [hovered, setHovered] = useState(null);

  // pinned peer gets main slot; fall back to first remote
  const mainPeer  = peers.find((p) => p.socketId === pinnedId) || peers[0] || null;
  const stripPeers = peers.filter((p) => p !== mainPeer);

  // Reset to default position whenever window opens
  useEffect(() => {
    if (visible) setPos({ x: null, y: null });
  }, [visible]);

  // Drag logic
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    const r = pipRef.current.getBoundingClientRect();
    dragOff.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !pipRef.current) return;
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOff.current.x, window.innerWidth  - pipRef.current.offsetWidth)),
        y: Math.max(0, Math.min(e.clientY - dragOff.current.y, window.innerHeight - pipRef.current.offsetHeight)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const posStyle = pos.x !== null
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <div
      ref={pipRef}
      className={`${styles.pip} ${visible ? styles.pipVisible : styles.pipHidden}`}
      style={posStyle}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.logo}><img src="/logo.png" alt="QuantumMeet" className={styles.logoImage} /> QuantumMeet</span>
        <div className={styles.headerBtns}>
          <button className={styles.returnBtn} onClick={onReturnToMeet}>↩ Return</button>
          <button className={styles.closeBtn}  onClick={onDismiss}>✕</button>
        </div>
      </div>

      {/* Main area */}
      <div className={styles.mainArea}>
        {/* Big remote tile */}
        {mainPeer ? (
          <Tile
            stream={mainPeer.stream}
            userName={mainPeer.userName}
            muted={false}
            mirrored={false}
            isPinned={pinnedId === mainPeer.socketId}
            hovered={hovered === mainPeer.socketId}
            onEnter={() => setHovered(mainPeer.socketId)}
            onLeave={() => setHovered(null)}
            onPin={() => pinnedId === mainPeer.socketId ? onUnpin?.() : onPin?.(mainPeer.socketId)}
            pinLabel={pinnedId === mainPeer.socketId ? 'Unpin' : 'Pin'}
            big
          />
        ) : (
          <div className={styles.emptyMain}>
            <span>👥</span>
            <p>Waiting for others…</p>
          </div>
        )}

        {/* Local self-view — corner */}
        <div
          className={`${styles.selfCorner} ${pinnedId === 'local' ? styles.selfPinned : ''}`}
          onMouseEnter={() => setHovered('local')}
          onMouseLeave={() => setHovered(null)}
        >
          <VideoEl stream={localStream} muted mirrored />
          {!videoEnabled && (
            <div className={styles.avatar}>
              {localUserName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className={styles.selfLabel}>
            {!audioEnabled && '🔇 '}{localUserName}
          </div>
          {hovered === 'local' && (
            <div className={styles.hoverOverlay}>
              <button className={styles.overlayBtn}
                onClick={() => pinnedId === 'local' ? onUnpin?.() : onPin?.('local')}>
                📌 {pinnedId === 'local' ? 'Unpin' : 'Pin'}
              </button>
              <button className={`${styles.overlayBtn} ${styles.overlayBtnRed}`} onClick={onDismiss}>
                ✕ Hide
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Strip — other remote peers */}
      {stripPeers.length > 0 && (
        <div className={styles.strip}>
          {stripPeers.map((p) => (
            <Tile
              key={p.socketId}
              stream={p.stream}
              userName={p.userName}
              muted={false}
              mirrored={false}
              isPinned={pinnedId === p.socketId}
              hovered={hovered === p.socketId}
              onEnter={() => setHovered(p.socketId)}
              onLeave={() => setHovered(null)}
              onPin={() => pinnedId === p.socketId ? onUnpin?.() : onPin?.(p.socketId)}
              pinLabel={pinnedId === p.socketId ? 'Unpin' : 'Pin'}
            />
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={styles.mediaIcons}>
          <span style={{ opacity: audioEnabled ? 1 : 0.4 }}>{audioEnabled ? '🎙️' : '🔇'}</span>
          <span style={{ opacity: videoEnabled ? 1 : 0.4 }}>{videoEnabled ? '📷' : '📵'}</span>
        </span>
        <span className={styles.count}>{peers.length + 1} participants</span>
      </div>
    </div>
  );
}

/* ─── Tile ────────────────────────────────────────────────────────────────── */
function Tile({ stream, userName, muted, mirrored, isPinned, hovered, onEnter, onLeave, onPin, pinLabel, big }) {
  return (
    <div
      className={`${styles.tile} ${isPinned ? styles.tilePinned : ''} ${big ? styles.tileBig : styles.tileSmall}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <VideoEl stream={stream} muted={muted} mirrored={mirrored} />
      <div className={styles.tileLabel}>{userName}</div>
      {isPinned && <div className={styles.pinBadge}>📌</div>}
      {hovered && (
        <div className={styles.hoverOverlay}>
          <button className={styles.overlayBtn} onClick={onPin}>
            📌 {pinLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Video element — direct srcObject wiring ─────────────────────────────── */
function VideoEl({ stream, muted, mirrored }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={styles.video}
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}
