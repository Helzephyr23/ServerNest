"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("biryani_token");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
    socket = io(API_URL, { auth: { token } });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
