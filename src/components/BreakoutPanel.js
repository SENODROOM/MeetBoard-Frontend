/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import styles from './BreakoutPanel.module.css';

export default function BreakoutPanel({ isHost, socket, roomId, userId, userName, peers, onClose }) {
  const [rooms, setRooms]           = useState([{ id: 'br-1', name: 'Room 1', participants: [] }, { id: 'br-2', name: 'Room 2', participants: [] }]);
  const [active, setActive]         = useState(false);
  const [myRoom, setMyRoom]         = useState(null);  // which breakout room I'm in
  const [broadcastMsg, setBroadcast]= useState('');
  const [timer, setTimer]           = useState(null);
  const [countdown, setCountdown]   = useState(null);
  const [dragOver, setDragOver]     = useState(null);
  const [nameEdit, setNameEdit]     = useState({});

  const allPeople = [
    { socketId: 'local', userName },
    ...peers.map(p => ({ socketId: p.socketId, userName: p.userName || 'Participant' }))
  ];

  // Unassigned participants
  const assigned = rooms.flatMap(r => r.participants);
  const unassigned = allPeople.filter(p => !assigned.includes(p.socketId));

  useEffect(() => {
    if (!socket) return;
    socket.emit('breakout-get', { roomId });
    const onStarted = ({ breakoutRooms }) => { setRooms(breakoutRooms); setActive(true); };
    const onEnded   = () => { setActive(false); setMyRoom(null); };
    const onAssigned = ({ breakoutRoomId }) => setMyRoom(breakoutRoomId);
    const onMsg      = ({ message }) => alert(`📢 Host: ${message}`);
    const onCallback = () => { alert('📢 Host is calling everyone back to the main room!'); setMyRoom(null); };
    const onState    = (state) => { if (state) { setRooms(state.rooms); setActive(state.active); } };

    socket.on('breakout-started',       onStarted);
    socket.on('breakout-ended',         onEnded);
    socket.on('breakout-assigned',      onAssigned);
    socket.on('breakout-broadcast-msg', onMsg);
    socket.on('breakout-callback',      onCallback);
    socket.on('breakout-state',         onState);

    return () => {
      socket.off('breakout-started', onStarted);
      socket.off('breakout-ended', onEnded);
      socket.off('breakout-assigned', onAssigned);
      socket.off('breakout-broadcast-msg', onMsg);
      socket.off('breakout-callback', onCallback);
      socket.off('breakout-state', onState);
    };
  }, [socket]);

  // Countdown timer
  useEffect(() => {
    if (!countdown || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); if (active) endBreakout(); return 0; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const addRoom = () => {
    const n = rooms.length + 1;
    setRooms(r => [...r, { id: `br-${Date.now()}`, name: `Room ${n}`, participants: [] }]);
  };

  const removeRoom = id => setRooms(r => r.filter(rm => rm.id !== id));

  const assignAuto = () => {
    const updated = rooms.map(r => ({ ...r, participants: [] }));
    const people = [...allPeople];
    people.forEach((p, i) => { updated[i % updated.length].participants.push(p.socketId); });
    setRooms(updated);
  };

  const startBreakout = () => {
    socket.emit('breakout-create', { roomId, breakoutRooms: rooms });
    // Assign each participant to their room
    rooms.forEach(br => {
      br.participants.forEach(sid => {
        if (sid !== 'local') socket.emit('breakout-assign', { roomId, targetSocketId: sid, breakoutRoomId: br.id });
      });
    });
    setActive(true);
    if (timer) setCountdown(timer * 60);
  };

  const endBreakout = () => {
    socket.emit('breakout-end', { roomId });
    setActive(false);
    setCountdown(null);
  };

  const callBack = () => socket.emit('breakout-call-back', { roomId });

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    socket.emit('breakout-broadcast', { roomId, message: broadcastMsg.trim() });
    setBroadcast('');
  };

  const handleDrop = (e, targetRoomId) => {
    e.preventDefault();
    const sid = e.dataTransfer.getData('socketId');
    setRooms(prev => prev.map(r => ({
      ...r,
      participants: targetRoomId === null
        ? r.participants.filter(p => p !== sid)
        : r.id === targetRoomId
          ? r.participants.includes(sid) ? r.participants : [...r.participants.filter(p => p !== sid), sid]
          : r.participants.filter(p => p !== sid)
    })));
    setDragOver(null);
  };

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const nameOf  = sid => allPeople.find(p => p.socketId === sid)?.userName || sid.slice(0,8);

  if (!isHost) {
    // Participant view
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>🚪</span>
          <span className={styles.title}>Breakout Rooms</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        {!active ? (
          <div className={styles.locked}>
            <span style={{fontSize:40}}>⏳</span>
            <strong>No breakout session active</strong>
            <p>The host hasn't started breakout rooms yet.</p>
          </div>
        ) : myRoom ? (
          <div className={styles.participantView}>
            <div className={styles.myRoomBadge}>
              {rooms.find(r => r.id === myRoom)?.name || 'Breakout Room'}
            </div>
            <p className={styles.participantNote}>You are assigned to this breakout room. The host can broadcast messages here.</p>
          </div>
        ) : (
          <div className={styles.locked}>
            <span style={{fontSize:40}}>🚪</span>
            <strong>Waiting for assignment</strong>
            <p>The host will assign you to a breakout room shortly.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🚪</span>
          <div>
            <span className={styles.title}>Breakout Rooms</span>
            {active && countdown > 0 && <span className={styles.timer}>⏱ {fmtTime(countdown)}</span>}
            {active && <span className={styles.activePill}>Active</span>}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {!active ? (
        <div className={styles.body}>
          {/* Config */}
          <div className={styles.configRow}>
            <button className={styles.addRoomBtn} onClick={addRoom}>+ Add Room</button>
            <button className={styles.autoBtn} onClick={assignAuto}>⚡ Auto Assign</button>
          </div>
          <div className={styles.timerRow}>
            <label className={styles.timerLabel}>Timer (min)</label>
            <input className={styles.timerInput} type="number" min="1" max="60" placeholder="—"
              value={timer||''} onChange={e => setTimer(e.target.value ? Number(e.target.value) : null)} />
          </div>

          {/* Unassigned pool */}
          {unassigned.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Unassigned ({unassigned.length})</p>
              <div className={styles.pool}
                onDragOver={e => { e.preventDefault(); setDragOver('pool'); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, null)}
                style={{ borderColor: dragOver === 'pool' ? 'rgba(0,212,255,0.4)' : undefined }}>
                {unassigned.map(p => (
                  <div key={p.socketId} className={styles.chip}
                    draggable onDragStart={e => e.dataTransfer.setData('socketId', p.socketId)}>
                    {p.userName.slice(0,1).toUpperCase()}
                    <span>{p.userName}</span>
                  </div>
                ))}
                {unassigned.length === 0 && <span className={styles.emptyPool}>All assigned</span>}
              </div>
            </div>
          )}

          {/* Rooms */}
          <div className={styles.roomsList}>
            {rooms.map(room => (
              <div key={room.id} className={`${styles.roomCard} ${dragOver === room.id ? styles.dragTarget : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(room.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, room.id)}>
                <div className={styles.roomCardHeader}>
                  {nameEdit[room.id]
                    ? <input className={styles.nameInput} autoFocus value={room.name}
                        onChange={e => setRooms(r => r.map(rm => rm.id === room.id ? { ...rm, name: e.target.value } : rm))}
                        onBlur={() => setNameEdit(n => ({ ...n, [room.id]: false }))}
                        onKeyDown={e => e.key === 'Enter' && setNameEdit(n => ({ ...n, [room.id]: false }))} />
                    : <span className={styles.roomName} onClick={() => setNameEdit(n => ({ ...n, [room.id]: true }))}>{room.name} ✏️</span>
                  }
                  <div style={{display:'flex',gap:4}}>
                    <span className={styles.countBadge}>{room.participants.length}</span>
                    {rooms.length > 1 && <button className={styles.removeRoom} onClick={() => removeRoom(room.id)}>✕</button>}
                  </div>
                </div>
                <div className={styles.roomParticipants}>
                  {room.participants.map(sid => (
                    <div key={sid} className={styles.chip}
                      draggable onDragStart={e => e.dataTransfer.setData('socketId', sid)}>
                      {nameOf(sid).slice(0,1).toUpperCase()}
                      <span>{nameOf(sid)}</span>
                    </div>
                  ))}
                  {room.participants.length === 0 && <span className={styles.emptyPool}>Drag people here</span>}
                </div>
              </div>
            ))}
          </div>

          <button className={styles.startBtn} onClick={startBreakout}
            disabled={rooms.every(r => r.participants.length === 0)}>
            🚀 Open Breakout Rooms
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          {/* Active session */}
          <div className={styles.roomsList}>
            {rooms.map(r => (
              <div key={r.id} className={styles.roomCard}>
                <div className={styles.roomCardHeader}>
                  <span className={styles.roomName}>{r.name}</span>
                  <span className={styles.countBadge}>{r.participants.length}</span>
                </div>
                <div className={styles.roomParticipants}>
                  {r.participants.map(sid => (
                    <div key={sid} className={styles.chip}>
                      {nameOf(sid).slice(0,1).toUpperCase()}
                      <span>{nameOf(sid)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Broadcast */}
          <div className={styles.broadcastBox}>
            <p className={styles.sectionLabel}>Broadcast message</p>
            <div className={styles.broadcastRow}>
              <input className={styles.broadcastInput} placeholder="Message all rooms…"
                value={broadcastMsg} onChange={e => setBroadcast(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendBroadcast()} />
              <button className={styles.sendBtn} onClick={sendBroadcast}>Send</button>
            </div>
          </div>

          <div className={styles.endRow}>
            <button className={styles.callbackBtn} onClick={callBack}>📣 Call Everyone Back</button>
            <button className={styles.endBtn} onClick={endBreakout}>🏁 End Breakout</button>
          </div>
        </div>
      )}
    </div>
  );
}
