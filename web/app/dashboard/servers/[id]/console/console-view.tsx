"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { useServer } from "@/lib/server-context";

export default function ConsoleView() {
  const params = useParams();
  const id = params.id as string;
  const { server } = useServer();
  const [connected, setConnected] = useState(false);
  const [attached, setAttached] = useState(false);
  const attachedRef = useRef(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cmdBufferRef = useRef<string>("");
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

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
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    term.writeln("\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m");
    term.writeln("\x1b[1;36m║          ServerNest Server Console          ║\x1b[0m");
    term.writeln("\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m");
    term.writeln("");
    term.write("\x1b[90mConnecting to server...\x1b[0m");

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const socket = getSocket() as Socket;
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      socket.emit("console:subscribe", Number(id));
      socket.emit("console:attach", Number(id));
    };

    const handleAttached = () => {
      setAttached(true);
      if (termRef.current) {
        termRef.current.writeln("\r\n\x1b[32m✓ Connected to server console\x1b[0m");
        writePrompt(termRef.current);
      }
    };

    const handleOutput = ({ data }: { data: string }) => {
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
    };

    const handleError = ({ error }: { error: string }) => {
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[31m✗ Error: ${error}\x1b[0m`);
        writePrompt(termRef.current);
      }
    };

    const handleDetached = () => {
      setAttached(false);
      if (termRef.current) {
        termRef.current.writeln("\r\n\x1b[33m⚠ Disconnected from server console\x1b[0m");
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      setAttached(false);
    };

    socket.on("connect", handleConnect);
    socket.on("console:attached", handleAttached);
    socket.on("console:output", handleOutput);
    socket.on("console:error", handleError);
    socket.on("console:detached", handleDetached);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("console:attached", handleAttached);
      socket.off("console:output", handleOutput);
      socket.off("console:error", handleError);
      socket.off("console:detached", handleDetached);
      socket.off("disconnect", handleDisconnect);
      socket.emit("console:unsubscribe", Number(id));
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [id, writePrompt]);

  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal, server?.status]);

  useEffect(() => {
    attachedRef.current = attached;
  }, [attached]);

  useEffect(() => {
    if (server?.status === "running" && socketRef.current?.connected && !attachedRef.current) {
      socketRef.current.emit("console:attach", Number(id));
    }
  }, [server?.status, id]);

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

  const handleSearch = () => {
    if (!searchAddonRef.current || !searchQuery.trim()) return;
    searchAddonRef.current.findNext(searchQuery);
  };

  const handleSearchPrev = () => {
    if (!searchAddonRef.current || !searchQuery.trim()) return;
    searchAddonRef.current.findPrevious(searchQuery);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    } else if (e.key === "Escape") {
      setShowSearch(false);
      setSearchQuery("");
      searchAddonRef.current?.clearDecorations();
    }
  };

  const handleDownloadLog = () => {
    const term = termRef.current;
    if (!term) return;
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `server-${id}-console-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    termRef.current?.clear();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Console</h2>
        <div className="flex items-center gap-2">
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

      {showSearch && (
        <div className="flex items-center gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search in console..."
            className="max-w-xs"
            autoFocus
          />
          <Button variant="outline" size="sm" onClick={handleSearch} disabled={!searchQuery.trim()}>Next</Button>
          <Button variant="outline" size="sm" onClick={handleSearchPrev} disabled={!searchQuery.trim()}>Prev</Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearchQuery(""); searchAddonRef.current?.clearDecorations(); }}>
            Close
          </Button>
        </div>
      )}

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

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)}>
          {showSearch ? "Hide Search" : "Search"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadLog}>
          Download Log
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
