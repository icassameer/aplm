import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Building2, Plus, Users, Phone, Crown, Trash2, Settings2, Calendar, ChevronLeft, ChevronRight, Mail, FileText } from "lucide-react";

const LIMIT = 20;

export default function AgenciesPage() {
  const [, setLocation] = useLocation();
  const { apiFetch } = useApi();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [prospectOpen, setProspectOpen] = useState(false);
  const [prospectForm, setProspectForm] = useState({ name: "", email: "" });
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateAgency, setActivateAgency] = useState<any>(null);
  const [activateDays, setActivateDays] = useState("30");
  const [activatePlan, setActivatePlan] = useState("BASIC");
  const [activateLoading, setActivateLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ businessProfile: "", businessServices: "" });
  const [selectedAgency, setSelectedAgency] = useState<any>(null);
  const [editForm, setEditForm] = useState({ leadLimit: "", userLimit: "", plan: "" });
  const [form, setForm] = useState({ name: "", plan: "BASIC", leadLimit: "500", userLimit: "10" });
  const [adminForm, setAdminForm] = useState({ username: "", password: "", fullName: "", email: "" });

  const handleActivate = async () => {
    if (!activateAgency) return;
    setActivateLoading(true);
    try {
      const res = await fetch("/api/subscription/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agencyCode: activateAgency.agencyCode, days: parseInt(activateDays), plan: activatePlan }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Subscription activated!", description: `${activateAgency.name} active for ${activateDays} days on ${activatePlan} plan` });
        setActivateOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to activate", variant: "destructive" });
    }
    setActivateLoading(false);
  };

  const prospectMutation = useMutation({
    mutationFn: () => apiFetch("/api/email/prospect", {
      method: "POST",
      body: JSON.stringify({ to: prospectForm.email, name: prospectForm.name }),
    }),
    onSuccess: () => {
      setProspectOpen(false);
      setProspectForm({ name: "", email: "" });
      toast({ title: "Prospect email sent!", description: `Email sent to ${prospectForm.name}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: agencyData, isLoading } = useQuery({
    queryKey: ["/api/agencies", page],
    queryFn: () => apiFetch(`/api/agencies?page=${page}&limit=${LIMIT}`),
  });

  // Support both paginated { data, total } and legacy flat array response
  const agencies: any[] = Array.isArray(agencyData) ? agencyData : (agencyData?.data ?? agencyData ?? []);
  const total: number = agencyData?.total ?? agencies.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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

  const editLimitsMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/agencies/${selectedAgency?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          leadLimit: parseInt(editForm.leadLimit),
          userLimit: parseInt(editForm.userLimit),
          plan: editForm.plan,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      setEditOpen(false);
      toast({ title: "Agency limits updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editProfileMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/agencies/${selectedAgency?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          businessProfile: profileForm.businessProfile,
          businessServices: profileForm.businessServices,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      setProfileOpen(false);
      toast({ title: "Business profile saved", description: "AI tools will now use this context" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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

  const openEditDialog = (agency: any) => {
    setSelectedAgency(agency);
    setEditForm({ leadLimit: String(agency.leadLimit), userLimit: String(agency.userLimit), plan: agency.plan });
    setEditOpen(true);
  };

  const openProfileDialog = (agency: any) => {
    setSelectedAgency(agency);
    setProfileForm({
      businessProfile: agency.businessProfile || "",
      businessServices: agency.businessServices || "",
    });
    setProfileOpen(true);
  };

  const planColors: Record<string, string> = {
    BASIC: "bg-muted text-foreground",
    PRO: "bg-chart-2 text-white dark:text-white",
    ENTERPRISE: "bg-chart-1 text-white dark:text-white",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Agencies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all registered agencies — {total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setProspectOpen(true)} data-testid="button-send-prospect">
            <Mail className="w-4 h-4 mr-2" />
            Send Prospect Email
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-agency">
                <Plus className="w-4 h-4 mr-2" />
                Create Agency
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Agency</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Agency Name</Label>
                <Input data-testid="input-agency-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter agency name" required />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger data-testid="select-plan"><SelectValue /></SelectTrigger>
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
                  <Input type="number" data-testid="input-lead-limit" value={form.leadLimit} onChange={(e) => setForm({ ...form, leadLimit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>User Limit</Label>
                  <Input type="number" data-testid="input-user-limit" value={form.userLimit} onChange={(e) => setForm({ ...form, userLimit: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-agency">
                {createMutation.isPending ? "Creating..." : "Create Agency"}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Agency list */}
      <div className="grid gap-4">
        {agencies.map((agency: any) => (
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
                        <strong className="text-foreground">{agency.leadLimit}</strong>&nbsp;leads max
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <strong className="text-foreground">{agency.userLimit}</strong>&nbsp;users max
                      </span>
                      {agency.businessServices && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <FileText className="w-3 h-3" />
                          {agency.businessServices.length > 40 ? agency.businessServices.slice(0, 40) + "…" : agency.businessServices}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(agency)} data-testid={`button-edit-limits-${agency.id}`}>
                    <Settings2 className="w-3 h-3 mr-1" />Edit Limits
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openProfileDialog(agency)} data-testid={`button-edit-profile-${agency.id}`}
                    className={agency.businessProfile ? "text-blue-600 border-blue-300 hover:bg-blue-50" : "text-muted-foreground"}>
                    <FileText className="w-3 h-3 mr-1" />{agency.businessProfile ? "Edit Profile" : "Add Profile"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => { setSelectedAgency(agency); setAdminOpen(true); }} data-testid={`button-add-admin-${agency.id}`}>
                    <Crown className="w-3 h-3 mr-1" />Add Admin
                  </Button>
                  <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => { setActivateAgency(agency); setActivatePlan(agency.plan); setActivateDays("30"); setActivateOpen(true); }}
                    data-testid={`button-activate-${agency.id}`}>
                    <Calendar className="w-3 h-3 mr-1" />Activate
                  </Button>
                  <Button variant="destructive" size="sm"
                    onClick={() => { if (confirm(`Delete agency "${agency.name}" and all its data? This cannot be undone.`)) deleteAgencyMutation.mutate(agency.id); }}
                    data-testid={`button-delete-agency-${agency.id}`}>
                    <Trash2 className="w-3 h-3 mr-1" />Delete
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{agency.isActive ? "Active" : "Inactive"}</span>
                    <Switch checked={agency.isActive} onCheckedChange={(checked) => toggleMutation.mutate({ id: agency.id, isActive: checked })} data-testid={`switch-agency-${agency.id}`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agencies.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No agencies yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first agency to get started</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
            <ChevronLeft className="w-4 h-4 mr-1" />Previous
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {page} of {totalPages} ({total} agencies)
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
            Next<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Send Prospect Email Dialog ── */}
      <Dialog open={prospectOpen} onOpenChange={setProspectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Prospect Inquiry Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sends a branded ICA CRM email with all 3 plan details + add-on packs to a prospective agency client.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); prospectMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Prospect Name</Label>
              <Input
                placeholder="e.g. Rahul Shah"
                value={prospectForm.name}
                onChange={(e) => setProspectForm({ ...prospectForm, name: e.target.value })}
                required
                data-testid="input-prospect-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Prospect Email</Label>
              <Input
                type="email"
                placeholder="e.g. rahul@agencyname.com"
                value={prospectForm.email}
                onChange={(e) => setProspectForm({ ...prospectForm, email: e.target.value })}
                required
                data-testid="input-prospect-email"
              />
            </div>
            <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground">
              📧 This will send a complete plan comparison email (BASIC / PRO / ENTERPRISE) with pricing and add-on packs to the prospect.
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setProspectOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={prospectMutation.isPending} data-testid="button-submit-prospect">
                {prospectMutation.isPending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Activate Subscription Dialog ── */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activate Subscription — {activateAgency?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={activatePlan} onValueChange={setActivatePlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">BASIC — ₹2,500/mo</SelectItem>
                  <SelectItem value="PRO">PRO — ₹5,500/mo</SelectItem>
                  <SelectItem value="ENTERPRISE">ENTERPRISE — ₹12,000/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Days to activate</Label>
              <Select value={activateDays} onValueChange={setActivateDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days (trial)</SelectItem>
                  <SelectItem value="15">15 days</SelectItem>
                  <SelectItem value="30">30 days (standard)</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted rounded-md p-3 text-sm text-muted-foreground">
              Agency <strong className="text-foreground">{activateAgency?.name}</strong> will be activated on <strong className="text-foreground">{activatePlan}</strong> plan for <strong className="text-foreground">{activateDays} days</strong>.
            </div>
            <Button className="w-full" onClick={handleActivate} disabled={activateLoading}>
              {activateLoading ? "Activating..." : "✅ Activate Subscription"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Limits Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Limits — {selectedAgency?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editLimitsMutation.mutate(); }} className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex gap-6">
              <span>Current leads: <strong className="text-foreground">{selectedAgency?.leadLimit}</strong></span>
              <span>Current users: <strong className="text-foreground">{selectedAgency?.userLimit}</strong></span>
              <span>Plan: <strong className="text-foreground">{selectedAgency?.plan}</strong></span>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input type="number" min="1" value={editForm.leadLimit} onChange={(e) => setEditForm({ ...editForm, leadLimit: e.target.value })} required data-testid="input-edit-lead-limit" />
              </div>
              <div className="space-y-2">
                <Label>User Limit</Label>
                <Input type="number" min="1" value={editForm.userLimit} onChange={(e) => setEditForm({ ...editForm, userLimit: e.target.value })} required data-testid="input-edit-user-limit" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editLimitsMutation.isPending} data-testid="button-save-limits">
                {editLimitsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Business Profile Dialog ── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Business Profile — {selectedAgency?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This information is used by AI tools (Smart Remarks, Follow-up Generator, Lead Scoring, Chatbot) to personalise responses for this agency.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); editProfileMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Profile</Label>
              <Textarea
                placeholder="e.g. We are a Pune-based insurance agency serving individual customers and SMEs. Our team focuses on building long-term relationships through personalised service."
                value={profileForm.businessProfile}
                onChange={(e) => setProfileForm({ ...profileForm, businessProfile: e.target.value })}
                rows={4}
                data-testid="input-business-profile"
              />
              <p className="text-xs text-muted-foreground">Describe the agency — location, target customers, specialisation, team style</p>
            </div>
            <div className="space-y-2">
              <Label>Products / Services Sold</Label>
              <Input
                placeholder="e.g. Motor Insurance, Health Insurance, Term Life, Personal Accident"
                value={profileForm.businessServices}
                onChange={(e) => setProfileForm({ ...profileForm, businessServices: e.target.value })}
                data-testid="input-business-services"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of insurance products this agency sells</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 text-xs text-blue-700 dark:text-blue-300">
              🤖 AI tools will use this profile to write more relevant remarks, follow-up messages, and lead scores specific to this agency's business.
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setProfileOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editProfileMutation.isPending} data-testid="button-save-profile">
                {editProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Admin Dialog ── */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Agency Admin for {selectedAgency?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createAdminMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input data-testid="input-admin-fullname" value={adminForm.fullName} onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" data-testid="input-admin-email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input data-testid="input-admin-username" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" data-testid="input-admin-password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required />
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
