"use client";

import * as React from "react";
import { Loader2, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Source {
  url: string;
  title: string;
  description: string;
  type: string;
  branch: string;
  paths: string[];
}

export default function AdminPage() {
  const [sources, setSources] = React.useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState("");

  React.useEffect(() => {
    fetch("/api/admin/sources")
      .then((r) => r.json())
      .then((data) => setSources(Array.isArray(data) ? data : []))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/admin/sync", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(data.message || "Sync completed successfully.");
      } else {
        setSyncMessage(data.error || "Sync failed.");
      }
    } catch {
      setSyncMessage("Network error - sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage content sources and trigger syncs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {syncMessage && (
        <p className="mb-4 text-sm text-muted-foreground">{syncMessage}</p>
      )}

      <Separator className="mb-6" />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Content Sources</h2>
        {loadingSources ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading sources...</span>
          </div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No sources configured.</p>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {sources.map((source, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{source.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {source.description}
                    </p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-2 block"
                    >
                      {source.url}
                    </a>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Branch: {source.branch}</span>
                      <span>Type: {source.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
