/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ClassroomDashboard.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const THEMES = {
  cyan:   { bg: 'linear-gradient(135deg,#00d4ff22,#0099bb11)', border: '#00d4ff44', accent: '#00d4ff' },
  violet: { bg: 'linear-gradient(135deg,#7c3aed22,#5b21b611)', border: '#7c3aed44', accent: '#a78bfa' },
  green:  { bg: 'linear-gradient(135deg,#10b98122,#05966911)', border: '#10b98144', accent: '#34d399' },
  amber:  { bg: 'linear-gradient(135deg,#f59e0b22,#d9770611)', border: '#f59e0b44', accent: '#fcd34d' },
  rose:   { bg: 'linear-gradient(135deg,#f4365622,#be123c11)', border: '#f4365644', accent: '#fb7185' },
};

function getUserId() {
  let id = localStorage.getItem('qm_userId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
  return id;
}

export default function ClassroomDashboard() {
  const navigate = useNavigate();
  const userId   = getUserId();
  const userName = localStorage.getItem('qm_userName') || '';

  const [classrooms, setClassrooms]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null); // 'create' | 'join'
  const [nameModal, setNameModal]     = useState(!userName);

  // Create form
  const [form, setForm] = useState({ name:'', description:'', subject:'', section:'', theme:'cyan' });
  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError]   = useState('');
  const [tempName, setTempName]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchClassrooms = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/classrooms/user/${userId}`);
      const d = await r.json();
      setClassrooms(Array.isArray(d) ? d : []);
    } catch { setClassrooms([]); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (userName) fetchClassrooms(); }, []);

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    localStorage.setItem('qm_userName', tempName.trim());
    setNameModal(false);
    fetchClassrooms();
  };

  const handleCreate = async () => {
    const uName = localStorage.getItem('qm_userName') || '';
    if (!form.name.trim()) { setFormError('Classroom name is required'); return; }
    if (!uName) { setFormError('Please set your name first'); return; }
    setSubmitting(true); setFormError('');
    try {
      const r = await fetch(`${API}/api/classrooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, creatorId: userId, creatorName: uName }),
      });
      const d = await r.json();
      if (d.error) { setFormError(d.error); return; }
      setModal(null); setForm({ name:'',description:'',subject:'',section:'',theme:'cyan' });
      navigate(`/classroom/${d.classroomId}`);
    } catch(e) { setFormError('Server error — is the server running?'); }
    finally { setSubmitting(false); }
  };

  const handleJoin = async () => {
    const uName = localStorage.getItem('qm_userName') || '';
    if (!inviteCode.trim()) { setFormError('Enter an invite code'); return; }
    if (!uName) { setFormError('Please set your name first'); return; }
    setSubmitting(true); setFormError('');
    try {
      const r = await fetch(`${API}/api/classrooms/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim(), userId, userName: uName }),
      });
      const d = await r.json();
      if (d.error) { setFormError(d.error); return; }
      setModal(null); setInviteCode('');
      navigate(`/classroom/${d.classroomId}`);
    } catch(e) { setFormError('Server error'); }
    finally { setSubmitting(false); }
  };

  const uName = localStorage.getItem('qm_userName') || '';

  if (nameModal) return (
    <div className={styles.page}>
      <div className={styles.bg}><div className={styles.orb1}/><div className={styles.orb2}/></div>
      <div className={styles.nameCard}>
        <div className={styles.nameLogo}>⬡ QuantumMeet</div>
        <h2>What's your name?</h2>
        <p>Used across meetings and classrooms.</p>
        <input className={styles.nameInput} placeholder="Your full name" value={tempName}
          autoFocus onChange={e => setTempName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
        <button className={styles.nameSaveBtn} onClick={handleSaveName}>Continue →</button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.bg}><div className={styles.orb1}/><div className={styles.orb2}/><div className={styles.grid}/></div>

      {/* Nav */}
      <nav className={styles.nav}>
        <button className={styles.logoBtn} onClick={() => navigate('/')}>
          <span className={styles.logoIcon}>⬡</span>
          <span>Quantum<strong>Meet</strong></span>
        </button>
        <div className={styles.navCenter}>
          <button className={styles.navTab} onClick={() => navigate('/')}>🏠 Meetings</button>
          <button className={`${styles.navTab} ${styles.navTabActive}`}>🎓 Classrooms</button>
        </div>
        <div className={styles.navRight}>
          <div className={styles.avatar}>{uName?.[0]?.toUpperCase()||'?'}</div>
          <span className={styles.navName}>{uName}</span>
        </div>
      </nav>

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🎓 Your Classrooms</h1>
            <p className={styles.subtitle}>Manage classes, assignments, and sessions</p>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.joinBtn} onClick={() => { setModal('join'); setFormError(''); }}>
              + Join class
            </button>
            <button className={styles.createBtn} onClick={() => { setModal('create'); setFormError(''); }}>
              + Create class
            </button>
          </div>
        </div>

        {/* Classrooms grid */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}/><span>Loading classrooms…</span>
          </div>
        ) : classrooms.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🎓</span>
            <h3>No classrooms yet</h3>
            <p>Create a class or join one with an invite code.</p>
            <div className={styles.emptyBtns}>
              <button className={styles.createBtn} onClick={() => setModal('create')}>+ Create class</button>
              <button className={styles.joinBtn}   onClick={() => setModal('join')}>+ Join class</button>
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {classrooms.map(c => {
              const th = THEMES[c.theme] || THEMES.cyan;
              const role = c.members?.find(m => m.userId === userId)?.role || 'student';
              return (
                <div key={c.classroomId} className={styles.card}
                  style={{ background: th.bg, borderColor: th.border }}
                  onClick={() => navigate(`/classroom/${c.classroomId}`)}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon} style={{ background: th.accent + '22', border: `1px solid ${th.border}` }}>
                      📚
                    </div>
                    <span className={styles.roleBadge} style={{ color: th.accent, borderColor: th.border }}>
                      {role === 'teacher' ? '👩‍🏫 Teacher' : '🎓 Student'}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle} style={{ color: th.accent }}>{c.name}</h3>
                  {c.subject && <p className={styles.cardSubject}>{c.subject}{c.section ? ` · ${c.section}` : ''}</p>}
                  {c.description && <p className={styles.cardDesc}>{c.description}</p>}
                  <div className={styles.cardFooter}>
                    <span>👥 {c.members?.length||0} member{c.members?.length !== 1 ? 's' : ''}</span>
                    <span className={styles.cardInvite}>#{c.inviteCode}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Create modal ── */}
      {modal === 'create' && (
        <div className={styles.modalOverlay} onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>🎓 Create a classroom</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {formError && <div className={styles.formError}>{formError}</div>}
              <label className={styles.label}>Class name *</label>
              <input className={styles.input} placeholder="e.g. Physics 101" value={form.name}
                onChange={e => setForm(f=>({...f,name:e.target.value}))} autoFocus />
              <label className={styles.label}>Subject</label>
              <input className={styles.input} placeholder="e.g. Physics" value={form.subject}
                onChange={e => setForm(f=>({...f,subject:e.target.value}))} />
              <label className={styles.label}>Section</label>
              <input className={styles.input} placeholder="e.g. Period 2" value={form.section}
                onChange={e => setForm(f=>({...f,section:e.target.value}))} />
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} placeholder="What's this class about?" value={form.description}
                onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={3} />
              <label className={styles.label}>Theme color</label>
              <div className={styles.themeRow}>
                {Object.entries(THEMES).map(([key, th]) => (
                  <button key={key}
                    className={`${styles.themeBtn} ${form.theme===key ? styles.themeBtnActive : ''}`}
                    style={{ background: th.accent, boxShadow: form.theme===key ? `0 0 0 3px #fff, 0 0 0 5px ${th.accent}` : 'none' }}
                    onClick={() => setForm(f=>({...f,theme:key}))} />
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setModal(null)}>Cancel</button>
              <button className={styles.modalCreate} onClick={handleCreate} disabled={submitting}>
                {submitting ? <span className={styles.spinner}/> : 'Create classroom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join modal ── */}
      {modal === 'join' && (
        <div className={styles.modalOverlay} onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>🔑 Join a classroom</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {formError && <div className={styles.formError}>{formError}</div>}
              <label className={styles.label}>Invite code</label>
              <input className={styles.input} placeholder="e.g. ABC123" value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleJoin()} />
              <p className={styles.joinHint}>Ask your teacher for the 6-character invite code.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setModal(null)}>Cancel</button>
              <button className={styles.modalCreate} onClick={handleJoin} disabled={submitting}>
                {submitting ? <span className={styles.spinner}/> : 'Join classroom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
