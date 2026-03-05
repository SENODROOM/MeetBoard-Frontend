import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import ClassroomDashboard from './pages/classroom/ClassroomDashboard';
import ClassroomPage from './pages/classroom/ClassroomPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"                        element={<Home />} />
        <Route path="/room/:roomId"            element={<Room />} />
        <Route path="/classrooms"              element={<ClassroomDashboard />} />
        <Route path="/classroom/:classroomId"  element={<ClassroomPage />} />
      </Routes>
    </Router>
  );
}

export default App;
