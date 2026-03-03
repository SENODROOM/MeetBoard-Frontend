import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function Home() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('home'); // 'home' | 'live'
  const [joinCode, setJoinCode] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('qm_userName') || '');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [roomType, setRoomType] = useState('public'); // 'public' | 'private'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdData, setCreatedData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [liveRooms, setLiveRooms] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

  const userId = (() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
    return id;
  })();

  // Fetch live public rooms
  const fetchLive = async () => {
    setLiveLoading(true);
    try {
      const res = await fetch(`${API}/api/rooms`);
      const data = await res.json();
      setLiveRooms(Array.isArray(data) ? data : []);
    } catch {
      setLiveRooms([]);
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'live') fetchLive();
  }, [tab]);

  const handleCreate = async () => {
    if (!userName.trim()) { setError('Please enter your name first'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          hostName: userName,
          isPublic: roomType === 'public',
          title: meetingTitle || `${userName}'s Meeting`,
        }),
      });
      const data = await res.json();
      setCreatedData(data);
      localStorage.setItem('qm_userName', userName);
      localStorage.setItem(`qm_host_${data.roomId}`, '1');
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
    const match = joinCode.match(/\/room\/([^/?#]+)/);
    const roomId = match ? match[1] : joinCode.trim();
    navigate(`/room/${roomId}`);
  };

  const handleGoToRoom = () => {
    if (!createdData) return;
    localStorage.setItem('qm_userName', userName);
    navigate(`/room/${createdData.roomId}`);
  };

  const handleCopy = () => {
    if (!createdData) return;
    navigator.clipboard.writeText(createdData.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinLive = (roomId) => {
    if (!userName.trim()) { setError('Please enter your name first'); setTab('home'); return; }
    localStorage.setItem('qm_userName', userName);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.grid} />
      </div>

      <nav className={styles.nav}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${tab === 'home' ? styles.navTabActive : ''}`}
            onClick={() => setTab('home')}
          >🏠 Home</button>
          <button
            className={`${styles.navTab} ${tab === 'live' ? styles.navTabActive : ''}`}
            onClick={() => setTab('live')}
          >🔴 Live Streams</button>
        </div>
      </nav>

      {tab === 'home' && (
        <main className={styles.main}>
          <div className={styles.hero}>
            <div className={styles.badge}>WebRTC · End-to-End</div>
            <h1 className={styles.title}>
              Video calls at the<br /><span className={styles.gradient}>speed of light</span>
            </h1>
            <p className={styles.subtitle}>Instant meetings. No downloads. Just share a link.</p>
          </div>

          <div className={styles.card}>
            <input
              className={styles.input}
              type="text"
              placeholder="Your name"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(''); }}
            />

            {error && <p className={styles.error}>{error}</p>}

            {!createdData ? (
              <>
                {/* Meeting title */}
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Meeting title (optional)"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                />

                {/* Public / Private toggle */}
                <div className={styles.typeToggle}>
                  <button
                    className={`${styles.typeBtn} ${roomType === 'public' ? styles.typeBtnActive : ''}`}
                    onClick={() => setRoomType('public')}
                  >
                    <span className={styles.typeIcon}>🌐</span>
                    <div>
                      <strong>Public</strong>
                      <span>Anyone can join & visible in Live Streams</span>
                    </div>
                  </button>
                  <button
                    className={`${styles.typeBtn} ${roomType === 'private' ? styles.typeBtnPrivate : ''}`}
                    onClick={() => setRoomType('private')}
                  >
                    <span className={styles.typeIcon}>🔒</span>
                    <div>
                      <strong>Private</strong>
                      <span>Link only · Host must approve entry</span>
                    </div>
                  </button>
                </div>

                <button className={styles.btnPrimary} onClick={handleCreate} disabled={loading}>
                  {loading ? <span className={styles.spinner} /> : <><span className={styles.btnIcon}>＋</span> New Meeting</>}
                </button>

                <div className={styles.divider}><span>or join existing</span></div>

                <div className={styles.joinRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Meeting code or link"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />
                  <button className={styles.btnSecondary} onClick={handleJoin}>Join</button>
                </div>
              </>
            ) : (
              <div className={styles.linkBox}>
                <div className={styles.roomTypeBadge}>
                  {createdData.isPublic
                    ? <span className={styles.publicBadge}>🌐 Public Meeting</span>
                    : <span className={styles.privateBadge}>🔒 Private Meeting</span>}
                </div>
                <p className={styles.linkLabel}>Your meeting is ready!</p>
                <div className={styles.linkRow}>
                  <code className={styles.linkText}>{createdData.link}</code>
                  <button className={styles.copyBtn} onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy'}</button>
                </div>
                {!createdData.isPublic && (
                  <p className={styles.privateNote}>
                    🔒 Private — guests will knock and wait for your approval to enter.
                  </p>
                )}
                <button className={styles.btnPrimary} onClick={handleGoToRoom}>Join Now →</button>
                <button className={styles.btnGhost} onClick={() => setCreatedData(null)}>Create another</button>
              </div>
            )}
          </div>

          <div className={styles.features}>
            {[
              { icon: '🔒', title: 'Secure', desc: 'WebRTC P2P encrypted' },
              { icon: '⚡', title: 'Instant', desc: 'No signup required' },
              { icon: '💬', title: 'Chat', desc: 'In-room messaging' },
              { icon: '🖊️', title: 'Whiteboard', desc: 'Collaborate in real-time' },
            ].map((f) => (
              <div key={f.title} className={styles.feature}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </div>
            ))}
          </div>
        </main>
      )}

      {tab === 'live' && (
        <main className={styles.main}>
          <div className={styles.liveHeader}>
            <div>
              <h2 className={styles.liveTitle}>🔴 Live Public Meetings</h2>
              <p className={styles.liveSubtitle}>Join any active public meeting right now</p>
            </div>
            <button className={styles.refreshBtn} onClick={fetchLive} disabled={liveLoading}>
              {liveLoading ? <span className={styles.spinnerSmall} /> : '↺'} Refresh
            </button>
          </div>

          {!userName.trim() && (
            <div className={styles.namePrompt}>
              <input
                className={styles.input}
                type="text"
                placeholder="Enter your name to join a meeting"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                style={{ maxWidth: 320 }}
              />
            </div>
          )}

          {liveLoading ? (
            <div className={styles.liveLoading}>
              <span className={styles.spinnerLg} />
              <span>Scanning for live meetings…</span>
            </div>
          ) : liveRooms.length === 0 ? (
            <div className={styles.emptyLive}>
              <span className={styles.emptyIcon}>📡</span>
              <strong>No live meetings right now</strong>
              <span>Create a public meeting and it will appear here.</span>
            </div>
          ) : (
            <div className={styles.liveGrid}>
              {liveRooms.map((room) => (
                <div key={room.roomId} className={styles.liveCard}>
                  <div className={styles.liveCardTop}>
                    <div className={styles.liveDot} />
                    <span className={styles.liveLabel}>LIVE</span>
                  </div>
                  <h3 className={styles.liveCardTitle}>{room.title || `${room.hostName}'s Meeting`}</h3>
                  <div className={styles.liveCardMeta}>
                    <span>👤 {room.hostName}</span>
                    <span>👥 {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.liveCardId}>{room.roomId}</div>
                  <button
                    className={styles.joinLiveBtn}
                    onClick={() => handleJoinLive(room.roomId)}
                  >
                    Join Meeting →
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
