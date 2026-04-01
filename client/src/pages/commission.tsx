import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, CheckCircle, Clock, Users, Settings, TrendingUp } from "lucide-react";
import { useApi } from "@/hooks/use-api";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CommissionPage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = user?.role;
  const [defaultCommission, setDefaultCommission] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["/api/commissions"],
    queryFn: () => apiFetch("/api/commissions"),
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/agency/commission-settings"],
    queryFn: () => apiFetch("/api/agency/commission-settings"),
    enabled: role === "AGENCY_ADMIN",
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/commissions/${id}/paid`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      toast({ title: "Commission marked as paid" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/agency/office-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commissionPerLead: Number(defaultCommission) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/commission-settings"] });
      toast({ title: "Default commission saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const totalEarned = (commissions || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const totalPaid = (commissions || []).filter((c: any) => c.paidStatus === "PAID").reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const totalPending = totalEarned - totalPaid;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Commission</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === "TELE_CALLER" ? "Track your earned commissions" : "Manage team commissions and payouts"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Total Earned</p>
            <p className="text-2xl font-bold text-green-600">₹{totalEarned.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</p>
            <p className="text-2xl font-bold text-amber-500">₹{totalPending.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Paid Out</p>
            <p className="text-2xl font-bold text-blue-600">₹{totalPaid.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Settings — Agency Admin only */}
      {role === "AGENCY_ADMIN" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Default Commission Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label className="text-xs">Default Commission per Converted Lead (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={`Current: ₹${settings?.commissionPerLead || 0}`}
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used when service has no specific commission set</p>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings || !defaultCommission}>
                {savingSettings ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              To set commission per service, go to <span className="font-medium">Services</span> page and edit each service.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Commission Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" />
            {role === "TELE_CALLER" ? "My Commission History" : "Team Commission Records"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : !commissions || commissions.length === 0 ? (
            <div className="p-8 text-center">
              <IndianRupee className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No commissions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Commissions are earned when a lead is converted</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {(role === "AGENCY_ADMIN" || role === "TEAM_LEADER") ? (() => {
                const grouped: Record<string, { name: string; ids: string[]; pendingIds: string[]; total: number; pending: number; paid: number; commissionOn: number; totalConverted: number }> = {};
                commissions.forEach((c: any) => {
                  const key = c.userId;
                  if (!grouped[key]) grouped[key] = { name: c.userName || c.telecallerName || "Unknown", teamLeaderName: c.teamLeaderName || "—", ids: [], pendingIds: [], total: 0, pending: 0, paid: 0, commissionOn: 0, totalConverted: c.totalConverted || 0 };
                  grouped[key].ids.push(c.id);
                  grouped[key].total += c.amount || 0;
                  grouped[key].commissionOn += 1;
                  grouped[key].totalConverted = c.totalConverted || grouped[key].totalConverted;
                  if (c.paidStatus === "PENDING") { grouped[key].pending += c.amount || 0; grouped[key].pendingIds.push(c.id); }
                  else grouped[key].paid += c.amount || 0;
                });
                const rows = Object.values(grouped);
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium text-muted-foreground">Telecaller</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Team Leader</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Total Converted</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Commission On</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Total Earned</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-green-600">Paid</th>
                        <th className="text-right p-3 font-medium text-muted-foreground text-amber-500">Pending</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-semibold">{r.name}</td>
                          <td className="p-3 text-sm text-muted-foreground">{(r as any).teamLeaderName || "—"}</td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                              <TrendingUp className="w-3 h-3" />{r.totalConverted}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                              <TrendingUp className="w-3 h-3" />{r.commissionOn}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-green-600">₹{r.total.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right text-green-600 font-medium">₹{r.paid.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-right text-amber-500 font-medium">₹{r.pending.toLocaleString("en-IN")}</td>
                          <td className="p-3 text-center">
                            {r.pendingIds.length > 0 ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                disabled={markPaidMutation.isPending}
                                onClick={() => { r.pendingIds.forEach(id => markPaidMutation.mutate(id)); }}>
                                Mark All Paid
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />All Paid
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/20">
                        <td className="p-3 font-bold text-xs uppercase text-muted-foreground">Total</td>
                        <td></td>
                        <td className="p-3 text-center font-bold">{rows.reduce((a,r)=>a+r.totalConverted,0)}</td>
                        <td className="p-3 text-center font-bold">{rows.reduce((a,r)=>a+r.commissionOn,0)}</td>
                        <td className="p-3 text-right font-bold text-green-600">₹{rows.reduce((a,r)=>a+r.total,0).toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right font-bold text-green-600">₹{rows.reduce((a,r)=>a+r.paid,0).toLocaleString("en-IN")}</td>
                        <td className="p-3 text-right font-bold text-amber-500">₹{rows.reduce((a,r)=>a+r.pending,0).toLocaleString("en-IN")}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })() : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Converted On</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-bold text-green-600">₹{c.amount?.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(c.convertedAt)}</td>
                      <td className="p-3">
                        {c.paidStatus === "PAID" ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                            <Clock className="w-3 h-3 mr-1" />Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
