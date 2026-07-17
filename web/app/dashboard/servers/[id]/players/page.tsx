"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function PlayersPage() {
<<<<<<< Updated upstream
=======
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<Tab>("whitelist");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const [server, setServer] = useState<any>(null);

  const fetchPlayers = () => {
    setLoading(true);
    Promise.all([
      api.get(`/api/servers/${id}/players/${tab}`),
      api.get(`/api/servers/${id}`),
    ]).then(([{ players: p }, { server: s }]) => {
      setPlayers(Array.isArray(p) ? p : []);
      setServer(s || null);
    }).catch(() => {
      setPlayers([]);
      setServer(null);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlayers(); }, [id, tab]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      if (tab === "bans") {
        await api.post(`/api/servers/${id}/players/bans`, { name: newName.trim(), reason: reason.trim() || undefined });
      } else {
        await api.post(`/api/servers/${id}/players/${tab}`, { name: newName.trim() });
      }
      setNewName("");
      setReason("");
      fetchPlayers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await api.delete(`/api/servers/${id}/players/${tab}/${name}`);
      fetchPlayers();
    } catch (err: any) {
      alert(err.message);
    }
  };

>>>>>>> Stashed changes
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Player Management</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">👥</span>
          <p className="text-muted-foreground">Player management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
