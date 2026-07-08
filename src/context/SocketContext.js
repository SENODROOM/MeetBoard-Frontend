import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRealtimeClient } from '../lib/realtimeClient';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

// Provides a socket.io-shaped client (emit/on/off/id) backed by Ably, so
// existing components don't need to change how they talk to it. No roomId
// here — this top-level provider is for cross-page use (e.g. presence
// outside a specific meeting room); Room.js creates its own room-scoped
// client directly via createRealtimeClient.
export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem('qm_userId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('qm_userId', id);
    }
    const s = createRealtimeClient({ userId: id, userName: localStorage.getItem('qm_userName') || '' });
    socketRef.current = s;

    s.on('connect', () => setConnected(true));

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
