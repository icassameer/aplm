import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Car, Search, User, Shield, FileText,
  Calendar, Building2, ChevronDown, ChevronUp,
  Clock, AlertTriangle, CheckCircle2, XCircle, IndianRupee, Trash2
} from "lucide-react";

export default function RCLookupPage() {
  const { user, token } = useAuth();
  const isMasterAdmin = user?.role === "MASTER_ADMIN";
  const isTeamLeader = user?.role === "TEAM_LEADER";
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rcNumber, setRcNumber] = useState("");
  const [expanded, setExpanded] = useState<string | null>("vehicle");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: agencies } = useQuery({
    queryKey: ["/api/agencies"],
    queryFn: () => apiFetch("/api/agencies"),
    enabled: isMasterAdmin,
  });

  const agencyList = agencies?.data || [];

  const recordsUrl = isMasterAdmin
    ? agencyFilter !== "all" ? `/api/rc-lookup?agency=${agencyFilter}` : "/api/rc-lookup"
    : "/api/rc-records";

  const { data: savedRecords, isLoading: recordsLoading, isFetching: recordsFetching, error: recordsQueryError } = useQuery({
    queryKey: [recordsUrl],
    queryFn: async () => {
      const res = await fetch(recordsUrl, { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
  });

  const agencyPlan = savedRecords?.meta?.plan;
  const recordsError = (savedRecords as any)?.success === false;
const subscriptionLoaded = !isMasterAdmin ? (!recordsLoading && !recordsFetching) || !!recordsQueryError : true;
  // subscriptionLoaded is true when fetch is done (data or error)
  const isBasicPlan = !isMasterAdmin && (agencyPlan === "BASIC" || (recordsQueryError as any)?.message?.includes("PRO or ENTERPRISE"));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/rc-lookup/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rc-lookup"] });
      queryClient.invalidateQueries({ queryKey: [`/api/rc-lookup?agency=${agencyFilter}`] });
      setDeleteConfirm(null);
      toast({ title: "RC record deleted successfully" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const handleLookup = async () => {
    if (!rcNumber.trim()) {
      toast({ title: "Please enter a registration number", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/rc-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ rcNumber: rcNumber.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        queryClient.invalidateQueries({ queryKey: ["/api/rc-records"] });
        toast({ title: data.cached ? "Returned from cache (within 24h)" : "RC details fetched and saved!" });
      } else {
        toast({ title: "Lookup failed", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isMasterAdmin && !subscriptionLoaded) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isBasicPlan) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">RC Lookup</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This feature requires PRO or ENTERPRISE plan. Contact your administrator to upgrade.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Section = ({ id, title, icon: Icon, children }: any) => (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(expanded === id ? null : id)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </div>
        {expanded === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded === id && <CardContent className="pt-0 pb-4">{children}</CardContent>}
    </Card>
  );

  const Field = ({ label, value, highlight = false }: { label: string; value: any; highlight?: boolean }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-primary" : ""} ${!value || value === "NA" || value === "" ? "text-muted-foreground italic" : ""}`}>
        {value && value !== "NA" && value !== "" ? String(value) : "—"}
      </span>
    </div>
  );

  const r = result;
  const records = (savedRecords?.data || []).sort((a: any, b: any) => {
    const dateA = a.rcData?.insurance_details?.insurance_valid_upto ? new Date(a.rcData.insurance_details.insurance_valid_upto).getTime() : Infinity;
    const dateB = b.rcData?.insurance_details?.insurance_valid_upto ? new Date(b.rcData.insurance_details.insurance_valid_upto).getTime() : Infinity;
    return dateA - dateB;
  });

  if (isMasterAdmin) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Car className="w-6 h-6 text-primary" />
              RC Lookup — All Agencies
            </h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage RC lookup history across all agencies</p>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {records.length} record{records.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select value={agencyFilter} onValueChange={setAgencyFilter}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {agencyList.map((a: any) => (
                <SelectItem key={a.agencyCode} value={a.agencyCode}>
                  {a.name} ({a.agencyCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agencyFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setAgencyFilter("all")}>Clear</Button>
          )}
        </div>
        {recordsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : records.length > 0 ? (
          <div className="space-y-2">
            {records.map((record: any) => (
              <Card key={record.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Car className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-primary">{record.rcNumber}</span>
                          <Badge variant="outline" className="text-xs">{record.rcData?.vehicle_details?.fuel_type || "—"}</Badge>
                          <Badge variant="secondary" className="text-xs">{record.agencyName || record.agencyCode}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {record.rcData?.vehicle_details?.maker} {record.rcData?.vehicle_details?.model}
                          {record.rcData?.owner_details?.name ? ` • Owner: ${record.rcData.owner_details.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(record.createdAt).toLocaleDateString()}
                      </div>
                      {deleteConfirm === record.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-destructive font-medium">Delete?</span>
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                            onClick={() => deleteMutation.mutate(record.id)}
                            disabled={deleteMutation.isPending}>Yes</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                            onClick={() => setDeleteConfirm(null)}>No</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(record.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No RC lookup records found{agencyFilter !== "all" ? " for this agency" : ""}.</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Car className="w-6 h-6 text-primary" />
          RC Vehicle Lookup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isTeamLeader ? "View vehicle registration details fetched by admin" : "Fetch and save vehicle registration details"}
        </p>
      </div>
      {!isTeamLeader && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="mb-2 block">Vehicle Registration Number</Label>
                <Input
                  placeholder="e.g. MH12AB1234"
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="font-mono text-base uppercase"
                  data-testid="input-rc-number"
                />
              </div>
              <Button onClick={handleLookup} disabled={loading} className="gap-2" data-testid="button-rc-lookup">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Fetching..." : "Fetch Details"}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">⚠️ Each lookup uses API credits. Results are saved automatically.</p>
              {savedRecords?.meta && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">This month:</span>
                  <Badge variant={savedRecords.meta.used >= savedRecords.meta.limit ? "destructive" : "secondary"} className="text-xs">
                    {savedRecords.meta.used} / {savedRecords.meta.limit >= 9999999 ? "∞" : savedRecords.meta.limit} used
                  </Badge>
                  {savedRecords.meta.plan && <Badge variant="outline" className="text-xs">{savedRecords.meta.plan}</Badge>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {r && (
        <div className="space-y-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Car className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg">{r.vehicle_details?.maker} {r.vehicle_details?.model}</p>
                  <p className="text-sm text-muted-foreground">{r.vehicle_details?.variant} • {r.vehicle_details?.color} • {r.vehicle_details?.fuel_type}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-primary text-white font-mono text-sm px-3 py-1">{rcNumber}</Badge>
                  <Badge variant={r.owner_details?.status === "ACTIVE" ? "default" : "destructive"} className="gap-1">
                    {r.owner_details?.status === "ACTIVE" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {r.owner_details?.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Section id="owner" title="Owner Details" icon={User}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <Field label="Owner Name" value={r.owner_details?.name} highlight />
              <Field label="Father's Name" value={r.owner_details?.father_name} />
              <Field label="Mobile" value={r.owner_details?.mobile} highlight />
              <Field label="Email" value={r.owner_details?.email} />
              <Field label="State" value={r.owner_details?.state} />
              <Field label="Address" value={r.owner_details?.present_address} />
            </div>
          </Section>
          <Section id="vehicle" title="Vehicle Details" icon={Car}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <Field label="Maker" value={r.vehicle_details?.maker} highlight />
              <Field label="Model" value={r.vehicle_details?.model} highlight />
              <Field label="Variant" value={r.vehicle_details?.variant} />
              <Field label="Color" value={r.vehicle_details?.color} />
              <Field label="Fuel Type" value={r.vehicle_details?.fuel_type} />
              <Field label="Body Type" value={r.vehicle_details?.body_type} />
              <Field label="Seat Capacity" value={r.vehicle_details?.seat_capacity} />
              <Field label="Cylinders" value={r.vehicle_details?.cylinders} />
              <Field label="Cubic Capacity" value={r.vehicle_details?.cubic_capacity ? `${r.vehicle_details.cubic_capacity} cc` : null} />
              <Field label="Fuel Norms" value={r.vehicle_details?.fuel_norms} />
              <Field label="Registration Date" value={r.vehicle_details?.registration_date} />
              <Field label="Manufactured" value={r.vehicle_details?.manufactured_date} />
              <Field label="Fitness Upto" value={r.vehicle_details?.fitness_upto} highlight />
              <Field label="Chassis Number" value={r.vehicle_details?.chassis_number} />
              <Field label="Engine Number" value={r.vehicle_details?.engine_number} />
              <Field label="Unladen Weight" value={r.vehicle_details?.unladen_weight ? `${r.vehicle_details.unladen_weight} kg` : null} />
            </div>
          </Section>
          <Section id="insurance" title="Insurance Details" icon={Shield}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <Field label="Insurance Company" value={r.insurance_details?.insurance_company} highlight />
              <Field label="Policy Number" value={r.insurance_details?.insurance_policy_no} />
              <Field label="Valid Upto" value={r.insurance_details?.insurance_valid_upto} highlight />
            </div>
            {r.insurance_details?.insurance_valid_upto && new Date(r.insurance_details.insurance_valid_upto) < new Date() && (
              <div className="mt-3 flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded">
                <AlertTriangle className="w-4 h-4" /> Insurance has expired!
              </div>
            )}
          </Section>
          <Section id="pucc" title="PUCC / Pollution Details" icon={FileText}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <Field label="PUCC Number" value={r.pucc_details?.pucc_no} />
              <Field label="Valid Upto" value={r.pucc_details?.pucc_upto} highlight />
            </div>
          </Section>
          <Section id="office" title="RTO Office" icon={Building2}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <Field label="RTO" value={r.office_details?.rto} highlight />
              <Field label="Registered At" value={r.office_details?.regn_at} />
            </div>
          </Section>
          <Section id="financer" title="Financer and Additional" icon={IndianRupee}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
              <Field label="Financer Name" value={r.financer_details?.name} />
              <Field label="Is Financed" value={r.financer_details?.is_financed === true ? "Yes" : r.financer_details?.is_financed === false ? "No" : null} />
              <Field label="Resale Value" value={r.additional_details?.resale_value} highlight />
              <Field label="Blacklist Status" value={r.additional_details?.blacklist_status} />
              <Field label="Tax" value={r.additional_details?.tax_upto} />
            </div>
          </Section>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" /> Previously Looked Up
        </h2>
        {recordsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : records.length > 0 ? (
          <div className="space-y-2">
            {records.map((record: any) => (
              <Card key={record.id} className="hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => { setResult(record.rcData); setRcNumber(record.rcNumber); setExpanded("vehicle"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{record.rcNumber}</span>
                          <Badge variant="outline" className="text-xs">{record.rcData?.vehicle_details?.fuel_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {record.rcData?.vehicle_details?.maker} {record.rcData?.vehicle_details?.model} • Owner: {record.rcData?.owner_details?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No RC lookups yet. Search above to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
