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
import { useServer } from "@/lib/server-context";

export default function ConsolePage() {
  const params = useParams();
  const id = params.id as string;
  const { server } = useServer();
  const [connected, setConnected] = useState(false);
  const [attached, setAttached] = useState(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cmdBufferRef = useRef<string>("");

  const writePrompt = useCallback((term: Terminal) => {
    term.write("\r\n\x1b[36m>\x1b[0m ");
  }, []);

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
      cursorStyle: "block",
      cursorInactiveStyle: "bar",
      scrollback: 5000,
      allowProposedApi: true,
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║          Biryani Server Console          ║\x1b[0m");
    term.writeln("\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.write("\x1b[90mConnecting to server...\x1b[0m");

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("biryani_token");
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
        termRef.current.writeln("\r\n\x1b[32m✓ Connected to server console\x1b[0m");
        writePrompt(termRef.current);
      }
    });

    socket.on("console:output", ({ data }: { data: string }) => {
      if (!termRef.current) return;
      const term = termRef.current;
      const bufLen = cmdBufferRef.current.length;
      if (bufLen > 0) {
        term.write("\r" + " ".repeat(2 + bufLen) + "\r");
      }
      const lines = data.split("\n");
      for (const line of lines) {
        term.writeln(line);
      }
      if (bufLen > 0) {
        term.write("\x1b[36m>\x1b[0m " + cmdBufferRef.current);
      }
    });

    socket.on("console:error", ({ error }: { error: string }) => {
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[31m✗ Error: ${error}\x1b[0m`);
        writePrompt(termRef.current);
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
  }, [id, writePrompt]);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal, server?.status]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !socketRef.current) return;

    const disposable = term.onData((data: string) => {
      if (!attached) return;

      if (data === "\r") {
        const cmd = cmdBufferRef.current;
        cmdBufferRef.current = "";
        socketRef.current!.emit("console:command", {
          serverId: Number(id),
          command: cmd,
        });
      } else if (data === "\x7f" || data === "\b") {
        if (cmdBufferRef.current.length > 0) {
          cmdBufferRef.current = cmdBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\x03") {
        cmdBufferRef.current = "";
        term.write("^C");
        writePrompt(term);
      } else if (data >= " ") {
        cmdBufferRef.current += data;
        term.write(data);
      }
    });

    return () => disposable.dispose();
  }, [attached, id, writePrompt]);

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
            className="relative h-[600px] w-full bg-[#0a0a0a]"
          />
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Type commands in the terminal and press Enter to execute. Ctrl+C to cancel input.
      </p>
    </div>
  );
}
