"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { io, Socket } from "socket.io-client";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export default function ConsolePage() {
  const params = useParams();
  const id = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [attached, setAttached] = useState(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initTerminal = useCallback(() => {
    if (termRef.current || !containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0a0a0a",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
        black: "#0a0a0a",
        red: "#f44747",
        green: "#6a9955",
        yellow: "#dcdcaa",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#4ec9b0",
        white: "#d4d4d4",
        brightBlack: "#808080",
        brightRed: "#f44747",
        brightGreen: "#6a9955",
        brightYellow: "#dcdcaa",
        brightBlue: "#569cd6",
        brightMagenta: "#c586c0",
        brightCyan: "#4ec9b0",
        brightWhite: "#d4d4d4",
      },
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Menlo, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║          Biryani Server Console          ║\x1b[0m");
    term.writeln("\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.writeln("\x1b[90mConnecting to server...\x1b[0m");

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    api.get(`/api/servers/${id}`).then(({ server: s }) => setServer(s));

    const token = localStorage.getItem("token");
    const socket = io(typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "http://localhost:3001",
    {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("console:subscribe", Number(id));
      socket.emit("console:attach", Number(id));
    });

    socket.on("console:attached", () => {
      setAttached(true);
      if (termRef.current) {
        termRef.current.writeln("\r\n\x1b[32m✓ Connected to server console\x1b[0m\r\n");
      }
    });

    socket.on("console:output", ({ data }: { data: string }) => {
      if (termRef.current) {
        const lines = data.split("\n");
        for (const line of lines) {
          termRef.current.writeln(line);
        }
      }
    });

    socket.on("console:error", ({ error }: { error: string }) => {
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[31m✗ Error: ${error}\x1b[0m`);
      }
    });

    socket.on("console:detached", () => {
      setAttached(false);
      if (termRef.current) {
        termRef.current.writeln("\r\n\x1b[33m⚠ Disconnected from server console\x1b[0m");
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setAttached(false);
    });

    return () => {
      socket.emit("console:unsubscribe", Number(id));
      socket.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (attached && termRef.current) {
      termRef.current.clear();
      termRef.current.writeln("\x1b[32m✓ Connected to server console\x1b[0m\r\n");
    }
  }, [attached]);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !attached || !socketRef.current) return;

    const disposable = term.onData((data: string) => {
      if (data === "\r") {
        socketRef.current!.emit("console:command", {
          serverId: Number(id),
          command: term.buffer.active.getLine(term.buffer.active.cursorY)?.translateToString(true) || "",
        });
      }
    });

    return () => disposable.dispose();
  }, [attached, id]);

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.emit("console:attach", Number(id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Console</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={`h-2 w-2 rounded-full ${connected && attached ? "bg-green-500" : connected ? "bg-yellow-500" : "bg-red-500"}`} />
            <span className="text-muted-foreground">
              {connected && attached ? "Connected" : connected ? "Connecting..." : "Disconnected"}
            </span>
          </div>
          {!attached && connected && (
            <Button variant="outline" size="sm" onClick={handleReconnect}>Reconnect</Button>
          )}
        </div>
      </div>

      {server?.status !== "running" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">🖥️</span>
            <p className="text-muted-foreground">Server is not running</p>
            <p className="text-xs text-muted-foreground">Start the server to access the console</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div
            ref={containerRef}
            className="h-[600px] w-full bg-[#0a0a0a]"
          />
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Type commands directly in the terminal. Press Enter to send. Uses Minecraft RCON for command execution.
      </p>
    </div>
  );
}
