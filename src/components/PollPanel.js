/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import styles from "./PollPanel.module.css";

export default function PollPanel({ isHost, socket, roomId, userId, onClose }) {
  const [polls, setPolls] = useState([]);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [myVotes, setMyVotes] = useState({});

  useEffect(() => {
    if (!socket) return;
    socket.emit("poll-get-all", { roomId });
    const onAll = (ps) => setPolls(ps);
    const onNew = (p) => setPolls((prev) => [...prev, p]);
    const onUpdated = (p) =>
      setPolls((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    socket.on("poll-all", onAll);
    socket.on("poll-new", onNew);
    socket.on("poll-updated", onUpdated);
    return () => {
      socket.off("poll-all", onAll);
      socket.off("poll-new", onNew);
      socket.off("poll-updated", onUpdated);
    };
  }, [socket]);

  const createPoll = () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || clean.length < 2) return;
    socket.emit("poll-create", {
      roomId,
      question: question.trim(),
      options: clean,
    });
    setQuestion("");
    setOptions(["", ""]);
    setCreating(false);
  };

  const vote = (pollId, idx) => {
    const prev = myVotes[pollId];
    const newIdx = prev === idx ? -1 : idx;
    setMyVotes((v) => ({ ...v, [pollId]: newIdx }));
    socket.emit("poll-vote", { roomId, pollId, optionIndex: newIdx, userId });
  };

  const endPoll = (pollId) => socket.emit("poll-end", { roomId, pollId });

  const totalVotes = (poll) =>
    poll.options.reduce((a, o) => a + o.votes.length, 0);
  const pct = (votes, total) => (total ? Math.round((votes / total) * 100) : 0);

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="polls-title"
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon} aria-hidden="true">
            📊
          </span>
          <span className={styles.title} id="polls-title">
            Polls
          </span>
          {polls.filter((p) => p.active).length > 0 && (
            <span
              className={styles.liveCount}
              aria-label={`${polls.filter((p) => p.active).length} live polls`}
            >
              {polls.filter((p) => p.active).length} live
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isHost && !creating && (
            <button
              className={styles.newBtn}
              onClick={() => setCreating(true)}
              aria-label="Create new poll"
            >
              + New Poll
            </button>
          )}
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close polls panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {isHost && creating && (
          <div
            className={styles.createCard}
            role="form"
            aria-label="Create new poll"
          >
            <p className={styles.createLabel}>New Poll</p>
            <textarea
              className={styles.qInput}
              placeholder="Ask a question…"
              value={question}
              rows={2}
              aria-label="Poll question"
              autoFocus
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className={styles.optionsList}>
              {options.map((o, i) => (
                <div key={i} className={styles.optionRow}>
                  <div className={styles.optionLetter} aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <input
                    className={styles.optionInput}
                    placeholder={`Option ${i + 1}`}
                    value={o}
                    aria-label={`Poll option ${i + 1}`}
                    onChange={(e) =>
                      setOptions((p) =>
                        p.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                  />
                  {options.length > 2 && (
                    <button
                      className={styles.removeOpt}
                      onClick={() =>
                        setOptions((p) => p.filter((_, j) => j !== i))
                      }
                      aria-label={`Remove option ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                className={styles.addOpt}
                onClick={() => setOptions((p) => [...p, ""])}
                aria-label="Add another poll option"
              >
                + Add option
              </button>
            )}
            <div className={styles.createActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setCreating(false);
                  setQuestion("");
                  setOptions(["", ""]);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.launchBtn}
                onClick={createPoll}
                disabled={
                  !question.trim() || options.filter((o) => o.trim()).length < 2
                }
                aria-label="Launch poll"
              >
                🚀 Launch
              </button>
            </div>
          </div>
        )}

        {polls.length === 0 && !creating && (
          <div className={styles.empty}>
            <span aria-hidden="true" style={{ fontSize: 36 }}>
              📊
            </span>
            {isHost ? (
              <p>Launch a poll to engage your participants</p>
            ) : (
              <p>No polls yet. The host will launch one soon.</p>
            )}
          </div>
        )}

        {[...polls]
          .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
          .map((poll) => {
            const total = totalVotes(poll);
            const showResults = !poll.active || isHost;
            return (
              <div
                key={poll.id}
                className={`${styles.pollCard} ${!poll.active ? styles.ended : ""}`}
                aria-label={`Poll: ${poll.question} — ${poll.active ? "Live" : "Ended"}`}
              >
                <div className={styles.pollHeader}>
                  <span
                    className={`${styles.pollStatus} ${poll.active ? styles.pollActive : styles.pollEnded}`}
                    aria-label={poll.active ? "Live poll" : "Poll ended"}
                  >
                    {poll.active ? "● LIVE" : "✓ ENDED"}
                  </span>
                  <span
                    className={styles.pollVoteCount}
                    aria-label={`${total} votes`}
                  >
                    {total} vote{total !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className={styles.pollQuestion}>{poll.question}</p>

                <div
                  className={styles.optionVotes}
                  role={poll.active && !isHost ? "radiogroup" : "list"}
                  aria-label="Poll options"
                >
                  {poll.options.map((opt, i) => {
                    const p = pct(opt.votes.length, total);
                    const voted = myVotes[poll.id] === i;
                    return (
                      <div
                        key={i}
                        role={poll.active && !isHost ? "radio" : "listitem"}
                        aria-checked={
                          poll.active && !isHost ? voted : undefined
                        }
                        aria-label={`${String.fromCharCode(65 + i)}: ${opt.text}${showResults ? ` — ${p}%` : ""}${voted ? " (your vote)" : ""}`}
                        className={`${styles.optionVote} ${voted ? styles.votedOption : ""} ${poll.active && !isHost ? styles.clickable : ""}`}
                        onClick={() =>
                          poll.active && !isHost && vote(poll.id, i)
                        }
                        tabIndex={poll.active && !isHost ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "Enter" || e.key === " ") &&
                            poll.active &&
                            !isHost
                          ) {
                            e.preventDefault();
                            vote(poll.id, i);
                          }
                        }}
                      >
                        <div className={styles.optionVoteMeta}>
                          <div className={styles.optionVoteLeft}>
                            <span
                              className={styles.optLetter}
                              aria-hidden="true"
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={styles.optText}>{opt.text}</span>
                            {voted && (
                              <span className={styles.myVotePill}>You</span>
                            )}
                          </div>
                          {showResults && (
                            <span
                              className={styles.pctLabel}
                              aria-hidden="true"
                            >
                              {p}%
                            </span>
                          )}
                        </div>
                        {showResults && (
                          <div className={styles.barTrack} aria-hidden="true">
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${p}%`,
                                opacity: voted ? 1 : 0.6,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isHost && poll.active && (
                  <button
                    className={styles.endPollBtn}
                    onClick={() => endPoll(poll.id)}
                    aria-label={`End poll: ${poll.question}`}
                  >
                    End Poll
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
