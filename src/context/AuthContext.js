import React, { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("qm_auth");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((token, userData) => {
    const auth = { token, ...userData };
    localStorage.setItem("qm_auth", JSON.stringify(auth));
    setUser(auth);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("qm_auth");
    setUser(null);
  }, []);

  // Attach token to every classroom API fetch automatically
  const authFetch = useCallback(
    (url, options = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
      });
    },
    [user?.token],
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
