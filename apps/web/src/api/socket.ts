import { io, type Socket } from "socket.io-client";
import { BACKEND_ORIGIN } from "./base";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  const opts = {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
  };
  socket = BACKEND_ORIGIN
    ? io(BACKEND_ORIGIN, opts)
    : io(window.location.origin, opts);
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
