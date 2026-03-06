/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import styles from './Home.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function getUserId() {
  let id = localStorage.getItem('qm_userId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
  return id;
}

export default function Home() {
  const navigate  = useNavigate();
  const [tab, setTab] = useState('home');
  const [joinCode, setJoinCode]       = useState('');
  const [userName, setUserName]       = useState(() => localStorage.getItem('qm_userName') || '');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [roomType, setRoomType]       = useState('public');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [createdData, setCreatedData] = useState(null);
  const [copied, setCopied]           = useState(false);
  const [liveRooms, setLiveRooms]     = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // SecretMeet
  const [secretState, setSecretState] = useState('idle'); // idle | waiting | matched
  const [secretPartner, setSecretPartner] = useState('');
  const secretSocketRef = useRef(null);

  const userId = getUserId();

  const fetchLive = async () => {
    setLiveLoading(true);
    try {
      const res = await fetch(`${API}/api/rooms`);
      const data = await res.json();
      setLiveRooms(Array.isArray(data) ? data : []);
    } catch { setLiveRooms([]); }
    finally { setLiveLoading(false); }
  };

  useEffect(() => { if (tab === 'live') fetchLive(); }, [tab]);

  // Cleanup SecretMeet socket on tab change
  useEffect(() => {
    if (tab !== 'secret') {
      if (secretSocketRef.current) {
        secretSocketRef.current.emit('secret-leave-queue');
        secretSocketRef.current.disconnect();
        secretSocketRef.current = null;
      }
      setSecretState('idle');
    }
  }, [tab]);

  const handleCreate = async () => {
    if (!userName.trim()) { setError('Please enter your name first'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, hostName: userName, isPublic: roomType === 'public', title: meetingTitle || `${userName}'s Meeting` }),
      });
      const data = await res.json();
      setCreatedData(data);
      localStorage.setItem('qm_userName', userName);
      localStorage.setItem(`qm_host_${data.roomId}`, '1');
    } catch { setError('Failed to create room. Is the server running?'); }
    finally { setLoading(false); }
  };

  const handleJoin = () => {
    if (!userName.trim()) { setError('Please enter your name'); return; }
    if (!joinCode.trim()) { setError('Enter a meeting code or link'); return; }
    localStorage.setItem('qm_userName', userName);
    const match = joinCode.match(/\/room\/([^/?#]+)/);
    navigate(`/room/${match ? match[1] : joinCode.trim()}`);
  };

  const handleGoToRoom = () => {
    if (!createdData) return;
    localStorage.setItem('qm_userName', userName);
    navigate(`/room/${createdData.roomId}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdData.link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ── SecretMeet ──────────────────────────────────────────────────────────────
  const joinSecretQueue = () => {
    if (!userName.trim()) { setError('Enter your name first'); setTab('home'); return; }
    localStorage.setItem('qm_userName', userName);
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    secretSocketRef.current = s;

    s.on('connect', () => {
      s.emit('secret-join-queue', { userId, userName });
    });
    s.on('secret-waiting', () => setSecretState('waiting'));
    s.on('secret-matched', ({ roomId, partnerName }) => {
      setSecretPartner(partnerName);
      setSecretState('matched');
      setTimeout(() => {
        s.disconnect();
        secretSocketRef.current = null;
        navigate(`/room/${roomId}`);
      }, 2000);
    });
    s.on('secret-cancelled', () => setSecretState('idle'));
  };

  const leaveSecretQueue = () => {
    secretSocketRef.current?.emit('secret-leave-queue');
    secretSocketRef.current?.disconnect();
    secretSocketRef.current = null;
    setSecretState('idle');
  };

  return (
    <div className={styles.page}>
      {/* Background */}
      <div className={styles.bg}>
        <div className={styles.orb1}/><div className={styles.orb2}/><div className={styles.orb3}/>
        <div className={styles.grid}/>
        <div className={styles.scanline}/>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>⬡</div>
          <span>Quantum<strong>Meet</strong></span>
        </div>
        <div className={styles.navTabs}>
          {[
            ['home',    '🏠', 'Home'],
            ['live',    '🔴', 'Live'],
            ['secret',  '🎲', 'SecretMeet'],
            ['class',   '🎓', 'Classrooms'],
          ].map(([id, icon, label]) => (
            <button key={id}
              className={`${styles.navTab} ${tab === id ? styles.navTabActive : ''}`}
              onClick={() => id === 'class' ? navigate('/classrooms') : setTab(id)}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
        <div className={styles.navRight}>
          {userName && (
            <div className={styles.userChip}>
              <div className={styles.userAvatar}>{userName[0].toUpperCase()}</div>
              <span>{userName}</span>
            </div>
          )}
        </div>
      </nav>

      {/* ── HOME TAB ── */}
      {tab === 'home' && (
        <main className={styles.main}>
          <div className={styles.hero}>
            <div className={styles.heroBadge}>
              <span className={styles.badgeDot}/> WebRTC · End-to-End Encrypted
            </div>
            <h1 className={styles.title}>
              The future of<br/>
              <span className={styles.gradient}>video meetings</span>
            </h1>
            <p className={styles.subtitle}>
              Crystal-clear HD calls. Zero downloads. Just share a link and connect instantly.
            </p>
            <div className={styles.heroStats}>
              {[['🔒','Secure','E2E WebRTC'],['⚡','Instant','No signup'],['🎓','Classes','Full LMS'],['🎲','Random','SecretMeet']].map(([i,t,d])=>(
                <div key={t} className={styles.stat}>
                  <span>{i}</span><strong>{t}</strong><small>{d}</small>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            {/* Name input */}
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Your name</label>
              <input className={styles.input} type="text" placeholder="e.g. Alex Johnson"
                value={userName} onChange={e => { setUserName(e.target.value); setError(''); }} />
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}

            {!createdData ? (<>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Meeting title <span className={styles.optional}>(optional)</span></label>
                <input className={styles.input} type="text" placeholder="e.g. Weekly Standup"
                  value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} />
              </div>

              <div className={styles.typeToggle}>
                {[
                  ['public','🌐','Public','Anyone can join · Listed in Live'],
                  ['private','🔒','Private','Invite only · Host approves entry'],
                ].map(([v, icon, label, desc]) => (
                  <button key={v}
                    className={`${styles.typeBtn} ${roomType===v ? (v==='public'?styles.typeBtnActive:styles.typeBtnPrivate) : ''}`}
                    onClick={() => setRoomType(v)}>
                    <span className={styles.typeIcon}>{icon}</span>
                    <div className={styles.typeMeta}>
                      <strong>{label}</strong>
                      <span>{desc}</span>
                    </div>
                    {roomType===v && <span className={styles.typeCheck}>✓</span>}
                  </button>
                ))}
              </div>

              <button className={styles.btnPrimary} onClick={handleCreate} disabled={loading}>
                {loading ? <span className={styles.spinner}/> : <>＋ New Meeting</>}
              </button>

              <div className={styles.divider}><span>or join existing</span></div>

              <div className={styles.joinRow}>
                <input className={styles.input} type="text" placeholder="Meeting code or invite link"
                  value={joinCode} onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleJoin()} style={{flex:1}} />
                <button className={styles.btnJoin} onClick={handleJoin}>Join →</button>
              </div>
            </>) : (
              <div className={styles.linkBox}>
                <div className={styles.successIcon}>✓</div>
                <p className={styles.linkLabel}>Your meeting is ready!</p>
                <div className={styles.linkCard}>
                  <code className={styles.linkText}>{createdData.link}</code>
                  <button className={styles.copyBtn} onClick={handleCopy}>{copied ? '✓' : '📋'}</button>
                </div>
                {!createdData.isPublic && (
                  <div className={styles.privateNote}>🔒 Private — guests must be admitted by you</div>
                )}
                <button className={styles.btnPrimary} onClick={handleGoToRoom}>Join Now →</button>
                <button className={styles.btnGhost} onClick={() => setCreatedData(null)}>Create another</button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── LIVE TAB ── */}
      {tab === 'live' && (
        <main className={styles.main}>
          <div className={styles.tabHeader}>
            <div>
              <h2 className={styles.tabTitle}>🔴 Live Public Meetings</h2>
              <p className={styles.tabSubtitle}>Join any active public meeting right now</p>
            </div>
            <button className={styles.refreshBtn} onClick={fetchLive} disabled={liveLoading}>
              {liveLoading ? <span className={styles.spinnerSm}/> : '↺'} Refresh
            </button>
          </div>

          {!userName.trim() && (
            <div className={styles.namePrompt}>
              <input className={styles.input} type="text" placeholder="Enter your name to join"
                value={userName} onChange={e => setUserName(e.target.value)} />
            </div>
          )}

          {liveLoading ? (
            <div className={styles.centerState}><span className={styles.spinnerLg}/><span>Scanning for live meetings…</span></div>
          ) : liveRooms.length === 0 ? (
            <div className={styles.centerState}>
              <span className={styles.emptyIcon}>📡</span>
              <strong>No live meetings right now</strong>
              <span>Create a public meeting to appear here.</span>
            </div>
          ) : (
            <div className={styles.liveGrid}>
              {liveRooms.map(room => (
                <div key={room.roomId} className={styles.liveCard}>
                  <div className={styles.liveCardTop}>
                    <div className={styles.liveDot}/><span className={styles.liveLabel}>LIVE</span>
                    <span className={styles.liveCount}>👥 {room.participantCount}</span>
                  </div>
                  <h3 className={styles.liveCardTitle}>{room.title || `${room.hostName}'s Meeting`}</h3>
                  <p className={styles.liveCardHost}>Hosted by {room.hostName}</p>
                  <code className={styles.liveCardId}>{room.roomId}</code>
                  <button className={styles.joinLiveBtn}
                    onClick={() => { localStorage.setItem('qm_userName', userName); navigate(`/room/${room.roomId}`); }}>
                    Join Meeting →
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── SECRETMEET TAB ── */}
      {tab === 'secret' && (
        <main className={styles.main}>
          <div className={styles.secretWrap}>
            <div className={styles.secretGlow}/>
            <div className={styles.secretCard}>
              <div className={styles.secretIcon}>🎲</div>
              <h2 className={styles.secretTitle}>SecretMeet</h2>
              <p className={styles.secretDesc}>
                Get matched with a random stranger for a spontaneous 1-on-1 conversation.
                You never know who you'll meet next.
              </p>

              {secretState === 'idle' && (<>
                {!userName.trim() && (
                  <input className={styles.input} type="text" placeholder="Enter your name first"
                    value={userName} onChange={e => setUserName(e.target.value)} style={{marginBottom:12}} />
                )}
                <div className={styles.secretRules}>
                  <div className={styles.secretRule}><span>👤</span> Anonymous pairing</div>
                  <div className={styles.secretRule}><span>🎲</span> Completely random</div>
                  <div className={styles.secretRule}><span>⏱</span> Instant connection</div>
                  <div className={styles.secretRule}><span>🔒</span> P2P encrypted</div>
                </div>
                <button className={styles.secretBtn} onClick={joinSecretQueue} disabled={!userName.trim()}>
                  🎲 Find a random match
                </button>
              </>)}

              {secretState === 'waiting' && (
                <div className={styles.secretWaiting}>
                  <div className={styles.secretPulse}>
                    <div className={styles.secretPulseRing}/>
                    <div className={styles.secretPulseRing} style={{animationDelay:'0.5s'}}/>
                    <div className={styles.secretPulseRing} style={{animationDelay:'1s'}}/>
                    <span className={styles.secretPulseIcon}>🎲</span>
                  </div>
                  <p className={styles.secretWaitText}>Finding your match…</p>
                  <p className={styles.secretWaitSub}>Searching the globe for someone to connect with</p>
                  <button className={styles.secretCancelBtn} onClick={leaveSecretQueue}>Cancel</button>
                </div>
              )}

              {secretState === 'matched' && (
                <div className={styles.secretMatched}>
                  <div className={styles.matchedIcon}>🎉</div>
                  <h3>Match found!</h3>
                  <p>You're being connected with <strong>{secretPartner}</strong></p>
                  <div className={styles.matchedBar}><div className={styles.matchedBarFill}/></div>
                  <p className={styles.matchedSub}>Joining room…</p>
                </div>
              )}
            </div>

            <div className={styles.secretHowWorks}>
              <h3>How it works</h3>
              <div className={styles.howSteps}>
                {[
                  ['1','Click Find',      'Join the matching queue'],
                  ['2','Wait briefly',    'We find someone online'],
                  ['3','Connect',         '1-on-1 private call starts'],
                ].map(([n,t,d]) => (
                  <div key={n} className={styles.howStep}>
                    <div className={styles.howNum}>{n}</div>
                    <div><strong>{t}</strong><span>{d}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
