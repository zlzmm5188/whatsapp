import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  socket = io({
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
  });
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
