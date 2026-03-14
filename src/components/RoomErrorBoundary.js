import React from "react";

export default class RoomErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[RoomErrorBoundary] crashed:", error, info);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#020509",
          color: "#eef4ff",
          textAlign: "center",
          padding: 24,
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <span style={{ fontSize: 52 }}>⚠️</span>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            margin: 0,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "#7a95b8",
            maxWidth: 380,
            lineHeight: 1.6,
            margin: 0,
            fontSize: 14,
          }}
        >
          A component crashed unexpectedly. Your call may still be active for
          other participants.
        </p>
        {this.state.error && (
          <code
            style={{
              fontSize: 11,
              color: "#475569",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "8px 14px",
              maxWidth: 480,
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </code>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 28px",
              background: "rgba(0,229,255,0.12)",
              border: "1px solid rgba(0,229,255,0.3)",
              color: "#00e5ff",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            🔄 Rejoin Meeting
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "12px 28px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            ← Go Home
          </button>
        </div>
      </div>
    );
  }
}
