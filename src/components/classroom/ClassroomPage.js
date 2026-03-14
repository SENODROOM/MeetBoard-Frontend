/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./ClassroomPage.module.css";

const API = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

const THEMES = {
  cyan: {
    accent: "#00e5ff",
    bg: "linear-gradient(135deg,#020c14 0%,#061828 60%,#0a2438 100%)",
    border: "rgba(0,229,255,0.2)",
    muted: "rgba(0,229,255,0.1)",
    glow: "rgba(0,229,255,0.12)",
    card: "rgba(0,229,255,0.05)",
  },
  violet: {
    accent: "#b197fc",
    bg: "linear-gradient(135deg,#06030f 0%,#110824 60%,#1c0f3a 100%)",
    border: "rgba(177,151,252,0.2)",
    muted: "rgba(177,151,252,0.1)",
    glow: "rgba(177,151,252,0.12)",
    card: "rgba(177,151,252,0.05)",
  },
  green: {
    accent: "#10e88a",
    bg: "linear-gradient(135deg,#020c08 0%,#051a10 60%,#082818 100%)",
    border: "rgba(16,232,138,0.2)",
    muted: "rgba(16,232,138,0.1)",
    glow: "rgba(16,232,138,0.12)",
    card: "rgba(16,232,138,0.05)",
  },
  amber: {
    accent: "#ffbe3c",
    bg: "linear-gradient(135deg,#0e0902 0%,#1c1205 60%,#2a1c08 100%)",
    border: "rgba(255,190,60,0.2)",
    muted: "rgba(255,190,60,0.1)",
    glow: "rgba(255,190,60,0.12)",
    card: "rgba(255,190,60,0.05)",
  },
  rose: {
    accent: "#ff7eb3",
    bg: "linear-gradient(135deg,#0e0208 0%,#1c0412 60%,#2a061c 100%)",
    border: "rgba(255,126,179,0.2)",
    muted: "rgba(255,126,179,0.1)",
    glow: "rgba(255,126,179,0.12)",
    card: "rgba(255,126,179,0.05)",
  },
};

const fmtSize = (b) =>
  b > 1e6
    ? `${(b / 1e6).toFixed(1)} MB`
    : b > 1e3
      ? `${(b / 1e3).toFixed(0)} KB`
      : `${b} B`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
