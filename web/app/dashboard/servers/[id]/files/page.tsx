"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  date: string;
  path: string;
}

export default function FilesPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const id = params.id as string;
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { server } = useServer();

  const fetchFiles = (path: string = "") => {
    setLoading(true);
    api.get(`/api/servers/${id}/files?path=${encodeURIComponent(path)}`)
      .then(({ entries: e, currentPath: cp }) => {
        setEntries(Array.isArray(e) ? e : []);
        setCurrentPath(typeof cp === "string" ? cp : "");
      })
      .catch(() => { setEntries([]); setCurrentPath(""); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFiles(); }, [id]);

  useEffect(() => { if (server?.status) fetchFiles(); }, [server?.status]);

  const navigate = (entry: FileEntry) => {
    if (entry.isDir) {
      fetchFiles(entry.path);
    } else {
      openFile(entry.path);
    }
  };

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    fetchFiles(parts.join("/"));
  };

  const openFile = async (filePath: string) => {
    try {
      const { content } = await api.get(`/api/servers/${id}/files/content?path=${encodeURIComponent(filePath)}`);
      setEditing(filePath);
      setEditContent(content);
    } catch (err: any) {
      toastError("Cannot open file", err.message);
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/servers/${id}/files/content`, { path: editing, content: editContent });
      success("File saved");
      fetchFiles(currentPath);
    } catch (err: any) {
      toastError("Save failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  const createDir = async () => {
    if (!newDirName.trim()) return;
    const dirPath = currentPath ? `${currentPath}/${newDirName.trim()}` : newDirName.trim();
    try {
      await api.post(`/api/servers/${id}/files/mkdir`, { path: dirPath });
      setNewDirName("");
      setShowMkdir(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      toastError("Failed to create folder", err.message);
    }
  };

  const uploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.upload(`/api/servers/${id}/files/upload?path=${encodeURIComponent(currentPath)}`, file);
      success(`Uploaded ${file.name}`);
      fetchFiles(currentPath);
    } catch (err: any) {
      toastError("Upload failed", err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteFile = async (filePath: string, name: string) => {
    if (!(await showConfirm({ title: "Delete File", message: `Delete "${name}"?` }))) return;
    try {
      await api.delete(`/api/servers/${id}/files?path=${encodeURIComponent(filePath)}`);
      fetchFiles(currentPath);
    } catch (err: any) {
      toastError("Failed to delete", err.message);
    }
  };

  const pathParts = currentPath.split("/").filter(Boolean);

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Editing File</h2>
            <p className="text-sm text-muted-foreground font-mono">{editing}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveFile} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full h-[500px] rounded-lg border bg-black/30 p-4 font-mono text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-ring"
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">File Manager</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMkdir(!showMkdir)}>
            {showMkdir ? "Cancel" : "New Folder"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchFiles(currentPath)}>Refresh</Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={uploadFiles}
          className="hidden"
        />
      </div>

      {showMkdir && (
        <div className="flex gap-2">
          <Input value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="Folder name" />
          <Button onClick={createDir}>Create</Button>
        </div>
      )}

      <div className="flex items-center gap-1 text-sm">
        <button onClick={() => fetchFiles("")} className="text-primary hover:underline">/</button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground">/</span>
            <button
              onClick={() => fetchFiles(pathParts.slice(0, i + 1).join("/"))}
              className="text-primary hover:underline"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {currentPath && (
        <Button variant="ghost" size="sm" onClick={goUp}>
          .. Back
        </Button>
      )}

      <Input
        value={fileSearch}
        onChange={(e) => setFileSearch(e.target.value)}
        placeholder="Search files..."
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : server && server.status !== "running" ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">▶</span>
            <p className="text-muted-foreground">Start the server to browse files</p>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">📁</span>
            <p className="text-muted-foreground">Empty folder</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {(fileSearch ? entries.filter((e) => e.name.toLowerCase().includes(fileSearch.toLowerCase())) : entries).map((entry) => (
            <div
              key={entry.path}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent cursor-pointer"
              onClick={() => navigate(entry)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{entry.isDir ? "📁" : "📄"}</span>
                <div>
                  <p className="font-medium">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.isDir ? "Folder" : `${formatBytes(entry.size)}`} &middot; {entry.date}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); deleteFile(entry.path, entry.name); }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
