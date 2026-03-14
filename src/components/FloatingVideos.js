import React, { useRef, useEffect, useState } from "react";
import styles from "./FloatingVideos.module.css";

/**
 * FloatingVideos — a compact draggable strip of video tiles shown
 * on top of the whiteboard (or any overlay). Shows local + all peers.
 * Draggable via both mouse and touch.
 */
export default function FloatingVideos({
  localStream,
  peers,
  localUserName,
  audioEnabled,
  videoEnabled,
}) {
  const stripRef = useRef(null);
  const dragging = useRef(false);
  const dragOff = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: null, y: null });
  const [collapsed, setCollapsed] = useState(false);

  // ── Mouse drag ───────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("video")) return;
    dragging.current = true;
    const r = stripRef.current.getBoundingClientRect();
    dragOff.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !stripRef.current) return;
      setPos({
        x: Math.max(
          0,
          Math.min(
            e.clientX - dragOff.current.x,
            window.innerWidth - stripRef.current.offsetWidth,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            e.clientY - dragOff.current.y,
            window.innerHeight - stripRef.current.offsetHeight,
          ),
        ),
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // FIX: touch support — the drag strip was mouse-only, making it impossible to
  // reposition on mobile/tablet devices.
  const onTouchStart = (e) => {
    if (e.target.closest("button") || e.target.closest("video")) return;
    dragging.current = true;
    const touch = e.touches[0];
    const r = stripRef.current.getBoundingClientRect();
    dragOff.current = { x: touch.clientX - r.left, y: touch.clientY - r.top };
    // Don't call preventDefault here — it would prevent tap events on children
  };

  useEffect(() => {
    const onTouchMove = (e) => {
      if (!dragging.current || !stripRef.current) return;
      const touch = e.touches[0];
      setPos({
        x: Math.max(
          0,
          Math.min(
            touch.clientX - dragOff.current.x,
            window.innerWidth - stripRef.current.offsetWidth,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            touch.clientY - dragOff.current.y,
            window.innerHeight - stripRef.current.offsetHeight,
          ),
        ),
      });
      // Prevent page scroll while dragging the strip
      e.preventDefault();
    };
    const onTouchEnd = () => {
      dragging.current = false;
    };

    // passive: false is required so we can call preventDefault inside onTouchMove
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const style =
    pos.x !== null
      ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
      : {};

  const all = [
    { id: "local", stream: localStream, name: localUserName, isLocal: true },
    ...peers.map((p) => ({
      id: p.socketId,
      stream: p.stream,
      name: p.userName,
      isLocal: false,
    })),
  ];

  return (
    <div
      ref={stripRef}
      className={styles.strip}
      style={style}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className={styles.header}>
        <span className={styles.logo}>
          <img src="/logo.png" alt="QuantumMeet" className={styles.logoImage} />{" "}
          In call
        </span>
        <div className={styles.headerRight}>
          <span className={styles.count}>{all.length}</span>
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className={styles.tiles}>
          {all.map(({ id, stream, name, isLocal }) => (
            <FloatTile
              key={id}
              stream={stream}
              name={name}
              isLocal={isLocal}
              muted={isLocal}
              audioMuted={isLocal && !audioEnabled}
              videoOff={isLocal && !videoEnabled}
            />
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
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`${styles.video} ${isLocal ? styles.mirrored : ""}`}
      />
      {videoOff && (
        <div className={styles.avatar}>{name?.[0]?.toUpperCase() || "?"}</div>
      )}
      <div className={styles.nameTag}>
        {audioMuted && "🔇 "}
        {name}
      </div>
      {isLocal && <div className={styles.youBadge}>You</div>}
    </div>
  );
}
