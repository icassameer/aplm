import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Plus, Mail, Shield, KeyRound, Phone, Trash2 } from "lucide-react";

const roleLabels: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  AGENCY_ADMIN: "Agency Admin",
  TEAM_LEADER: "Team Leader",
  TELE_CALLER: "Telecaller",
};

const roleColors: Record<string, string> = {
  MASTER_ADMIN: "bg-chart-1 text-white dark:text-white",
  AGENCY_ADMIN: "bg-chart-2 text-white dark:text-white",
  TEAM_LEADER: "bg-chart-4 text-white dark:text-white",
  TELE_CALLER: "bg-chart-5 text-white dark:text-white",
};

export default function UsersPage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [agencyFilter, setAgencyFilter] = useState("ALL");
  const [form, setForm] = useState({
    username: "", password: "", fullName: "", email: "", mobile: "", role: "TELE_CALLER"
  });

  const { data: agencies } = useQuery({
    queryKey: ["/api/agencies"],
    queryFn: () => apiFetch("/api/agencies"),
    enabled: user?.role === "MASTER_ADMIN",
  });

  const { data: userList, isLoading } = useQuery({
    queryKey: ["/api/users", agencyFilter],
    queryFn: () => apiFetch(`/api/users${agencyFilter !== "ALL" ? `?agency=${agencyFilter}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      setForm({ username: "", password: "", fullName: "", email: "", mobile: "", role: "TELE_CALLER" });
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive, status: isActive ? "ACTIVE" : "INACTIVE" }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return;
    setResetLoading(true);
    try {
      const res = await fetch("/api/users/admin-reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: resetUser.id, newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: "Success", description: "Password reset successfully" });
      setResetOpen(false);
      setNewPassword("");
      setResetUser(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const allowedRoles = user?.role === "MASTER_ADMIN"
    ? ["AGENCY_ADMIN"]
    : user?.role === "AGENCY_ADMIN"
      ? ["TEAM_LEADER", "TELE_CALLER"]
      : ["TELE_CALLER"];

  const canResetPassword = ["MASTER_ADMIN", "AGENCY_ADMIN", "TEAM_LEADER"].includes(user?.role || "");
  const canCreate = ["MASTER_ADMIN", "AGENCY_ADMIN"].includes(user?.role || "");

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your agency's team</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === "MASTER_ADMIN" && agencies && agencies.length > 0 && (
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-agency-filter">
                <SelectValue placeholder="All Agencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Agencies</SelectItem>
                {agencies.map((a: any) => (
                  <SelectItem key={a.agencyCode} value={a.agencyCode}>{a.name} ({a.agencyCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input data-testid="input-user-fullname" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" data-testid="input-user-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input type="tel" data-testid="input-user-mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile number" />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input data-testid="input-user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" data-testid="input-user-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                {user?.role === "MASTER_ADMIN" && (
                  <div className="space-y-2">
                    <Label>Agency Code</Label>
                    <Input data-testid="input-user-agency-code" value={(form as any).agencyCode || ""} onChange={(e) => setForm({ ...form, agencyCode: e.target.value } as any)} required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allowedRoles.map(r => (
                        <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-user">
                  {createMutation.isPending ? "Creating..." : "Add Member"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid gap-3">
        {userList?.map((u: any) => (
          <Card key={u.id} data-testid={`card-user-${u.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {u.fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{u.fullName}</p>
                      <Badge className={`text-[10px] ${roleColors[u.role] || ""}`}>{roleLabels[u.role] || u.role}</Badge>
                      {u.status === "PENDING_APPROVAL" && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{u.username}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</span>
                      {u.mobile && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{u.mobile}</span>
                      )}
                      {u.agencyCode && <span className="text-[10px]">{u.agencyCode}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canResetPassword && u.id !== user?.id && u.role !== "MASTER_ADMIN" && (
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => { setResetUser(u); setNewPassword(""); setResetOpen(true); }}
                      title="Reset Password"
                      data-testid={`button-reset-password-${u.id}`}
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                  )}
                  {user?.role === "MASTER_ADMIN" && u.role !== "MASTER_ADMIN" && (
                    <Button
                      variant="destructive" size="sm"
                      onClick={() => { if (confirm(`Delete user "${u.fullName}"? This will also remove their assigned leads and data.`)) deleteUserMutation.mutate(u.id); }}
                      data-testid={`button-delete-user-${u.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">{u.isActive ? "Active" : "Inactive"}</span>
                  <Switch
                    checked={u.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: u.id, isActive: checked })}
                    data-testid={`switch-user-${u.id}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!userList || userList.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No team members</h3>
            <p className="text-sm text-muted-foreground mt-1">Add your first team member to get started</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password: {resetUser?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                data-testid="input-reset-password"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleResetPassword}
              disabled={resetLoading || newPassword.length < 6}
              data-testid="button-confirm-reset"
            >
              {resetLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
