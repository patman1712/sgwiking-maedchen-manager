import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import BoardPage from "@/pages/BoardPage";
import DashboardHome from "@/pages/DashboardHome";
import DashboardLayout from "@/pages/DashboardLayout";
import Login from "@/pages/Login";
import MessagesPage from "@/pages/MessagesPage";
import PlayersPage from "@/pages/PlayersPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import TeamDetailPage from "@/pages/TeamDetailPage";
import TeamsPage from "@/pages/TeamsPage";
import TrainersPage from "@/pages/TrainersPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="trainers" element={<TrainersPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="users" element={<Navigate to="/dashboard/trainers" replace />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
