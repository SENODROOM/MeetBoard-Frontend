import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ messages, userId, onSend, onClose }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>💬 Meeting chat</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>No messages yet. Say hello! 👋</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.userId === userId ? styles.own : ''}`}
          >
            {msg.userId !== userId && (
              <span className={styles.msgName}>{msg.userName}</span>
            )}
            <div className={styles.bubble}>{msg.message}</div>
            <span className={styles.time}>{formatTime(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <input
          type="text"
          placeholder="Send a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className={styles.input}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
