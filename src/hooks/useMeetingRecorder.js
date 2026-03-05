/* eslint-disable react-hooks/exhaustive-deps */
/**
 * useMeetingRecorder — records the entire meeting (all video + all audio) for admins.
 * 
 * Strategy (100% free, no server):
 *  1. Create an OffscreenCanvas that composites all video streams in a grid.
 *  2. Create a WebAudio context that mixes all audio streams (local + all peers).
 *  3. Feed canvas stream + mixed audio into MediaRecorder → WebM download.
 *
 * Result: single .webm file with all participants visible + all voices audible.
 */
import { useRef, useState, useCallback } from 'react';

export function useMeetingRecorder({ localStream, peers }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration]   = useState(0);
  const recRef      = useRef(null);
  const chunks      = useRef([]);
  const canvasRef   = useRef(null);
  const ctxRef      = useRef(null);
  const audioCtxRef = useRef(null);
  const destRef     = useRef(null);
  const animRef     = useRef(null);
  const timerRef    = useRef(null);
  const startedAt   = useRef(0);

  const stopRecording = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    }
    cancelAnimationFrame(animRef.current);
    clearInterval(timerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return stopRecording();

    // ── Canvas setup ─────────────────────────────────────────────────────────
    const W = 1280, H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    // ── Audio mix setup ──────────────────────────────────────────────────────
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    destRef.current = dest;

    // Mix all audio sources
    const allStreams = [localStream, ...peers.map(p => p.stream)].filter(Boolean);
    allStreams.forEach(stream => {
      try {
        const src = audioCtx.createMediaStreamSource(stream);
        src.connect(dest);
      } catch {}
    });

    // ── Build video elements for each participant ─────────────────────────────
    const allParticipants = [
      { stream: localStream, label: 'You', mirror: true },
      ...peers.map(p => ({ stream: p.stream, label: p.userName, mirror: false })),
    ].filter(p => p.stream);

    const videos = allParticipants.map(({ stream, label, mirror }) => {
      const v = document.createElement('video');
      v.srcObject = stream;
      v.autoplay  = true;
      v.muted     = true; // prevent double audio
      v.playsInline = true;
      v.play().catch(() => {});
      return { el: v, label, mirror };
    });

    // ── Draw loop ─────────────────────────────────────────────────────────────
    const drawGrid = () => {
      const n = videos.length;
      if (n === 0) { ctx.fillStyle = '#050810'; ctx.fillRect(0,0,W,H); return; }

      const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
      const rows = Math.ceil(n / cols);
      const cellW = W / cols;
      const cellH = H / rows;

      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, W, H);

      videos.forEach(({ el, label, mirror }, i) => {
        const col  = i % cols;
        const row  = Math.floor(i / cols);
        const x    = col * cellW;
        const y    = row * cellH;
        const pad  = 6;

        ctx.save();
        if (mirror) {
          ctx.translate(x + cellW, y);
          ctx.scale(-1, 1);
          ctx.drawImage(el, pad, pad, cellW - pad*2, cellH - pad*2);
        } else {
          ctx.drawImage(el, x + pad, y + pad, cellW - pad*2, cellH - pad*2);
        }
        ctx.restore();

        // Name tag
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x + pad + 8, y + cellH - pad - 28, label.length * 8 + 16, 24);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(label, x + pad + 16, y + cellH - pad - 10);

        // Border
        ctx.strokeStyle = 'rgba(0,212,255,0.25)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(x + pad, y + pad, cellW - pad*2, cellH - pad*2);
      });

      // Timestamp overlay
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
      const ss = String(elapsed % 60).padStart(2,'0');
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.fillRect(W - 90, 12, 78, 26);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`⏺ ${mm}:${ss}`, W - 82, 30);

      animRef.current = requestAnimationFrame(drawGrid);
    };

    // ── MediaRecorder ─────────────────────────────────────────────────────────
    const canvasStream = canvas.captureStream(30);
    const audioTrack   = dest.stream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    let rec;
    try {
      rec = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_000_000 });
    } catch {
      rec = new MediaRecorder(canvasStream);
    }

    chunks.current = [];
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'video/webm' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `QuantumMeet-Recording-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Cleanup video elements
      videos.forEach(({ el }) => { el.srcObject = null; });
    };

    rec.start(1000);
    recRef.current = rec;
    startedAt.current = Date.now();

    // Duration counter
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);

    drawGrid();
    setRecording(true);
    setDuration(0);
  }, [recording, localStream, peers, stopRecording]);

  return { recording, duration, startRecording, stopRecording };
}
