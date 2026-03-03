import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './PipWindow.module.css';

/**
 * PipWindow — always rendered in DOM, shown/hidden via `visible` prop.
 * Appears when user switches tab/window (like Google Meet).
 * Supports drag, pin/unpin and dismiss on hover.
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
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pipRef = useRef(null);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null });
  const [hoveredTile, setHoveredTile] = useState(null); // 'local' | socketId | null

  // Which remote peer to show: pinned first, else first peer
  const shownPeer = (pinnedId && pinnedId !== 'local')
    ? peers.find((p) => p.socketId === pinnedId)
    : peers[0] || null;

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, visible]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = shownPeer?.stream || null;
    }
  }, [shownPeer, visible]);

  // Reset position when PiP becomes visible
  useEffect(() => {
    if (visible) setPos({ x: null, y: null });
  }, [visible]);

  // Drag handlers
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
      <div className={styles.pipHeader}>
        <span className={styles.pipLogo}>⬡ QuantumMeet</span>
        <button className={styles.returnBtn} onClick={onReturnToMeet} title="Return to meeting">
          ↩ Return
        </button>
      </div>

      {/* Video tiles */}
      <div className={styles.tilesRow}>
        {/* Remote / pinned peer */}
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
                <button
                  className={styles.tileActionBtn}
                  onClick={() => pinnedId === shownPeer.socketId ? onUnpin?.() : onPin?.(shownPeer.socketId)}
                >
                  📌 {pinnedId === shownPeer.socketId ? 'Unpin' : 'Pin'}
                </button>
                <button
                  className={`${styles.tileActionBtn} ${styles.removeBtn}`}
                  onClick={() => { if (pinnedId === shownPeer.socketId) onUnpin?.(); }}
                  title="Remove from mini window"
                >✕ Remove</button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tileEmpty}>
            <span>Waiting for others…</span>
          </div>
        )}

        {/* Local tile */}
        <div
          className={`${styles.tile} ${styles.tileLocal} ${pinnedId === 'local' ? styles.tilePinned : ''}`}
          onMouseEnter={() => setHoveredTile('local')}
          onMouseLeave={() => setHoveredTile(null)}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
            style={{ transform: 'scaleX(-1)' }}
          />
          {!videoEnabled && (
            <div className={styles.noVideo}>
              <span>{localUserName?.[0]?.toUpperCase() || '?'}</span>
            </div>
          )}
          <div className={styles.tileLabel}>
            {!audioEnabled && '🔇 '}{localUserName} (You)
          </div>
          {hoveredTile === 'local' && (
            <div className={styles.tileActions}>
              <button
                className={styles.tileActionBtn}
                onClick={() => pinnedId === 'local' ? onUnpin?.() : onPin?.('local')}
              >
                📌 {pinnedId === 'local' ? 'Unpin' : 'Pin'}
              </button>
              <button
                className={`${styles.tileActionBtn} ${styles.removeBtn}`}
                onClick={onDismiss}
                title="Dismiss mini window (switch back to get it again)"
              >✕ Remove</button>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className={styles.pipControls}>
        <span className={styles.pipStatus}>
          {audioEnabled ? '🎙️' : '🔇'} {videoEnabled ? '📷' : '📵'}
        </span>
        <span className={styles.pipPeerCount}>{peers.length + 1} in call</span>
      </div>
    </div>
  );
}
