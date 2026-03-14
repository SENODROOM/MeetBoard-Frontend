/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import styles from "./QnAPanel.module.css";

export default function QnAPanel({
  isHost,
  socket,
  roomId,
  userId,
  userName,
  onClose,
}) {
  const [questions, setQuestions] = useState([]);
  const [input, setInput] = useState("");
  const [anon, setAnon] = useState(false);
  const [filter, setFilter] = useState("all");
  const [submitting, setSub] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit("qna-get-all", { roomId });
    const onAll = (qs) => setQuestions(qs);
    const onNew = (q) => setQuestions((p) => [q, ...p]);
    const onUpdated = (q) =>
      setQuestions((p) => p.map((x) => (x.id === q.id ? q : x)));
    socket.on("qna-all", onAll);
    socket.on("qna-new", onNew);
    socket.on("qna-updated", onUpdated);
    return () => {
      socket.off("qna-all", onAll);
      socket.off("qna-new", onNew);
      socket.off("qna-updated", onUpdated);
    };
  }, [socket]);

  // Focus input on open (a11y: move focus into dialog)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!input.trim()) return;
    setSub(true);
    socket.emit("qna-ask", {
      roomId,
      text: input.trim(),
      askerName: userName,
      askerId: userId,
      anonymous: anon,
    });
    setInput("");
    setSub(false);
  };

  const upvote = (qid) =>
    socket.emit("qna-upvote", { roomId, questionId: qid, userId });
  const markAnswered = (qid) =>
    socket.emit("qna-mark-answered", { roomId, questionId: qid });
  const pin = (qid) => socket.emit("qna-pin", { roomId, questionId: qid });
  const dismiss = (qid) =>
    socket.emit("qna-dismiss", { roomId, questionId: qid });

  const sorted = [...questions]
    .filter((q) =>
      filter === "all"
        ? true
        : filter === "answered"
          ? q.answered
          : !q.answered,
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.upvotes.length - a.upvotes.length;
    });

  const openCount = questions.filter((q) => !q.answered).length;
  const answeredCount = questions.filter((q) => q.answered).length;

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qna-title"
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon} aria-hidden="true">
            ❓
          </span>
          <div>
            <span className={styles.title} id="qna-title">
              Q&amp;A
            </span>
            {openCount > 0 && (
              <span
                className={styles.openCount}
                aria-label={`${openCount} open questions`}
              >
                {openCount} open
              </span>
            )}
          </div>
        </div>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close Q&A panel"
        >
          ✕
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Filter questions">
        {[
          ["all", "All"],
          ["open", "Open"],
          ["answered", "Answered"],
        ].map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={filter === v}
            className={`${styles.tab} ${filter === v ? styles.tabActive : ""}`}
            onClick={() => setFilter(v)}
          >
            {label}
            <span className={styles.tabCount} aria-hidden="true">
              {v === "all"
                ? questions.length
                : v === "open"
                  ? openCount
                  : answeredCount}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.askBox}>
        <textarea
          ref={inputRef}
          className={styles.askInput}
          placeholder="Ask a question…"
          value={input}
          rows={2}
          aria-label="Type your question"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className={styles.askFooter}>
          <label className={styles.anonLabel}>
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
              aria-label="Post anonymously"
            />
            <span style={{ marginLeft: 5 }}>Anonymous</span>
          </label>
          <button
            className={styles.askBtn}
            onClick={submit}
            disabled={!input.trim() || submitting}
            aria-label="Submit question"
          >
            {submitting ? "…" : "Ask →"}
          </button>
        </div>
      </div>

      <div className={styles.list} role="list" aria-label="Questions">
        {sorted.length === 0 && (
          <div className={styles.empty}>
            <span aria-hidden="true" style={{ fontSize: 32 }}>
              🙋
            </span>
            <p>
              {filter === "answered"
                ? "No answered questions yet"
                : "No questions yet — be the first!"}
            </p>
          </div>
        )}
        {sorted.map((q) => {
          const hasUpvoted = q.upvotes.includes(userId);
          const isOwn = q.askerId === userId;
          return (
            <div
              key={q.id}
              role="listitem"
              className={`${styles.qCard} ${q.answered ? styles.answeredCard : ""} ${q.pinned ? styles.pinnedCard : ""}`}
            >
              {q.pinned && (
                <div
                  className={styles.pinnedBanner}
                  aria-label="Pinned by host"
                >
                  📌 Pinned by Host
                </div>
              )}
              <div className={styles.qBody}>
                <p className={styles.qText}>{q.text}</p>
                <div className={styles.qMeta}>
                  <span className={styles.asker}>
                    {q.askerName}
                    {isOwn ? " (you)" : ""}
                  </span>
                  <span className={styles.qTime}>
                    {new Date(q.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <div className={styles.qActions}>
                <button
                  className={`${styles.upvoteBtn} ${hasUpvoted ? styles.upvoted : ""}`}
                  onClick={() => upvote(q.id)}
                  aria-label={`${hasUpvoted ? "Remove upvote" : "Upvote"} — ${q.upvotes.length} upvotes`}
                  aria-pressed={hasUpvoted}
                >
                  <span aria-hidden="true">{hasUpvoted ? "▲" : "△"}</span>
                  <span>{q.upvotes.length}</span>
                </button>
                {q.answered && (
                  <span className={styles.answeredPill}>✓ Answered</span>
                )}
                {isHost && !q.answered && (
                  <button
                    className={styles.answerBtn}
                    onClick={() => markAnswered(q.id)}
                    aria-label="Mark as answered"
                  >
                    ✓
                  </button>
                )}
                {isHost && q.answered && (
                  <button
                    className={styles.unanswerBtn}
                    onClick={() => markAnswered(q.id)}
                    aria-label="Reopen question"
                  >
                    ↩
                  </button>
                )}
                {isHost && (
                  <>
                    <button
                      className={`${styles.pinBtn} ${q.pinned ? styles.pinActive : ""}`}
                      onClick={() => pin(q.id)}
                      aria-label={q.pinned ? "Unpin question" : "Pin question"}
                      aria-pressed={q.pinned}
                    >
                      📌
                    </button>
                    <button
                      className={styles.dismissBtn}
                      onClick={() => dismiss(q.id)}
                      aria-label="Dismiss question"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
