import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './PipWindow.module.css';

/**
 * PipWindow — floating mini meet window that appears when user switches tabs.
 * Shows local + pinned (or first remote) participant.
 * Supports drag, pin-on-hover, and dismiss ("remove") on hover.
 */
export default function PipWindow({
  localStream,
  peers,
  pinnedId,
  localUserName,
  audioEnabled,
  videoEnabled,
  onPin,       // (socketId) -> void
  onUnpin,     // () -> void
  onReturnToMeet, // () -> void  — called on click to return
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pipRef = useRef(null);

  // Drag state
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null }); // null = default bottom-right
  const [dismissed, setDismissed] = useState(false);
  const [hoveredPeer, setHoveredPeer] = useState(null); // socketId being hovered

  // Which remote peer to show: pinned first, else first peer
  const shownPeer = pinnedId && pinnedId !== 'local'
    ? peers.find((p) => p.socketId === pinnedId)
    : peers[0] || null;

  // Attach streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && shownPeer?.stream) {
      remoteVideoRef.current.srcObject = shownPeer.stream;
    }
  }, [shownPeer]);

  // ── Dragging ─────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return;
    dragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      const maxX = window.innerWidth - (pipRef.current?.offsetWidth || 260);
      const maxY = window.innerHeight - (pipRef.current?.offsetHeight || 180);
      setPos({ x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  if (dismissed) return null;

  const posStyle = pos.x !== null
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <div
      ref={pipRef}
      className={styles.pip}
      style={posStyle}
      onMouseDown={onMouseDown}
    >
      {/* Header bar */}
      <div className={styles.pipHeader}>
        <span className={styles.pipLogo}>⬡ QuantumMeet</span>
        <button
          className={styles.returnBtn}
          onClick={onReturnToMeet}
          title="Return to meeting"
        >↩ Return</button>
      </div>

      {/* Video tiles */}
      <div className={styles.tilesRow}>
        {/* Remote / pinned peer */}
        {shownPeer ? (
          <div
            className={`${styles.tile} ${pinnedId === shownPeer.socketId ? styles.tilePinned : ''}`}
            onMouseEnter={() => setHoveredPeer(shownPeer.socketId)}
            onMouseLeave={() => setHoveredPeer(null)}
          >
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
            <div className={styles.tileLabel}>{shownPeer.userName}</div>

            {/* Hover actions */}
            {hoveredPeer === shownPeer.socketId && (
              <div className={styles.tileActions}>
                {pinnedId === shownPeer.socketId ? (
                  <button
                    className={styles.tileActionBtn}
                    onClick={() => onUnpin && onUnpin()}
                    title="Unpin"
                  >📌 Unpin</button>
                ) : (
                  <button
                    className={styles.tileActionBtn}
                    onClick={() => onPin && onPin(shownPeer.socketId)}
                    title="Pin this participant"
                  >📌 Pin</button>
                )}
                <button
                  className={`${styles.tileActionBtn} ${styles.removeBtn}`}
                  onClick={() => {
                    // Remove this peer from PiP (just hide from pip, not from call)
                    setHoveredPeer(null);
                    // If it was pinned, unpin so PiP shows someone else
                    if (pinnedId === shownPeer.socketId) onUnpin && onUnpin();
                  }}
                  title="Remove from mini window"
                >✕ Remove</button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tileEmpty}>
            <span>Waiting for others...</span>
          </div>
        )}

        {/* Local tile */}
        <div
          className={`${styles.tile} ${styles.tileLocal} ${pinnedId === 'local' ? styles.tilePinned : ''}`}
          onMouseEnter={() => setHoveredPeer('local')}
          onMouseLeave={() => setHoveredPeer(null)}
        >
          <video ref={localVideoRef} autoPlay playsInline muted className={styles.video} style={{ transform: 'scaleX(-1)' }} />
          {!videoEnabled && (
            <div className={styles.noVideo}>
              <span>{localUserName?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className={styles.tileLabel}>
            {!audioEnabled && '🔇 '}{localUserName} (You)
          </div>

          {hoveredPeer === 'local' && (
            <div className={styles.tileActions}>
              {pinnedId === 'local' ? (
                <button className={styles.tileActionBtn} onClick={() => onUnpin && onUnpin()}>📌 Unpin</button>
              ) : (
                <button className={styles.tileActionBtn} onClick={() => onPin && onPin('local')}>📌 Pin</button>
              )}
              <button
                className={`${styles.tileActionBtn} ${styles.removeBtn}`}
                onClick={() => setDismissed(true)}
                title="Dismiss mini window (go back to tab to restore)"
              >✕ Remove</button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom mini controls */}
      <div className={styles.pipControls}>
        <div className={`${styles.pipDot} ${audioEnabled ? styles.dotGreen : styles.dotRed}`} title={audioEnabled ? 'Mic on' : 'Muted'}>
          {audioEnabled ? '🎙️' : '🔇'}
        </div>
        <div className={`${styles.pipDot} ${videoEnabled ? styles.dotGreen : styles.dotRed}`} title={videoEnabled ? 'Camera on' : 'Camera off'}>
          {videoEnabled ? '📷' : '📵'}
        </div>
        <span className={styles.pipPeerCount}>
          {peers.length + 1} in call
        </span>
      </div>
    </div>
  );
}
