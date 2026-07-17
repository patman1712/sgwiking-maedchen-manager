import { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import BoardPage from "@/pages/BoardPage";
import BoardMailboxPage from "@/pages/BoardMailboxPage";
import DashboardHome from "@/pages/DashboardHome";
import DashboardLayout from "@/pages/DashboardLayout";
import FirstLoginPage from "@/pages/FirstLoginPage";
import Login from "@/pages/Login";
import MessagesPage from "@/pages/MessagesPage";
import PlayersPage from "@/pages/PlayersPage";
import PlayerEditPage from "@/pages/PlayerEditPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import TeamDetailPage from "@/pages/TeamDetailPage";
import TeamsPage from "@/pages/TeamsPage";
import TrainersPage from "@/pages/TrainersPage";
import { useAppStore } from "@/store";

const ensureHeadLink = (rel: string) => {
  let link = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  return link;
};

const ensureMeta = (name: string) => {
  let meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }

  return meta;
};

function AppHead() {
  const settings = useAppStore((state) => state.settings);
  const fetchData = useAppStore((state) => state.fetchData);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const clubName = settings.clubName || "SG Wiking Offenbach";
    const iconUrl = settings.logoUrl || "/favicon.svg";

    document.title = `${clubName} Vereinsmanager`;

    ensureHeadLink("icon").href = iconUrl;
    ensureHeadLink("shortcut icon").href = iconUrl;
    ensureHeadLink("apple-touch-icon").href = iconUrl;

    ensureMeta("theme-color").content = "#0b3ea8";
    ensureMeta("apple-mobile-web-app-capable").content = "yes";
    ensureMeta("apple-mobile-web-app-status-bar-style").content = "default";
    ensureMeta("apple-mobile-web-app-title").content = clubName;

    const manifest = {
      name: clubName,
      short_name: clubName,
      start_url: "/dashboard",
      display: "standalone",
      background_color: "#eef4ff",
      theme_color: "#0b3ea8",
      icons: [
        {
          src: iconUrl,
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    };

    const manifestLink = ensureHeadLink("manifest");
    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const previousManifestUrl = manifestLink.href.startsWith("blob:")
      ? manifestLink.href
      : null;
    manifestLink.href = manifestUrl;

    return () => {
      URL.revokeObjectURL(manifestUrl);

      if (previousManifestUrl) {
        URL.revokeObjectURL(previousManifestUrl);
      }
    };
  }, [settings.clubName, settings.logoUrl]);

  return null;
}

export default function App() {
  return (
    <Router>
      <AppHead />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowPendingOnboarding>
              <FirstLoginPage />
            </ProtectedRoute>
          }
        />
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
          <Route path="teams/:teamId/:section" element={<TeamDetailPage />} />
          <Route path="trainers" element={<TrainersPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:playerId" element={<PlayerEditPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="board/mailbox" element={<BoardMailboxPage />} />
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
