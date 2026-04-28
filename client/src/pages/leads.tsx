import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users,
  Phone, Plus, ChevronLeft, ChevronRight, Filter, Search,
  UserCheck, Clock, CheckCircle2, XCircle, AlertCircle,
  Upload, Download, Briefcase, Check, MessageCircle, TrendingUp, IndianRupee,
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: "New", color: "bg-chart-1 text-white dark:text-white", icon: AlertCircle },
  IN_PROGRESS: { label: "In Progress", color: "bg-chart-2 text-white dark:text-white", icon: Phone },
  FOLLOW_UP: { label: "Follow Up", color: "bg-chart-5 text-white dark:text-white", icon: Clock },
  CONVERTED: { label: "Converted", color: "bg-chart-4 text-white dark:text-white", icon: CheckCircle2 },
  NOT_INTERESTED: { label: "Not Interested", color: "bg-destructive text-destructive-foreground", icon: XCircle },
};

export default function LeadsPage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

;

;

;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(user?.role === "TELE_CALLER" ? "NEW" : "ALL");
  const [assignmentFilter, setAssignmentFilter] = useState(user?.role === "TEAM_LEADER" ? "UNASSIGNED" : "ALL");
  const [telecallerFilter, setTelecallerFilter] = useState("ALL");
  const [exportingTL, setExportingTL] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [aiRemarkLoading, setAiRemarkLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", phone: "", email: "", source: "", remarks: "", service: "", teamLeaderId: ""
  });
  const [uploadTeamLeaderId, setUploadTeamLeaderId] = useState("");
  const [editForm, setEditForm] = useState({
    status: "", remarks: "", followUpDate: "", service: ""
  });
  const [assignTo, setAssignTo] = useState("");
  const [assignService, setAssignService] = useState("");
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkAssignService, setBulkAssignService] = useState("");

  const limit = 15;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  useEffect(() => { if (searchInputRef.current && document.activeElement !== searchInputRef.current && searchTerm.length > 0) { searchInputRef.current.focus(); } }, [searchTerm]);

  const isAgencyAdmin = user?.role === "AGENCY_ADMIN";

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["/api/leads", page, statusFilter, assignmentFilter, telecallerFilter, searchDebounced],
    queryFn: () => apiFetch(`/api/leads?page=${page}&limit=${limit}${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}${assignmentFilter !== "ALL" ? `&assignment=${assignmentFilter}` : ""}${telecallerFilter !== "ALL" ? `&assignedTo=${telecallerFilter}` : ""}${searchDebounced ? `&search=${encodeURIComponent(searchDebounced)}` : ""}`),
    enabled: !isAgencyAdmin || !!searchDebounced,
    placeholderData: (prev: any) => prev,
  });

  const { data: leadStatsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ["/api/stats/leads"],
    queryFn: () => apiFetch("/api/stats/leads"),
  });
  const { data: commissionsData } = useQuery({
    queryKey: ["/api/commissions"],
    queryFn: () => apiFetch("/api/commissions"),
    enabled: isAgencyAdmin,
  });

  const { data: teamUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiFetch("/api/users"),
    enabled: user?.role === "AGENCY_ADMIN" || user?.role === "TEAM_LEADER",
  });

  const { data: serviceList } = useQuery({
    queryKey: ["/api/services"],
    queryFn: () => apiFetch("/api/services"),
    enabled: user?.role !== "MASTER_ADMIN",
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/leads", {
      method: "POST",
      body: JSON.stringify({ ...form, teamLeaderId: form.teamLeaderId || undefined }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setCreateOpen(false);
      setForm({ name: "", phone: "", email: "", source: "", remarks: "", service: "", teamLeaderId: "" });
      toast({ title: "Lead created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiFetch(`/api/leads/${selectedLead?.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...editForm,
        followUpDate: editForm.followUpDate ? new Date(editForm.followUpDate).toISOString() : undefined,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditOpen(false);
      toast({ title: "Lead updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: () => apiFetch(`/api/leads/${selectedLead?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: assignTo, service: assignService || undefined }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setAssignOpen(false);
      toast({ title: "Lead assigned" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (leadId: string) => apiFetch(`/api/leads/${leadId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Lead deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: () => apiFetch("/api/leads/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ leadIds: selectedLeadIds, assignedTo: bulkAssignTo, service: bulkAssignService || undefined }),
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setBulkAssignOpen(false);
      setSelectedLeadIds([]);
      toast({ title: "Bulk assign complete", description: `${data.assigned} leads assigned` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (uploadTeamLeaderId) formData.append("teamLeaderId", uploadTeamLeaderId);
      const res = await fetch("/api/leads/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const r = data.data;
      toast({
        title: "Upload Complete",
        description: `Created: ${r.created} | Duplicates: ${r.duplicates} | Invalid: ${r.invalid} (of ${r.total})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setUploadOpen(false);
      setUploadTeamLeaderId("");
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = async () => {
  try {
    const res = await fetch("/api/leads/template", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_upload_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
  }
};

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };


  const leadList = leadsData?.leads || [];

  const allOnPageSelected = leadList.length > 0 && leadList.every((l: any) => selectedLeadIds.includes(l.id));
  const someOnPageSelected = leadList.some((l: any) => selectedLeadIds.includes(l.id)) && !allOnPageSelected;

  const toggleSelectAllOnPage = () => {
    const pageIds = leadList.map((l: any) => l.id);
    if (allOnPageSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedLeadIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };
  const total = (isAgencyAdmin && !searchDebounced)
    ? Object.values(leadStatsData || {}).reduce((sum: number, v: any) => sum + (typeof v === "number" ? v : 0), 0)
    : leadsData?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const canCreate = user?.role === "TEAM_LEADER" || user?.role === "AGENCY_ADMIN";
  const canAssign = user?.role === "TEAM_LEADER";
  const canDelete = user?.role === "TEAM_LEADER";
  const canUpdate = (lead: any) => {
    if (user?.role === "TELE_CALLER" && lead.assignedTo === user?.id) return true;
    if (user?.role === "TEAM_LEADER" || user?.role === "AGENCY_ADMIN") return true;
    return false;
  };
  const telecallers = teamUsers?.filter((u: any) => u.role === "TELE_CALLER") || [];
  const teamLeaders = teamUsers?.filter((u: any) => u.role === "TEAM_LEADER") || [];
  const services = serviceList || [];

  if (isLoading || isStatsLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-testid="input-lead-search"
              placeholder="Search name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-52"
            />
          </div>
          {!isAgencyAdmin && (
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                <Filter className="w-3 h-3 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
              </SelectContent>
            </Select>
          )}

          {user?.role === "TEAM_LEADER" && (
            <Select value={assignmentFilter} onValueChange={(v) => { setAssignmentFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44" data-testid="select-assignment-filter">
                <UserCheck className="w-3 h-3 mr-2" />
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Leads</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
              </SelectContent>
            </Select>
          )}

          {user?.role === "TEAM_LEADER" && (
            <Select value={telecallerFilter} onValueChange={(v) => { setTelecallerFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44" data-testid="select-telecaller-filter">
                <Users className="w-3 h-3 mr-2" />
                <SelectValue placeholder="All Telecallers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Telecallers</SelectItem>
                {telecallers.map((tc: any) => (
                  <SelectItem key={tc.id} value={tc.id}>{tc.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {canAssign && selectedLeadIds.length > 0 && (
            <Button variant="outline" onClick={() => setBulkAssignOpen(true)} data-testid="button-bulk-assign">
              <UserCheck className="w-4 h-4 mr-2" />
              Assign ({selectedLeadIds.length})
            </Button>
          )}

          {canCreate && (
            <>
              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-bulk-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Lead Upload</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload an Excel (.xlsx) or CSV file with columns: name, phone, email, source, service
                    </p>
                    <Button variant="outline" onClick={downloadTemplate} className="w-full" data-testid="button-download-template">
                      <Download className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                    {isAgencyAdmin && teamLeaders.length > 0 && (
                      <div className="space-y-2">
                        <Label>Assign to Team Leader <span className="text-red-500">*</span></Label>
                        <Select value={uploadTeamLeaderId} onValueChange={setUploadTeamLeaderId}>
                          <SelectTrigger><SelectValue placeholder="Select Team Leader first" /></SelectTrigger>
                          <SelectContent>
                            {teamLeaders.map((tl: any) => (
                              <SelectItem key={tl.id} value={tl.id}>{tl.fullName || tl.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Select File</Label>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        data-testid="input-upload-file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        disabled={uploading || (isAgencyAdmin && !uploadTeamLeaderId)}
                      />
                      {isAgencyAdmin && !uploadTeamLeaderId && (
                        <p className="text-xs text-orange-500">Please select a Team Leader before uploading</p>
                      )}
                    </div>
                    {uploading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Processing file...
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-lead">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="overflow-y-auto max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                    
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input data-testid="input-lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input data-testid="input-lead-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" data-testid="input-lead-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                        <SelectTrigger data-testid="select-lead-source"><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Cold Call">Cold Call</SelectItem>
                          <SelectItem value="Social Media">Social Media</SelectItem>
                          <SelectItem value="Exhibition">Exhibition</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {services.length > 0 && (
                      <div className="space-y-2">
                        <Label>Service</Label>
                        <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                          <SelectTrigger data-testid="select-lead-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                          <SelectContent>
                            {services.map((s: any) => (
                              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea data-testid="input-lead-remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} />
                    </div>
                    {isAgencyAdmin && teamLeaders.length > 0 && (
                      <div className="space-y-2">
                        <Label>Assign to Team Leader <span className="text-red-500">*</span></Label>
                        <Select value={form.teamLeaderId} onValueChange={(v) => setForm({ ...form, teamLeaderId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Team Leader" /></SelectTrigger>
                          <SelectContent>
                            {teamLeaders.map((tl: any) => (
                              <SelectItem key={tl.id} value={tl.id}>{tl.fullName || tl.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={createMutation.isPending || (isAgencyAdmin && !form.teamLeaderId)} data-testid="button-submit-lead">
                      {createMutation.isPending ? "Creating..." : "Add Lead"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {isAgencyAdmin && !searchDebounced ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(statusConfig).map(([key, config]) => {
            const StatusIcon = config.icon;
            const count = key === "IN_PROGRESS"
              ? (leadStatsData?.["CONTACTED"] || 0) + (leadStatsData?.["FOLLOW_UP"] || 0) + (leadStatsData?.["CONVERTED"] || 0) + (leadStatsData?.["NOT_INTERESTED"] || 0)
              : leadStatsData?.[key] || 0;
            return (
              <Card key={key} data-testid={`card-stat-${key}`}>
                <CardContent className="p-5 text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${config.color}`}>
                    <StatusIcon className="w-6 h-6" />
                  </div>
                  <p className="text-3xl font-bold" data-testid={`text-count-${key}`}>{count}</p>
                  <p className="text-sm text-muted-foreground mt-1">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <>
          {/* Select all on current page — only shown to TEAM_LEADER when leads exist */}
          {canAssign && leadList.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg border border-dashed">
              <Checkbox
                checked={allOnPageSelected}
                data-state={someOnPageSelected ? "indeterminate" : allOnPageSelected ? "checked" : "unchecked"}
                onCheckedChange={toggleSelectAllOnPage}
                data-testid="checkbox-select-all-page"
                className="shrink-0"
              />
              <span className="text-sm text-muted-foreground">
                {allOnPageSelected
                  ? `All ${leadList.length} leads on this page selected`
                  : someOnPageSelected
                  ? `${selectedLeadIds.filter(id => leadList.some((l: any) => l.id === id)).length} of ${leadList.length} selected on this page`
                  : `Select all ${leadList.length} leads on this page`}
              </span>
              {selectedLeadIds.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedLeadIds.length} total selected
                </span>
              )}
            </div>
          )}

          <div className="grid gap-3">
            {leadList.map((lead: any) => {
              const config = statusConfig[lead.status] || statusConfig.NEW;
              const StatusIcon = config.icon;
              return (
                <div key={lead.id} className="space-y-0">
                <Card data-testid={`card-lead-${lead.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {canAssign && (
                          <Checkbox
                            checked={selectedLeadIds.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                            data-testid={`checkbox-lead-${lead.id}`}
                            className="shrink-0"
                          />
                        )}
                        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <StatusIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{lead.name}</p>
                            <Badge className={`text-[10px] ${config.color}`}>{config.label}</Badge>
                            {lead.source && <Badge variant="secondary" className="text-[10px]">{lead.source}</Badge>}
                            {lead.service && (
                              <Badge variant="outline" className="text-[10px]">
                                <Briefcase className="w-2.5 h-2.5 mr-0.5" />
                                {lead.service}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {user?.role === "TELE_CALLER" ? (
                              <a
                                href={"tel:" + lead.phone}
                                className="flex items-center gap-1 text-primary font-medium hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="w-3 h-3" />{lead.phone}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                            )}
                            <a
                              href={`https://wa.me/91${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                `Hello ${lead.name},\n\nWe are reaching out regarding your enquiry${lead.service ? ` for *${lead.service}*` : ""}.\n\nWe would love to assist you. Please let us know a convenient time to connect.\n\nRegards,\nAPLM Team\n+91 8830242124`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium transition-colors bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full"
                              data-testid={`button-whatsapp-${lead.id}`}
                              title={`Send WhatsApp to ${lead.name}`}
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                            {lead.email && <span>{lead.email}</span>}
                            {lead.followUpDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Follow up: {new Date(lead.followUpDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          {lead.remarks && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{lead.remarks}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end w-full sm:w-auto">
                        {canAssign && (
                          <Button
                            variant="secondary" size="sm"
                            onClick={() => { setSelectedLead(lead); setAssignTo(lead.assignedTo || ""); setAssignService(lead.service || ""); setAssignOpen(true); }}
                            data-testid={`button-assign-${lead.id}`}
                          >
                            <UserCheck className="w-3 h-3 mr-1" />
                            Assign
                          </Button>
                        )}
                        {canUpdate(lead) && (
                          <Button
                            variant="secondary" size="sm"
                            onClick={() => {
                              setSelectedLead(lead);
                              setEditForm({
                                status: lead.status,
                                remarks: lead.remarks || "",
                                followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().split("T")[0] : "",
                                service: lead.service || "",
                              });
                              setAiSuggestion("");
                              setEditOpen(true);
                            }}
                            data-testid={`button-edit-${lead.id}`}
                          >
                            Update
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="destructive" size="sm"
                            onClick={() => { if (confirm("Delete this lead?")) deleteMutation.mutate(lead.id); }}
                            data-testid={`button-delete-${lead.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
              );
            })}
          </div>

          {leadList.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No leads found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusFilter !== "ALL" ? "Try a different filter" : "Start adding leads to manage them"}
                </p>
              </CardContent>
            </Card>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Telecaller-wise Commission Summary */}
      {isAgencyAdmin && commissionsData && commissionsData.length > 0 && (() => {
        const grouped: Record<string, { name: string; total: number; pending: number; paid: number; converted: number }> = {};
        commissionsData.forEach((c: any) => {
          const key = c.userId;
          if (!grouped[key]) grouped[key] = { name: c.telecallerName || "Unknown", teamLeaderName: c.teamLeaderName || "—", total: 0, pending: 0, paid: 0, converted: 0, totalConverted: c.totalConverted || 0 };
          grouped[key].total += c.amount;
          grouped[key].converted += 1;
          grouped[key].totalConverted = c.totalConverted || 0;
          if (c.paidStatus === "PAID") grouped[key].paid += c.amount;
          else grouped[key].pending += c.amount;
        });
        const rows = Object.values(grouped);
        return (
          <Card className="mt-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm">Telecaller Commission Summary</h3>
                <span className="text-xs text-muted-foreground ml-1">this month</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 pr-4 font-medium">Telecaller</th>
                      <th className="text-left py-2 pr-4 font-medium">Team Leader</th>
                      <th className="text-center py-2 pr-4 font-medium">Total Converted</th>
                      <th className="text-center py-2 pr-4 font-medium">Commission On</th>
                      <th className="text-right py-2 pr-4 font-medium">Total Earned</th>
                      <th className="text-right py-2 pr-4 font-medium text-green-600">Paid</th>
                      <th className="text-right py-2 font-medium text-orange-500">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 font-medium">{r.name}</td>
                        <td className="py-2 pr-4 text-sm text-muted-foreground">{(r as any).teamLeaderName || "—"}</td>
                        <td className="py-2 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3" />{r.totalConverted}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-center">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3" />{r.converted}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">{r.total.toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                        <td className="py-2 pr-4 text-right text-green-600 font-medium">{r.paid.toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                        <td className="py-2 text-right text-orange-500 font-medium">{r.pending.toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2">
                      <td className="py-2 pr-4 font-bold text-xs uppercase text-muted-foreground">Total</td>
                      <td></td>
                      <td className="py-2 pr-4 text-center font-bold">{rows.reduce((a,r)=>a+r.totalConverted,0)}</td>
                      <td className="py-2 pr-4 text-center font-bold">{rows.reduce((a,r)=>a+r.converted,0)}</td>
                      <td className="py-2 pr-4 text-right font-bold">{rows.reduce((a,r)=>a+r.total,0).toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                      <td className="py-2 pr-4 text-right font-bold text-green-600">{rows.reduce((a,r)=>a+r.paid,0).toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                      <td className="py-2 text-right font-bold text-orange-500">{rows.reduce((a,r)=>a+r.pending,0).toLocaleString("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0})}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>Update Lead: {selectedLead?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (editForm.status === "CONVERTED" && !editForm.service) { toast({ title: "Service Required", description: "Please select a service before marking lead as Converted.", variant: "destructive" }); return; } updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger data-testid="select-lead-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {user?.role === "TELE_CALLER" ? (
                    <>
                      <SelectItem value="CONVERTED">Converted</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                      <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="CONTACTED">Contacted</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                      <SelectItem value="CONVERTED">Converted</SelectItem>
                      <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={editForm.service} onValueChange={(v) => setEditForm({ ...editForm, service: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service (optional)" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Change service if a different product was sold</p>
              </div>
            )}
            {editForm.status === "FOLLOW_UP" && (
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input type="date" data-testid="input-followup-date" value={editForm.followUpDate} onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })} required />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Remarks</Label>
                <button
                  type="button"
                  disabled={aiRemarkLoading}
                  onClick={async () => {
                    if (!selectedLead) return;
                    setAiRemarkLoading(true);
                    setAiSuggestion("");
                    try {
                      const rawRes = await fetch("/api/ai/suggest-remark", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("ica_token") },
                        body: JSON.stringify({
                          leadName: selectedLead.name,
                          status: editForm.status,
                          service: selectedLead.service || "",
                          previousRemark: editForm.remarks || "",
                          polishMode: true,
                        }),
                      });
                      const res = await rawRes.json();
                      if (res?.remark) setAiSuggestion(res.remark);
                    } catch (err: any) {
                      toast({ title: "AI Error", description: err.message || "Failed", variant: "destructive" });
                    } finally {
                      setAiRemarkLoading(false);
                    }
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors disabled:opacity-50"
                >
                  {aiRemarkLoading ? <span className="w-3 h-3 border border-violet-500 border-t-transparent rounded-full animate-spin" /> : <span>✨</span>}
                  {aiRemarkLoading ? "Polishing..." : "Polish with AI"}
                </button>
              </div>
              {aiSuggestion && (
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 leading-relaxed">{aiSuggestion}</p>
                    <button type="button" onClick={() => { setEditForm({ ...editForm, remarks: aiSuggestion }); setAiSuggestion(""); }} className="shrink-0 text-xs px-2 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white transition-colors">Use</button>
                  </div>
                  <p className="mt-1 text-xs text-violet-500">AI polished version — click Use to apply, or edit below.</p>
                </div>
              )}
              <Textarea data-testid="input-edit-remarks" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} rows={3} placeholder="Type your remark, then click Polish with AI to improve it..." />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-update-lead">
              {updateMutation.isPending ? "Updating..." : "Update Lead"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Lead: {selectedLead?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Assign to Telecaller</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger data-testid="select-assign-to"><SelectValue placeholder="Select telecaller" /></SelectTrigger>
                <SelectContent>
                  {telecallers.map((tc: any) => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={assignService} onValueChange={setAssignService}>
                  <SelectTrigger data-testid="select-assign-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={assignMutation.isPending} data-testid="button-confirm-assign">
              {assignMutation.isPending ? "Assigning..." : "Assign Lead"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Assign {selectedLeadIds.length} Leads</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); bulkAssignMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Assign to Telecaller</Label>
              <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
                <SelectTrigger data-testid="select-bulk-assign-to"><SelectValue placeholder="Select telecaller" /></SelectTrigger>
                <SelectContent>
                  {telecallers.map((tc: any) => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={bulkAssignService} onValueChange={setBulkAssignService}>
                  <SelectTrigger data-testid="select-bulk-assign-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={bulkAssignMutation.isPending || !bulkAssignTo} data-testid="button-confirm-bulk-assign">
              {bulkAssignMutation.isPending ? "Assigning..." : `Assign ${selectedLeadIds.length} Leads`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
