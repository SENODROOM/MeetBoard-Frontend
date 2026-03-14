import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoomErrorBoundary from "./components/RoomErrorBoundary";
import Home from "./pages/Home";
import Room from "./pages/Room";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ClassroomDashboard from "./pages/classroom/ClassroomDashboard";
import ClassroomPage from "./pages/classroom/ClassroomPage";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Room wrapped in error boundary — crash shows rejoin button, not blank screen */}
          <Route
            path="/room/:roomId"
            element={
              <RoomErrorBoundary>
                <Room />
              </RoomErrorBoundary>
            }
          />

          <Route
            path="/classrooms"
            element={
              <ProtectedRoute>
                <ClassroomDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/classroom/:classroomId"
            element={
              <ProtectedRoute>
                <ClassroomPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
