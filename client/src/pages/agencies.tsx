import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Users, Phone, Crown, Trash2 } from "lucide-react";

export default function AgenciesPage() {
  const [, setLocation] = useLocation();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<any>(null);

  const [form, setForm] = useState({ name: "", plan: "BASIC", leadLimit: "500", userLimit: "10" });
  const [adminForm, setAdminForm] = useState({ username: "", password: "", fullName: "", email: "" });

  const { data: agencies, isLoading } = useQuery({
    queryKey: ["/api/agencies"],
    queryFn: () => apiFetch("/api/agencies"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/agencies", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        plan: form.plan,
        leadLimit: parseInt(form.leadLimit),
        userLimit: parseInt(form.userLimit),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      setOpen(false);
      setForm({ name: "", plan: "BASIC", leadLimit: "500", userLimit: "10" });
      toast({ title: "Agency created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/agencies/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({ title: "Agency updated" });
    },
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agencies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({ title: "Agency deleted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createAdminMutation = useMutation({
    mutationFn: () => apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        ...adminForm,
        role: "AGENCY_ADMIN",
        agencyCode: selectedAgency?.agencyCode,
      }),
    }),
    onSuccess: () => {
      setAdminOpen(false);
      setAdminForm({ username: "", password: "", fullName: "", email: "" });
      toast({ title: "Agency Admin created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const planColors: Record<string, string> = {
    BASIC: "bg-muted text-foreground",
    PRO: "bg-chart-2 text-white dark:text-white",
    ENTERPRISE: "bg-chart-1 text-white dark:text-white",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Agencies</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all registered agencies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-agency">
              <Plus className="w-4 h-4 mr-2" />
              Create Agency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agency</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Agency Name</Label>
                <Input
                  data-testid="input-agency-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter agency name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger data-testid="select-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lead Limit</Label>
                  <Input
                    type="number"
                    data-testid="input-lead-limit"
                    value={form.leadLimit}
                    onChange={(e) => setForm({ ...form, leadLimit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>User Limit</Label>
                  <Input
                    type="number"
                    data-testid="input-user-limit"
                    value={form.userLimit}
                    onChange={(e) => setForm({ ...form, userLimit: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-agency">
                {createMutation.isPending ? "Creating..." : "Create Agency"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {agencies?.map((agency: any) => (
          <Card key={agency.id} data-testid={`card-agency-${agency.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{agency.name}</h3>
                      <Badge variant="secondary" className="text-xs">{agency.agencyCode}</Badge>
                      <Badge className={`text-[10px] ${planColors[agency.plan]}`}>{agency.plan}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {agency.leadLimit} leads max
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {agency.userLimit} users max
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setSelectedAgency(agency); setAdminOpen(true); }}
                    data-testid={`button-add-admin-${agency.id}`}
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    Add Admin
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm(`Delete agency "${agency.name}" and all its data? This cannot be undone.`)) deleteAgencyMutation.mutate(agency.id); }}
                    data-testid={`button-delete-agency-${agency.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{agency.isActive ? "Active" : "Inactive"}</span>
                    <Switch
                      checked={agency.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: agency.id, isActive: checked })}
                      data-testid={`switch-agency-${agency.id}`}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!agencies || agencies.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No agencies yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first agency to get started</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Agency Admin for {selectedAgency?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createAdminMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                data-testid="input-admin-fullname"
                value={adminForm.fullName}
                onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                data-testid="input-admin-email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                data-testid="input-admin-username"
                value={adminForm.username}
                onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                data-testid="input-admin-password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={createAdminMutation.isPending} data-testid="button-submit-admin">
              {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
