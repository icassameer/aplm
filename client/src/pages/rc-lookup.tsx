import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Car, Search, User, Shield, FileText,
  Calendar, Building2, ChevronDown, ChevronUp,
  Clock, AlertTriangle, CheckCircle2, XCircle, IndianRupee
} from "lucide-react";

export default function RCLookupPage() {
  const { user } = useAuth();
  const isTeamLeader = user?.role === "TEAM_LEADER";
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rcNumber, setRcNumber] = useState("");
  const [expanded, setExpanded] = useState<string | null>("vehicle");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: savedRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/rc-records"],
    queryFn: () => apiFetch("/api/rc-records"),
  });

  const handleLookup = async () => {
    if (!rcNumber.trim()) {
      toast({ title: "Please enter a registration number", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/api/rc-lookup", {
        method: "POST",
        body: JSON.stringify({ rcNumber: rcNumber.trim().toUpperCase() }),
      });
      if (data.success) {
        setResult(data.data);
        queryClient.invalidateQueries({ queryKey: ["/api/rc-records"] });
        toast({ title: "RC details fetched and saved!" });
      } else {
        toast({ title: "Lookup failed", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Car className="w-6 h-6 text-primary" />
          RC Vehicle Lookup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isTeamLeader ? "View vehicle registration details fetched by admin" : "Fetch and save vehicle registration details"}
        </p>
      </div>

      {/* Search — Agency Admin only */}
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
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Search className="w-4 h-4" />}
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
                  {savedRecords.meta.plan && (
                    <Badge variant="outline" className="text-xs">{savedRecords.meta.plan}</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
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

          <Section id="financer" title="Financer & Additional" icon={IndianRupee}>
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

      {/* Saved Records */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" /> Previously Looked Up
        </h2>
        {recordsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : savedRecords?.data?.length > 0 ? (
          <div className="space-y-2">
            {savedRecords.data.map((record: any) => (
              <Card
                key={record.id}
                className="hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => {
                  setResult(record.rcData);
                  setRcNumber(record.rcNumber);
                  setExpanded("vehicle");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
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
