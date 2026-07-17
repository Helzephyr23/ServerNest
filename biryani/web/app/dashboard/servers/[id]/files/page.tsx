"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FilesPage() {
<<<<<<< Updated upstream
=======
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
      alert("Cannot open file: " + err.message);
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/servers/${id}/files/content`, { path: editing, content: editContent });
      setEditing(null);
      fetchFiles(currentPath);
    } catch (err: any) {
      alert("Save failed: " + err.message);
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
      alert(err.message);
    }
  };

  const deleteFile = async (filePath: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/api/servers/${id}/files?path=${encodeURIComponent(filePath)}`);
      fetchFiles(currentPath);
    } catch (err: any) {
      alert(err.message);
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

>>>>>>> Stashed changes
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">File Manager</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">📁</span>
          <p className="text-muted-foreground">File manager coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
