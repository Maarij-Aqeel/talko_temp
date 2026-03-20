import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Logout from "./pages/Logout"; // Make sure this is imported
import ProtectedRoute from "./components/ProtectedRoute"; // Import the bouncer
import DailyPen from "./pages/DailyPen";
import Tuesday_talko from "./pages/Tuesday_talko";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public Routes (Anyone can see these) --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<Logout />} />

        {/* --- Protected Routes (Must be logged in) --- */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

      {/* Tuesday Talko */}
        <Route path="/tuesday_talko" element={
          <ProtectedRoute>
            <Tuesday_talko/>
          </ProtectedRoute>
        }/>
        {/* Daily-Pen tool */}
        <Route path="/dailypen" element={
          <ProtectedRoute>
            <DailyPen/>
          </ProtectedRoute>
        }/>

        {/* Catch-all: If they type a random URL, send them to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
