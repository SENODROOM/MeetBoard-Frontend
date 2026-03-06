import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ messages, userId, onSend, onClose }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textRef   = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    textRef.current?.focus();
  };

  // Group consecutive msgs from same user
  const groups = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    if (prev && prev.userId === msg.userId) groups[groups.length - 1].msgs.push(msg);
    else groups.push({ userId: msg.userId, userName: msg.userName, msgs: [msg] });
  });

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>💬 Chat</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {messages.length === 0 ? (
        <div className={styles.emptyChat}>
          <span>💬</span>
          <p>No messages yet.<br/>Start the conversation!</p>
        </div>
      ) : (
        <div className={styles.messages}>
          {groups.map((g, gi) => {
            const isOwn = g.userId === userId;
            return (
              <div key={gi} className={`${styles.msgGroup} ${isOwn ? styles.msgOwn : styles.msgOther}`}>
                {!isOwn && <div className={styles.msgAuthor}>{g.userName}</div>}
                {g.msgs.map((msg, mi) => (
                  <div key={mi} className={styles.msgBubble}>
                    {msg.message}
                  </div>
                ))}
                <div className={styles.msgTime}>
                  {new Date(g.msgs[g.msgs.length-1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          ref={textRef} className={styles.input}
          placeholder="Message…" value={input} rows={1}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className={styles.sendBtn} onClick={send} disabled={!input.trim()}>➤</button>
      </div>
    </div>
  );
}
