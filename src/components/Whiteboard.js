import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './Whiteboard.module.css';

const COLORS = ['#00d4ff', '#ffffff', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#f97316', '#ec4899'];
const SIZES = [2, 4, 8, 14, 22];

export default function Whiteboard({ socket, roomId, userId, userName, onClose }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null); // for remote drawing preview
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [color, setColor] = useState('#00d4ff');
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState('pen'); // pen | eraser
  const [activePeers, setActivePeers] = useState({}); // socketId -> { x, y, color, userName }
  const historyRef = useRef([]); // array of ImageData snapshots for undo
  const redoStackRef = useRef([]);

  // ── Canvas helpers ──────────────────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // ── Init canvas size ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveSnapshot();
  }, []);

  // ── Socket events ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Another user drew a stroke segment
    const onDraw = ({ from, x0, y0, x1, y1, color: c, size: s, tool: t }) => {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = t === 'eraser' ? '#0c1220' : c;
      ctx.lineWidth = s;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = t === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    };

    // Another user cleared the board
    const onClear = () => {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.fillStyle = '#0c1220';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    // Cursor position of remote peer
    const onCursor = ({ from, x, y, color: c, userName: uName }) => {
      setActivePeers((prev) => ({ ...prev, [from]: { x, y, color: c, userName: uName } }));
    };

    // Peer left
    const onPeerLeft = ({ socketId }) => {
      setActivePeers((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
    };

    // Full canvas sync (new user joins, request state)
    const onRequestCanvas = ({ from }) => {
      const dataUrl = canvasRef.current.toDataURL();
      socket.emit('wb-canvas-state', { to: from, dataUrl });
    };

    const onCanvasState = ({ dataUrl }) => {
      const img = new window.Image();
      img.onload = () => {
        const ctx = getCtx();
        ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    };

    socket.on('wb-draw', onDraw);
    socket.on('wb-clear', onClear);
    socket.on('wb-cursor', onCursor);
    socket.on('wb-request-canvas', onRequestCanvas);
    socket.on('wb-canvas-state', onCanvasState);
    socket.on('user-left', onPeerLeft);

    // Request current canvas state from peers
    socket.emit('wb-join', { roomId, userId });

    return () => {
      socket.off('wb-draw', onDraw);
      socket.off('wb-clear', onClear);
      socket.off('wb-cursor', onCursor);
      socket.off('wb-request-canvas', onRequestCanvas);
      socket.off('wb-canvas-state', onCanvasState);
      socket.off('user-left', onPeerLeft);
    };
  }, [socket, roomId, userId]);

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  const saveSnapshot = () => {
    const ctx = getCtx();
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoStackRef.current = [];
  };

  const undo = useCallback(() => {
    if (historyRef.current.length < 2) return;
    const current = historyRef.current.pop();
    redoStackRef.current.push(current);
    const prev = historyRef.current[historyRef.current.length - 1];
    getCtx().putImageData(prev, 0, 0);
  }, []);

  const redo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    const next = redoStackRef.current.pop();
    historyRef.current.push(next);
    getCtx().putImageData(next, 0, 0);
  }, []);

  // ── Drawing events ──────────────────────────────────────────────────────────
  const startDraw = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
    saveSnapshot();
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);

    // Emit cursor
    if (socket) {
      socket.emit('wb-cursor', { roomId, from: socket.id, x: pos.x, y: pos.y, color, userName });
    }

    if (!drawing.current || !lastPos.current) return;

    const ctx = getCtx();
    const prev = lastPos.current;

    ctx.save();
    ctx.strokeStyle = tool === 'eraser' ? '#0c1220' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();

    if (socket) {
      socket.emit('wb-draw', {
        roomId,
        from: socket.id,
        x0: prev.x, y0: prev.y,
        x1: pos.x, y1: pos.y,
        color, size: tool === 'eraser' ? size * 3 : size, tool,
      });
    }

    lastPos.current = pos;
  }, [socket, roomId, color, size, tool, userName]);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  const clearBoard = () => {
    const ctx = getCtx();
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveSnapshot();
    if (socket) socket.emit('wb-clear', { roomId });
  };

  const downloadBoard = () => {
    const link = document.createElement('a');
    link.download = `quantummeet-whiteboard-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'e') setTool('eraser');
      if (e.key === 'p') setTool('pen');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.wbIcon}>⬜</span>
            <span className={styles.title}>Whiteboard</span>
            <span className={styles.subtitle}>— collaborative canvas</span>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconBtn} onClick={downloadBoard} title="Download as PNG">⬇️ Save</button>
            <button className={styles.closeBtn} onClick={onClose} title="Close whiteboard">✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolGroup}>
            <button
              className={`${styles.toolBtn} ${tool === 'pen' ? styles.toolActive : ''}`}
              onClick={() => setTool('pen')} title="Pen (P)"
            >✏️ Pen</button>
            <button
              className={`${styles.toolBtn} ${tool === 'eraser' ? styles.toolActive : ''}`}
              onClick={() => setTool('eraser')} title="Eraser (E)"
            >🧹 Eraser</button>
          </div>

          <div className={styles.toolGroup}>
            {COLORS.map((c) => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${color === c ? styles.swatchActive : ''}`}
                style={{ background: c }}
                onClick={() => { setColor(c); setTool('pen'); }}
                title={c}
              />
            ))}
          </div>

          <div className={styles.toolGroup}>
            {SIZES.map((s) => (
              <button
                key={s}
                className={`${styles.sizeBtn} ${size === s ? styles.sizeActive : ''}`}
                onClick={() => setSize(s)}
                title={`Size ${s}`}
              >
                <span style={{ width: Math.max(4, s), height: Math.max(4, s), borderRadius: '50%', background: color, display: 'block' }} />
              </button>
            ))}
          </div>

          <div className={styles.toolGroup}>
            <button className={styles.actionBtn} onClick={undo} title="Undo (Ctrl+Z)">↩ Undo</button>
            <button className={styles.actionBtn} onClick={redo} title="Redo (Ctrl+Y)">↪ Redo</button>
            <button className={`${styles.actionBtn} ${styles.clearBtn}`} onClick={clearBoard} title="Clear board">🗑 Clear</button>
          </div>

          {/* Active peers indicator */}
          <div className={styles.peersIndicator}>
            {Object.values(activePeers).map((p, i) => (
              <div key={i} className={styles.peerDot} style={{ borderColor: p.color }} title={p.userName}>
                {p.userName?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${tool === 'eraser' ? styles.eraserCursor : styles.penCursor}`}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          {/* Remote peer cursors */}
          {Object.entries(activePeers).map(([sid, peer]) => (
            <div
              key={sid}
              className={styles.remoteCursor}
              style={{
                left: `${(peer.x / 1600) * 100}%`,
                top: `${(peer.y / 900) * 100}%`,
                borderColor: peer.color,
                color: peer.color,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M0 0 L0 12 L4 9 L7 14 L9 13 L6 8 L11 8 Z"
                  fill={peer.color} stroke="#000" strokeWidth="0.5" />
              </svg>
              <span className={styles.cursorLabel}>{peer.userName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
