/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ClassroomPage.module.css';

const API = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

const THEMES = {
  cyan:   { accent:'#00d4ff', bg:'linear-gradient(135deg,#071828 0%,#0a2a3a 40%,#0d3d52 100%)', border:'rgba(0,212,255,0.25)', muted:'rgba(0,212,255,0.1)', glow:'rgba(0,212,255,0.12)' },
  violet: { accent:'#a78bfa', bg:'linear-gradient(135deg,#0f0821 0%,#1e1040 40%,#2d1b69 100%)', border:'rgba(167,139,250,0.25)', muted:'rgba(167,139,250,0.1)', glow:'rgba(167,139,250,0.12)' },
  green:  { accent:'#34d399', bg:'linear-gradient(135deg,#041410 0%,#0a2a1e 40%,#0d3d2b 100%)', border:'rgba(52,211,153,0.25)', muted:'rgba(52,211,153,0.1)', glow:'rgba(52,211,153,0.12)' },
  amber:  { accent:'#fcd34d', bg:'linear-gradient(135deg,#140f02 0%,#2a1f0a 40%,#3d2d0d 100%)', border:'rgba(252,211,77,0.25)',  muted:'rgba(252,211,77,0.1)',  glow:'rgba(252,211,77,0.12)' },
  rose:   { accent:'#fb7185', bg:'linear-gradient(135deg,#150508 0%,#2a0a14 40%,#3d0d1e 100%)', border:'rgba(251,113,133,0.25)', muted:'rgba(251,113,133,0.1)', glow:'rgba(251,113,133,0.12)' },
};

