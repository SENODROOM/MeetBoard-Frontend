import React, { useRef, useEffect, useState } from 'react';
import styles from './FloatingVideos.module.css';

/**
 * FloatingVideos — a compact draggable strip of video tiles shown
 * on top of the whiteboard (or any overlay). Shows local + all peers.
 * Clicking a tile expands/collapses it. Draggable strip.
 */
export default function FloatingVideos({ localStream, peers, localUserName, audioEnabled, videoEnabled }) {
  const stripRef = useRef(null);
  const dragging = useRef(false);
  const dragOff  = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null });
  const [collapsed, setCollapsed] = useState(false);

  const onMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('video')) return;
    dragging.current = true;
    const r = stripRef.current.getBoundingClientRect();
    dragOff.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e) => {
      if (!dragging.current || !stripRef.current) return;
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOff.current.x, window.innerWidth  - stripRef.current.offsetWidth)),
        y: Math.max(0, Math.min(e.clientY - dragOff.current.y, window.innerHeight - stripRef.current.offsetHeight)),
      });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const style = pos.x !== null ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};

  const all = [
    { id: 'local', stream: localStream, name: localUserName, isLocal: true },
    ...peers.map(p => ({ id: p.socketId, stream: p.stream, name: p.userName, isLocal: false })),
  ];

  return (
    <div ref={stripRef} className={styles.strip} style={style} onMouseDown={onMouseDown}>
      <div className={styles.header}>
        <span className={styles.logo}>⬡ In call</span>
        <div className={styles.headerRight}>
          <span className={styles.count}>{all.length}</span>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={styles.tiles}>
          {all.map(({ id, stream, name, isLocal }) => (
            <FloatTile key={id} stream={stream} name={name} isLocal={isLocal}
              muted={isLocal}
              audioMuted={isLocal && !audioEnabled}
              videoOff={isLocal && !videoEnabled} />
          ))}
        </div>
      )}
    </div>
  );
}

function FloatTile({ stream, name, isLocal, muted, audioMuted, videoOff }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <div className={styles.tile}>
      <video ref={ref} autoPlay playsInline muted={muted}
        className={`${styles.video} ${isLocal ? styles.mirrored : ''}`} />
      {videoOff && (
        <div className={styles.avatar}>{name?.[0]?.toUpperCase() || '?'}</div>
      )}
      <div className={styles.nameTag}>
        {audioMuted && '🔇 '}{name}
      </div>
      {isLocal && <div className={styles.youBadge}>You</div>}
    </div>
  );
}
