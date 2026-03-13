import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, UserX, Clock, Mail, User, Phone, Building2, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const roleLabels: Record<string, string> = {
  AGENCY_ADMIN: "Agency Admin",
  TEAM_LEADER: "Team Leader",
  TELE_CALLER: "Telecaller",
};

export default function ApprovalsPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { apiFetch } = useApi();
  const isMaster = user?.role === "MASTER_ADMIN";

  const [approvalData, setApprovalData] = useState<Record<string, { role: string; agencyCode: string }>>({});

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["/api/users/pending"],
    queryFn: () => apiFetch("/api/users/pending"),
  });

  const { data: agencies } = useQuery({
    queryKey: ["/api/agencies"],
    queryFn: () => apiFetch("/api/agencies"),
    enabled: isMaster,
  });

  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const body: any = {};
      if (isMaster && approvalData[userId]) {
        body.role = approvalData[userId].role;
        body.agencyCode = approvalData[userId].agencyCode;
      }
      const res = await fetch(`/api/users/approve/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (_, userId) => {
      setApprovedIds(prev => new Set(prev).add(userId));
      toast({ title: "Success", description: "User approved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/reject/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Done", description: "User rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const users = pendingUsers || [];

  const updateApprovalData = (userId: string, field: string, value: string) => {
    setApprovalData(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { role: "TELE_CALLER", agencyCode: "" }), [field]: value }
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Pending Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve new user registrations</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No Pending Approvals</p>
            <p className="text-sm text-muted-foreground">All user registrations have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((u: any) => (
            <Card key={u.id} data-testid={`card-pending-user-${u.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{u.fullName}</CardTitle>
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                    Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    <span>{u.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.mobile && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{u.mobile}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}</span>
                  </div>
                  {u.agencyCode && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{u.agencyCode}</span>
                    </div>
                  )}
                </div>

                {isMaster && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assign Agency</Label>
                      <Select
                        value={approvalData[u.id]?.agencyCode || ""}
                        onValueChange={(v) => updateApprovalData(u.id, "agencyCode", v)}
                      >
                        <SelectTrigger className="text-xs" data-testid={`select-agency-${u.id}`}>
                          <Building2 className="w-3 h-3 mr-1" />
                          <SelectValue placeholder="Select agency" />
                        </SelectTrigger>
                        <SelectContent>
                          {agencies?.map((a: any) => (
                            <SelectItem key={a.id} value={a.agencyCode}>{a.name} ({a.agencyCode})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assign Role</Label>
                      <Select
                        value={approvalData[u.id]?.role || "TELE_CALLER"}
                        onValueChange={(v) => updateApprovalData(u.id, "role", v)}
                      >
                        <SelectTrigger className="text-xs" data-testid={`select-role-${u.id}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => { if (!approvedIds.has(u.id)) approveMutation.mutate(u.id); }}
                    disabled={approveMutation.isPending || approvedIds.has(u.id) || (isMaster && !approvalData[u.id]?.agencyCode)}
                    data-testid={`button-approve-${u.id}`}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => rejectMutation.mutate(u.id)}
                    disabled={rejectMutation.isPending}
                    data-testid={`button-reject-${u.id}`}
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
