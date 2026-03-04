/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './Whiteboard.module.css';

const COLORS = ['#00d4ff','#ffffff','#f59e0b','#10b981','#ef4444','#a855f7','#f97316','#ec4899'];
const SIZES  = [2, 4, 8, 14, 22];

export default function Whiteboard({ socket, roomId, userId, userName, onClose }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef(null);
  const historyRef = useRef([]);
  const redoStack  = useRef([]);
  const imgUploadRef = useRef(null);

  const [color, setColor]             = useState('#00d4ff');
  const [size, setSize]               = useState(4);
  const [tool, setTool]               = useState('pen');   // pen | eraser
  const [activePeers, setActivePeers] = useState({});

  // Images: { id, src, x, y, w, h }  (canvas-coordinate space)
  const [images, setImages]           = useState([]);
  const [selectedImg, setSelectedImg] = useState(null);
  const dragState  = useRef(null);   // { type:'move'|'resize', id, startX, startY, origX, origY, origW, origH }

  // ── canvas helpers ──────────────────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPos = (e) => {
    const r  = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width  / r.width;
    const sy = canvasRef.current.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  };

  // ── history ─────────────────────────────────────────────────────────────────
  const saveSnapshot = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (historyRef.current.length > 50) historyRef.current.shift();
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length < 2) return;
    redoStack.current.push(historyRef.current.pop());
    getCtx().putImageData(historyRef.current[historyRef.current.length - 1], 0, 0);
  }, []);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop();
    historyRef.current.push(next);
    getCtx().putImageData(next, 0, 0);
  }, []);

  // ── init canvas ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveSnapshot();
  }, [saveSnapshot]);

  // ── socket events ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onDraw = ({ x0, y0, x1, y1, color: c, size: s, tool: t }) => {
      const ctx = getCtx(); if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = t === 'eraser' ? '#0c1220' : c;
      ctx.lineWidth = s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = t === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.restore();
    };

    const onClear = () => {
      const ctx = getCtx(); if (!ctx) return;
      ctx.fillStyle = '#0c1220';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setImages([]);
    };

    const onCursor = ({ from, x, y, color: c, userName: uName }) =>
      setActivePeers((prev) => ({ ...prev, [from]: { x, y, color: c, userName: uName } }));

    const onPeerLeft = ({ socketId }) =>
      setActivePeers((prev) => { const n = { ...prev }; delete n[socketId]; return n; });

    const onRequestCanvas = ({ from }) => {
      socket.emit('wb-canvas-state', { to: from, dataUrl: canvasRef.current.toDataURL() });
    };

    const onCanvasState = ({ dataUrl }) => {
      const img = new window.Image();
      img.onload = () => getCtx()?.drawImage(img, 0, 0);
      img.src = dataUrl;
    };

    const onImageDrop = ({ dataUrl, x, y, w, h, imgId }) => {
      setImages((prev) => {
        if (prev.find((i) => i.id === imgId)) return prev;
        return [...prev, { id: imgId, src: dataUrl, x, y, w, h }];
      });
    };

    const onImageMove   = ({ imgId, x, y }) =>
      setImages((prev) => prev.map((i) => i.id === imgId ? { ...i, x, y } : i));
    const onImageResize = ({ imgId, w, h }) =>
      setImages((prev) => prev.map((i) => i.id === imgId ? { ...i, w, h } : i));
    const onImageDelete = ({ imgId }) =>
      setImages((prev) => prev.filter((i) => i.id !== imgId));

    socket.on('wb-draw',           onDraw);
    socket.on('wb-clear',          onClear);
    socket.on('wb-cursor',         onCursor);
    socket.on('wb-request-canvas', onRequestCanvas);
    socket.on('wb-canvas-state',   onCanvasState);
    socket.on('wb-image-drop',     onImageDrop);
    socket.on('wb-image-move',     onImageMove);
    socket.on('wb-image-resize',   onImageResize);
    socket.on('wb-image-delete',   onImageDelete);
    socket.on('user-left',         onPeerLeft);

    socket.emit('wb-join', { roomId, userId });

    return () => {
      socket.off('wb-draw',           onDraw);
      socket.off('wb-clear',          onClear);
      socket.off('wb-cursor',         onCursor);
      socket.off('wb-request-canvas', onRequestCanvas);
      socket.off('wb-canvas-state',   onCanvasState);
      socket.off('wb-image-drop',     onImageDrop);
      socket.off('wb-image-move',     onImageMove);
      socket.off('wb-image-resize',   onImageResize);
      socket.off('wb-image-delete',   onImageDelete);
      socket.off('user-left',         onPeerLeft);
    };
  }, [socket, roomId, userId]);

  // ── drawing ─────────────────────────────────────────────────────────────────
  const startDraw = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
    saveSnapshot();
  }, [saveSnapshot]);

  const draw = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (socket) socket.emit('wb-cursor', { roomId, from: socket.id, x: pos.x, y: pos.y, color, userName });
    if (!drawing.current || !lastPos.current) return;
    const ctx = getCtx();
    const prev = lastPos.current;
    ctx.save();
    ctx.strokeStyle = tool === 'eraser' ? '#0c1220' : color;
    ctx.lineWidth   = tool === 'eraser' ? size * 3 : size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    ctx.restore();
    if (socket) {
      socket.emit('wb-draw', {
        roomId, from: socket.id,
        x0: prev.x, y0: prev.y, x1: pos.x, y1: pos.y,
        color, size: tool === 'eraser' ? size * 3 : size, tool,
      });
    }
    lastPos.current = pos;
  }, [socket, roomId, color, size, tool, userName, saveSnapshot]);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  // ── image helpers ───────────────────────────────────────────────────────────
  const addImageFromDataUrl = useCallback((dataUrl) => {
    const img = new window.Image();
    img.onload = () => {
      const maxW = 480, maxH = 360;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      const x = Math.round((1600 - w) / 2);
      const y = Math.round((900  - h) / 2);
      const imgId = crypto.randomUUID();
      setImages((prev) => [...prev, { id: imgId, src: dataUrl, x, y, w, h }]);
      setSelectedImg(imgId);
      if (socket) socket.emit('wb-image-drop', { roomId, dataUrl, x, y, w, h, imgId });
    };
    img.src = dataUrl;
  }, [socket, roomId]);

  // ── drag/drop onto whiteboard area ──────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => addImageFromDataUrl(ev.target.result);
    reader.readAsDataURL(file);
  }, [addImageFromDataUrl]);

  // ── paste ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => addImageFromDataUrl(ev.target.result);
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImageFromDataUrl]);

  // ── image drag/resize on the overlay ────────────────────────────────────────
  // We track drag state in a ref so mouse-move stays fast (no stale closures)
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);

  const startImgDrag = useCallback((e, id) => {
    e.stopPropagation(); e.preventDefault();
    setSelectedImg(id);
    const img = imagesRef.current.find((i) => i.id === id);
    if (!img) return;
    dragState.current = { type: 'move', id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y };
  }, []);

  const startImgResize = useCallback((e, id) => {
    e.stopPropagation(); e.preventDefault();
    const img = imagesRef.current.find((i) => i.id === id);
    if (!img) return;
    dragState.current = { type: 'resize', id, startX: e.clientX, startY: e.clientY, origW: img.w, origH: img.h };
  }, []);

  const handleWrapMouseMove = useCallback((e) => {
    if (!dragState.current) return;
    const ds = dragState.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width  / rect.width;
    const sy = canvasRef.current.height / rect.height;
    const dx = (e.clientX - ds.startX) * sx;
    const dy = (e.clientY - ds.startY) * sy;
    if (ds.type === 'move') {
      setImages((prev) => prev.map((i) =>
        i.id === ds.id ? { ...i, x: ds.origX + dx, y: ds.origY + dy } : i
      ));
    } else {
      setImages((prev) => prev.map((i) =>
        i.id === ds.id ? { ...i, w: Math.max(40, ds.origW + dx), h: Math.max(30, ds.origH + dy) } : i
      ));
    }
  }, []);

  const handleWrapMouseUp = useCallback(() => {
    if (!dragState.current) return;
    const ds = dragState.current;
    const img = imagesRef.current.find((i) => i.id === ds.id);
    if (img && socket) {
      if (ds.type === 'move') {
        socket.emit('wb-image-move', { roomId, imgId: ds.id, x: Math.round(img.x), y: Math.round(img.y) });
      } else {
        socket.emit('wb-image-resize', { roomId, imgId: ds.id, w: Math.round(img.w), h: Math.round(img.h) });
      }
    }
    dragState.current = null;
  }, [socket, roomId]);

  const deleteSelectedImg = useCallback(() => {
    if (!selectedImg) return;
    setImages((prev) => prev.filter((i) => i.id !== selectedImg));
    if (socket) socket.emit('wb-image-delete', { roomId, imgId: selectedImg });
    setSelectedImg(null);
  }, [selectedImg, socket, roomId]);

  // ── clear ────────────────────────────────────────────────────────────────────
  const clearBoard = useCallback(() => {
    const ctx = getCtx();
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setImages([]); setSelectedImg(null);
    saveSnapshot();
    if (socket) socket.emit('wb-clear', { roomId });
  }, [socket, roomId, saveSnapshot]);

  const downloadBoard = useCallback(() => {
    const off = document.createElement('canvas');
    off.width = canvasRef.current.width;
    off.height = canvasRef.current.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(canvasRef.current, 0, 0);
    images.forEach(({ src, x, y, w, h }) => {
      const img = new window.Image();
      img.src = src;
      ctx.drawImage(img, x, y, w, h);
    });
    const a = document.createElement('a');
    a.download = `whiteboard-${Date.now()}.png`;
    a.href = off.toDataURL();
    a.click();
  }, [images]);

  // ── keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey) setTool('eraser');
      if (e.key === 'p' && !e.ctrlKey && !e.metaKey) setTool('pen');
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImg) deleteSelectedImg();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedImg, deleteSelectedImg]);

  // ── coordinate helpers (canvas → CSS %) ─────────────────────────────────────
  const px = (x) => `${(x / 1600) * 100}%`;
  const py = (y) => `${(y / 900)  * 100}%`;
  const pw = (w) => `${(w / 1600) * 100}%`;
  const ph = (h) => `${(h / 900)  * 100}%`;

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
            <button className={styles.iconBtn} onClick={downloadBoard} title="Download PNG">
              ⬇️ Save
            </button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolGroup}>
            <button
              className={`${styles.toolBtn} ${tool === 'pen' ? styles.toolActive : ''}`}
              onClick={() => setTool('pen')} title="Pen (P)">
              ✏️ Pen
            </button>
            <button
              className={`${styles.toolBtn} ${tool === 'eraser' ? styles.toolActive : ''}`}
              onClick={() => setTool('eraser')} title="Eraser (E)">
              🧹 Eraser
            </button>
            <button
              className={styles.toolBtn}
              onClick={() => imgUploadRef.current?.click()}
              title="Upload image (or drag & drop / Ctrl+V)">
              🖼️ Image
            </button>
            <input
              ref={imgUploadRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => addImageFromDataUrl(ev.target.result);
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          </div>

          <div className={styles.toolGroup}>
            {COLORS.map((c) => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${color === c ? styles.swatchActive : ''}`}
                style={{ background: c }}
                onClick={() => { setColor(c); setTool('pen'); }}
              />
            ))}
          </div>

          <div className={styles.toolGroup}>
            {SIZES.map((s) => (
              <button
                key={s}
                className={`${styles.sizeBtn} ${size === s ? styles.sizeActive : ''}`}
                onClick={() => setSize(s)}>
                <span style={{ width: Math.max(4, s), height: Math.max(4, s), borderRadius: '50%', background: color, display: 'block' }} />
              </button>
            ))}
          </div>

          <div className={styles.toolGroup}>
            <button className={styles.actionBtn} onClick={undo}>↩ Undo</button>
            <button className={styles.actionBtn} onClick={redo}>↪ Redo</button>
            {selectedImg && (
              <button className={`${styles.actionBtn} ${styles.clearBtn}`} onClick={deleteSelectedImg}>
                🗑 Del image
              </button>
            )}
            <button className={`${styles.actionBtn} ${styles.clearBtn}`} onClick={clearBoard}>
              🗑 Clear
            </button>
          </div>

          <div className={styles.peersIndicator}>
            {Object.values(activePeers).map((p, i) => (
              <div key={i} className={styles.peerDot} style={{ borderColor: p.color }} title={p.userName}>
                {p.userName?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>

          <div className={styles.imageTip}>💡 Drag &amp; drop · Ctrl+V paste</div>
        </div>

        {/* Canvas area */}
        <div
          className={styles.canvasWrap}
          onMouseMove={handleWrapMouseMove}
          onMouseUp={handleWrapMouseUp}
          onMouseLeave={handleWrapMouseUp}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => setSelectedImg(null)}
        >
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

          {/* ── Draggable image overlays ── */}
          {images.map(({ id, src, x, y, w, h }) => (
            <div
              key={id}
              className={`${styles.imgOverlay} ${selectedImg === id ? styles.imgSelected : ''}`}
              style={{ left: px(x), top: py(y), width: pw(w), height: ph(h) }}
              onClick={(e) => { e.stopPropagation(); setSelectedImg(id); }}
              onMouseDown={(e) => startImgDrag(e, id)}
            >
              <img
                src={src}
                alt="whiteboard"
                draggable={false}
                style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
              />
              {selectedImg === id && (
                <>
                  {/* Resize handle — bottom-right corner */}
                  <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => startImgResize(e, id)}
                  />
                  {/* Delete button */}
                  <button
                    className={styles.imgDeleteBtn}
                    onClick={(e) => { e.stopPropagation(); deleteSelectedImg(); }}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}

          {/* ── Remote peer cursors ── */}
          {Object.entries(activePeers).map(([sid, peer]) => (
            <div
              key={sid}
              className={styles.remoteCursor}
              style={{ left: `${(peer.x / 1600) * 100}%`, top: `${(peer.y / 900) * 100}%`, color: peer.color }}
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
