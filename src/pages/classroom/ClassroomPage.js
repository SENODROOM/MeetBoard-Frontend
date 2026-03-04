/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ClassroomPage.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const THEMES = {
  cyan:   { accent:'#00d4ff', bg:'linear-gradient(135deg,#00d4ff,#0099bb)', muted:'rgba(0,212,255,0.15)' },
  violet: { accent:'#a78bfa', bg:'linear-gradient(135deg,#7c3aed,#5b21b6)', muted:'rgba(167,139,250,0.15)' },
  green:  { accent:'#34d399', bg:'linear-gradient(135deg,#10b981,#059669)', muted:'rgba(52,211,153,0.15)' },
  amber:  { accent:'#fcd34d', bg:'linear-gradient(135deg,#f59e0b,#d97706)', muted:'rgba(252,211,77,0.15)' },
  rose:   { accent:'#fb7185', bg:'linear-gradient(135deg,#f43656,#be123c)', muted:'rgba(251,113,133,0.15)' },
};
const fmtSize = b => b > 1e6 ? `${(b/1e6).toFixed(1)} MB` : b > 1e3 ? `${(b/1e3).toFixed(0)} KB` : `${b} B`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
const fmtTime = d => d ? new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
const fmtDur  = (s,e) => { if(!s||!e) return ''; const m=Math.round((new Date(e)-new Date(s))/60000); return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`; };
const fileIcon = mime => {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.includes('pdf'))      return '📄';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel'))   return '📊';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📊';
  if (mime.includes('zip') || mime.includes('rar'))       return '🗜️';
  return '📎';
};

function getUserId() {
  let id = localStorage.getItem('qm_userId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('qm_userId', id); }
  return id;
}

export default function ClassroomPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const userId   = getUserId();
  const userName = localStorage.getItem('qm_userName') || 'Unknown';

  const [classroom, setClassroom] = useState(null);
  const [tab, setTab]             = useState('stream');
  const [loading, setLoading]     = useState(true);
  const [posts, setPosts]         = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [members, setMembers]     = useState([]);

  // My role
  const isTeacher = classroom?.creatorId === userId ||
    classroom?.members?.find(m => m.userId === userId)?.role === 'teacher';

  const th = THEMES[classroom?.theme || 'cyan'];

  // ── Fetch classroom ─────────────────────────────────────────────────────────
  const fetchClassroom = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}`);
      const d = await r.json();
      setClassroom(d); setMembers(d.members || []);
    } catch { setClassroom(null); }
  }, [classroomId]);

  const fetchPosts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}/posts`);
      const d = await r.json();
      setPosts(Array.isArray(d) ? d : []);
    } catch {}
  }, [classroomId]);

  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}/sessions`);
      const d = await r.json();
      setSessions(Array.isArray(d) ? d : []);
    } catch {}
  }, [classroomId]);

  useEffect(() => {
    Promise.all([fetchClassroom(), fetchPosts(), fetchSessions()])
      .finally(() => setLoading(false));
  }, []);

  // ── Start a live class session ───────────────────────────────────────────────
  const startSession = async () => {
    const roomId = `cls-${classroomId.slice(0,8)}-${Date.now().toString(36)}`;
    try {
      // Create meeting room
      await fetch(`${API}/api/rooms`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId, hostName: userName, isPublic: false, title: `${classroom?.name} – Live Session` }),
      });
      // Log session
      await fetch(`${API}/api/classrooms/${classroomId}/sessions`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ roomId, hostName: userName, classroomId }),
      });
      localStorage.setItem(`qm_host_${roomId}`, '1');
      navigate(`/room/${roomId}?classroom=${classroomId}`);
    } catch(e) { console.error(e); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(classroom?.inviteCode || '');
  };

  if (loading) return (
    <div className={styles.loadPage}>
      <div className={styles.spinner}/>
      <span>Loading classroom…</span>
    </div>
  );

  if (!classroom) return (
    <div className={styles.loadPage}>
      <span style={{fontSize:48}}>😕</span>
      <h2>Classroom not found</h2>
      <button className={styles.backBtn} onClick={() => navigate('/classrooms')}>← Back</button>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Banner ── */}
      <div className={styles.banner} style={{ background: th.bg }}>
        <div className={styles.bannerContent}>
          <button className={styles.backBtn} onClick={() => navigate('/classrooms')}>← Classrooms</button>
          <div className={styles.bannerInfo}>
            <h1 className={styles.bannerTitle}>{classroom.name}</h1>
            {(classroom.subject || classroom.section) && (
              <p className={styles.bannerMeta}>{classroom.subject}{classroom.section ? ` · ${classroom.section}` : ''}</p>
            )}
            {classroom.description && <p className={styles.bannerDesc}>{classroom.description}</p>}
          </div>
          <div className={styles.bannerActions}>
            {isTeacher && (
              <button className={styles.startSessionBtn} onClick={startSession}>
                🎥 Start live session
              </button>
            )}
            <div className={styles.inviteBox}>
              <span className={styles.inviteLabel}>Invite code</span>
              <div className={styles.inviteRow}>
                <code className={styles.inviteCode}>{classroom.inviteCode}</code>
                <button className={styles.copyCodeBtn} onClick={copyInvite}>Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabBar}>
        {['stream','assignments','materials','members','sessions'].map(t => (
          <button key={t} className={`${styles.tab} ${tab===t?styles.tabActive:''}`}
            style={tab===t ? { color: th.accent, borderBottomColor: th.accent } : {}}
            onClick={() => setTab(t)}>
            {t==='stream' ? '📢 Stream' : t==='assignments' ? '📋 Assignments' :
             t==='materials' ? '📚 Materials' : t==='members' ? '👥 Members' : '📹 Sessions'}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.content}>
        {tab === 'stream'      && <StreamTab      classroomId={classroomId} posts={posts} setPosts={setPosts} fetchPosts={fetchPosts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} />}
        {tab === 'assignments' && <AssignmentsTab classroomId={classroomId} posts={posts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} />}
        {tab === 'materials'   && <MaterialsTab   classroomId={classroomId} posts={posts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} fetchPosts={fetchPosts} />}
        {tab === 'members'     && <MembersTab     classroom={classroom} members={members} setMembers={setMembers} isTeacher={isTeacher} userId={userId} th={th} />}
        {tab === 'sessions'    && <SessionsTab    sessions={sessions} th={th} navigate={navigate} classroomId={classroomId} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAM TAB — announcements, questions, all post types
// ═══════════════════════════════════════════════════════════════════════════════
function StreamTab({ classroomId, posts, setPosts, fetchPosts, isTeacher, userId, userName, th }) {
  const [compose, setCompose] = useState(false);
  const [form, setForm]       = useState({ type:'announcement', title:'', body:'' });
  const [files, setFiles]     = useState([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const streamPosts = posts.filter(p => p.type === 'announcement' || p.type === 'question');

  const handlePost = async () => {
    if (!form.body.trim() && !form.title.trim()) return;
    setPosting(true);
    const fd = new FormData();
    fd.append('type', form.type); fd.append('title', form.title);
    fd.append('body', form.body); fd.append('authorId', userId); fd.append('authorName', userName);
    files.forEach(f => fd.append('files', f));
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}/posts`, { method:'POST', body: fd });
      const d = await r.json();
      setPosts(p => [d, ...p]);
      setCompose(false); setForm({ type:'announcement', title:'', body:'' }); setFiles([]);
    } catch {}
    finally { setPosting(false); }
  };

  const handlePin = async (postId) => {
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${postId}/pin`, { method:'PATCH' });
    fetchPosts();
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${postId}`, { method:'DELETE' });
    setPosts(p => p.filter(x => x.postId !== postId));
  };

  return (
    <div className={styles.tabContent}>
      {/* Compose box */}
      {(isTeacher || true) && (
        <div className={styles.composeBox} style={{ borderColor: th.accent + '33' }}>
          {!compose ? (
            <button className={styles.composePlaceholder} onClick={() => setCompose(true)} style={{ color: th.accent + '99' }}>
              📢 Share something with your class…
            </button>
          ) : (
            <>
              <div className={styles.composeTypeRow}>
                {['announcement','question'].map(t => (
                  <button key={t} className={`${styles.typeChip} ${form.type===t ? styles.typeChipActive : ''}`}
                    style={form.type===t ? { background: th.accent+'22', borderColor: th.accent, color: th.accent } : {}}
                    onClick={() => setForm(f => ({...f, type:t}))}>
                    {t === 'announcement' ? '📢 Announcement' : '❓ Question'}
                  </button>
                ))}
              </div>
              <textarea className={styles.composeText}
                placeholder="Write something…" rows={3} value={form.body}
                autoFocus onChange={e => setForm(f=>({...f,body:e.target.value}))} />
              {files.length > 0 && (
                <div className={styles.fileChips}>
                  {files.map((f,i) => (
                    <div key={i} className={styles.fileChip}>
                      {fileIcon(f.type)} {f.name}
                      <button onClick={() => setFiles(ff => ff.filter((_,j)=>j!==i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.composeActions}>
                <button className={styles.attachBtn} onClick={() => fileRef.current?.click()}>📎 Attach</button>
                <input ref={fileRef} type="file" multiple style={{display:'none'}}
                  onChange={e => setFiles(ff => [...ff, ...Array.from(e.target.files)])} />
                <div className={styles.composeRight}>
                  <button className={styles.cancelBtn} onClick={() => { setCompose(false); setFiles([]); }}>Cancel</button>
                  <button className={styles.postBtn} style={{ background: th.accent, color:'#000' }}
                    onClick={handlePost} disabled={posting}>
                    {posting ? '…' : 'Post'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Posts */}
      {streamPosts.length === 0 && (
        <div className={styles.emptyTab}>
          <span>📢</span><p>No announcements yet.</p>
        </div>
      )}
      {streamPosts.map(p => (
        <PostCard key={p.postId} post={p} classroomId={classroomId} isTeacher={isTeacher}
          userId={userId} userName={userName} th={th}
          onPin={() => handlePin(p.postId)} onDelete={() => handleDelete(p.postId)} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AssignmentsTab({ classroomId, posts, isTeacher, userId, userName, th }) {
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ title:'', body:'', dueDate:'', points:'' });
  const [files, setFiles]         = useState([]);
  const [posting, setPosting]     = useState(false);
  const [selected, setSelected]   = useState(null); // postId for submission view
  const [allPosts, setAllPosts]   = useState(posts);
  const fileRef = useRef(null);

  useEffect(() => { setAllPosts(posts); }, [posts]);

  const assignments = allPosts.filter(p => p.type === 'assignment');

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    const fd = new FormData();
    fd.append('type','assignment'); fd.append('title', form.title);
    fd.append('body', form.body); fd.append('authorId', userId); fd.append('authorName', userName);
    if (form.dueDate) fd.append('dueDate', form.dueDate);
    if (form.points)  fd.append('points',  form.points);
    files.forEach(f => fd.append('files', f));
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}/posts`, { method:'POST', body: fd });
      const d = await r.json();
      setAllPosts(p => [d, ...p]);
      setCreating(false); setForm({ title:'', body:'', dueDate:'', points:'' }); setFiles([]);
    } catch {}
    finally { setPosting(false); }
  };

  if (selected) return (
    <SubmissionView classroomId={classroomId} post={assignments.find(p=>p.postId===selected)}
      isTeacher={isTeacher} userId={userId} userName={userName} th={th}
      onBack={() => setSelected(null)} />
  );

  return (
    <div className={styles.tabContent}>
      {isTeacher && (
        <button className={styles.createPostBtn} style={{ borderColor: th.accent+'55', color: th.accent }}
          onClick={() => setCreating(c => !c)}>
          {creating ? '✕ Cancel' : '+ Create assignment'}
        </button>
      )}

      {creating && (
        <div className={styles.createForm}>
          <input className={styles.formInput} placeholder="Assignment title *" value={form.title}
            autoFocus onChange={e => setForm(f=>({...f,title:e.target.value}))} />
          <textarea className={styles.formTextarea} placeholder="Instructions…" rows={4} value={form.body}
            onChange={e => setForm(f=>({...f,body:e.target.value}))} />
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Due date</label>
              <input className={styles.formInput} type="datetime-local" value={form.dueDate}
                onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Points</label>
              <input className={styles.formInput} type="number" placeholder="100" value={form.points}
                onChange={e => setForm(f=>({...f,points:e.target.value}))} />
            </div>
          </div>
          <div className={styles.fileRow}>
            <button className={styles.attachBtn} onClick={() => fileRef.current?.click()}>📎 Attach files</button>
            <input ref={fileRef} type="file" multiple style={{display:'none'}}
              onChange={e => setFiles(ff => [...ff, ...Array.from(e.target.files)])} />
            {files.map((f,i) => (
              <div key={i} className={styles.fileChip}>
                {fileIcon(f.type)} {f.name} <button onClick={() => setFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>
          <button className={styles.postBtn} style={{ background: th.accent, color:'#000', width:'100%', padding:'12px' }}
            onClick={handleCreate} disabled={posting}>
            {posting ? 'Creating…' : 'Create assignment'}
          </button>
        </div>
      )}

      {assignments.length === 0 && !creating && (
        <div className={styles.emptyTab}><span>📋</span><p>No assignments yet.</p></div>
      )}
      {assignments.map(a => (
        <div key={a.postId} className={styles.assignmentCard}
          style={{ borderLeftColor: th.accent }}
          onClick={() => setSelected(a.postId)}>
          <div className={styles.assignTop}>
            <span className={styles.assignIcon}>📋</span>
            <div className={styles.assignInfo}>
              <h3 className={styles.assignTitle}>{a.title}</h3>
              <p className={styles.assignMeta}>
                Posted by {a.authorName} · {fmtDate(a.createdAt)}
                {a.dueDate && <span className={styles.dueChip}>Due {fmtDate(a.dueDate)} {fmtTime(a.dueDate)}</span>}
                {a.points   && <span className={styles.ptChip}>{a.points} pts</span>}
              </p>
              {a.body && <p className={styles.assignBody}>{a.body}</p>}
            </div>
          </div>
          {a.attachments?.length > 0 && (
            <div className={styles.attachList}>
              {a.attachments.map((f,i) => (
                <a key={i} className={styles.attachItem}
                  href={`${API}/api/classrooms/${a.classroomId || 'general'}/files/${f.filename}`}
                  target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                  {fileIcon(f.mime)} {f.name} <span>{fmtSize(f.size)}</span>
                </a>
              ))}
            </div>
          )}
          <div className={styles.assignFooter}>
            <span style={{ color: th.accent }}>View / Submit →</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION VIEW — per assignment
// ═══════════════════════════════════════════════════════════════════════════════
function SubmissionView({ classroomId, post, isTeacher, userId, userName, th, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [myFiles, setMyFiles]         = useState([]);
  const [myComment, setMyComment]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [grading, setGrading]         = useState(null); // submissionId
  const [grade, setGrade]             = useState('');
  const [feedback, setFeedback]       = useState('');
  const fileRef = useRef(null);

  const myRole = isTeacher ? 'teacher' : 'student';

  const fetchSubs = useCallback(async () => {
    const r = await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions?userId=${userId}&role=${myRole}`);
    const d = await r.json();
    setSubmissions(Array.isArray(d) ? d : []);
  }, [classroomId, post.postId, userId, myRole]);

  useEffect(() => { fetchSubs(); }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    const fd = new FormData();
    fd.append('studentId', userId); fd.append('studentName', userName); fd.append('comment', myComment);
    myFiles.forEach(f => fd.append('files', f));
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions`, { method:'POST', body: fd });
    setMyComment(''); setMyFiles([]); fetchSubs();
    setSubmitting(false);
  };

  const handleGrade = async (subId) => {
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions/${subId}/grade`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ grade: Number(grade), feedback }),
    });
    setGrading(null); setGrade(''); setFeedback(''); fetchSubs();
  };

  const mySub = submissions.find(s => s.studentId === userId);

  return (
    <div className={styles.tabContent}>
      <button className={styles.backLink} onClick={onBack}>← Back to assignments</button>
      <div className={styles.subHeader}>
        <h2 className={styles.subTitle}>{post.title}</h2>
        <div className={styles.subMeta}>
          {post.dueDate && <span className={styles.dueChip}>Due {fmtDate(post.dueDate)} {fmtTime(post.dueDate)}</span>}
          {post.points  && <span className={styles.ptChip}>{post.points} pts</span>}
        </div>
        {post.body && <p className={styles.subBody}>{post.body}</p>}
        {post.attachments?.length > 0 && (
          <div className={styles.attachList}>
            {post.attachments.map((f,i) => (
              <a key={i} className={styles.attachItem}
                href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`}
                target="_blank" rel="noreferrer">
                {fileIcon(f.mime)} {f.name} <span>{fmtSize(f.size)}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {!isTeacher && (
        <div className={styles.submitBox} style={{ borderColor: th.accent+'44' }}>
          <h3 style={{ color: th.accent }}>Your work</h3>
          {mySub ? (
            <div className={styles.submittedState}>
              <span className={styles.submittedBadge}>✓ Submitted {fmtDate(mySub.submittedAt)}</span>
              {mySub.attachments?.map((f,i) => (
                <a key={i} className={styles.attachItem}
                  href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`}
                  target="_blank" rel="noreferrer">
                  {fileIcon(f.mime)} {f.name}
                </a>
              ))}
              {mySub.comment && <p className={styles.subComment}>💬 {mySub.comment}</p>}
              {mySub.status === 'graded' && (
                <div className={styles.gradeResult} style={{ borderColor: th.accent }}>
                  <strong style={{ color: th.accent }}>{mySub.grade} / {post.points || '?'}</strong>
                  {mySub.feedback && <p>{mySub.feedback}</p>}
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea className={styles.formTextarea} placeholder="Add a comment…" value={myComment} rows={3}
                onChange={e => setMyComment(e.target.value)} />
              <div className={styles.fileRow}>
                <button className={styles.attachBtn} onClick={() => fileRef.current?.click()}>📎 Add files</button>
                <input ref={fileRef} type="file" multiple style={{display:'none'}}
                  onChange={e => setMyFiles(ff => [...ff, ...Array.from(e.target.files)])} />
                {myFiles.map((f,i) => (
                  <div key={i} className={styles.fileChip}>
                    {fileIcon(f.type)} {f.name} <button onClick={() => setMyFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className={styles.postBtn} style={{ background: th.accent, color:'#000' }}
                onClick={handleSubmit} disabled={submitting || (myFiles.length===0 && !myComment.trim())}>
                {submitting ? 'Submitting…' : 'Hand in'}
              </button>
            </>
          )}
        </div>
      )}

      {isTeacher && (
        <div className={styles.submissionsSection}>
          <h3 className={styles.subsHeading}>Submissions ({submissions.length})</h3>
          {submissions.length === 0 && (
            <div className={styles.emptyTab}><span>📭</span><p>No submissions yet.</p></div>
          )}
          {submissions.map(s => (
            <div key={s.submissionId} className={styles.submissionCard}>
              <div className={styles.subStudentRow}>
                <div className={styles.subStudentAvatar}>{s.studentName?.[0]?.toUpperCase()}</div>
                <div>
                  <strong>{s.studentName}</strong>
                  <p className={styles.subTimestamp}>{fmtDate(s.submittedAt)} {fmtTime(s.submittedAt)}</p>
                </div>
                <span className={`${styles.subStatusBadge} ${s.status === 'graded' ? styles.subGraded : ''}`}
                  style={s.status==='graded' ? {color:th.accent,borderColor:th.accent+44} : {}}>
                  {s.status === 'graded' ? `✓ ${s.grade}/${post.points||'?'}` : '⏳ Pending'}
                </span>
              </div>
              {s.attachments?.map((f,i) => (
                <a key={i} className={styles.attachItem}
                  href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`}
                  target="_blank" rel="noreferrer">
                  {fileIcon(f.mime)} {f.name} <span>{fmtSize(f.size)}</span>
                </a>
              ))}
              {s.comment && <p className={styles.subComment}>💬 {s.comment}</p>}
              {s.feedback && <p className={styles.subFeedback}>📝 {s.feedback}</p>}
              {grading === s.submissionId ? (
                <div className={styles.gradeForm}>
                  <input className={styles.gradeInput} type="number" placeholder="Grade" value={grade}
                    onChange={e => setGrade(e.target.value)} />
                  <input className={styles.gradeInput} placeholder="Feedback (optional)" value={feedback}
                    onChange={e => setFeedback(e.target.value)} />
                  <button className={styles.postBtn} style={{background:th.accent,color:'#000'}} onClick={() => handleGrade(s.submissionId)}>Save grade</button>
                  <button className={styles.cancelBtn} onClick={() => setGrading(null)}>Cancel</button>
                </div>
              ) : (
                <button className={styles.gradeBtn} style={{color:th.accent,borderColor:th.accent+'55'}}
                  onClick={() => { setGrading(s.submissionId); setGrade(s.grade||''); setFeedback(s.feedback||''); }}>
                  ✏️ {s.status==='graded' ? 'Edit grade' : 'Grade'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIALS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function MaterialsTab({ classroomId, posts, isTeacher, userId, userName, th, fetchPosts }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState({ title:'', body:'' });
  const [files, setFiles]       = useState([]);
  const [posting, setPosting]   = useState(false);
  const [allPosts, setAllPosts] = useState(posts);
  const fileRef = useRef(null);

  useEffect(() => setAllPosts(posts), [posts]);
  const mats = allPosts.filter(p => p.type === 'material');

  const handleUpload = async () => {
    if (files.length === 0 && !form.body.trim()) return;
    setPosting(true);
    const fd = new FormData();
    fd.append('type','material'); fd.append('title', form.title || 'Material');
    fd.append('body', form.body); fd.append('authorId', userId); fd.append('authorName', userName);
    files.forEach(f => fd.append('files', f));
    try {
      const r = await fetch(`${API}/api/classrooms/${classroomId}/posts`, { method:'POST', body: fd });
      const d = await r.json();
      setAllPosts(p => [d, ...p]);
      setCreating(false); setForm({ title:'', body:'' }); setFiles([]);
    } catch {}
    finally { setPosting(false); }
  };

  return (
    <div className={styles.tabContent}>
      {isTeacher && (
        <button className={styles.createPostBtn} style={{ borderColor: th.accent+'55', color: th.accent }}
          onClick={() => setCreating(c => !c)}>
          {creating ? '✕ Cancel' : '+ Upload material'}
        </button>
      )}
      {creating && (
        <div className={styles.createForm}>
          <input className={styles.formInput} placeholder="Title" value={form.title}
            autoFocus onChange={e => setForm(f=>({...f,title:e.target.value}))} />
          <textarea className={styles.formTextarea} placeholder="Description (optional)" rows={3} value={form.body}
            onChange={e => setForm(f=>({...f,body:e.target.value}))} />
          <div className={styles.fileRow}>
            <button className={styles.attachBtn} onClick={() => fileRef.current?.click()}>📎 Choose files</button>
            <input ref={fileRef} type="file" multiple style={{display:'none'}}
              onChange={e => setFiles(ff => [...ff, ...Array.from(e.target.files)])} />
            {files.map((f,i) => (
              <div key={i} className={styles.fileChip}>
                {fileIcon(f.type)} {f.name} ({fmtSize(f.size)})
                <button onClick={() => setFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>
          <button className={styles.postBtn} style={{ background: th.accent, color:'#000', width:'100%', padding:'12px' }}
            onClick={handleUpload} disabled={posting}>
            {posting ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}
      {mats.length === 0 && !creating && (
        <div className={styles.emptyTab}><span>📚</span><p>No materials uploaded yet.</p></div>
      )}
      {mats.map(m => (
        <div key={m.postId} className={styles.materialCard} style={{ borderLeftColor: th.accent }}>
          <div className={styles.matHeader}>
            <span className={styles.matIcon}>📚</span>
            <div>
              <h3 className={styles.matTitle}>{m.title}</h3>
              <p className={styles.matMeta}>Posted by {m.authorName} · {fmtDate(m.createdAt)}</p>
              {m.body && <p className={styles.matBody}>{m.body}</p>}
            </div>
          </div>
          {m.attachments?.length > 0 && (
            <div className={styles.attachList}>
              {m.attachments.map((f,i) => (
                <a key={i} className={styles.attachItem}
                  href={`${API}/api/classrooms/${m.classroomId||classroomId}/files/${f.filename}`}
                  target="_blank" rel="noreferrer" download>
                  {fileIcon(f.mime)} <span className={styles.attachName}>{f.name}</span>
                  <span className={styles.attachSize}>{fmtSize(f.size)}</span>
                  <span className={styles.dlIcon}>⬇</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function MembersTab({ classroom, members, setMembers, isTeacher, userId, th }) {
  const teachers = members.filter(m => m.role === 'teacher');
  const students = members.filter(m => m.role === 'student');

  const handleRemove = async (memberId) => {
    if (!window.confirm('Remove this member?')) return;
    await fetch(`${API}/api/classrooms/${classroom.classroomId}/members/${memberId}`, {
      method: 'DELETE', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ userId }),
    });
    setMembers(m => m.filter(x => x.userId !== memberId));
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.memberSection}>
        <h3 className={styles.memberHeading} style={{ color: th.accent }}>Teachers</h3>
        {teachers.map(m => (
          <div key={m.userId} className={styles.memberRow}>
            <div className={styles.memberAvatar} style={{ background: th.accent + '33', color: th.accent }}>
              {m.userName?.[0]?.toUpperCase()}
            </div>
            <div className={styles.memberInfo}>
              <span className={styles.memberName}>{m.userName}</span>
              <span className={styles.memberRole}>👩‍🏫 Teacher</span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.memberSection}>
        <h3 className={styles.memberHeading} style={{ color: th.accent }}>
          Students <span className={styles.memberCount}>{students.length}</span>
        </h3>
        {students.length === 0 && <p className={styles.memberEmpty}>No students yet. Share the invite code!</p>}
        {students.map(m => (
          <div key={m.userId} className={styles.memberRow}>
            <div className={styles.memberAvatar}>{m.userName?.[0]?.toUpperCase()}</div>
            <div className={styles.memberInfo}>
              <span className={styles.memberName}>{m.userName}</span>
              <span className={styles.memberRole}>🎓 Student · joined {fmtDate(m.joinedAt)}</span>
            </div>
            {isTeacher && m.userId !== userId && (
              <button className={styles.removeBtn} onClick={() => handleRemove(m.userId)}>Remove</button>
            )}
          </div>
        ))}
      </div>
      <div className={styles.inviteBlock} style={{ borderColor: th.accent + '44' }}>
        <p>Share this code to invite students:</p>
        <div className={styles.bigCode} style={{ color: th.accent }}>{classroom.inviteCode}</div>
        <button className={styles.copyInviteBtn} style={{ background: th.accent, color:'#000' }}
          onClick={() => navigator.clipboard.writeText(classroom.inviteCode)}>
          📋 Copy invite code
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS TAB — meeting history
// ═══════════════════════════════════════════════════════════════════════════════
function SessionsTab({ sessions, th, navigate, classroomId }) {
  return (
    <div className={styles.tabContent}>
      <h3 className={styles.sessionsHeading}>Class session history</h3>
      {sessions.length === 0 && (
        <div className={styles.emptyTab}><span>📹</span><p>No sessions yet. Start a live class to see recordings here.</p></div>
      )}
      {sessions.map((s,i) => (
        <div key={s._id||i} className={styles.sessionCard} style={{ borderLeftColor: th.accent }}>
          <div className={styles.sessionTop}>
            <div className={styles.sessionDot} style={{ background: s.endedAt ? '#64748b' : th.accent }} />
            <div>
              <strong>Session #{sessions.length - i}</strong>
              <span className={styles.sessionDate}>{fmtDate(s.startedAt)} at {fmtTime(s.startedAt)}</span>
            </div>
            {!s.endedAt && <span className={styles.livePill} style={{ color: th.accent, borderColor: th.accent }}>🔴 LIVE</span>}
          </div>
          <div className={styles.sessionMeta}>
            <span>👤 Host: {s.hostName}</span>
            {s.attendees?.length > 0 && <span>👥 {s.attendees.length} attended</span>}
            {s.endedAt && <span>⏱ {fmtDur(s.startedAt, s.endedAt)}</span>}
          </div>
          {s.summary && <p className={styles.sessionSummary}>{s.summary}</p>}
          {s.chatLog?.length > 0 && (
            <details className={styles.chatLogBlock}>
              <summary>💬 Chat log ({s.chatLog.length} messages)</summary>
              <div className={styles.chatLog}>
                {s.chatLog.map((m,j) => (
                  <div key={j} className={styles.chatLogMsg}>
                    <span className={styles.chatLogName}>{m.userName}</span>
                    <span className={styles.chatLogText}>{m.message}</span>
                    <span className={styles.chatLogTime}>{fmtTime(m.timestamp)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {s.attendees?.length > 0 && (
            <details className={styles.attendeesBlock}>
              <summary>👥 Attendees</summary>
              <div className={styles.attendeeList}>
                {s.attendees.map((a,j) => (
                  <span key={j} className={styles.attendeeChip}>{a.userName}</span>
                ))}
              </div>
            </details>
          )}
          {!s.endedAt && (
            <button className={styles.rejoinBtn} style={{ color: th.accent, borderColor: th.accent + '55' }}
              onClick={() => navigate(`/room/${s.roomId}?classroom=${classroomId}`)}>
              Rejoin session →
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST CARD — reusable for stream posts
// ═══════════════════════════════════════════════════════════════════════════════
function PostCard({ post, classroomId, isTeacher, userId, userName, th, onPin, onDelete }) {
  const [comments, setComments]   = useState([]);
  const [showComments, setShow]   = useState(false);
  const [commentText, setComment] = useState('');
  const [loadingC, setLoadingC]   = useState(false);

  const loadComments = async () => {
    setLoadingC(true);
    const r = await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/comments`);
    const d = await r.json();
    setComments(Array.isArray(d) ? d : []);
    setLoadingC(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShow(v => !v);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const r = await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/comments`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ authorId: userId, authorName: userName, text: commentText }),
    });
    const d = await r.json();
    setComments(c => [...c, d]);
    setComment('');
  };

  return (
    <div className={styles.postCard} style={{ borderLeftColor: post.type==='question' ? '#f59e0b' : th.accent }}>
      <div className={styles.postHeader}>
        <div className={styles.postAvatar} style={{ background: th.accent + '22', color: th.accent }}>
          {post.authorName?.[0]?.toUpperCase()}
        </div>
        <div className={styles.postMeta}>
          <strong>{post.authorName}</strong>
          <span className={styles.postTime}>{fmtDate(post.createdAt)} {fmtTime(post.createdAt)}</span>
        </div>
        <div className={styles.postBadge} style={post.type==='question' ? {color:'#f59e0b'} : {color:th.accent}}>
          {post.type==='question' ? '❓ Question' : '📢 Announcement'}
        </div>
        {post.pinned && <span className={styles.pinnedBadge}>📌</span>}
        {isTeacher && (
          <div className={styles.postActions}>
            <button className={styles.postActionBtn} onClick={onPin} title={post.pinned ? 'Unpin' : 'Pin'}>
              {post.pinned ? '📌' : '📍'}
            </button>
            <button className={styles.postActionBtn} onClick={onDelete} title="Delete">🗑</button>
          </div>
        )}
      </div>
      {post.title && <h3 className={styles.postTitle}>{post.title}</h3>}
      {post.body  && <p  className={styles.postBody}>{post.body}</p>}
      {post.attachments?.length > 0 && (
        <div className={styles.attachList}>
          {post.attachments.map((f,i) => (
            <a key={i} className={styles.attachItem}
              href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`}
              target="_blank" rel="noreferrer">
              {fileIcon(f.mime)} {f.name} <span>{fmtSize(f.size)}</span>
            </a>
          ))}
        </div>
      )}
      <div className={styles.postFooter}>
        <button className={styles.commentToggle} onClick={toggleComments}>
          💬 {showComments ? 'Hide comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
        </button>
      </div>
      {showComments && (
        <div className={styles.commentSection}>
          {loadingC && <span className={styles.loadingTxt}>Loading…</span>}
          {comments.map((c,i) => (
            <div key={i} className={styles.commentRow}>
              <div className={styles.commentAvatar} style={{ background: th.accent+'22', color: th.accent }}>
                {c.authorName?.[0]?.toUpperCase()}
              </div>
              <div className={styles.commentContent}>
                <span className={styles.commentName}>{c.authorName}</span>
                <span className={styles.commentText}>{c.text}</span>
              </div>
              <span className={styles.commentTime}>{fmtTime(c.createdAt)}</span>
            </div>
          ))}
          <div className={styles.commentInput}>
            <input className={styles.commentBox} placeholder="Add a comment…" value={commentText}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key==='Enter' && addComment()} />
            <button className={styles.commentSend} style={{ background: th.accent, color:'#000' }}
              onClick={addComment} disabled={!commentText.trim()}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
