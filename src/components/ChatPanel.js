import React, { useState, useRef, useEffect } from "react";
import styles from "./ChatPanel.module.css";

export default function ChatPanel({
  messages,
  userId,
  onSend,
  onClose,
  unreadCount = 0,
  initialScrollTop = null,
  onScrollPositionChange,
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textRef = useRef(null);
  const messagesRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const initializedRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastMessageCountRef = useRef(messages.length);
  const lastScrollTopRef = useRef(0);

  const unreadStartIndex =
    unreadCount > 0 ? Math.max(0, messages.length - unreadCount) : -1;

  const syncBottomState = () => {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - (el.scrollTop + el.clientHeight);
    isAtBottomRef.current = distanceFromBottom <= 48;
    lastScrollTopRef.current = el.scrollTop;
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || initializedRef.current) return;

    if (unreadCount > 0 && firstUnreadRef.current) {
      firstUnreadRef.current.scrollIntoView({ block: "start" });
    } else if (typeof initialScrollTop === "number") {
      el.scrollTop = initialScrollTop;
    } else {
      el.scrollTop = el.scrollHeight;
    }

    syncBottomState();
    lastMessageCountRef.current = messages.length;
    initializedRef.current = true;
  }, [messages.length, unreadCount, initialScrollTop]);

  useEffect(() => {
    if (!initializedRef.current) return;
    const hadNewMessages = messages.length > lastMessageCountRef.current;
    if (hadNewMessages && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
    lastMessageCountRef.current = messages.length;
    syncBottomState();
  }, [messages]);

  useEffect(
    () => () => {
      onScrollPositionChange?.(lastScrollTopRef.current);
    },
    [onScrollPositionChange],
  );

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
    textRef.current?.focus();
  };

  // Group consecutive msgs from same user
  const groups = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    const withIndex = { ...msg, _index: i };
    if (prev && prev.userId === msg.userId)
      groups[groups.length - 1].msgs.push(withIndex);
    else
      groups.push({
        userId: msg.userId,
        userName: msg.userName,
        msgs: [withIndex],
      });
  });

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>💬 Chat</span>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {messages.length === 0 ? (
        <div className={styles.emptyChat}>
          <span>💬</span>
          <p>
            No messages yet.
            <br />
            Start the conversation!
          </p>
        </div>
      ) : (
        <div
          className={styles.messages}
          ref={messagesRef}
          onScroll={syncBottomState}
        >
          {groups.map((g, gi) => {
            const isOwn = g.userId === userId;
            return (
              <div
                key={gi}
                className={`${styles.msgGroup} ${isOwn ? styles.msgOwn : styles.msgOther}`}
              >
                {!isOwn && <div className={styles.msgAuthor}>{g.userName}</div>}
                {g.msgs.map((msg, mi) => (
                  <React.Fragment key={`${msg._index}-${mi}`}>
                    {msg._index === unreadStartIndex && unreadCount > 0 && (
                      <div
                        className={styles.unreadDivider}
                        ref={firstUnreadRef}
                      >
                        Unread messages
                      </div>
                    )}
                    <div className={styles.msgBubble}>{msg.message}</div>
                  </React.Fragment>
                ))}
                <div className={styles.msgTime}>
                  {new Date(
                    g.msgs[g.msgs.length - 1].timestamp,
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          ref={textRef}
          className={styles.input}
          placeholder="Message…"
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className={styles.sendBtn}
          onClick={send}
          disabled={!input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
