"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function BackupsPage() {
<<<<<<< Updated upstream
=======
  const params = useParams();
  const id = params.id as string;
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [server, setServer] = useState<any>(null);

  const fetchBackups = () => {
    Promise.all([
      api.get(`/api/servers/${id}/backups`),
      api.get(`/api/servers/${id}`),
    ]).then(([{ backups: b }, { server: s }]) => {
      setBackups(Array.isArray(b) ? b : []);
      setServer(s || null);
    }).catch(() => {
      setBackups([]);
      setServer(null);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, [id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post(`/api/servers/${id}/backups`);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId: number) => {
    if (!confirm("Restore this backup? The server will restart.")) return;
    try {
      await api.post(`/api/servers/${id}/backups/${backupId}/restore`);
      alert("Backup restored! Server is restarting.");
    } catch (err: any) {
      alert(err.message || "Failed to restore backup");
    }
  };

  const handleDelete = async (backupId: number) => {
    if (!confirm("Delete this backup permanently?")) return;
    try {
      await api.delete(`/api/backups/${backupId}`);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || "Failed to delete backup");
    }
  };

>>>>>>> Stashed changes
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Backups</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">💾</span>
          <p className="text-muted-foreground">Backup management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
