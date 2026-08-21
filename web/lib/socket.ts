"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Optional override for setups where the API lives on a different origin
    // (e.g. dev server on :3000, API on :3001). Empty = same origin.
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";
    socket = io(SOCKET_URL, { withCredentials: true });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
