import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';

const EMOJIS = ['👋','😄','👍','❤️','🔥','🎉','😂','🤔'];

export default function ChatPanel({ messages, userId, onSend, onClose }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>💬</span>
          <span>Meeting chat</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p>No messages yet.</p>
            <p className={styles.emptyHint}>Say hello! 👋</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.userId === userId;
          const showName = !isOwn && (i === 0 || messages[i-1]?.userId !== msg.userId);
          return (
            <div key={msg.id || i} className={`${styles.msgGroup} ${isOwn ? styles.own : ''}`}>
              {showName && <span className={styles.msgName}>{msg.userName}</span>}
              <div className={styles.bubble}>
                <span className={styles.msgText}>{msg.message}</span>
              </div>
              <span className={styles.time}>{fmt(msg.timestamp)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        {showEmoji && (
          <div className={styles.emojiPicker}>
            {EMOJIS.map(e => (
              <button key={e} className={styles.emojiBtn}
                onClick={() => { setText(t => t + e); inputRef.current?.focus(); }}>
                {e}
              </button>
            ))}
          </div>
        )}
        <div className={styles.inputRow}>
          <button className={`${styles.emojiToggle} ${showEmoji ? styles.emojiToggleActive : ''}`}
            onClick={() => setShowEmoji(v => !v)} title="Emoji">
            😊
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Send a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className={styles.input}
          />
          <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
