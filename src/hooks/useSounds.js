// src/hooks/useSounds.js
// ─────────────────────────────────────────────────────────────────────────────
// Generates all UI sounds via the Web Audio API (no external files needed).
// Handles browser autoplay policy by resuming AudioContext on first gesture.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useRef, useEffect } from 'react';

let _ctx = null;
const getCtx = () => {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
};

// Resume AudioContext after a user gesture (browsers require this)
const resumeCtx = () => {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { }
};

// Generic tone helper
function playTone({ freq = 440, type = 'sine', gain = 0.18, duration = 0.18, delay = 0 } = {}) {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(gain, ctx.currentTime + delay);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch (e) {
    console.warn('[useSounds] playTone failed:', e);
  }
}

export function useSounds() {
  const lastJoinRef = useRef(0);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => { resumeCtx(); };
    window.addEventListener('click',     unlock, { once: true });
    window.addEventListener('keydown',   unlock, { once: true });
    window.addEventListener('touchstart',unlock, { once: true });
    return () => {
      window.removeEventListener('click',      unlock);
      window.removeEventListener('keydown',    unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // ── User joined: warm 2-note chime (C5 → E5) ─────────────────────────────
  const playJoin = useCallback(() => {
    const now = Date.now();
    if (now - lastJoinRef.current < 400) return;
    lastJoinRef.current = now;
    playTone({ freq: 523.25, type: 'sine', gain: 0.14, duration: 0.22, delay: 0    });
    playTone({ freq: 659.25, type: 'sine', gain: 0.12, duration: 0.28, delay: 0.14 });
  }, []);

  // ── User left: descending 2-note (E5 → C5) ───────────────────────────────
  const playLeave = useCallback(() => {
    playTone({ freq: 659.25, type: 'sine', gain: 0.10, duration: 0.18, delay: 0    });
    playTone({ freq: 523.25, type: 'sine', gain: 0.08, duration: 0.22, delay: 0.14 });
  }, []);

  // ── Chat message: soft single pop ────────────────────────────────────────
  const playMessage = useCallback(() => {
    playTone({ freq: 880, type: 'sine', gain: 0.10, duration: 0.12, delay: 0 });
  }, []);

  // ── Knock / alert: 3 gentle pulses ───────────────────────────────────────
  const playKnock = useCallback(() => {
    [0, 0.18, 0.36].forEach(delay =>
      playTone({ freq: 700, type: 'triangle', gain: 0.13, duration: 0.13, delay })
    );
  }, []);

  return { playJoin, playLeave, playMessage, playKnock };
}