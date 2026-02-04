import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "./components/layout/MainLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { NodesPage } from "./pages/NodesPage";
import { NodeDetailPage } from "./pages/NodeDetailPage";
import { AlertsPage } from "./pages/AlertsPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useSocket } from "./hooks/useSocket";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** Socket.IO connector — mounts once at app root */
function SocketConnector() {
  useSocket();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketConnector />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="nodes" element={<NodesPage />} />
            <Route path="nodes/:id" element={<NodeDetailPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="comparison" element={<ComparisonPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
