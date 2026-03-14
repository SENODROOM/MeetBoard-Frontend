/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./TranscribePanel.module.css";

export default function TranscribePanel({
  isHost,
  socket,
  roomId,
  userId,
  userName,
  permitted,
  onClose,
}) {
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState([]);
  const [interimText, setInterim] = useState("");
  const [lang, setLang] = useState("en-US");
  const [shareToAll, setShare] = useState(true);
  // FIX: replaced alert() for unsupported browser with an inline error state
  const [srError, setSrError] = useState("");
  const recognRef = useRef(null);
  const bottomRef = useRef(null);
  // FIX: track whether the user deliberately stopped so auto-restart doesn't re-engage
  const userStoppedRef = useRef(false);
  const canUse = isHost || permitted;

  // Receive remote transcripts
  useEffect(() => {
    if (!socket) return;
    const handler = ({ text, speakerName, timestamp }) => {
      setLines((p) => [...p, { text, speakerName, timestamp, remote: true }]);
    };
    socket.on("transcript-line", handler);
    return () => socket.off("transcript-line", handler);
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, interimText]);

  const startRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    // FIX: replaced alert() with inline error — alert() is a blocking call that
    // freezes the page and would disrupt an ongoing video call
    if (!SR) {
      setSrError(
        "Speech Recognition is not supported in this browser. Try Chrome or Edge.",
      );
      return;
    }
    setSrError("");
    userStoppedRef.current = false;

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    recognRef.current = r;

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          const line = {
            text,
            speakerName: userName,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setLines((p) => [...p, line]);
          setInterim("");
          if (shareToAll && socket)
            socket.emit("transcript-share", { roomId, ...line });
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setInterim(interim);
    };

    r.onerror = (event) => {
      // 'aborted' fires when we call .stop() ourselves — don't treat it as an error
      if (event.error === "aborted") return;
      setActive(false);
      setInterim("");
    };

    // FIX: auto-restart on browser-initiated end (Chrome stops recognition after ~60s
    // of silence or due to its internal timeout). Only restart if the user didn't
    // deliberately stop via the button.
    r.onend = () => {
      if (recognRef.current !== r) return; // a new instance was already started
      if (!userStoppedRef.current) {
        // Browser auto-stopped — restart silently
        try {
          r.start();
        } catch {
          // If restart fails (e.g. permission revoked), mark as inactive
          setActive(false);
          setInterim("");
        }
      } else {
        setActive(false);
        setInterim("");
      }
    };

    r.start();
    setActive(true);
  }, [lang, shareToAll, socket, roomId, userName]);

  const stopRecognition = useCallback(() => {
    userStoppedRef.current = true;
    recognRef.current?.stop();
    recognRef.current = null;
    setActive(false);
    setInterim("");
  }, []);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      recognRef.current?.stop();
      recognRef.current = null;
    };
  }, []);

  const toggleTranscription = () => {
    if (active) stopRecognition();
    else startRecognition();
  };

  const downloadTranscript = () => {
    const text = lines
      .map((l) => `[${l.timestamp}] ${l.speakerName}: ${l.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${roomId}.txt`;
    a.click();
    // FIX: revoke the object URL after click to free memory — previously leaked
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const clearTranscript = () => {
    setLines([]);
    setInterim("");
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🎙</span>
          <div>
            <span className={styles.title}>Live Transcript</span>
            {active && <span className={styles.livePill}>● LIVE</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          {lines.length > 0 && (
            <button
              className={styles.iconBtn}
              onClick={downloadTranscript}
              title="Download"
            >
              ⬇
            </button>
          )}
          {lines.length > 0 && (
            <button
              className={styles.iconBtn}
              onClick={clearTranscript}
              title="Clear"
            >
              🗑
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {!canUse ? (
        <div className={styles.locked}>
          <span className={styles.lockIcon}>🔒</span>
          <strong>Permission Required</strong>
          <p>The host needs to grant you transcription access.</p>
        </div>
      ) : (
        <>
          <div className={styles.controls}>
            <div className={styles.controlRow}>
              <label className={styles.ctrlLabel}>Language</label>
              <select
                className={styles.select}
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={active}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="hi-IN">Hindi</option>
                <option value="ar-SA">Arabic</option>
                <option value="zh-CN">Chinese</option>
                <option value="ja-JP">Japanese</option>
                <option value="pt-BR">Portuguese</option>
                <option value="ur-PK">Urdu</option>
              </select>
            </div>
            <div className={styles.controlRow}>
              <label className={styles.ctrlLabel}>
                <input
                  type="checkbox"
                  checked={shareToAll}
                  onChange={(e) => setShare(e.target.checked)}
                />
                <span style={{ marginLeft: 6 }}>Share with everyone</span>
              </label>
            </div>
            {/* FIX: inline error replaces alert() */}
            {srError && <p className={styles.srError}>{srError}</p>}
            <button
              className={`${styles.toggleBtn} ${active ? styles.stop : styles.start}`}
              onClick={toggleTranscription}
            >
              {active ? "⏹ Stop Transcribing" : "▶ Start Transcribing"}
            </button>
          </div>

          <div className={styles.transcript}>
            {lines.length === 0 && !interimText && (
              <div className={styles.empty}>
                <span style={{ fontSize: 32 }}>📝</span>
                <p>Transcription will appear here once started</p>
              </div>
            )}
            {lines.map((l, i) => (
              <div
                key={i}
                className={`${styles.line} ${l.remote ? styles.remote : styles.local}`}
              >
                <div className={styles.lineMeta}>
                  <span className={styles.speaker}>{l.speakerName}</span>
                  <span className={styles.time}>{l.timestamp}</span>
                </div>
                <p className={styles.lineText}>{l.text}</p>
              </div>
            ))}
            {interimText && (
              <div className={`${styles.line} ${styles.interim}`}>
                <div className={styles.lineMeta}>
                  <span className={styles.speaker}>{userName}</span>
                  <span className={styles.time}>…</span>
                </div>
                <p className={styles.lineText}>{interimText}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}
    </div>
  );
}