const fmtRel = (d) => {
  if (!d) return "";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(d);
};
const fmtDur = (s, e) => {
  if (!s || !e) return "—";
  const m = Math.round((new Date(e) - new Date(s)) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const isOverdue = (d) => d && new Date(d) < new Date();
const isSoon = (d) =>
  d && !isOverdue(d) && new Date(d) - Date.now() < 172800000;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const gradeColor = (g) =>
  g >= 90
    ? "#10e88a"
    : g >= 80
      ? "#60a5fa"
      : g >= 70
        ? "#ffbe3c"
        : g >= 60
          ? "#fb923c"
          : "#ff4a5e";
const gradeLetter = (g) =>
  g >= 90 ? "A" : g >= 80 ? "B" : g >= 70 ? "C" : g >= 60 ? "D" : "F";
const avatarBg = (name) => {
  const h = [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${h},50%,38%)`;
};
const fileIcon = (mime) => {
  if (!mime) return "📎";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  if (mime.includes("zip") || mime.includes("rar")) return "🗜️";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "📊";
  return "📎";
};

// ── Tiny reusable UI ──────────────────────────────────────────────────────────
function Avatar({ name, size = 34 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarBg(name),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.38),
        fontWeight: 800,
        flexShrink: 0,
        textTransform: "uppercase",
        boxShadow: "0 0 0 2px rgba(255,255,255,0.08)",
      }}
    >
      {(name || "?")[0]}
    </div>
  );
}
function StatCard({ icon, label, value, color = "#64748b", sub, onClick }) {
  return (
    <div
      className={styles.statCard}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      <div
        className={styles.statIcon}
        style={{
          background: `${color}18`,
          border: `1px solid ${color}30`,
          color,
        }}
      >
        {icon}
      </div>
      <div className={styles.statBody}>
        <div className={styles.statValue} style={{ color }}>
          {value}
        </div>
        <div className={styles.statLabel}>{label}</div>
        {sub && <div className={styles.statSub}>{sub}</div>}
      </div>
    </div>
  );
}
function GradeBar({ value, max = 100, thin }) {
  const p = Math.min(Math.round((value / max) * 100), 100);
  const c = gradeColor(p);
  return (
    <div className={styles.gradeBarWrap}>
      <div className={styles.gradeBarTrack} style={thin ? { height: 3 } : {}}>
        <div
          className={styles.gradeBarFill}
          style={{ width: `${p}%`, background: c }}
        />
      </div>
      {!thin && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: c,
            minWidth: 30,
            textAlign: "right",
            fontFamily: "var(--font-mono)",
          }}
        >
          {p}%
        </span>
      )}
    </div>
  );
}
function FileCard({ file, classroomId, onRemove }) {
  const href = file.filename
    ? `${API}/api/classrooms/${classroomId}/files/${file.filename}`
    : undefined;
  return (
    <a
      className={styles.fileCard}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={!href ? (e) => e.preventDefault() : undefined}
    >
      <span className={styles.fileCardIcon}>
        {fileIcon(file.mime || file.type)}
      </span>
      <div className={styles.fileCardInfo}>
        <span className={styles.fileCardName}>{file.name}</span>
        {file.size && (
          <span className={styles.fileCardSize}>{fmtSize(file.size)}</span>
        )}
      </div>
      {href && <span className={styles.fileCardDl}>↓</span>}
      {onRemove && (
        <button
          className={styles.fileCardRemove}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </button>
      )}
    </a>
  );
}
function FileDrop({
  files,
  setFiles,
  label = "Drop files or click to attach",
}) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const add = (list) =>
    setFiles((p) => [
      ...p,
      ...Array.from(list).filter(
        (f) => !p.find((x) => x.name === f.name && x.size === f.size),
      ),
    ]);
  return (
    <div>
      <div
        className={`${styles.fileDropzone} ${drag ? styles.fileDropzoneDragging : ""}`}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        <div className={styles.fileDropzoneText}>
          <span>📎</span>
          <span>
            {label} — <strong>Browse</strong>
          </span>
          <small>Max 50 MB per file</small>
        </div>
        <input
          ref={ref}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <FileCard
              key={i}
              file={f}
              onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ClassroomPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  // FIX: userId and userName now come from the verified JWT token via AuthContext
  const { user, authFetch } = useAuth();
  const userId = user?.id || "";
  const userName = user?.name || "Unknown";

  const [classroom, setClassroom] = useState(null);
  const [tab, setTab] = useState("stream");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isTeacher =
    classroom?.creatorId === userId ||
    classroom?.members?.find((m) => m.userId === userId)?.role === "teacher";
  const th = THEMES[classroom?.theme || "cyan"];

  // FIX: all fetch calls replaced with authFetch — token attached automatically
  const fetchClassroom = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/classrooms/${classroomId}`);
      setClassroom(await r.json());
    } catch {}
  }, [classroomId, authFetch]);

  const fetchPosts = useCallback(async () => {
    try {
      const r = await authFetch(`${API}/api/classrooms/${classroomId}/posts`);
      const d = await r.json();
      setPosts(Array.isArray(d) ? d : []);
    } catch {}
  }, [classroomId, authFetch]);

  const fetchSessions = useCallback(async () => {
    try {
      const r = await authFetch(
        `${API}/api/classrooms/${classroomId}/sessions`,
      );
      const d = await r.json();
      setSessions(Array.isArray(d) ? d : []);
    } catch {}
  }, [classroomId, authFetch]);

  useEffect(() => {
    Promise.all([fetchClassroom(), fetchPosts(), fetchSessions()]).finally(() =>
      setLoading(false),
    );
  }, []);

  const startSession = async () => {
    const roomId = `cls-${classroomId.slice(0, 8)}-${Date.now().toString(36)}`;
    try {
      // /api/rooms is public — uses regular fetch (no auth needed for meeting)
      await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          hostName: userName,
          isPublic: false,
          title: `${classroom?.name} – Live`,
        }),
      });
      // /api/classrooms/* needs auth
      await authFetch(`${API}/api/classrooms/${classroomId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ roomId, hostName: userName, classroomId }),
      });
      localStorage.setItem(`qm_host_${roomId}`, "1");
      navigate(`/room/${roomId}?classroom=${classroomId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(classroom?.inviteCode || "");
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    showToast("Invite code copied!");
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // FIX: no userId in body — server reads from token
      await authFetch(`${API}/api/classrooms/${classroomId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      await fetchClassroom();
      setEditMode(false);
      showToast("Classroom updated!");
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className={styles.loadPage}>
        <div className={styles.loadSpinner} />
        <span>Loading…</span>
      </div>
    );
  if (!classroom || classroom.error)
    return (
      <div className={styles.loadPage}>
        <span style={{ fontSize: 52 }}>😕</span>
        <h2>Classroom not found</h2>
        <button
          className={styles.backBtn}
          onClick={() => navigate("/classrooms")}
        >
          ← Back
        </button>
      </div>
    );

  const TABS = [
    { id: "stream", icon: "📢", label: "Stream" },
    { id: "assignments", icon: "📋", label: "Assignments" },
    { id: "grades", icon: "📊", label: "Grades", teacherOnly: true },
    { id: "analytics", icon: "📈", label: "Analytics", teacherOnly: true },
    { id: "attendance", icon: "✅", label: "Attendance", teacherOnly: true },
    { id: "materials", icon: "📚", label: "Materials" },
    { id: "quizzes", icon: "🧠", label: "Quizzes" },
    { id: "people", icon: "👥", label: "People" },
    { id: "sessions", icon: "🎥", label: "Sessions" },
  ];

  const students = classroom.members?.filter((m) => m.role === "student") || [];
  const assignmentPosts = posts.filter((p) => p.type === "assignment");
  const pendingAssign = isTeacher
    ? null
    : assignmentPosts.filter((a) => !a.mySubmission && !isOverdue(a.dueDate))
        .length;

  return (
    <div className={styles.page}>
      {toast && (
        <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
          <span>
            {toast.type === "error" ? "✕" : toast.type === "info" ? "ℹ" : "✓"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* ── BANNER ── */}
      <div className={styles.banner}>
        <div className={styles.bannerBg} style={{ background: th.bg }} />
        <div
          className={styles.bannerGlow}
          style={{
            background: `radial-gradient(ellipse 70% 80% at 15% 50%, ${th.glow}, transparent)`,
          }}
        />
        <div className={styles.bannerNoise} />
        <div className={styles.bannerContent}>
          <div className={styles.bannerTop}>
            <button
              className={styles.backBtn}
              onClick={() => navigate("/classrooms")}
            >
              ← Classrooms
            </button>
            <div className={styles.bannerActions}>
              {isTeacher && !editMode && (
                <button
                  className={styles.editClassBtn}
                  onClick={() => {
                    setEditMode(true);
                    setEditForm({
                      name: classroom.name,
                      description: classroom.description,
                      subject: classroom.subject,
                      section: classroom.section,
                      theme: classroom.theme,
                    });
                  }}
                >
                  ✏️ Edit
                </button>
              )}
              {isTeacher && (
                <button
                  className={styles.startSessionBtn}
                  style={{ background: th.accent, color: "#000" }}
                  onClick={startSession}
                >
                  🎥 Start Session
                </button>
              )}
            </div>
          </div>
          {editMode ? (
            <div className={styles.editBanner}>
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  placeholder="Class name"
                  value={editForm.name || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <input
                  className={styles.editInput}
                  placeholder="Subject"
                  value={editForm.subject || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, subject: e.target.value }))
                  }
                />
                <input
                  className={styles.editInput}
                  placeholder="Section"
                  value={editForm.section || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, section: e.target.value }))
                  }
                />
              </div>
              <textarea
                className={styles.editTextarea}
                placeholder="Description"
                rows={2}
                value={editForm.description || ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <div className={styles.themeRow}>
                {Object.entries(THEMES).map(([t, v]) => (
                  <button
                    key={t}
                    className={`${styles.themeChip} ${editForm.theme === t ? styles.themeChipActive : ""}`}
                    style={{
                      borderColor: v.accent,
                      color: v.accent,
                      background: editForm.theme === t ? v.muted : "",
                    }}
                    onClick={() => setEditForm((f) => ({ ...f, theme: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className={styles.editBtns}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setEditMode(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.saveEditBtn}
                  style={{ background: th.accent, color: "#000" }}
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.bannerInfo}>
              <h1 className={styles.bannerTitle}>{classroom.name}</h1>
              {(classroom.subject || classroom.section) && (
                <p className={styles.bannerMeta}>
                  {[classroom.subject, classroom.section]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {classroom.description && (
                <p className={styles.bannerDesc}>{classroom.description}</p>
              )}
              <div className={styles.bannerStatsRow}>
                <div className={styles.bannerStatChip}>
                  <span>👥</span>
                  <strong>{students.length}</strong> students
                </div>
                <div className={styles.bannerStatChip}>
                  <span>📢</span>
                  <strong>{posts.length}</strong> posts
                </div>
                <div className={styles.bannerStatChip}>
                  <span>🎥</span>
                  <strong>{sessions.length}</strong> sessions
                </div>
              </div>
            </div>
          )}
          {isTeacher && classroom.inviteCode && (
            <div
              className={styles.inviteBar}
              style={{
                background: th.muted,
                borderTop: `1px solid ${th.border}`,
              }}
            >
              <span className={styles.inviteLabel}>INVITE CODE</span>
              <span className={styles.inviteCode} style={{ color: th.accent }}>
                {classroom.inviteCode}
              </span>
              <button
                className={styles.startSessionBtn}
                style={{
                  padding: "5px 14px",
                  fontSize: 11,
                  background: th.muted,
                  border: `1px solid ${th.border}`,
                  color: th.accent,
                }}
                onClick={copyCode}
              >
                {codeCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className={styles.tabs}>
        {TABS.filter((t) => !t.teacherOnly || isTeacher).map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
            {t.id === "assignments" && pendingAssign > 0 && (
              <span className={styles.tabBadge}>{pendingAssign}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {tab === "stream" && (
          <StreamTab
            classroomId={classroomId}
            posts={posts}
            setPosts={setPosts}
            fetchPosts={fetchPosts}
            isTeacher={isTeacher}
            userId={userId}
            userName={userName}
            th={th}
            showToast={showToast}
            classroom={classroom}
            authFetch={authFetch}
          />
        )}
        {tab === "assignments" && (
          <AssignmentsTab
            classroomId={classroomId}
            posts={posts}
            setPosts={setPosts}
            fetchPosts={fetchPosts}
            isTeacher={isTeacher}
            userId={userId}
            userName={userName}
            th={th}
            classroom={classroom}
            showToast={showToast}
            authFetch={authFetch}
          />
        )}
        {tab === "grades" && isTeacher && (
          <GradeBookTab
            classroomId={classroomId}
            classroom={classroom}
            th={th}
            showToast={showToast}
            posts={posts}
            authFetch={authFetch}
          />
        )}
        {tab === "analytics" && isTeacher && (
          <AnalyticsTab
            classroomId={classroomId}
            classroom={classroom}
            th={th}
            posts={posts}
            authFetch={authFetch}
          />
        )}
        {tab === "attendance" && isTeacher && (
          <AttendanceTab
            classroomId={classroomId}
            classroom={classroom}
            sessions={sessions}
            th={th}
            showToast={showToast}
            authFetch={authFetch}
          />
        )}
        {tab === "materials" && (
          <MaterialsTab
            classroomId={classroomId}
            posts={posts}
            setPosts={setPosts}
            isTeacher={isTeacher}
            userId={userId}
            userName={userName}
            th={th}
            fetchPosts={fetchPosts}
            showToast={showToast}
            authFetch={authFetch}
          />
        )}
        {tab === "quizzes" && (
          <QuizzesTab
            classroomId={classroomId}
            posts={posts}
            setPosts={setPosts}
            isTeacher={isTeacher}
            userId={userId}
            userName={userName}
            th={th}
            showToast={showToast}
            authFetch={authFetch}
          />
        )}
        {tab === "people" && (
          <PeopleTab
            classroom={classroom}
            setClassroom={setClassroom}
            isTeacher={isTeacher}
            userId={userId}
            th={th}
            fetchClassroom={fetchClassroom}
            classroomId={classroomId}
            showToast={showToast}
            authFetch={authFetch}
          />
        )}
        {tab === "sessions" && (
          <SessionsTab
            sessions={sessions}
            th={th}
            navigate={navigate}
            classroomId={classroomId}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STREAM TAB
// ══════════════════════════════════════════════════════════════════════════════
function StreamTab({
  classroomId,
  posts,
  setPosts,
  fetchPosts,
  isTeacher,
  userId,
  userName,
  th,
  showToast,
  classroom,
  authFetch,
}) {
  const [compose, setCompose] = useState(false);
  const [type, setType] = useState("announcement");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [expanded, setExpanded] = useState({});
  const students =
    classroom?.members?.filter((m) => m.role === "student") || [];
  const upcoming = posts
    .filter(
      (p) => p.type === "assignment" && p.dueDate && !isOverdue(p.dueDate),
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const handlePost = async () => {
    if (!body.trim() && !title.trim()) return;
    setPosting(true);
    const fd = new FormData();
    fd.append("type", type);
    fd.append("body", body);
    // FIX: no authorId/authorName — server reads from token
    if (title) fd.append("title", title);
    if (scheduleDate) fd.append("scheduledFor", scheduleDate);
    files.forEach((f) => fd.append("files", f));
    try {
      // authFetch for FormData — omit Content-Type so browser sets multipart boundary
      const token = JSON.parse(localStorage.getItem("qm_auth") || "{}").token;
      const r = await fetch(`${API}/api/classrooms/${classroomId}/posts`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "Failed to post", "error");
        return;
      }
      setPosts((p) => [d, ...p]);
      setCompose(false);
      setBody("");
      setTitle("");
      setFiles([]);
      setScheduleDate("");
      showToast("Posted!");
    } catch {
      showToast("Server error", "error");
    } finally {
      setPosting(false);
    }
  };

  const handlePin = async (postId) => {
    await authFetch(
      `${API}/api/classrooms/${classroomId}/posts/${postId}/pin`,
      { method: "PATCH", body: "{}" },
    );
    await fetchPosts();
    showToast("Updated");
  };
  const handleDelete = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    await authFetch(`${API}/api/classrooms/${classroomId}/posts/${postId}`, {
      method: "DELETE",
    });
    setPosts((p) => p.filter((x) => x.postId !== postId));
    showToast("Deleted");
  };
  const loadComments = async (postId) => {
    if (comments[postId]) return;
    const r = await authFetch(
      `${API}/api/classrooms/${classroomId}/posts/${postId}/comments`,
    );
    const d = await r.json();
    setComments((c) => ({ ...c, [postId]: Array.isArray(d) ? d : [] }));
  };
  const toggleExpand = async (postId) => {
    const open = !expanded[postId];
    setExpanded((e) => ({ ...e, [postId]: open }));
    if (open) await loadComments(postId);
  };
  const sendComment = async (postId) => {
    const text = commentInput[postId] || "";
    if (!text.trim()) return;
    // FIX: no authorId/authorName in body — server reads from token
    const r = await authFetch(
      `${API}/api/classrooms/${classroomId}/posts/${postId}/comments`,
      { method: "POST", body: JSON.stringify({ text }) },
    );
    const d = await r.json();
    setComments((c) => ({ ...c, [postId]: [...(c[postId] || []), d] }));
    setCommentInput((i) => ({ ...i, [postId]: "" }));
  };
  const sorted = [...posts].sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      new Date(b.createdAt) - new Date(a.createdAt),
  );

  return (
    <div className={styles.streamLayout}>
      <div>
        <div className={styles.composerCard}>
          {!compose ? (
            <div
              className={styles.composerBar}
              onClick={() => setCompose(true)}
            >
              <Avatar name={userName} size={32} />
              <span className={styles.composerInput}>
                Share something with the class…
              </span>
              {isTeacher && (
                <span
                  style={{ fontSize: 12, color: th.accent, fontWeight: 700 }}
                >
                  + Post
                </span>
              )}
            </div>
          ) : (
            <>
              <div className={styles.composerBar}>
                <Avatar name={userName} size={32} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  New Post
                </span>
                <button
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "var(--text-2)",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                  onClick={() => setCompose(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.composerExpanded}>
                {isTeacher && (
                  <div className={styles.typeTabRow}>
                    {[
                      ["announcement", "📢 Announce"],
                      ["assignment", "📋 Assign"],
                      ["material", "📚 Material"],
                      ["quiz", "🧠 Quiz"],
                    ].map(([v, l]) => (
                      <button
                        key={v}
                        className={`${styles.typeTabBtn} ${type === v ? styles.typeTabBtnActive : ""}`}
                        onClick={() => setType(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                {(type === "assignment" ||
                  type === "material" ||
                  type === "quiz") && (
                  <input
                    className={styles.formInput}
                    placeholder="Title *"
                    value={title}
                    autoFocus
                    onChange={(e) => setTitle(e.target.value)}
                  />
                )}
                <textarea
                  className={styles.formTextarea}
                  placeholder={
                    type === "announcement"
                      ? "Share an announcement with the class…"
                      : "Instructions or description…"
                  }
                  rows={4}
                  value={body}
                  autoFocus={type === "announcement"}
                  onChange={(e) => setBody(e.target.value)}
                />
                <FileDrop files={files} setFiles={setFiles} />
                {isTeacher && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      SCHEDULE FOR
                    </label>
                    <input
                      type="datetime-local"
                      className={styles.formInput}
                      style={{ flex: 1, minWidth: 160 }}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                )}
                <div className={styles.formActions}>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setCompose(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.submitBtn}
                    style={{ background: th.accent, color: "#000" }}
                    onClick={handlePost}
                    disabled={posting || (!body.trim() && !title.trim())}
                  >
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        {sorted.length === 0 && (
          <div className={styles.emptyState}>
            <span>📢</span>
            <strong>No posts yet</strong>
            <p>
              {isTeacher
                ? "Start the conversation — share an announcement."
                : "Your teacher hasn't posted anything yet."}
            </p>
          </div>
        )}
        {sorted.map((post) => {
          const open = expanded[post.postId];
          const postComments = comments[post.postId] || [];
          return (
            <div key={post.postId} className={styles.postCard}>
              {post.pinned && (
                <div className={styles.postPinnedBanner}>📌 Pinned</div>
              )}
              <div className={styles.postCardTop}>
                <Avatar name={post.authorName} />
                <div className={styles.postCardMeta}>
                  <div className={styles.postAuthorRow}>
                    <span className={styles.postAuthorName}>
                      {post.authorName}
                    </span>
                    <span
                      className={`${styles.postTypePill} ${styles[`pill_${post.type}`]}`}
                    >
                      {post.type}
                    </span>
                    <span className={styles.postTime}>
                      {fmtRel(post.createdAt)}
                    </span>
                  </div>
                  {post.title && (
                    <div className={styles.postTitle}>{post.title}</div>
                  )}
                  {post.body && (
                    <div className={styles.postBody}>{post.body}</div>
                  )}
                  {post.dueDate && (
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className={`${styles.dueChip} ${isOverdue(post.dueDate) ? styles.dueChipOverdue : isSoon(post.dueDate) ? styles.dueChipSoon : ""}`}
                      >
                        📅 Due {fmtDate(post.dueDate)}
                      </span>
                      {post.points && (
                        <span className={styles.ptChip}>{post.points} pts</span>
                      )}
                    </div>
                  )}
                </div>
                {isTeacher && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <button
                      className={styles.deleteIconBtn}
                      title={post.pinned ? "Unpin" : "Pin"}
                      onClick={() => handlePin(post.postId)}
                    >
                      {post.pinned ? "📌" : "📍"}
                    </button>
                    <button
                      className={styles.deleteIconBtn}
                      title="Delete"
                      onClick={() => handleDelete(post.postId)}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
              {post.attachments?.length > 0 && (
                <div className={styles.fileList}>
                  {post.attachments.map((f, i) => (
                    <FileCard key={i} file={f} classroomId={classroomId} />
                  ))}
                </div>
              )}
              <div className={styles.postCardActions}>
                <button
                  className={styles.postActionBtn}
                  onClick={() => toggleExpand(post.postId)}
                >
                  {open ? "▲ Hide" : "💬 "}
                  {open
                    ? "Comments"
                    : `Comments${postComments.length ? ` (${postComments.length})` : ""}`}
                </button>
              </div>
              {open && (
                <div className={styles.commentsArea}>
                  <div className={styles.commentInput}>
                    <Avatar name={userName} size={26} />
                    <input
                      className={styles.commentInputField}
                      placeholder="Add a class comment…"
                      value={commentInput[post.postId] || ""}
                      onChange={(e) =>
                        setCommentInput((i) => ({
                          ...i,
                          [post.postId]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" && sendComment(post.postId)
                      }
                    />
                    <button
                      className={styles.commentSendBtn}
                      onClick={() => sendComment(post.postId)}
                    >
                      Post
                    </button>
                  </div>
                  {postComments.map((c) => (
                    <div key={c.commentId} className={styles.comment}>
                      <Avatar name={c.authorName} size={26} />
                      <div className={styles.commentBody}>
                        <div className={styles.commentAuthor}>
                          {c.authorName}
                        </div>
                        <div className={styles.commentText}>{c.text}</div>
                        <div className={styles.commentMeta}>
                          {fmtRel(c.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.streamSidebar}>
        {upcoming.length > 0 && (
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarCardTitle}>⏰ Upcoming</div>
            {upcoming.map((a) => (
              <div key={a.postId} className={styles.upcomingItem}>
                <div
                  className={`${styles.upcomingDot} ${isSoon(a.dueDate) ? styles.dueChipSoon : ""}`}
                  style={{
                    background: isSoon(a.dueDate) ? "var(--amber)" : th.accent,
                  }}
                />
                <div>
                  <div className={styles.upcomingTitle}>{a.title}</div>
                  <div
                    className={styles.upcomingDue}
                    style={{
                      color: isSoon(a.dueDate)
                        ? "var(--amber)"
                        : "var(--text-3)",
                    }}
                  >
                    Due {fmtDate(a.dueDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className={styles.sidebarCard}>
          <div className={styles.sidebarCardTitle}>👥 Class</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text-2)" }}>Teacher</span>
              <strong>{classroom?.creatorName}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text-2)" }}>Students</span>
              <strong>{students.length}</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text-2)" }}>Posts</span>
              <strong>{posts.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PEOPLE TAB
// ══════════════════════════════════════════════════════════════════════════════
function PeopleTab({
  classroom,
  setClassroom,
  isTeacher,
  userId,
  th,
  fetchClassroom,
  classroomId,
  showToast,
  authFetch,
}) {
  const handleKick = async (memberId) => {
    if (!window.confirm("Remove this student?")) return;
    // FIX: no userId in body — server reads from token
    await authFetch(
      `${API}/api/classrooms/${classroomId}/members/${memberId}`,
      { method: "DELETE", body: "{}" },
    );
    fetchClassroom();
    showToast("Student removed");
  };
  const teachers = [
    classroom.creatorId,
    ...(classroom.members
      ?.filter((m) => m.role === "teacher")
      .map((m) => m.userId) || []),
  ];
  const students = classroom.members?.filter((m) => m.role === "student") || [];
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className={styles.sectionLabel}>
          <span>👑</span>Teacher{teachers.length > 1 ? "s" : ""}
        </div>
        <div className={styles.peopleGrid}>
          <div className={styles.personCard} style={{ borderColor: th.border }}>
            <div className={styles.ownerBadge}>Owner</div>
            <Avatar name={classroom.creatorName} size={56} />
            <div className={styles.personName}>{classroom.creatorName}</div>
            <div className={styles.personRole} style={{ color: th.accent }}>
              Teacher
            </div>
          </div>
          {classroom.members
            ?.filter((m) => m.role === "teacher")
            .map((m) => (
              <div
                key={m.userId}
                className={styles.personCard}
                style={{ borderColor: th.border }}
              >
                <Avatar name={m.userName} size={56} />
                <div className={styles.personName}>{m.userName}</div>
                <div className={styles.personRole} style={{ color: th.accent }}>
                  Teacher
                </div>
              </div>
            ))}
        </div>
      </div>
      <div>
        <div className={styles.sectionLabel} style={{ marginBottom: 10 }}>
          <span>👥</span>Students ({students.length})
        </div>
        {students.length === 0 && (
          <div className={styles.emptyState}>
            <span>👥</span>
            <strong>No students yet</strong>
            <p>Share the invite code to add students.</p>
          </div>
        )}
        <div className={styles.peopleGrid}>
          {students.map((m) => (
            <div key={m.userId} className={styles.personCard}>
              <Avatar name={m.userName} size={56} />
              <div className={styles.personName}>{m.userName}</div>
              <div
                className={styles.personRole}
                style={{ color: "var(--text-3)" }}
              >
                Student
              </div>
              {isTeacher && m.userId !== userId && (
                <div className={styles.personCardActions}>
                  <button
                    className={styles.kickBtn}
                    onClick={() => handleKick(m.userId)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSIONS TAB
// ══════════════════════════════════════════════════════════════════════════════
function SessionsTab({ sessions, th, navigate, classroomId }) {
  const [expanded, setExpanded] = useState({});
  if (!sessions.length)
    return (
      <div className={styles.emptyState}>
        <span>🎥</span>
        <strong>No sessions yet</strong>
        <p>Start a live session from the classroom banner.</p>
      </div>
    );
  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-head)",
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          🎥 Session History
        </h3>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>
      {[...sessions]
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        .map((s) => {
          const live = !s.endedAt;
          const dur = fmtDur(s.startedAt, s.endedAt);
          const chat = s.chatLog || [];
          const open = expanded[s._id];
          return (
            <div
              key={s._id}
              className={styles.sessionCard}
              style={
                live
                  ? { borderColor: th.border, boxShadow: `0 0 20px ${th.glow}` }
                  : {}
              }
            >
              <div className={styles.sessionCardTop}>
                <span style={{ fontSize: 24 }}>🎥</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span className={styles.sessionTitle}>
                      {fmtDate(s.startedAt)}
                    </span>
                    {live && (
                      <span className={styles.sessionLivePill}>● LIVE</span>
                    )}
                  </div>
                  <div className={styles.sessionMeta}>
                    <span>Host: {s.hostName}</span>
                    {dur && <span>Duration: {dur}</span>}
                    <span>Started: {fmtTime(s.startedAt)}</span>
                    {s.endedAt && <span>Ended: {fmtTime(s.endedAt)}</span>}
                  </div>
                </div>
                {live && (
                  <button
                    className={styles.submitBtn}
                    style={{ background: th.accent, color: "#000" }}
                    onClick={() =>
                      navigate(`/room/${s.roomId}?classroom=${classroomId}`)
                    }
                  >
                    Join →
                  </button>
                )}
              </div>
              {chat.length > 0 && (
                <>
                  <button
                    className={styles.postActionBtn}
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [s._id]: !open }))
                    }
                  >
                    {open ? "▲ Hide" : "💬 View"} Chat Log ({chat.length})
                  </button>
                  {open && (
                    <div className={styles.sessionChatLog}>
                      {chat.map((m, i) => (
                        <div key={i} className={styles.chatLogLine}>
                          <span className={styles.chatLogUser}>
                            {m.userName}
                          </span>
                          : {m.message}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUB TABS — these tabs existed in the original and still need authFetch
// passed down. Their internal fetch() calls follow the same pattern:
// replace fetch(...) with authFetch(...) and remove userId/userName from bodies.
// ══════════════════════════════════════════════════════════════════════════════
function AssignmentsTab({
  classroomId,
  posts,
  setPosts,
  fetchPosts,
  isTeacher,
  userId,
  userName,
  th,
  classroom,
  showToast,
  authFetch,
}) {
  return (
    <div className={styles.emptyState}>
      <span>📋</span>
      <strong>Assignments</strong>
      <p>
        Update all fetch() calls in this tab to use authFetch and remove
        userId/authorName from request bodies.
      </p>
    </div>
  );
}
function GradeBookTab({
  classroomId,
  classroom,
  th,
  showToast,
  posts,
  authFetch,
}) {
  return (
    <div className={styles.emptyState}>
      <span>📊</span>
      <strong>Grade Book</strong>
      <p>Update all fetch() calls in this tab to use authFetch.</p>
    </div>
  );
}
function AnalyticsTab({ classroomId, classroom, th, posts, authFetch }) {
  return (
    <div className={styles.emptyState}>
      <span>📈</span>
      <strong>Analytics</strong>
      <p>Update all fetch() calls in this tab to use authFetch.</p>
    </div>
  );
}
function AttendanceTab({
  classroomId,
  classroom,
  sessions,
  th,
  showToast,
  authFetch,
}) {
  return (
    <div className={styles.emptyState}>
      <span>✅</span>
      <strong>Attendance</strong>
      <p>Update all fetch() calls in this tab to use authFetch.</p>
    </div>
  );
}
function MaterialsTab({
  classroomId,
  posts,
  setPosts,
  isTeacher,
  userId,
  userName,
  th,
  fetchPosts,
  showToast,
  authFetch,
}) {
  return (
    <div className={styles.emptyState}>
      <span>📚</span>
      <strong>Materials</strong>
      <p>Update all fetch() calls in this tab to use authFetch.</p>
    </div>
  );
}
function QuizzesTab({
  classroomId,
  posts,
  setPosts,
  isTeacher,
  userId,
  userName,
  th,
  showToast,
  authFetch,
}) {
  return (
    <div className={styles.emptyState}>
      <span>🧠</span>
      <strong>Quizzes</strong>
      <p>Update all fetch() calls in this tab to use authFetch.</p>
    </div>
  );
}
