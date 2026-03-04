import React, { useState } from 'react';
import styles from './SettingsPanel.module.css';

export default function SettingsPanel({ peers, socket, roomId, isHost, onClose, wbPermissions, onWbPermChange }) {
  const [tab, setTab] = useState('participants'); // participants | room | advanced

  const emit = (ev, data) => socket?.emit(ev, { roomId, ...data });

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>⚙️ Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {['participants','room','advanced'].map(t => (
            <button key={t} className={`${styles.tab} ${tab===t ? styles.tabActive:''}`}
              onClick={() => setTab(t)}>
              {t === 'participants' ? '👥 Participants' : t === 'room' ? '🏠 Room' : '⚡ Advanced'}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {/* ── Participants tab ── */}
          {tab === 'participants' && (
            <div className={styles.section}>
              {isHost && (
                <div className={styles.hostActions}>
                  <span className={styles.sectionLabel}>Host actions</span>
                  <div className={styles.bulkBtns}>
                    <button className={styles.bulkBtn} onClick={() => emit('host-mute-all')}>
                      🔇 Mute everyone
                    </button>
                    <button className={styles.bulkBtn} onClick={() => emit('host-lower-all-hands')}>
                      ✋ Lower all hands
                    </button>
                  </div>
                </div>
              )}

              <span className={styles.sectionLabel}>In this call</span>
              {peers.length === 0 && (
                <p className={styles.empty}>No other participants yet.</p>
              )}
              {peers.map((p) => (
                <div key={p.socketId} className={styles.peerRow}>
                  <div className={styles.peerInfo}>
                    <div className={styles.peerAvatar}>{p.userName?.[0]?.toUpperCase() || '?'}</div>
                    <div className={styles.peerMeta}>
                      <span className={styles.peerName}>{p.userName}</span>
                      <span className={styles.peerStatus}>
                        {p.handRaised ? '✋ Hand raised · ' : ''}
                        {p.audioMuted ? '🔇 Muted' : '🎙️ Live'} · {p.videoStopped ? '📵 No video' : '📷 Video on'}
                      </span>
                    </div>
                  </div>
                  {isHost && (
                    <div className={styles.peerControls}>
                      <button className={styles.iconBtn} title="Mute"
                        onClick={() => emit('host-mute-user', { targetSocketId: p.socketId })}>
                        🔇
                      </button>
                      <button className={styles.iconBtn} title="Stop video"
                        onClick={() => emit('host-stop-video', { targetSocketId: p.socketId })}>
                        📵
                      </button>
                      <button
                        className={`${styles.wbBtn} ${wbPermissions[p.socketId] === false ? styles.wbOff : styles.wbOn}`}
                        title="Toggle whiteboard access"
                        onClick={() => {
                          const allowed = wbPermissions[p.socketId] !== false;
                          onWbPermChange(p.socketId, !allowed);
                          emit('host-wb-permission', { targetSocketId: p.socketId, allowed: !allowed });
                        }}>
                        {wbPermissions[p.socketId] === false ? '⬜ WB off' : '⬜ WB on'}
                      </button>
                      <button className={`${styles.iconBtn} ${styles.kickBtn}`} title="Remove"
                        onClick={() => emit('kick-user', { targetSocketId: p.socketId })}>
                        🚫
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Room tab ── */}
          {tab === 'room' && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Room info</span>
              <div className={styles.infoRow}>
                <span>Room ID</span>
                <code className={styles.code}>{roomId}</code>
              </div>
              <div className={styles.infoRow}>
                <span>Link</span>
                <button className={styles.copyLinkBtn}
                  onClick={() => navigator.clipboard.writeText(window.location.href)}>
                  📋 Copy invite link
                </button>
              </div>
              <div className={styles.infoRow}>
                <span>Participants</span>
                <span className={styles.badge}>{peers.length + 1}</span>
              </div>
            </div>
          )}

          {/* ── Advanced tab ── */}
          {tab === 'advanced' && (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>Keyboard shortcuts</span>
              {[
                ['Ctrl+Z / Cmd+Z', 'Undo (whiteboard)'],
                ['Ctrl+Y / Cmd+Y', 'Redo (whiteboard)'],
                ['P', 'Switch to pen'],
                ['E', 'Switch to eraser'],
                ['Delete / Backspace', 'Delete selected image'],
                ['Ctrl+V', 'Paste image into whiteboard'],
              ].map(([key, desc]) => (
                <div key={key} className={styles.shortcutRow}>
                  <code className={styles.kbd}>{key}</code>
                  <span>{desc}</span>
                </div>
              ))}

              <span className={styles.sectionLabel} style={{marginTop: 16}}>About</span>
              <div className={styles.about}>
                <span className={styles.aboutLogo}>⬡ QuantumMeet</span>
                <p>WebRTC · Socket.io · React · Node.js</p>
                <p>End-to-end encrypted peer connections via STUN/TURN.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
