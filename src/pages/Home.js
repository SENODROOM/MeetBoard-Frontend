import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const userId = (() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  })();

  const handleCreate = async () => {
    if (!userName.trim()) { setError('Please enter your name first'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setCreatedLink(data.link);
      localStorage.setItem('qm_userName', userName);
    } catch {
      setError('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (!userName.trim()) { setError('Please enter your name'); return; }
    if (!joinCode.trim()) { setError('Please enter a meeting code or link'); return; }
    localStorage.setItem('qm_userName', userName);
    // Extract roomId from link or use as-is
    const match = joinCode.match(/\/room\/([^/?#]+)/);
    const roomId = match ? match[1] : joinCode.trim();
    navigate(`/room/${roomId}`);
  };

  const handleGoToRoom = () => {
    const match = createdLink.match(/\/room\/([^/?#]+)/);
    if (match) navigate(`/room/${match[1]}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.grid} />
      </div>

      <nav className={styles.nav}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>WebRTC · End-to-End</div>
          <h1 className={styles.title}>
            Video calls at the<br />
            <span className={styles.gradient}>speed of light</span>
          </h1>
          <p className={styles.subtitle}>
            Instant meetings. No downloads. Just share a link and connect.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.nameRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Your name"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              defaultValue={localStorage.getItem('qm_userName') || ''}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {!createdLink ? (
            <>
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    <span className={styles.btnIcon}>＋</span>
                    New Meeting
                  </>
                )}
              </button>

              <div className={styles.divider}><span>or join existing</span></div>

              <div className={styles.joinRow}>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Enter meeting code or link"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <button className={styles.btnSecondary} onClick={handleJoin}>Join</button>
              </div>
            </>
          ) : (
            <div className={styles.linkBox}>
              <p className={styles.linkLabel}>Your meeting is ready!</p>
              <div className={styles.linkRow}>
                <code className={styles.linkText}>{createdLink}</code>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <button className={styles.btnPrimary} onClick={handleGoToRoom}>
                Join Now →
              </button>
              <button
                className={styles.btnGhost}
                onClick={() => setCreatedLink('')}
              >
                Create another
              </button>
            </div>
          )}
        </div>

        <div className={styles.features}>
          {[
            { icon: '🔒', title: 'Secure', desc: 'WebRTC encrypted P2P' },
            { icon: '⚡', title: 'Instant', desc: 'No signup required' },
            { icon: '💬', title: 'Chat', desc: 'In-room messaging' },
            { icon: '🖥️', title: 'Screen Share', desc: 'Share your display' },
          ].map((f) => (
            <div key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <strong>{f.title}</strong>
              <span>{f.desc}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
