import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useRealtimeStore } from "../stores/realtimeStore";
import type { MetricsUpdate, AlertEvent } from "../api/types";

/**
 * Connects to the Socket.IO server, subscribes to all node updates,
 * and feeds incoming data into the realtime store.
 * Should be mounted once at the app root.
 */
export function useSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const { pushMetrics, pushAlertEvent, setConnected } = useRealtimeStore();

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe:all");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("metrics:update", (data: MetricsUpdate) => {
      pushMetrics(data);
    });

    socket.on("alert:triggered", (data: AlertEvent) => {
      pushAlertEvent(data);
    });

    socket.on("alert:resolved", (data: AlertEvent) => {
      pushAlertEvent({ ...data, message: `Resolved: ${data.message}` });
    });

    return () => {
      socket.disconnect();
    };
  }, [pushMetrics, pushAlertEvent, setConnected]);
}