const fmtSize   = b => b>1e6?`${(b/1e6).toFixed(1)} MB`:b>1e3?`${(b/1e3).toFixed(0)} KB`:`${b} B`;
const fmtDate   = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
const fmtTime   = d => d ? new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
const fmtDur    = (s,e) => { if(!s||!e) return ''; const m=Math.round((new Date(e)-new Date(s))/60000); return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`; };
const isOverdue = d => d && new Date(d) < new Date();
const pct       = (a,b) => b ? Math.round((a/b)*100) : 0;
const gradeColor= g => g>=90?'#34d399':g>=80?'#60a5fa':g>=70?'#fcd34d':g>=60?'#fb923c':'#f87171';
const gradeLetter=(g)=>g>=90?'A':g>=80?'B':g>=70?'C':g>=60?'D':'F';
const avatarColor=name=>{const h=[...( name||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)%360;return`hsl(${h},55%,45%)`;};
const fileIcon  = mime => {
  if(!mime) return '📎';
  if(mime.startsWith('image/'))  return '🖼️';
  if(mime.startsWith('video/'))  return '🎬';
  if(mime.startsWith('audio/'))  return '🎵';
  if(mime.includes('pdf'))       return '📄';
  if(mime.includes('word')||mime.includes('document')) return '📝';
  if(mime.includes('sheet')||mime.includes('excel'))   return '📊';
  if(mime.includes('zip')||mime.includes('rar'))       return '🗜️';
  if(mime.includes('presentation')||mime.includes('powerpoint')) return '📊';
  return '📎';
};

function getUserId() {
  let id=localStorage.getItem('qm_userId');
  if(!id){id=crypto.randomUUID();localStorage.setItem('qm_userId',id);}
  return id;
}

// ─── Mini components ──────────────────────────────────────────────────────────
function Avatar({ name, size=32, fontSize=13 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarColor(name), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize, fontWeight:800, flexShrink:0, textTransform:'uppercase' }}>
      {(name||'?')[0]}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: `${color}18`, border: `1px solid ${color}35` }}>{icon}</div>
      <div>
        <div className={styles.statValue} style={{ color }}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  );
}

function GradeBar({ value, max=100 }) {
  const p = Math.min(Math.round((value/max)*100), 100);
  const color = gradeColor(p);
  return (
    <div className={styles.gradeBarWrap}>
      <div className={styles.gradeBarTrack}>
        <div className={styles.gradeBarFill} style={{ width:`${p}%`, background:color }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:32, textAlign:'right' }}>{p}%</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════
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
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const isTeacher = classroom?.creatorId === userId ||
    classroom?.members?.find(m=>m.userId===userId)?.role==='teacher';
  const th = THEMES[classroom?.theme||'cyan'];

  const fetchClassroom = useCallback(async () => {
    try{const r=await fetch(`${API}/api/classrooms/${classroomId}`);setClassroom(await r.json());}catch{}
  },[classroomId]);
  const fetchPosts = useCallback(async () => {
    try{const r=await fetch(`${API}/api/classrooms/${classroomId}/posts`);const d=await r.json();setPosts(Array.isArray(d)?d:[]);}catch{}
  },[classroomId]);
  const fetchSessions = useCallback(async () => {
    try{const r=await fetch(`${API}/api/classrooms/${classroomId}/sessions`);const d=await r.json();setSessions(Array.isArray(d)?d:[]);}catch{}
  },[classroomId]);

  useEffect(()=>{
    Promise.all([fetchClassroom(),fetchPosts(),fetchSessions()]).finally(()=>setLoading(false));
  },[]);

  const startSession = async () => {
    const roomId=`cls-${classroomId.slice(0,8)}-${Date.now().toString(36)}`;
    try {
      await fetch(`${API}/api/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId,hostName:userName,isPublic:false,title:`${classroom?.name} – Live`})});
      await fetch(`${API}/api/classrooms/${classroomId}/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({roomId,hostName:userName,classroomId})});
      localStorage.setItem(`qm_host_${roomId}`,'1');
      navigate(`/room/${roomId}?classroom=${classroomId}`);
    }catch(e){console.error(e);}
  };

  const copyCode = () => {
    navigator.clipboard.writeText(classroom?.inviteCode||'');
    setCodeCopied(true); setTimeout(()=>setCodeCopied(false),2000);
    showToast('Invite code copied!');
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/classrooms/${classroomId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...editForm,userId})});
      await fetchClassroom(); setEditMode(false); showToast('Classroom updated!');
    }catch{}finally{setSaving(false);}
  };

  if(loading) return (
    <div className={styles.loadPage}>
      <div className={styles.loadSpinner}/>
      <span>Loading classroom…</span>
    </div>
  );
  if(!classroom) return (
    <div className={styles.loadPage}>
      <span style={{fontSize:52}}>😕</span>
      <h2>Classroom not found</h2>
      <button className={styles.backBtn} onClick={()=>navigate('/classrooms')}>← Back</button>
    </div>
  );

  const TABS = [
    {id:'stream',      icon:'📢', label:'Stream'},
    {id:'assignments', icon:'📋', label:'Assignments'},
    {id:'grades',      icon:'📊', label:'Grades',    teacherOnly:true},
    {id:'analytics',   icon:'📈', label:'Analytics', teacherOnly:true},
    {id:'attendance',  icon:'✅', label:'Attendance', teacherOnly:true},
    {id:'materials',   icon:'📚', label:'Materials'},
    {id:'quizzes',     icon:'🧠', label:'Quizzes'},
    {id:'people',      icon:'👥', label:'People'},
    {id:'sessions',    icon:'📹', label:'Sessions'},
  ];

  const students = classroom.members?.filter(m=>m.role==='student')||[];
  const assignmentPosts = posts.filter(p=>p.type==='assignment');

  return (
    <div className={styles.page}>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.msg}</div>
      )}

      {/* ── Banner ── */}
      <div className={styles.banner} style={{background:th.bg}}>
        <div className={styles.bannerGlow} style={{background:`radial-gradient(ellipse at 20% 50%, ${th.glow}, transparent 65%)`}}/>
        <div className={styles.bannerContent}>
          <div className={styles.bannerTop}>
            <button className={styles.backBtn} onClick={()=>navigate('/classrooms')}>
              <span>←</span> Classrooms
            </button>
            <div className={styles.bannerRight}>
              {isTeacher&&!editMode&&(
                <button className={styles.editClassBtn} onClick={()=>{setEditMode(true);setEditForm({name:classroom.name,description:classroom.description,subject:classroom.subject,section:classroom.section,theme:classroom.theme});}}>
                  ✏️ Edit
                </button>
              )}
              {isTeacher&&<button className={styles.startSessionBtn} style={{background:th.accent,color:'#000'}} onClick={startSession}>🎥 Start Live Session</button>}
            </div>
          </div>

          {editMode?(
            <div className={styles.editBanner}>
              <div className={styles.editRow}>
                <input className={styles.editInput} placeholder="Class name" value={editForm.name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/>
                <input className={styles.editInput} placeholder="Subject" value={editForm.subject||''} onChange={e=>setEditForm(f=>({...f,subject:e.target.value}))}/>
                <input className={styles.editInput} placeholder="Section" value={editForm.section||''} onChange={e=>setEditForm(f=>({...f,section:e.target.value}))}/>
              </div>
              <textarea className={styles.editTextarea} placeholder="Description" rows={2} value={editForm.description||''} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))}/>
              <div className={styles.themeRow}>
                {Object.keys(THEMES).map(t=>(
                  <button key={t} className={`${styles.themeChip} ${editForm.theme===t?styles.themeChipActive:''}`}
                    style={{borderColor:THEMES[t].accent,color:THEMES[t].accent,background:editForm.theme===t?`${THEMES[t].accent}18`:''}}
                    onClick={()=>setEditForm(f=>({...f,theme:t}))}>
                    {t}
                  </button>
                ))}
              </div>
              <div className={styles.editBtns}>
                <button className={styles.cancelBtn} onClick={()=>setEditMode(false)}>Cancel</button>
                <button className={styles.saveEditBtn} style={{background:th.accent,color:'#000'}} onClick={handleSaveEdit} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
              </div>
            </div>
          ):(
            <div className={styles.bannerInfo}>
              <h1 className={styles.bannerTitle}>{classroom.name}</h1>
              {(classroom.subject||classroom.section)&&<p className={styles.bannerMeta}>{[classroom.subject,classroom.section].filter(Boolean).join(' · ')}</p>}
              {classroom.description&&<p className={styles.bannerDesc}>{classroom.description}</p>}
              <div className={styles.bannerStats}>
                <div className={styles.bannerStat}><span>👥</span><strong>{students.length}</strong><span>Students</span></div>
                <div className={styles.bannerStat}><span>📋</span><strong>{assignmentPosts.length}</strong><span>Assignments</span></div>
                <div className={styles.bannerStat}><span>📹</span><strong>{sessions.length}</strong><span>Sessions</span></div>
                {isTeacher&&<div className={styles.bannerStat} style={{color:th.accent}}><span>👑</span><strong>Teacher</strong></div>}
              </div>
            </div>
          )}

          <div className={styles.inviteBar} style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${th.border}`}}>
            <span className={styles.inviteLabel}>Invite Code</span>
            <code className={styles.inviteCode} style={{color:th.accent}}>{classroom.inviteCode}</code>
            <button className={styles.copyCodeBtn} onClick={copyCode} style={{background:th.muted,borderColor:th.border,color:th.accent}}>
              {codeCopied?'✓ Copied':'📋 Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabBar}>
        {TABS.filter(t=>!t.teacherOnly||isTeacher).map(t=>(
          <button key={t.id} className={`${styles.tab} ${tab===t.id?styles.tabActive:''}`}
            style={tab===t.id?{color:th.accent,borderBottomColor:th.accent}:{}}
            onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab==='stream'      && <StreamTab      classroomId={classroomId} posts={posts} setPosts={setPosts} fetchPosts={fetchPosts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} showToast={showToast}/>}
        {tab==='assignments' && <AssignmentsTab classroomId={classroomId} posts={posts} setPosts={setPosts} fetchPosts={fetchPosts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} classroom={classroom} showToast={showToast}/>}
        {tab==='grades'      && isTeacher && <GradeBookTab classroomId={classroomId} classroom={classroom} th={th} showToast={showToast}/>}
        {tab==='analytics'   && isTeacher && <AnalyticsTab classroomId={classroomId} classroom={classroom} th={th}/>}
        {tab==='attendance'  && isTeacher && <AttendanceTab classroomId={classroomId} classroom={classroom} sessions={sessions} th={th} showToast={showToast}/>}
        {tab==='materials'   && <MaterialsTab   classroomId={classroomId} posts={posts} setPosts={setPosts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} fetchPosts={fetchPosts} showToast={showToast}/>}
        {tab==='quizzes'     && <QuizzesTab     classroomId={classroomId} posts={posts} setPosts={setPosts} isTeacher={isTeacher} userId={userId} userName={userName} th={th} showToast={showToast}/>}
        {tab==='people'      && <PeopleTab      classroom={classroom} setClassroom={setClassroom} isTeacher={isTeacher} userId={userId} th={th} fetchClassroom={fetchClassroom} classroomId={classroomId} showToast={showToast}/>}
        {tab==='sessions'    && <SessionsTab    sessions={sessions} th={th} navigate={navigate} classroomId={classroomId}/>}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STREAM TAB
// ═════════════════════════════════════════════════════════════════════════
function StreamTab({classroomId,posts,setPosts,fetchPosts,isTeacher,userId,userName,th,showToast}) {
  const [compose,setCompose]   = useState(false);
  const [form,setForm]         = useState({type:'announcement',body:''});
  const [files,setFiles]       = useState([]);
  const [posting,setPosting]   = useState(false);
  const [pollOpts,setPollOpts] = useState(['','']);
  const [scheduled,setScheduled] = useState([]);
  const [schedForm,setSchedForm] = useState(false);
  const [schedBody,setSchedBody] = useState('');
  const [schedDate,setSchedDate] = useState('');
  const fileRef = useRef(null);

  const streamPosts = posts.filter(p=>['announcement','question','poll'].includes(p.type));
  const pinned  = streamPosts.filter(p=>p.pinned);
  const regular = streamPosts.filter(p=>!p.pinned);

  useEffect(()=>{
    if(!isTeacher) return;
    fetch(`${API}/api/classrooms/${classroomId}/scheduled`)
      .then(r=>r.json()).then(d=>setScheduled(Array.isArray(d)?d:[])).catch(()=>{});
  },[isTeacher, classroomId]);

  const handlePost = async () => {
    if(!form.body.trim()) return;
    setPosting(true);
    const fd=new FormData();
    fd.append('type',form.type); fd.append('body',form.body);
    fd.append('authorId',userId); fd.append('authorName',userName);
    if(form.type==='poll') fd.append('pollOptions',JSON.stringify(pollOpts.filter(o=>o.trim())));
    files.forEach(f=>fd.append('files',f));
    try {
      const r=await fetch(`${API}/api/classrooms/${classroomId}/posts`,{method:'POST',body:fd});
      const d=await r.json(); setPosts(p=>[d,...p]);
      setCompose(false); setForm({type:'announcement',body:''}); setFiles([]); setPollOpts(['','']);
      showToast('Posted!');
    }catch{}finally{setPosting(false);}
  };

  const schedulePost = async () => {
    if(!schedBody.trim()||!schedDate) return;
    await fetch(`${API}/api/classrooms/${classroomId}/scheduled`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({body:schedBody,type:'announcement',scheduledFor:schedDate,authorId:userId,authorName:userName})});
    setSchedForm(false); setSchedBody(''); setSchedDate('');
    fetch(`${API}/api/classrooms/${classroomId}/scheduled`).then(r=>r.json()).then(d=>setScheduled(Array.isArray(d)?d:[]));
    showToast('Post scheduled!');
  };

  const deleteScheduled = async (id) => {
    await fetch(`${API}/api/classrooms/${classroomId}/scheduled/${id}`,{method:'DELETE'});
    setScheduled(s=>s.filter(x=>x._id!==id));
  };

  const doPin    = async id => { await fetch(`${API}/api/classrooms/${classroomId}/posts/${id}/pin`,{method:'PATCH'}); fetchPosts(); };
  const doDelete = async id => { if(!window.confirm('Delete this post?')) return; await fetch(`${API}/api/classrooms/${classroomId}/posts/${id}`,{method:'DELETE'}); setPosts(p=>p.filter(x=>x.postId!==id)); showToast('Post deleted'); };

  return (
    <div className={styles.tabContent}>

      {/* Compose */}
      {isTeacher&&(
        <div className={styles.composeBox} style={{borderColor:th.border}}>
          {!compose?(
            <div className={styles.composePlaceholder} onClick={()=>setCompose(true)}>
              <Avatar name={userName} size={36}/>
              <span>Share something with your class…</span>
            </div>
          ):(
            <div className={styles.composeExpanded}>
              <div className={styles.typeRow}>
                {[['announcement','📢','Announcement'],['question','❓','Question'],['poll','📊','Poll']].map(([v,icon,label])=>(
                  <button key={v} className={`${styles.typeBtn} ${form.type===v?styles.typeBtnActive:''}`}
                    style={form.type===v?{background:th.muted,borderColor:th.accent,color:th.accent}:{}}
                    onClick={()=>setForm(f=>({...f,type:v}))}>
                    {icon} {label}
                  </button>
                ))}
              </div>
              <textarea className={styles.composeTextarea} rows={3} autoFocus value={form.body}
                placeholder={form.type==='poll'?'Poll question…':form.type==='question'?'Ask your class a question…':'Write an announcement…'}
                onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
              {form.type==='poll'&&(
                <div className={styles.pollOptionsEdit}>
                  <p className={styles.pollLabel}>Options</p>
                  {pollOpts.map((o,i)=>(
                    <div key={i} className={styles.pollOptRow}>
                      <input className={styles.pollOptInput} placeholder={`Option ${i+1}`} value={o} onChange={e=>{const n=[...pollOpts];n[i]=e.target.value;setPollOpts(n);}}/>
                      {pollOpts.length>2&&<button className={styles.pollOptRemove} onClick={()=>setPollOpts(p=>p.filter((_,j)=>j!==i))}>✕</button>}
                    </div>
                  ))}
                  {pollOpts.length<6&&<button className={styles.addOptBtn} onClick={()=>setPollOpts(p=>[...p,''])}>+ Add option</button>}
                </div>
              )}
              {files.length>0&&<div className={styles.fileChips}>{files.map((f,i)=><div key={i} className={styles.fileChip}>{fileIcon(f.type)} {f.name}<button onClick={()=>setFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button></div>)}</div>}
              <div className={styles.composeFooter}>
                {form.type!=='poll'&&<button className={styles.attachBtn} onClick={()=>fileRef.current?.click()}>📎 Attach</button>}
                <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>setFiles(ff=>[...ff,...Array.from(e.target.files)])}/>
                <div style={{flex:1}}/>
                <button className={styles.cancelBtn} onClick={()=>{setCompose(false);setFiles([]);}}>Cancel</button>
                <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}}
                  onClick={()=>{if(form.type==='poll')setForm(f=>({...f,pollOptions:pollOpts}));handlePost();}}
                  disabled={posting||!form.body.trim()}>{posting?'Posting…':'Post'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduled posts (teacher only) */}
      {isTeacher&&(
        <div className={styles.scheduledSection}>
          <div className={styles.scheduledHeader}>
            <span>🕐 Scheduled Announcements ({scheduled.length})</span>
            <button className={styles.smallBtn} style={{color:th.accent,borderColor:th.border}} onClick={()=>setSchedForm(s=>!s)}>+ Schedule</button>
          </div>
          {schedForm&&(
            <div className={styles.scheduleForm} style={{borderColor:th.border}}>
              <textarea className={styles.formTextarea} rows={2} placeholder="Announcement text…" value={schedBody} onChange={e=>setSchedBody(e.target.value)}/>
              <div className={styles.scheduleRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Publish at</label>
                  <input type="datetime-local" className={styles.formInput} value={schedDate} onChange={e=>setSchedDate(e.target.value)}/>
                </div>
                <button className={styles.submitBtn} style={{background:th.accent,color:'#000',alignSelf:'flex-end'}} onClick={schedulePost}>Schedule</button>
                <button className={styles.cancelBtn} style={{alignSelf:'flex-end'}} onClick={()=>setSchedForm(false)}>Cancel</button>
              </div>
            </div>
          )}
          {scheduled.length>0&&(
            <div className={styles.scheduledList}>
              {scheduled.map(sp=>(
                <div key={sp._id} className={styles.scheduledItem} style={{borderColor:th.border}}>
                  <span className={styles.scheduledTime} style={{color:th.accent}}>📅 {fmtDate(sp.scheduledFor)} at {fmtTime(sp.scheduledFor)}</span>
                  <p className={styles.scheduledBody}>{sp.body}</p>
                  <button className={styles.deleteIconBtn} onClick={()=>deleteScheduled(sp._id)}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pinned.length>0&&(
        <div className={styles.pinnedSection}>
          <div className={styles.sectionLabel}>📌 Pinned</div>
          {pinned.map(p=><PostCard key={p.postId} post={p} classroomId={classroomId} isTeacher={isTeacher} userId={userId} userName={userName} th={th} onPin={()=>doPin(p.postId)} onDelete={()=>doDelete(p.postId)}/>)}
        </div>
      )}
      {regular.length===0&&pinned.length===0&&!compose&&(
        <div className={styles.emptyState}><span>📢</span><strong>No posts yet</strong><p>{isTeacher?'Share an announcement to get started.':'Nothing posted yet — check back soon!'}</p></div>
      )}
      {regular.map(p=><PostCard key={p.postId} post={p} classroomId={classroomId} isTeacher={isTeacher} userId={userId} userName={userName} th={th} onPin={()=>doPin(p.postId)} onDelete={()=>doDelete(p.postId)}/>)}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS TAB
// ═════════════════════════════════════════════════════════════════════════
function AssignmentsTab({classroomId,posts,setPosts,fetchPosts,isTeacher,userId,userName,th,classroom,showToast}) {
  const [creating,setCreating] = useState(false);
  const [form,setForm]         = useState({title:'',body:'',dueDate:'',points:'',topic:''});
  const [files,setFiles]       = useState([]);
  const [posting,setPosting]   = useState(false);
  const [selected,setSelected] = useState(null);
  const [filter,setFilter]     = useState('all');
  const fileRef = useRef(null);

  const assignments = posts.filter(p=>p.type==='assignment');
  const now = new Date();
  const filtered = assignments.filter(a=>{
    if(filter==='overdue')  return a.dueDate && new Date(a.dueDate)<now;
    if(filter==='upcoming') return !a.dueDate || new Date(a.dueDate)>=now;
    if(filter==='graded')   return false; // teacher view only
    return true;
  });

  const handleCreate = async () => {
    if(!form.title.trim()) return;
    setPosting(true);
    const fd=new FormData();
    Object.entries(form).forEach(([k,v])=>v&&fd.append(k,v));
    fd.append('type','assignment'); fd.append('authorId',userId); fd.append('authorName',userName);
    files.forEach(f=>fd.append('files',f));
    try {
      const r=await fetch(`${API}/api/classrooms/${classroomId}/posts`,{method:'POST',body:fd});
      const d=await r.json(); setPosts(p=>[d,...p]);
      setCreating(false); setForm({title:'',body:'',dueDate:'',points:'',topic:''}); setFiles([]);
      showToast('Assignment created!');
    }catch{}finally{setPosting(false);}
  };

  const handleDelete = async (postId) => {
    if(!window.confirm('Delete this assignment?')) return;
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${postId}`,{method:'DELETE'});
    setPosts(p=>p.filter(x=>x.postId!==postId)); showToast('Assignment deleted');
  };

  if(selected) {
    const post = assignments.find(p=>p.postId===selected);
    if(!post){setSelected(null);return null;}
    return <AssignmentReviewPanel classroomId={classroomId} post={post} isTeacher={isTeacher} userId={userId} userName={userName} th={th} onBack={()=>setSelected(null)} classroom={classroom} showToast={showToast}/>;
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.assignHeader}>
        <div className={styles.filterRow}>
          {[['all','All'],['upcoming','Upcoming'],['overdue','Overdue']].map(([f,l])=>(
            <button key={f} className={`${styles.filterBtn} ${filter===f?styles.filterBtnActive:''}`}
              style={filter===f?{background:th.muted,borderColor:th.accent,color:th.accent}:{}}
              onClick={()=>setFilter(f)}>{l}</button>
          ))}
        </div>
        {isTeacher&&(
          <button className={styles.createBtn} style={{background:th.accent,color:'#000'}}
            onClick={()=>setCreating(c=>!c)}>
            {creating?'✕ Cancel':'+ New Assignment'}
          </button>
        )}
      </div>

      {creating&&(
        <div className={styles.createForm} style={{borderColor:th.border}}>
          <h3 className={styles.formTitle}>New Assignment</h3>
          <input className={styles.formInput} placeholder="Title *" value={form.title} autoFocus onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <textarea className={styles.formTextarea} placeholder="Instructions (optional)" rows={4} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Due date</label>
              <input className={styles.formInput} type="datetime-local" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Points</label>
              <input className={styles.formInput} type="number" placeholder="100" value={form.points} onChange={e=>setForm(f=>({...f,points:e.target.value}))}/>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Topic / Unit</label>
              <input className={styles.formInput} placeholder="e.g. Chapter 3" value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))}/>
            </div>
          </div>
          <div className={styles.filePickerRow}>
            <button className={styles.attachBtn} onClick={()=>fileRef.current?.click()}>📎 Attach files</button>
            <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>setFiles(ff=>[...ff,...Array.from(e.target.files)])}/>
            {files.map((f,i)=><div key={i} className={styles.fileChip}>{fileIcon(f.type)} {f.name}<button onClick={()=>setFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button></div>)}
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={()=>{setCreating(false);setFiles([]);}}>Cancel</button>
            <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={handleCreate} disabled={posting||!form.title.trim()}>{posting?'Creating…':'Create Assignment'}</button>
          </div>
        </div>
      )}

      {filtered.length===0&&!creating&&(
        <div className={styles.emptyState}><span>📋</span><strong>No assignments</strong><p>{isTeacher?'Create one above.':'Your teacher hasn\'t posted any yet.'}</p></div>
      )}

      {filtered.map(a=>{
        const overdue=isOverdue(a.dueDate);
        return (
          <div key={a.postId} className={styles.assignCard} style={{borderLeftColor:overdue?'#ef4444':th.accent}} onClick={()=>setSelected(a.postId)}>
            <div className={styles.assignCardTop}>
              <div className={styles.assignCardIcon} style={{background:overdue?'rgba(239,68,68,0.12)':th.muted,color:overdue?'#f87171':th.accent}}>📋</div>
              <div className={styles.assignCardInfo}>
                <h3 className={styles.assignCardTitle}>{a.title}</h3>
                <div className={styles.assignCardMeta}>
                  {a.topic&&<span className={styles.topicChip}>{a.topic}</span>}
                  {a.dueDate&&<span className={`${styles.dueChip} ${overdue?styles.dueChipOverdue:''}`}>{overdue?'⚠️ Overdue ':'📅 '}{fmtDate(a.dueDate)}</span>}
                  {a.points&&<span className={styles.ptChip}>{a.points} pts</span>}
                </div>
                {a.body&&<p className={styles.assignCardBody}>{a.body.slice(0,120)}{a.body.length>120?'…':''}</p>}
              </div>
              {isTeacher&&<button className={styles.deleteIconBtn} onClick={e=>{e.stopPropagation();handleDelete(a.postId);}}>🗑</button>}
            </div>
            {a.attachments?.length>0&&(
              <div className={styles.attachRow} onClick={e=>e.stopPropagation()}>
                {a.attachments.map((f,i)=><a key={i} className={styles.attachPill} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">{fileIcon(f.mime)} {f.name}</a>)}
              </div>
            )}
            <div className={styles.assignCardFooter} style={{color:th.accent}}>
              {isTeacher?'View submissions & grade →':'Open assignment →'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ASSIGNMENT REVIEW PANEL — Teacher grades / Student submits
// ═════════════════════════════════════════════════════════════════════════
function AssignmentReviewPanel({classroomId,post,isTeacher,userId,userName,th,onBack,classroom,showToast}) {
  const [submissions,setSubmissions]= useState([]);
  const [loading,setLoading]        = useState(true);
  const [selectedSub,setSelectedSub]= useState(null);
  const [filter,setFilter]          = useState('all');
  const [searchQuery,setSearchQuery]= useState('');
  const [myFiles,setMyFiles]        = useState([]);
  const [myComment,setMyComment]    = useState('');
  const [submitting,setSubmitting]  = useState(false);
  const fileRef = useRef(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const r=await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions?userId=${userId}&role=${isTeacher?'teacher':'student'}`);
      const d=await r.json(); setSubmissions(Array.isArray(d)?d:[]);
    }catch{}finally{setLoading(false);}
  },[classroomId,post.postId,userId,isTeacher]);

  useEffect(()=>{fetchSubs();},[]);

  const mySub = submissions.find(s=>s.studentId===userId);

  const handleSubmit = async () => {
    setSubmitting(true);
    const fd=new FormData();
    fd.append('studentId',userId); fd.append('studentName',userName); fd.append('comment',myComment);
    myFiles.forEach(f=>fd.append('files',f));
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions`,{method:'POST',body:fd});
    setMyComment(''); setMyFiles([]); fetchSubs(); setSubmitting(false);
    showToast('Assignment submitted!');
  };

  const handleGrade = async (subId,grade,feedback,privateNote,status) => {
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions/${subId}/grade`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({grade:Number(grade),feedback,privateNote,status:status||'graded'}),
    });
    fetchSubs(); showToast('Grade saved!');
  };

  const handleReturn = async (subId) => {
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions/${subId}/return`,{method:'PATCH'});
    fetchSubs(); showToast('Assignment returned to student!');
  };

  const handleAnnotate = async (subId, annotation) => {
    await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/submissions/${subId}/annotate`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({annotation}),
    });
    fetchSubs();
  };

  const students = classroom?.members?.filter(m=>m.role==='student')||[];
  const missingStudents = isTeacher ? students.filter(s=>!submissions.find(sub=>sub.studentId===s.userId)) : [];

  const filtered = isTeacher ? submissions
    .filter(s=>filter==='all'?true:filter==='graded'?(s.status==='graded'||s.status==='returned'):filter==='pending'?(s.status==='submitted'||s.status==='late'):s.status===filter)
    .filter(s=>!searchQuery||s.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
  : submissions;

  const graded = submissions.filter(s=>s.grade!=null);
  const stats = isTeacher ? {
    total: submissions.length, missing: missingStudents.length,
    pending: submissions.filter(s=>s.status==='submitted'||s.status==='late').length,
    graded: graded.length, late: submissions.filter(s=>s.status==='late').length,
    avg: graded.length ? (graded.reduce((a,s)=>a+s.grade,0)/graded.length).toFixed(1) : null,
    highest: graded.length ? Math.max(...graded.map(s=>s.grade)) : null,
  } : null;

  if(selectedSub) return (
    <SubmissionDetail sub={selectedSub} post={post} classroomId={classroomId} th={th}
      onGrade={handleGrade} onReturn={handleReturn} onAnnotate={handleAnnotate}
      onBack={()=>setSelectedSub(null)} showToast={showToast}/>
  );

  return (
    <div className={styles.reviewPanel}>
      <button className={styles.backLink} onClick={onBack}>← Back to assignments</button>

      <div className={styles.reviewHeader}>
        <div>
          <h2 className={styles.reviewTitle2}>{post.title}</h2>
          <div className={styles.reviewMeta}>
            {post.dueDate&&<span className={`${styles.dueChip} ${isOverdue(post.dueDate)?styles.dueChipOverdue:''}`}>📅 Due {fmtDate(post.dueDate)}</span>}
            {post.points&&<span className={styles.ptChip}>{post.points} pts</span>}
            {post.topic&&<span className={styles.topicChip}>{post.topic}</span>}
          </div>
        </div>
      </div>

      {post.body&&<p className={styles.reviewBody}>{post.body}</p>}

      {post.attachments?.length>0&&(
        <div className={styles.attachRow} style={{marginBottom:16}}>
          {post.attachments.map((f,i)=>(
            <a key={i} className={styles.attachPill} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">{fileIcon(f.mime)} {f.name}</a>
          ))}
        </div>
      )}

      {/* Stats row (teacher) */}
      {isTeacher&&stats&&(
        <div className={styles.subStatsRow}>
          <StatCard icon="📥" label="Submitted" value={stats.total} color="#60a5fa"/>
          <StatCard icon="⏳" label="Pending" value={stats.pending} color="#fcd34d"/>
          <StatCard icon="✅" label="Graded" value={stats.graded} color="#34d399"/>
          <StatCard icon="❌" label="Missing" value={stats.missing} color="#f87171"/>
          {stats.avg&&<StatCard icon="📊" label="Class Avg" value={`${stats.avg}/${post.points||'?'}`} color={th.accent}/>}
          {stats.highest!=null&&<StatCard icon="🏆" label="Highest" value={stats.highest} color="#fcd34d"/>}
        </div>
      )}

      {/* Teacher view */}
      {isTeacher&&(
        <>
          <div className={styles.subFilterRow}>
            <div className={styles.filterRow}>
              {[['all','All'],['pending','Pending'],['graded','Graded'],['late','Late']].map(([f,l])=>(
                <button key={f} className={`${styles.filterBtn} ${filter===f?styles.filterBtnActive:''}`}
                  style={filter===f?{background:th.muted,borderColor:th.accent,color:th.accent}:{}}
                  onClick={()=>setFilter(f)}>{l}</button>
              ))}
            </div>
            <input className={styles.searchInput} placeholder="Search student…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
          </div>

          {loading&&<div className={styles.loadingRow}><div className={styles.spinnerSm}/>Loading submissions…</div>}

          {!loading&&filtered.length===0&&(
            <div className={styles.emptyState}><span>📭</span><strong>No submissions yet</strong></div>
          )}

          {!loading&&filtered.map(sub=>(
            <div key={sub.submissionId} className={styles.subCard} onClick={()=>setSelectedSub(sub)} style={{borderColor:sub.status==='returned'?'rgba(52,211,153,0.3)':sub.status==='graded'?th.border:sub.status==='late'?'rgba(239,68,68,0.3)':th.border}}>
              <div className={styles.subCardLeft}>
                <Avatar name={sub.studentName} size={40}/>
                <div>
                  <strong className={styles.subCardName}>{sub.studentName}</strong>
                  <div className={styles.subCardDate}>{fmtDate(sub.submittedAt)} at {fmtTime(sub.submittedAt)}</div>
                  {sub.comment&&<p className={styles.subCardComment}>"{sub.comment}"</p>}
                </div>
              </div>
              <div className={styles.subCardRight}>
                {sub.grade!=null&&(
                  <div className={styles.subGrade} style={{color:gradeColor(pct(sub.grade,post.points||100))}}>
                    <span className={styles.subGradeNum}>{sub.grade}</span>
                    <span className={styles.subGradeOf}>/{post.points||'?'}</span>
                    <span className={styles.subGradeLetter}>{gradeLetter(pct(sub.grade,post.points||100))}</span>
                  </div>
                )}
                <span className={`${styles.subStatusPill} ${styles[`sub_${sub.status}`]}`}>{sub.status}</span>
                {sub.attachments?.length>0&&<span className={styles.subAttachCount}>📎 {sub.attachments.length}</span>}
                <span style={{color:th.accent,fontSize:12}}>Grade →</span>
              </div>
            </div>
          ))}

          {missingStudents.length>0&&(
            <div className={styles.missingSection}>
              <div className={styles.sectionLabel}>❌ Missing Submissions ({missingStudents.length})</div>
              {missingStudents.map(s=>(
                <div key={s.userId} className={styles.missingRow}>
                  <Avatar name={s.userName} size={32}/>
                  <span>{s.userName}</span>
                  <span className={styles.missingTag}>No submission</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Student view */}
      {!isTeacher&&(
        <div className={styles.studentSubmitArea}>
          {mySub?(
            <div className={styles.mySubmission} style={{borderColor:th.border}}>
              <h4>Your Submission</h4>
              <p className={styles.subCardDate}>Submitted {fmtDate(mySub.submittedAt)} at {fmtTime(mySub.submittedAt)}</p>
              {mySub.comment&&<p className={styles.subCardComment}>"{mySub.comment}"</p>}
              {mySub.attachments?.length>0&&(
                <div className={styles.attachRow}>
                  {mySub.attachments.map((f,i)=>(
                    <a key={i} className={styles.attachPill} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">{fileIcon(f.mime)} {f.name}</a>
                  ))}
                </div>
              )}
              {mySub.grade!=null&&(
                <div className={styles.myGradeBox} style={{borderColor:th.border}}>
                  <div className={styles.myGradeNum} style={{color:gradeColor(pct(mySub.grade,post.points||100))}}>
                    {mySub.grade}/{post.points||'?'}
                    <span style={{fontSize:24,marginLeft:8}}>{gradeLetter(pct(mySub.grade,post.points||100))}</span>
                  </div>
                  <GradeBar value={mySub.grade} max={post.points||100}/>
                  {mySub.feedback&&<div className={styles.feedbackBox}><strong>Teacher feedback:</strong><p>{mySub.feedback}</p></div>}
                  {mySub.annotation&&<div className={styles.annotationBox}><strong>📝 Annotation:</strong><p>{mySub.annotation}</p></div>}
                </div>
              )}
            </div>
          ):(
            <div className={styles.submitForm} style={{borderColor:th.border}}>
              <h4>Submit Your Work</h4>
              <textarea className={styles.formTextarea} rows={3} placeholder="Add a note to your teacher…" value={myComment} onChange={e=>setMyComment(e.target.value)}/>
              <div className={styles.filePickerRow}>
                <button className={styles.attachBtn} onClick={()=>fileRef.current?.click()}>📎 Attach files</button>
                <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>setMyFiles(ff=>[...ff,...Array.from(e.target.files)])}/>
                {myFiles.map((f,i)=><div key={i} className={styles.fileChip}>{fileIcon(f.type)} {f.name}<button onClick={()=>setMyFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button></div>)}
              </div>
              <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={handleSubmit} disabled={submitting||(!myComment.trim()&&myFiles.length===0)}>
                {submitting?'Submitting…':'Turn In'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SUBMISSION DETAIL — Full grading panel
// ═════════════════════════════════════════════════════════════════════════
function SubmissionDetail({sub,post,classroomId,th,onGrade,onReturn,onAnnotate,onBack,showToast}) {
  const [grade,setGrade]       = useState(sub.grade??'');
  const [feedback,setFeedback] = useState(sub.feedback||'');
  const [note,setNote]         = useState(sub.privateNote||'');
  const [annotation,setAnnotation] = useState(sub.annotation||'');
  const [saving,setSaving]     = useState(false);
  const [tab,setTab]           = useState('grade'); // 'grade' | 'files' | 'annotation'
  const percentage = grade!==''&&post.points ? pct(Number(grade),post.points) : null;

  const save = async (returnAfter=false) => {
    setSaving(true);
    await onGrade(sub.submissionId,grade,feedback,note,returnAfter?'returned':'graded');
    if(annotation!==sub.annotation) await onAnnotate(sub.submissionId, annotation);
    setSaving(false); onBack();
  };

  return (
    <div className={styles.subDetail}>
      <button className={styles.backLink} onClick={onBack}>← Back to submissions</button>

      <div className={styles.subDetailHeader}>
        <Avatar name={sub.studentName} size={52}/>
        <div>
          <h3 className={styles.subDetailName}>{sub.studentName}</h3>
          <div className={styles.subDetailMeta}>
            <span>Submitted {fmtDate(sub.submittedAt)} at {fmtTime(sub.submittedAt)}</span>
            {sub.status==='late'&&<span className={styles.latePill}>⚠️ Late</span>}
            {sub.status==='returned'&&<span className={styles.returnedPill}>✓ Returned</span>}
          </div>
        </div>
        {sub.grade!=null&&(
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:32,fontWeight:800,color:gradeColor(pct(sub.grade,post.points||100))}}>{sub.grade}/{post.points||'?'}</div>
            <div style={{fontSize:18,color:gradeColor(pct(sub.grade,post.points||100))}}>{gradeLetter(pct(sub.grade,post.points||100))}</div>
          </div>
        )}
      </div>

      {/* Inner tabs */}
      <div className={styles.subDetailTabs}>
        {[['grade','✏️ Grade'],['files','📎 Files'],['annotation','📝 Annotate']].map(([t,l])=>(
          <button key={t} className={`${styles.subDetailTab} ${tab===t?styles.subDetailTabActive:''}`}
            style={tab===t?{color:th.accent,borderBottomColor:th.accent}:{}} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {tab==='files'&&(
        <div>
          {sub.comment&&<div className={styles.subDetailComment}><strong>Student note:</strong> {sub.comment}</div>}
          {sub.attachments?.length>0?(
            <div className={styles.subDetailFiles}>
              {sub.attachments.map((f,i)=>(
                <a key={i} className={styles.subDetailFileCard} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">
                  <span className={styles.subDetailFileIcon}>{fileIcon(f.mime)}</span>
                  <div className={styles.subDetailFileInfo}>
                    <span className={styles.subDetailFileName}>{f.name}</span>
                    <span className={styles.subDetailFileSize}>{fmtSize(f.size)}</span>
                  </div>
                  <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-3)'}}>⬇ Download</span>
                </a>
              ))}
            </div>
          ):<div className={styles.emptyState}><span>📭</span><strong>No files submitted</strong></div>}
        </div>
      )}

      {tab==='annotation'&&(
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>📝 Inline annotation (visible to student after return)</label>
          <textarea className={styles.formTextarea} rows={6} placeholder="Write specific inline feedback about this submission…" value={annotation} onChange={e=>setAnnotation(e.target.value)}/>
          <button className={styles.submitBtn} style={{background:'#34d399',color:'#000',marginTop:8}} onClick={async()=>{await onAnnotate(sub.submissionId,annotation);showToast('Annotation saved!');}}>Save Annotation</button>
        </div>
      )}

      {tab==='grade'&&(
        <div className={styles.gradeFormFull} style={{borderColor:th.border}}>
          <div className={styles.gradeInputRow}>
            <div className={styles.formGroup} style={{maxWidth:200}}>
              <label className={styles.formLabel}>Score / {post.points||'?'} pts</label>
              <input className={styles.formInput} type="number" min={0} max={post.points||9999} placeholder="0"
                style={{fontSize:32,fontWeight:800,color:percentage!=null?gradeColor(percentage):undefined,textAlign:'center',padding:'12px'}}
                value={grade} onChange={e=>setGrade(e.target.value)}/>
            </div>
            {percentage!=null&&(
              <div className={styles.gradeBigDisplay} style={{color:gradeColor(percentage)}}>
                <span className={styles.gradePct}>{percentage}%</span>
                <span className={styles.gradeLtr}>{gradeLetter(percentage)}</span>
                <GradeBar value={Number(grade)} max={post.points||100}/>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>💬 Feedback to student</label>
            <textarea className={styles.formTextarea} rows={4} placeholder="Write detailed feedback visible to the student…" value={feedback} onChange={e=>setFeedback(e.target.value)}/>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>🔒 Private teacher note</label>
            <textarea className={styles.formTextarea} rows={2} placeholder="Internal notes only you can see…" value={note} onChange={e=>setNote(e.target.value)}/>
          </div>

          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={onBack}>Cancel</button>
            {sub.status==='graded'&&<button className={styles.returnBtn2} onClick={async()=>{setSaving(true);await onReturn(sub.submissionId);setSaving(false);onBack();}}>✓ Return to Student</button>}
            <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={()=>save(false)} disabled={saving||grade===''}>
              {saving?'Saving…':'Save Grade'}
            </button>
            <button className={styles.submitBtn} style={{background:'#34d399',color:'#000'}} onClick={()=>save(true)} disabled={saving||grade===''}>
              Save &amp; Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// GRADE BOOK TAB
// ═════════════════════════════════════════════════════════════════════════
function GradeBookTab({classroomId,classroom,th,showToast}) {
  const [data,setData]           = useState(null);
  const [loading,setLoading]     = useState(true);
  const [editing,setEditing]     = useState(null);
  const [tempGrade,setTempGrade] = useState('');
  const [saving,setSaving]       = useState(false);
  const [search,setSearch]       = useState('');
  const [sortDir,setSortDir]     = useState('asc');
  const [studentView,setStudentView] = useState(null); // selected student for detail

  const reload = () => {
    setLoading(true);
    fetch(`${API}/api/classrooms/${classroomId}/gradebook`)
      .then(r=>r.json()).then(d=>setData(d)).catch(()=>setData(null)).finally(()=>setLoading(false));
  };
  useEffect(()=>{reload();},[classroomId]);

  if(loading) return <div className={styles.loadingRow}><div className={styles.spinnerSm}/>Loading grade book…</div>;
  if(!data||!data.posts?.length) return <div className={styles.emptyState}><span>📊</span><strong>No gradeable items yet</strong><p>Assignments and quizzes appear here once created.</p></div>;

  const {submissions} = data;
  const gradedPosts = data.posts;
  const allMembers = data.members||[];
  const members = allMembers
    .filter(m=>!search||m.userName.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sortDir==='asc'?a.userName.localeCompare(b.userName):b.userName.localeCompare(a.userName));

  const getSub = (studentId,postId) => submissions.find(s=>s.studentId===studentId&&s.postId===postId);

  const studentAvg = (studentId) => {
    const graded=gradedPosts.filter(p=>{const s=getSub(studentId,p.postId);return s?.grade!=null;});
    if(!graded.length) return null;
    const total=graded.reduce((a,p)=>{const s=getSub(studentId,p.postId);return a+pct(s.grade,p.points||100);},0);
    return (total/graded.length).toFixed(1);
  };

  const handleSaveGrade = async (sub,postId,grade) => {
    if(grade===''||isNaN(Number(grade))){setEditing(null);return;}
    setSaving(true);
    if(sub) {
      await fetch(`${API}/api/classrooms/${classroomId}/posts/${postId}/submissions/${sub.submissionId}/grade`,{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade:Number(grade)}),
      });
    }
    reload(); setEditing(null); setSaving(false); showToast('Grade updated!');
  };

  const exportCSV = () => {
    const header = ['Student',...gradedPosts.map(p=>p.title),'Average'].join(',');
    const rows = allMembers.map(m=>{
      const grades = gradedPosts.map(p=>{const s=getSub(m.userId,p.postId);return s?.grade??'';});
      return [m.userName,...grades,studentAvg(m.userId)||''].join(',');
    });
    const csv = [header,...rows].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`grades-${classroomId}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported!');
  };

  const assignAvg = (postId) => {
    const g=submissions.filter(s=>s.postId===postId&&s.grade!=null);
    if(!g.length) return null;
    return (g.reduce((a,s)=>a+s.grade,0)/g.length).toFixed(1);
  };

  // Student detail view
  if(studentView) {
    const m = allMembers.find(x=>x.userId===studentView);
    const avg = studentAvg(studentView);
    return (
      <div className={styles.studentDetailView}>
        <button className={styles.backLink} onClick={()=>setStudentView(null)}>← Back to Grade Book</button>
        <div className={styles.studentDetailHeader}>
          <Avatar name={m?.userName} size={56}/>
          <div>
            <h2 style={{fontWeight:800}}>{m?.userName}</h2>
            <p style={{color:'var(--text-2)',fontSize:14}}>Overall average: <strong style={{color:avg?gradeColor(Number(avg)):'var(--text-3)'}}>{avg?`${avg}% (${gradeLetter(Number(avg))})`:'-'}</strong></p>
          </div>
        </div>
        <div className={styles.studentAssignList}>
          {gradedPosts.map(p=>{
            const sub=getSub(studentView,p.postId);
            const g = sub?.grade!=null ? pct(sub.grade,p.points||100) : null;
            return (
              <div key={p.postId} className={styles.studentAssignRow} style={{borderColor:th.border}}>
                <div style={{flex:1}}>
                  <strong>{p.title}</strong>
                  <div style={{fontSize:12,color:'var(--text-2)',marginTop:2}}>{fmtDate(p.dueDate)} · {p.points||'?'} pts</div>
                  {sub?.feedback&&<p style={{fontSize:12,color:'var(--text-2)',marginTop:6,fontStyle:'italic'}}>"{sub.feedback}"</p>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  {g!=null?<>
                    <div style={{fontSize:24,fontWeight:800,color:gradeColor(g)}}>{sub.grade}<span style={{fontSize:14,fontWeight:400,color:'var(--text-2)'}}>/{p.points}</span></div>
                    <GradeBar value={sub.grade} max={p.points||100}/>
                    <span className={`${styles.subStatusPill} ${styles[`sub_${sub.status}`]}`}>{sub.status}</span>
                  </>:<span style={{color:'var(--text-3)',fontSize:13}}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gradebook}>
      <div className={styles.gradebookHeader}>
        <div>
          <h3 className={styles.gradebookTitle}>📊 Grade Book</h3>
          <p className={styles.gradebookSubtitle}>{allMembers.length} students · {gradedPosts.length} assignments</p>
        </div>
        <div className={styles.gradebookToolbar}>
          <input className={styles.searchInput} placeholder="Search student…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <button className={styles.exportBtn} onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑ A-Z':'↓ Z-A'}</button>
          <button className={styles.exportBtn} onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      <div className={styles.gradebookScroll}>
        <table className={styles.gbTable}>
          <thead>
            <tr>
              <th className={styles.gbTh} style={{minWidth:180}}>Student</th>
              {gradedPosts.map(p=>(
                <th key={p.postId} className={styles.gbTh} title={p.title}>
                  <div className={styles.gbPostHead}>
                    <span className={styles.gbPostName}>{p.title.length>14?p.title.slice(0,14)+'…':p.title}</span>
                    <span className={styles.gbPostPts}>{p.points||'?'}pt</span>
                  </div>
                </th>
              ))}
              <th className={styles.gbTh} style={{minWidth:80}}>Avg</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{background:'rgba(0,212,255,0.03)'}}>
              <td className={styles.gbTd} style={{fontSize:10,color:'var(--text-2)',fontFamily:'var(--font-mono)',textTransform:'uppercase',letterSpacing:1}}>Class Avg</td>
              {gradedPosts.map(p=>{
                const avg=assignAvg(p.postId);
                return <td key={p.postId} className={styles.gbTd}>
                  <span className={styles.gbCell} style={avg?{color:gradeColor(pct(Number(avg),p.points||100)),opacity:0.85}:{color:'rgba(148,163,184,0.2)'}}>
                    {avg??'—'}
                  </span>
                </td>;
              })}
              <td className={styles.gbTd}/>
            </tr>
            {members.map(m=>{
              const avg=studentAvg(m.userId);
              return (
                <tr key={m.userId} className={styles.gbRow} onClick={()=>setStudentView(m.userId)} style={{cursor:'pointer'}}>
                  <td className={styles.gbTd}>
                    <div className={styles.gbStudentCell}>
                      <Avatar name={m.userName} size={28}/>
                      <span style={{fontSize:14,fontWeight:600}}>{m.userName}</span>
                    </div>
                  </td>
                  {gradedPosts.map(p=>{
                    const sub=getSub(m.userId,p.postId);
                    const isEditThis=editing?.studentId===m.userId&&editing?.postId===p.postId;
                    return (
                      <td key={p.postId} className={styles.gbTd}
                        onClick={e=>{e.stopPropagation();if(!isEditThis){setEditing({studentId:m.userId,postId:p.postId});setTempGrade(sub?.grade??'');}}}>
                        {isEditThis?(
                          <div className={styles.gbEditCell} onClick={e=>e.stopPropagation()}>
                            <input className={styles.gbInput} autoFocus type="number" min={0} max={p.points||9999} value={tempGrade}
                              style={{color:tempGrade?gradeColor(pct(Number(tempGrade),p.points||100)):undefined}}
                              onChange={e=>setTempGrade(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')handleSaveGrade(sub,p.postId,tempGrade);if(e.key==='Escape')setEditing(null);}}/>
                            <button className={styles.gbSaveBtn} style={{background:th.accent,color:'#000'}} onClick={()=>handleSaveGrade(sub,p.postId,tempGrade)} disabled={saving}>✓</button>
                            <button className={styles.gbSaveBtn} style={{background:'rgba(255,255,255,0.1)'}} onClick={()=>setEditing(null)}>✕</button>
                          </div>
                        ):(
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
                            <span className={styles.gbCell} style={sub?.grade!=null?{color:gradeColor(pct(sub.grade,p.points||100))}:{color:'rgba(148,163,184,0.2)'}}>
                              {sub?.grade!=null?sub.grade:'—'}
                            </span>
                            {sub?.status==='late'&&<span className={styles.gbLateTag}>late</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className={styles.gbTd}>
                    <span className={styles.gbAvg} style={avg?{color:gradeColor(Number(avg))}:{color:'rgba(148,163,184,0.25)'}}>
                      {avg?`${avg}%`:'—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.gbHint}>💡 Click a grade cell to edit · Enter to confirm · Click a student row for their full report · ⬇ Export CSV</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═════════════════════════════════════════════════════════════════════════
function AnalyticsTab({classroomId,classroom,th}) {
  const [data,setData]       = useState(null);
  const [loading,setLoading] = useState(true);
  const [view,setView]       = useState('overview'); // 'overview' | 'students' | 'assignments'

  useEffect(()=>{
    setLoading(true);
    fetch(`${API}/api/classrooms/${classroomId}/analytics`)
      .then(r=>r.json()).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false));
  },[classroomId]);

  if(loading) return <div className={styles.loadingRow}><div className={styles.spinnerSm}/>Crunching numbers…</div>;
  if(!data) return <div className={styles.emptyState}><span>📈</span><strong>No analytics data yet</strong></div>;

  const { studentStats, assignmentStats, sessionStats, distribution, totalStudents, classAvg } = data;

  return (
    <div className={styles.tabContent}>
      <div className={styles.analyticsHeader}>
        <h2 className={styles.sectionTitle}>📈 Class Analytics</h2>
        <div className={styles.filterRow}>
          {[['overview','Overview'],['students','Students'],['assignments','Assignments']].map(([v,l])=>(
            <button key={v} className={`${styles.filterBtn} ${view===v?styles.filterBtnActive:''}`}
              style={view===v?{background:th.muted,borderColor:th.accent,color:th.accent}:{}} onClick={()=>setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      {view==='overview'&&(
        <>
          <div className={styles.analyticsStatRow}>
            <StatCard icon="👥" label="Students" value={totalStudents} color="#60a5fa"/>
            <StatCard icon="📊" label="Class Average" value={classAvg?`${classAvg}%`:'-'} color={classAvg?gradeColor(Number(classAvg)):'#94a3b8'}/>
            <StatCard icon="📹" label="Sessions" value={sessionStats.length} color="#a78bfa"/>
            <StatCard icon="📋" label="Assignments" value={assignmentStats.length} color={th.accent}/>
          </div>

          {/* Grade distribution */}
          {distribution&&(
            <div className={styles.distCard} style={{borderColor:th.border}}>
              <h3 className={styles.distTitle}>Grade Distribution</h3>
              <div className={styles.distBars}>
                {Object.entries(distribution).map(([letter,count])=>{
                  const colors = {A:'#34d399',B:'#60a5fa',C:'#fcd34d',D:'#fb923c',F:'#f87171'};
                  const max = Math.max(...Object.values(distribution),1);
                  return (
                    <div key={letter} className={styles.distBar}>
                      <div className={styles.distBarFill} style={{height:`${(count/max)*100}%`,background:colors[letter]}}/>
                      <span className={styles.distBarLabel} style={{color:colors[letter]}}>{letter}</span>
                      <span className={styles.distBarCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sessions timeline */}
          {sessionStats.length>0&&(
            <div className={styles.sessionsTimeline} style={{borderColor:th.border}}>
              <h3 className={styles.distTitle}>Session History</h3>
              {sessionStats.slice(0,5).map((s,i)=>(
                <div key={i} className={styles.timelineRow}>
                  <div className={styles.timelineDot} style={{background:th.accent}}/>
                  <div className={styles.timelineContent}>
                    <strong>{fmtDate(s.startedAt)}</strong>
                    <span style={{color:'var(--text-2)',fontSize:12}}>{s.duration?`${s.duration}m`:''} · {s.attendeeCount} attendees</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view==='students'&&(
        <div className={styles.analyticsTable}>
          <div className={styles.analyticsTableHead}>
            <span style={{flex:2}}>Student</span>
            <span>Submitted</span>
            <span>Missing</span>
            <span>Late</span>
            <span>Avg Grade</span>
          </div>
          {studentStats.sort((a,b)=>(b.avgGrade||0)-(a.avgGrade||0)).map(s=>(
            <div key={s.userId} className={styles.analyticsTableRow}>
              <div style={{flex:2,display:'flex',alignItems:'center',gap:10}}>
                <Avatar name={s.userName} size={32}/>
                <span style={{fontWeight:600}}>{s.userName}</span>
              </div>
              <span style={{color:'#60a5fa'}}>{s.submitted}</span>
              <span style={{color:s.missing>0?'#f87171':'var(--text-2)'}}>{s.missing}</span>
              <span style={{color:s.late>0?'#fb923c':'var(--text-2)'}}>{s.late}</span>
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:120}}>
                {s.avgGrade!=null?(
                  <>
                    <span style={{fontWeight:800,color:gradeColor(s.avgGrade),minWidth:44}}>{s.avgGrade.toFixed(1)}%</span>
                    <GradeBar value={s.avgGrade} max={100}/>
                  </>
                ):<span style={{color:'var(--text-3)'}}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view==='assignments'&&(
        <div className={styles.analyticsTable}>
          <div className={styles.analyticsTableHead}>
            <span style={{flex:2}}>Assignment</span>
            <span>Submitted</span>
            <span>Graded</span>
            <span>Avg Score</span>
          </div>
          {assignmentStats.map(a=>(
            <div key={a.postId} className={styles.analyticsTableRow}>
              <div style={{flex:2}}>
                <strong>{a.title}</strong>
                <span style={{fontSize:11,color:'var(--text-2)',marginLeft:8}}>{a.points}pt</span>
              </div>
              <span style={{color:'#60a5fa'}}>{a.submitted}/{a.totalStudents}</span>
              <span style={{color:'#34d399'}}>{a.graded}</span>
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:120}}>
                {a.avgGrade!=null?(
                  <>
                    <span style={{fontWeight:700,color:gradeColor(pct(a.avgGrade,a.points||100))}}>{a.avgGrade.toFixed(1)}</span>
                    <GradeBar value={a.avgGrade} max={a.points||100}/>
                  </>
                ):<span style={{color:'var(--text-3)'}}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ATTENDANCE TAB
// ═════════════════════════════════════════════════════════════════════════
function AttendanceTab({classroomId,classroom,sessions,th,showToast}) {
  const [records,setRecords]   = useState([]);
  const [loading,setLoading]   = useState(true);
  const [marking,setMarking]   = useState(null); // session being marked
  const [draft,setDraft]       = useState({});   // {studentId: status}
  const [saving,setSaving]     = useState(false);

  const students = classroom?.members?.filter(m=>m.role==='student')||[];

  useEffect(()=>{
    fetch(`${API}/api/classrooms/${classroomId}/attendance`)
      .then(r=>r.json()).then(d=>setRecords(Array.isArray(d)?d:[])).catch(()=>setRecords([])).finally(()=>setLoading(false));
  },[classroomId]);

  const startMarking = (session) => {
    const existing = records.find(r=>r.sessionId===session.sessionId||r.sessionId===session._id);
    const initDraft = {};
    students.forEach(s=>{
      const rec = existing?.records?.find(r=>r.studentId===s.userId);
      initDraft[s.userId] = rec?.status || 'absent';
    });
    setDraft(initDraft);
    setMarking(session);
  };

  const saveAttendance = async () => {
    setSaving(true);
    const attendanceRecords = students.map(s=>({studentId:s.userId,studentName:s.userName,status:draft[s.userId]||'absent'}));
    await fetch(`${API}/api/classrooms/${classroomId}/attendance`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sessionId:marking.sessionId||marking._id,date:marking.startedAt,records:attendanceRecords}),
    });
    setMarking(null);
    fetch(`${API}/api/classrooms/${classroomId}/attendance`).then(r=>r.json()).then(d=>setRecords(Array.isArray(d)?d:[]));
    setSaving(false); showToast('Attendance saved!');
  };

  const statusColors = {present:'#34d399',absent:'#f87171',late:'#fcd34d',excused:'#60a5fa'};
  const statusIcon   = {present:'✅',absent:'❌',late:'⏰',excused:'📋'};

  if(marking) {
    return (
      <div className={styles.tabContent}>
        <button className={styles.backLink} onClick={()=>setMarking(null)}>← Back to Attendance</button>
        <h3 className={styles.sectionTitle}>✅ Mark Attendance — {fmtDate(marking.startedAt)}</h3>
        <p style={{color:'var(--text-2)',fontSize:13,marginBottom:20}}>Click each student to cycle through statuses: Present → Absent → Late → Excused</p>

        <div className={styles.attendanceGrid}>
          {students.map(s=>{
            const status = draft[s.userId]||'absent';
            const cycle  = {present:'absent',absent:'late',late:'excused',excused:'present'};
            return (
              <div key={s.userId} className={styles.attendanceTile}
                style={{borderColor:statusColors[status],background:`${statusColors[status]}12`}}
                onClick={()=>setDraft(d=>({...d,[s.userId]:cycle[status]}))}>
                <Avatar name={s.userName} size={42}/>
                <span className={styles.attendanceName}>{s.userName}</span>
                <span className={styles.attendanceStatus} style={{color:statusColors[status]}}>{statusIcon[status]} {status}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.formActions} style={{marginTop:24}}>
          <div className={styles.attendanceSummary}>
            {Object.entries(statusColors).map(([s,c])=>(
              <span key={s} style={{color:c,fontSize:13,fontWeight:600}}>
                {statusIcon[s]} {Object.values(draft).filter(v=>v===s).length} {s}
              </span>
            ))}
          </div>
          <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={saveAttendance} disabled={saving}>{saving?'Saving…':'Save Attendance'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <h3 className={styles.sectionTitle}>✅ Attendance</h3>

      {sessions.length===0&&<div className={styles.emptyState}><span>📹</span><strong>No sessions yet</strong><p>Attendance can be marked after hosting a live session.</p></div>}

      {/* Per-session records */}
      {sessions.map((s,i)=>{
        const rec = records.find(r=>r.sessionId===s.sessionId||r.sessionId===s._id);
        const present = rec?.records?.filter(r=>r.status==='present').length||0;
        const total   = students.length;
        return (
          <div key={i} className={styles.attendanceSessionCard} style={{borderColor:th.border}}>
            <div className={styles.attendanceSessionTop}>
              <div>
                <strong style={{fontSize:15}}>Session {sessions.length-i}</strong>
                <span style={{color:'var(--text-2)',fontSize:12,marginLeft:10}}>{fmtDate(s.startedAt)} at {fmtTime(s.startedAt)}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {rec&&<span style={{color:'var(--text-2)',fontSize:12}}>{present}/{total} present</span>}
                <button className={styles.smallBtn} style={{color:th.accent,borderColor:th.border}} onClick={()=>startMarking(s)}>
                  {rec?'✏️ Edit':'+ Mark Attendance'}
                </button>
              </div>
            </div>
            {rec&&rec.records?.length>0&&(
              <div className={styles.attendanceRecordRow}>
                {rec.records.map((r,j)=>(
                  <span key={j} className={styles.attendanceChip} style={{color:statusColors[r.status],borderColor:`${statusColors[r.status]}40`,background:`${statusColors[r.status]}12`}}>
                    {statusIcon[r.status]} {r.studentName}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Student attendance summary */}
      {records.length>0&&students.length>0&&(
        <div className={styles.attendanceSummaryCard} style={{borderColor:th.border,marginTop:24}}>
          <h4 style={{marginBottom:12,fontWeight:700}}>📊 Student Attendance Summary</h4>
          {students.map(s=>{
            const allRecs = records.flatMap(r=>r.records?.filter(rec=>rec.studentId===s.userId)||[]);
            const counts = {present:0,absent:0,late:0,excused:0};
            allRecs.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
            const rate = allRecs.length ? Math.round((counts.present/allRecs.length)*100) : null;
            return (
              <div key={s.userId} className={styles.attendanceStudentRow}>
                <Avatar name={s.userName} size={32}/>
                <span style={{flex:1,fontWeight:600}}>{s.userName}</span>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {Object.entries(counts).filter(([,v])=>v>0).map(([stat,count])=>(
                    <span key={stat} style={{fontSize:11,color:statusColors[stat]}}>{statusIcon[stat]}{count}</span>
                  ))}
                </div>
                {rate!=null&&(
                  <span style={{fontWeight:700,color:rate>=80?'#34d399':rate>=60?'#fcd34d':'#f87171',fontSize:13,minWidth:48,textAlign:'right'}}>
                    {rate}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MATERIALS TAB
// ═════════════════════════════════════════════════════════════════════════
function MaterialsTab({classroomId,posts,setPosts,isTeacher,userId,userName,th,fetchPosts,showToast}) {
  const [creating,setCreating] = useState(false);
  const [form,setForm]         = useState({title:'',body:'',topic:''});
  const [files,setFiles]       = useState([]);
  const [posting,setPosting]   = useState(false);
  const [search,setSearch]     = useState('');
  const fileRef = useRef(null);
  const materials = posts.filter(p=>p.type==='material').filter(m=>!search||m.title.toLowerCase().includes(search.toLowerCase())||m.topic?.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if(!form.title.trim()&&files.length===0) return;
    setPosting(true);
    const fd=new FormData();
    Object.entries(form).forEach(([k,v])=>v&&fd.append(k,v));
    fd.append('type','material'); fd.append('authorId',userId); fd.append('authorName',userName);
    files.forEach(f=>fd.append('files',f));
    try {
      const r=await fetch(`${API}/api/classrooms/${classroomId}/posts`,{method:'POST',body:fd});
      const d=await r.json(); setPosts(p=>[d,...p]);
      setCreating(false); setForm({title:'',body:'',topic:''}); setFiles([]);
      showToast('Material uploaded!');
    }catch{}finally{setPosting(false);}
  };

  const topics = [...new Set(materials.map(m=>m.topic).filter(Boolean))];

  return (
    <div className={styles.tabContent}>
      <div className={styles.assignHeader}>
        <input className={styles.searchInput} placeholder="Search materials…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,maxWidth:300}}/>
        {isTeacher&&<button className={styles.createBtn} style={{background:th.accent,color:'#000'}} onClick={()=>setCreating(c=>!c)}>{creating?'✕ Cancel':'+ Upload Material'}</button>}
      </div>

      {creating&&(
        <div className={styles.createForm} style={{borderColor:th.border}}>
          <h3 className={styles.formTitle}>New Material</h3>
          <input className={styles.formInput} placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <textarea className={styles.formTextarea} placeholder="Description (optional)" rows={3} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
          <input className={styles.formInput} placeholder="Topic / Unit" value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))}/>
          <div className={styles.filePickerRow}>
            <button className={styles.attachBtn} onClick={()=>fileRef.current?.click()}>📎 Attach files</button>
            <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>setFiles(ff=>[...ff,...Array.from(e.target.files)])}/>
            {files.map((f,i)=><div key={i} className={styles.fileChip}>{fileIcon(f.type)} {f.name}<button onClick={()=>setFiles(ff=>ff.filter((_,j)=>j!==i))}>✕</button></div>)}
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={()=>{setCreating(false);setFiles([]);}}>Cancel</button>
            <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={handleCreate} disabled={posting}>{posting?'Uploading…':'Upload'}</button>
          </div>
        </div>
      )}

      {topics.length>0&&(
        <div className={styles.topicsRow}>
          {topics.map(t=><button key={t} className={styles.topicFilterBtn} style={{borderColor:th.border,color:th.accent}} onClick={()=>setSearch(t)}>{t}</button>)}
          {search&&<button className={styles.topicFilterBtn} style={{borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}} onClick={()=>setSearch('')}>✕ Clear</button>}
        </div>
      )}

      {materials.length===0&&!creating&&<div className={styles.emptyState}><span>📚</span><strong>No materials yet</strong><p>{isTeacher?'Upload resources for your class.':'No materials posted yet.'}</p></div>}

      <div className={styles.materialGrid}>
        {materials.map(m=>(
          <div key={m.postId} className={styles.materialCard} style={{borderColor:th.border}}>
            <div className={styles.materialCardTop}>
              <span style={{fontSize:24}}>{m.attachments?.[0]?fileIcon(m.attachments[0].mime):'📚'}</span>
              <div style={{flex:1}}>
                <h4 className={styles.materialTitle}>{m.title||'Untitled'}</h4>
                {m.topic&&<span className={styles.topicChip}>{m.topic}</span>}
              </div>
              {isTeacher&&<button className={styles.deleteIconBtn} onClick={async()=>{await fetch(`${API}/api/classrooms/${classroomId}/posts/${m.postId}`,{method:'DELETE'});setPosts(p=>p.filter(x=>x.postId!==m.postId));showToast('Deleted');}}>🗑</button>}
            </div>
            {m.body&&<p className={styles.materialBody}>{m.body}</p>}
            {m.attachments?.length>0&&(
              <div className={styles.materialFiles}>
                {m.attachments.map((f,i)=>(
                  <a key={i} className={styles.materialFile} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">
                    <span>{fileIcon(f.mime)}</span>
                    <div>
                      <span className={styles.materialFileName}>{f.name}</span>
                      <span className={styles.materialFileSize}>{fmtSize(f.size)}</span>
                    </div>
                    <span style={{marginLeft:'auto',color:th.accent,fontSize:12}}>⬇</span>
                  </a>
                ))}
              </div>
            )}
            <div className={styles.materialMeta}>{fmtDate(m.createdAt)} · {m.authorName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// QUIZZES TAB
// ═════════════════════════════════════════════════════════════════════════
function QuizzesTab({classroomId,posts,setPosts,isTeacher,userId,userName,th,showToast}) {
  const [creating,setCreating] = useState(false);
  const [selected,setSelected] = useState(null);
  const [form,setForm]         = useState({title:'',body:'',dueDate:'',points:'',timeLimit:'',questions:[]});
  const [posting,setPosting]   = useState(false);

  const quizzes = posts.filter(p=>p.type==='quiz');

  const addQuestion = () => setForm(f=>({...f,questions:[...f.questions,{text:'',type:'mcq',options:['','','',''],correct:0,points:10}]}));
  const updateQ = (i,field,val) => setForm(f=>{const qs=[...f.questions];qs[i]={...qs[i],[field]:val};return {...f,questions:qs};});
  const updateOpt = (qi,oi,val) => setForm(f=>{const qs=[...f.questions];qs[qi].options[oi]=val;return {...f,questions:qs};});

  const handleCreate = async () => {
    if(!form.title.trim()||form.questions.length===0) return;
    setPosting(true);
    const fd=new FormData();
    Object.entries(form).forEach(([k,v])=>k!=='questions'&&v&&fd.append(k,v));
    fd.append('type','quiz'); fd.append('authorId',userId); fd.append('authorName',userName);
    fd.append('quizQuestions',JSON.stringify(form.questions));
    try {
      const r=await fetch(`${API}/api/classrooms/${classroomId}/posts`,{method:'POST',body:fd});
      const d=await r.json(); setPosts(p=>[d,...p]);
      setCreating(false); setForm({title:'',body:'',dueDate:'',points:'',timeLimit:'',questions:[]});
      showToast('Quiz created!');
    }catch{}finally{setPosting(false);}
  };

  if(selected) {
    const quiz = quizzes.find(q=>q.postId===selected);
    if(!quiz){setSelected(null);return null;}
    return <QuizPanel quiz={quiz} classroomId={classroomId} isTeacher={isTeacher} userId={userId} userName={userName} th={th} onBack={()=>setSelected(null)} showToast={showToast}/>;
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.assignHeader}>
        {isTeacher&&<button className={styles.createBtn} style={{background:th.accent,color:'#000',marginLeft:'auto'}} onClick={()=>setCreating(c=>!c)}>{creating?'✕ Cancel':'+ New Quiz'}</button>}
      </div>

      {creating&&(
        <div className={styles.createForm} style={{borderColor:th.border}}>
          <h3 className={styles.formTitle}>New Quiz</h3>
          <input className={styles.formInput} placeholder="Quiz title *" value={form.title} autoFocus onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <textarea className={styles.formTextarea} placeholder="Instructions" rows={2} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))}/>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}><label className={styles.formLabel}>Due date</label><input className={styles.formInput} type="datetime-local" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Total pts</label><input className={styles.formInput} type="number" placeholder="Auto" value={form.points} onChange={e=>setForm(f=>({...f,points:e.target.value}))}/></div>
            <div className={styles.formGroup}><label className={styles.formLabel}>Time limit (min)</label><input className={styles.formInput} type="number" placeholder="None" value={form.timeLimit} onChange={e=>setForm(f=>({...f,timeLimit:e.target.value}))}/></div>
          </div>

          <div className={styles.questionList}>
            {form.questions.map((q,qi)=>(
              <div key={qi} className={styles.questionCard} style={{borderColor:th.border}}>
                <div className={styles.questionHeader}>
                  <span className={styles.questionNum} style={{background:th.muted,color:th.accent}}>Q{qi+1}</span>
                  <input className={styles.formInput} style={{flex:1}} placeholder="Question text" value={q.text} onChange={e=>updateQ(qi,'text',e.target.value)}/>
                  <input className={styles.formInput} type="number" style={{width:72}} placeholder="pts" value={q.points} onChange={e=>updateQ(qi,'points',Number(e.target.value))}/>
                  <button className={styles.deleteIconBtn} onClick={()=>setForm(f=>({...f,questions:f.questions.filter((_,j)=>j!==qi)}))}>🗑</button>
                </div>
                <div className={styles.optionsList}>
                  {q.options.map((o,oi)=>(
                    <div key={oi} className={`${styles.optionRow} ${q.correct===oi?styles.optionCorrect:''}`} style={q.correct===oi?{borderColor:th.accent,background:th.muted}:{}}>
                      <button className={styles.correctBtn} style={q.correct===oi?{color:th.accent}:{}} onClick={()=>updateQ(qi,'correct',oi)} title="Mark as correct">
                        {q.correct===oi?'✓':'○'}
                      </button>
                      <input className={styles.optionInput} placeholder={`Option ${oi+1}`} value={o} onChange={e=>updateOpt(qi,oi,e.target.value)}/>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className={styles.addQBtn} style={{borderColor:th.border,color:th.accent}} onClick={addQuestion}>+ Add Question</button>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={()=>setCreating(false)}>Cancel</button>
            <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={handleCreate} disabled={posting||!form.title.trim()||form.questions.length===0}>{posting?'Creating…':'Create Quiz'}</button>
          </div>
        </div>
      )}

      {quizzes.length===0&&!creating&&<div className={styles.emptyState}><span>🧠</span><strong>No quizzes yet</strong><p>{isTeacher?'Create a quiz above.':'No quizzes posted yet.'}</p></div>}

      {quizzes.map(q=>(
        <div key={q.postId} className={styles.assignCard} style={{borderLeftColor:th.accent,cursor:'pointer'}} onClick={()=>setSelected(q.postId)}>
          <div className={styles.assignCardTop}>
            <div className={styles.assignCardIcon} style={{background:th.muted,color:th.accent}}>🧠</div>
            <div className={styles.assignCardInfo}>
              <h3 className={styles.assignCardTitle}>{q.title}</h3>
              <div className={styles.assignCardMeta}>
                {q.quizQuestions?.length>0&&<span className={styles.topicChip}>{q.quizQuestions.length} questions</span>}
                {q.dueDate&&<span className={styles.dueChip}>📅 {fmtDate(q.dueDate)}</span>}
                {q.points&&<span className={styles.ptChip}>{q.points} pts</span>}
                {q.timeLimit&&<span className={styles.topicChip}>⏱ {q.timeLimit}min</span>}
              </div>
            </div>
            {isTeacher&&<button className={styles.deleteIconBtn} onClick={e=>{e.stopPropagation();fetch(`${API}/api/classrooms/${classroomId}/posts/${q.postId}`,{method:'DELETE'}).then(()=>{setPosts(p=>p.filter(x=>x.postId!==q.postId));showToast('Quiz deleted');});}}>🗑</button>}
          </div>
          <div className={styles.assignCardFooter} style={{color:th.accent}}>{isTeacher?'View results →':'Take quiz →'}</div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// QUIZ PANEL — take or review
// ═════════════════════════════════════════════════════════════════════════
function QuizPanel({quiz,classroomId,isTeacher,userId,userName,th,onBack,showToast}) {
  const [answers,setAnswers]   = useState({});
  const [submitted,setSubmitted] = useState(false);
  const [results,setResults]   = useState(null);
  const [subs,setSubs]         = useState([]);
  const [loadingSubs,setLoadingSubs] = useState(true);

  useEffect(()=>{
    if(!isTeacher) return;
    setLoadingSubs(true);
    fetch(`${API}/api/classrooms/${classroomId}/posts/${quiz.postId}/submissions?userId=${userId}&role=teacher`)
      .then(r=>r.json()).then(d=>setSubs(Array.isArray(d)?d:[])).finally(()=>setLoadingSubs(false));
  },[]);

  const handleSubmit = async () => {
    const fd=new FormData();
    fd.append('studentId',userId); fd.append('studentName',userName);
    fd.append('quizAnswers',JSON.stringify(answers));
    const r=await fetch(`${API}/api/classrooms/${classroomId}/posts/${quiz.postId}/submissions`,{method:'POST',body:fd});
    const d=await r.json();
    setSubmitted(true); setResults(d); showToast('Quiz submitted!');
  };

  const qs = quiz.quizQuestions||[];

  if(isTeacher) {
    return (
      <div className={styles.reviewPanel}>
        <button className={styles.backLink} onClick={onBack}>← Back to quizzes</button>
        <h2 className={styles.reviewTitle2}>{quiz.title}</h2>
        {loadingSubs&&<div className={styles.loadingRow}><div className={styles.spinnerSm}/>Loading…</div>}
        {!loadingSubs&&subs.length===0&&<div className={styles.emptyState}><span>📭</span><strong>No submissions yet</strong></div>}
        {subs.map(s=>{
          const score = s.grade!=null?pct(s.grade,quiz.points||100):null;
          return (
            <div key={s.submissionId} className={styles.subCard} style={{borderColor:th.border}}>
              <div className={styles.subCardLeft}><Avatar name={s.studentName} size={38}/><div><strong>{s.studentName}</strong><div className={styles.subCardDate}>{fmtDate(s.submittedAt)}</div></div></div>
              <div className={styles.subCardRight}>
                {score!=null&&<div className={styles.subGrade} style={{color:gradeColor(score)}}><span className={styles.subGradeNum}>{s.grade}</span><span className={styles.subGradeOf}>/{quiz.points||'?'}</span><span className={styles.subGradeLetter}>{gradeLetter(score)}</span></div>}
                <span className={`${styles.subStatusPill} ${styles[`sub_${s.status}`]}`}>{s.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if(submitted&&results) {
    const score = results.grade!=null?pct(results.grade,quiz.points||qs.reduce((a,q)=>a+q.points,0)):null;
    return (
      <div className={styles.reviewPanel}>
        <button className={styles.backLink} onClick={onBack}>← Back to quizzes</button>
        <div className={styles.quizResultCard} style={{borderColor:th.border}}>
          <div style={{fontSize:52}}>{score>=90?'🏆':score>=70?'🎉':'📝'}</div>
          <h2>Quiz Complete!</h2>
          {score!=null&&<>
            <div style={{fontSize:56,fontWeight:800,color:gradeColor(score)}}>{score}%</div>
            <div style={{fontSize:28,color:gradeColor(score)}}>{gradeLetter(score)}</div>
            <GradeBar value={score} max={100}/>
          </>}
          <p style={{color:'var(--text-2)',marginTop:8}}>Score: {results.grade}/{quiz.points||'?'} pts</p>
          <button className={styles.backLink} style={{marginTop:16}} onClick={onBack}>← Back to quizzes</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reviewPanel}>
      <button className={styles.backLink} onClick={onBack}>← Back to quizzes</button>
      <h2 className={styles.reviewTitle2}>{quiz.title}</h2>
      {quiz.body&&<p className={styles.reviewBody}>{quiz.body}</p>}
      <div className={styles.quizMeta}>
        {qs.length>0&&<span className={styles.topicChip}>{qs.length} questions</span>}
        {quiz.points&&<span className={styles.ptChip}>{quiz.points} pts</span>}
        {quiz.timeLimit&&<span className={styles.topicChip}>⏱ {quiz.timeLimit} min</span>}
      </div>

      {qs.map((q,qi)=>(
        <div key={qi} className={styles.quizQuestion} style={{borderColor:th.border}}>
          <div className={styles.questionHeader}>
            <span className={styles.questionNum} style={{background:th.muted,color:th.accent}}>Q{qi+1}</span>
            <p className={styles.questionText}>{q.text}</p>
            <span className={styles.ptChip}>{q.points}pt</span>
          </div>
          <div className={styles.optionsList}>
            {q.options.filter(o=>o).map((o,oi)=>(
              <div key={oi} className={`${styles.optionRow} ${answers[qi]===oi?styles.optionSelected:''}`}
                style={answers[qi]===oi?{borderColor:th.accent,background:th.muted}:{}}
                onClick={()=>setAnswers(a=>({...a,[qi]:oi}))}>
                <span className={styles.optionLetter} style={answers[qi]===oi?{color:th.accent}:{}}>{String.fromCharCode(65+oi)}</span>
                <span>{o}</span>
                {answers[qi]===oi&&<span style={{marginLeft:'auto',color:th.accent}}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.formActions}>
        <span style={{color:'var(--text-2)',fontSize:13}}>{Object.keys(answers).length}/{qs.length} answered</span>
        <button className={styles.submitBtn} style={{background:th.accent,color:'#000'}} onClick={handleSubmit} disabled={Object.keys(answers).length<qs.length}>
          Submit Quiz
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PEOPLE TAB
// ═════════════════════════════════════════════════════════════════════════
function PeopleTab({classroom,setClassroom,isTeacher,userId,th,fetchClassroom,classroomId,showToast}) {
  const [removing,setRemoving] = useState(null);

  const members = classroom?.members||[];
  const teachers = members.filter(m=>m.role==='teacher'||m.userId===classroom.creatorId);
  const students = members.filter(m=>m.role==='student'&&m.userId!==classroom.creatorId);

  const changeRole = async (memberId,role) => {
    await fetch(`${API}/api/classrooms/${classroomId}/members/${memberId}/role`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
    fetchClassroom(); showToast('Role updated!');
  };
  const removeMember = async (memberId) => {
    setRemoving(memberId);
    await fetch(`${API}/api/classrooms/${classroomId}/members/${memberId}`,{method:'DELETE'});
    fetchClassroom(); setRemoving(null); showToast('Member removed');
  };

  const PersonRow = ({m,showRole=false})=>(
    <div className={styles.personRow}>
      <Avatar name={m.userName} size={40}/>
      <div style={{flex:1}}>
        <span style={{fontWeight:600}}>{m.userName}</span>
        {m.userId===classroom.creatorId&&<span style={{fontSize:10,color:'#fcd34d',marginLeft:6,fontFamily:'var(--font-mono)'}}>CREATOR</span>}
        <div style={{fontSize:12,color:'var(--text-2)'}}>{m.role} · Joined {fmtDate(m.joinedAt)}</div>
      </div>
      {isTeacher&&m.userId!==classroom.creatorId&&m.userId!==userId&&(
        <div className={styles.personActions}>
          {m.role==='student'&&<button className={styles.smallBtn} style={{color:'#a78bfa',borderColor:'rgba(167,139,250,0.3)'}} onClick={()=>changeRole(m.userId,'teacher')}>Make Teacher</button>}
          {m.role==='teacher'&&<button className={styles.smallBtn} style={{color:th.accent,borderColor:th.border}} onClick={()=>changeRole(m.userId,'student')}>Make Student</button>}
          <button className={styles.smallBtn} style={{color:'#f87171',borderColor:'rgba(239,68,68,0.3)'}} disabled={removing===m.userId} onClick={()=>removeMember(m.userId)}>{removing===m.userId?'…':'Remove'}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.tabContent}>
      <div className={styles.peopleSection}>
        <div className={styles.sectionLabel}>👑 Teachers ({teachers.length})</div>
        {teachers.map(m=><PersonRow key={m.userId} m={m}/>)}
      </div>
      <div className={styles.peopleSection}>
        <div className={styles.sectionLabel}>👥 Students ({students.length})</div>
        {students.length===0&&<div className={styles.emptyState} style={{padding:'24px 0'}}><span>👥</span><strong>No students yet</strong><p>Share the invite code to get started.</p></div>}
        {students.map(m=><PersonRow key={m.userId} m={m}/>)}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SESSIONS TAB
// ═════════════════════════════════════════════════════════════════════════
function SessionsTab({sessions,th,navigate,classroomId}) {
  if(!sessions.length) return <div className={styles.emptyState}><span>📹</span><strong>No sessions yet</strong><p>Host a live session to see it here.</p></div>;
  return (
    <div className={styles.tabContent}>
      {sessions.map((s,i)=>(
        <div key={i} className={styles.sessionCard} style={{borderColor:th.border}}>
          <div className={styles.sessionTop}>
            <div>
              <strong style={{fontSize:15}}>Session #{sessions.length-i}</strong>
              <span className={styles.sessionDate}> · {fmtDate(s.startedAt)} at {fmtTime(s.startedAt)}</span>
            </div>
            {!s.endedAt&&<span className={styles.livePill} style={{color:th.accent,borderColor:th.border}}>🔴 LIVE</span>}
            {s.endedAt&&<span className={styles.durationPill}>⏱ {fmtDur(s.startedAt,s.endedAt)}</span>}
          </div>
          <div className={styles.sessionMeta}>
            <span>👤 {s.hostName}</span>
            {s.attendees?.length>0&&<span>👥 {s.attendees.length} attended</span>}
            {s.chatLog?.length>0&&<span>💬 {s.chatLog.length} messages</span>}
          </div>
          {s.chatLog?.length>0&&(
            <details className={styles.chatLogBlock}>
              <summary>💬 Chat log ({s.chatLog.length})</summary>
              <div className={styles.chatLog}>
                {s.chatLog.map((m,j)=>(
                  <div key={j} className={styles.chatLogMsg}>
                    <span style={{color:th.accent,fontWeight:700}}>{m.userName}</span>
                    <span>{m.message}</span>
                    <span className={styles.chatLogTime}>{fmtTime(m.timestamp)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {s.attendees?.length>0&&(
            <details className={styles.chatLogBlock}>
              <summary>👥 Attendees ({s.attendees.length})</summary>
              <div className={styles.attendeeList}>
                {s.attendees.map((a,j)=><span key={j} className={styles.attendeeChip}>{a.userName}</span>)}
              </div>
            </details>
          )}
          {!s.endedAt&&<button className={styles.rejoinBtn} style={{color:th.accent,borderColor:`${th.accent}55`}} onClick={()=>navigate(`/room/${s.roomId}?classroom=${classroomId}`)}>Rejoin Session →</button>}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// POST CARD
// ═════════════════════════════════════════════════════════════════════════
function PostCard({post,classroomId,isTeacher,userId,userName,th,onPin,onDelete}) {
  const [comments,setComments]=useState([]);
  const [showC,setShowC]=useState(false);
  const [text,setText]=useState('');
  const [loadingC,setLoadingC]=useState(false);
  const [pollPost,setPollPost]=useState(post);

  const loadComments = async()=>{
    setLoadingC(true);
    const r=await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/comments`);
    const d=await r.json(); setComments(Array.isArray(d)?d:[]); setLoadingC(false);
  };
  const sendComment = async()=>{
    if(!text.trim()) return;
    const r=await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({authorId:userId,authorName:userName,text})});
    const d=await r.json(); setComments(c=>[...c,d]); setText('');
  };
  const vote=async(oi)=>{
    const r=await fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,optionIndex:oi})});
    setPollPost(await r.json());
  };
  const totalVotes=pollPost.pollOptions?.reduce((a,o)=>a+o.votes.length,0)||0;
  const myVote=pollPost.pollOptions?.findIndex(o=>o.votes.includes(userId))??-1;
  const typeLabel = post.type==='question'?'❓ Question':post.type==='poll'?'📊 Poll':'📢 Announcement';
  const typeColor = post.type==='question'?'#fcd34d':th.accent;

  return (
    <div className={styles.postCard} style={{borderLeftColor:typeColor}}>
      <div className={styles.postHeader}>
        <Avatar name={post.authorName} size={36}/>
        <div className={styles.postMeta}>
          <strong>{post.authorName}</strong>
          <span>{fmtDate(post.createdAt)} · {fmtTime(post.createdAt)}</span>
        </div>
        <span className={styles.postTypeBadge} style={{background:`${typeColor}15`,color:typeColor,border:`1px solid ${typeColor}30`}}>{typeLabel}</span>
        {post.pinned&&<span className={styles.pinnedMark}>📌</span>}
        {isTeacher&&(
          <div className={styles.postActions}>
            <button onClick={onPin} title={post.pinned?'Unpin':'Pin'}>{post.pinned?'📌':'📍'}</button>
            <button onClick={onDelete}>🗑</button>
          </div>
        )}
      </div>
      {post.body&&<p className={styles.postBody}>{post.body}</p>}
      {post.attachments?.length>0&&(
        <div className={styles.attachRow}>
          {post.attachments.map((f,i)=><a key={i} className={styles.attachPill} href={`${API}/api/classrooms/${classroomId}/files/${f.filename}`} target="_blank" rel="noreferrer">{fileIcon(f.mime)} {f.name}</a>)}
        </div>
      )}
      {post.type==='poll'&&pollPost.pollOptions?.length>0&&(
        <div className={styles.pollBlock}>
          {pollPost.pollOptions.map((o,oi)=>{
            const v=totalVotes?Math.round((o.votes.length/totalVotes)*100):0;
            const isMine=myVote===oi;
            return (
              <div key={oi} className={styles.pollOpt} onClick={()=>!pollPost.pollClosed&&vote(oi)}
                style={{cursor:pollPost.pollClosed?'default':'pointer',borderColor:isMine?th.accent:'rgba(255,255,255,0.08)',background:isMine?th.muted:'rgba(255,255,255,0.03)'}}>
                <div className={styles.pollOptBar} style={{width:`${v}%`,background:th.muted}}/>
                <span className={styles.pollOptText}>{isMine&&'✓ '}{o.text}</span>
                <span className={styles.pollOptPct}>{v}%</span>
              </div>
            );
          })}
          <p className={styles.pollMeta}>{totalVotes} vote{totalVotes!==1?'s':''}{pollPost.pollClosed?' · Closed':''}</p>
          {isTeacher&&!pollPost.pollClosed&&<button className={styles.closePollBtn} onClick={()=>fetch(`${API}/api/classrooms/${classroomId}/posts/${post.postId}/close-poll`,{method:'PATCH'}).then(r=>r.json()).then(setPollPost)}>Close poll</button>}
        </div>
      )}
      <div className={styles.postFooter}>
        <button className={styles.commentToggle} onClick={()=>{if(!showC)loadComments();setShowC(v=>!v);}}>
          💬 {showC?'Hide':'Comments'}{comments.length>0?` (${comments.length})`:''}
        </button>
      </div>
      {showC&&(
        <div className={styles.commentSection}>
          {loadingC&&<span className={styles.loadingTxt}>Loading…</span>}
          {comments.map((c,i)=>(
            <div key={i} className={styles.commentRow}>
              <Avatar name={c.authorName} size={28}/>
              <div className={styles.commentContent}>
                <span className={styles.commentName} style={{color:th.accent}}>{c.authorName}</span>
                <span className={styles.commentText}>{c.text}</span>
              </div>
              <span className={styles.commentTime}>{fmtTime(c.createdAt)}</span>
            </div>
          ))}
          <div className={styles.commentInputRow}>
            <Avatar name={userName} size={28}/>
            <input className={styles.commentInput} placeholder="Add a comment…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendComment()}/>
            <button className={styles.commentSend} style={{background:th.accent,color:'#000'}} onClick={sendComment}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
