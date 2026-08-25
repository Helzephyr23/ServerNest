"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

export default function UsersPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [passwordResets, setPasswordResets] = useState<Record<number, boolean>>({});
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  const fetchUsers = () => {
    api.get("/api/users")
      .then(({ users }) => setUsers(Array.isArray(users) ? users : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/users", form);
      setForm({ username: "", password: "", role: "user" });
      setShowAdd(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await api.put(`/api/users/${id}/role`, { role });
      success("Role updated");
      fetchUsers();
    } catch (err: any) {
      toastError("Failed to update role", err.message);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (await showConfirm({ title: "Delete User", message: `Delete user "${username}"? This cannot be undone.` })) {
      try {
        await api.delete(`/api/users/${id}`);
        success(`User "${username}" deleted`);
        fetchUsers();
      } catch (err: any) {
        toastError("Failed to delete user", err.message);
      }
    }
  };

  const handlePasswordReset = async (id: number) => {
    const password = resetPasswords[id];
    if (!password || password.length < 6) return;
    try {
      await api.put(`/api/users/${id}/password`, { password });
      success("Password reset");
      setPasswordResets({ ...passwordResets, [id]: false });
      setResetPasswords({ ...resetPasswords, [id]: "" });
      fetchUsers();
    } catch (err: any) {
      toastError("Failed to reset password", err.message);
    }
  };

  const adminCount = users.filter((u: any) => u.role === "admin").length;
  const operatorCount = users.filter((u: any) => u.role === "operator").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add User"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{users.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admins</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">{adminCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Operators</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{operatorCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Users</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{users.length - adminCount - operatorCount}</p></CardContent>
        </Card>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Add User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Min. 6 characters" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="role" value="user" checked={form.role === "user"} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                    User
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="role" value="admin" checked={form.role === "admin"} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                    Admin
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="role" value="operator" checked={form.role === "operator"} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                    Operator
                  </label>
                </div>
              </div>
              <Button type="submit">Create User</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">👤</span>
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Username</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                          {user.username?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.role === "admin" ? "bg-primary/10 text-primary" :
                          user.role === "operator" ? "bg-blue-500/10 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {user.role}
                        </span>
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="rounded border bg-background px-2 py-1 text-xs"
                        >
                          <option value="user">user</option>
                          <option value="operator">operator</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {passwordResets[user.id] ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="password"
                              placeholder="New password"
                              className="h-8 w-32 text-xs"
                              value={resetPasswords[user.id] || ""}
                              onChange={(e) => setResetPasswords({ ...resetPasswords, [user.id]: e.target.value })}
                            />
                            <Button size="sm" variant="outline" onClick={() => handlePasswordReset(user.id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setPasswordResets({ ...passwordResets, [user.id]: false })}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setPasswordResets({ ...passwordResets, [user.id]: true })}>
                            Reset Password
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id, user.username)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
