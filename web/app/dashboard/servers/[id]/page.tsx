"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const { server } = useServer();

  const handleDelete = async () => {
    if (!(await showConfirm({ title: "Delete Server", message: `Delete server "${server?.name}"? This will remove all data and cannot be undone.` }))) return;
    try {
      await api.delete(`/api/servers/${id}`);
      router.push("/dashboard/servers");
    } catch (err: any) {
      toastError("Failed to delete server", err.message);
    }
  };

  if (!server) return null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                server.status === "running" ? "bg-green-500 animate-pulse" :
                server.status === "starting" ? "bg-yellow-500 animate-pulse" :
                server.status === "error" ? "bg-red-500 animate-pulse" :
                "bg-zinc-500"
              }`} />
              <span className={`text-lg font-bold ${
                server.status === "running" ? "text-green-500" :
                server.status === "starting" ? "text-yellow-500" :
                server.status === "error" ? "text-red-500" :
                "text-zinc-400"
              }`}>{server.status}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Port</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{server.port}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Memory</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{server.ram_mb >= 1024 ? `${server.ram_mb / 1024} GB` : `${server.ram_mb} MB`}</p></CardContent>
        </Card>
      </div>

      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>Delete Server</Button>
        </CardContent>
      </Card>
    </>
  );
}
