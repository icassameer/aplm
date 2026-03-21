import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Building2, Brain, CheckCircle2 } from "lucide-react";

export default function AgencyProfilePage() {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ businessProfile: "", businessServices: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/agency/profile"],
    queryFn: () => apiFetch("/api/agency/profile"),
  });

  useEffect(() => {
    if (data) {
      setForm({
        businessProfile: data.businessProfile || "",
        businessServices: data.businessServices || "",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/api/agency/profile", {
      method: "PATCH",
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agency/profile"] });
      toast({ title: "Business profile saved!", description: "AI tools will now use this context for your agency." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isReadOnly = user?.role !== "AGENCY_ADMIN";

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Business Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Help AI tools understand your agency — personalised remarks, follow-ups and lead scoring
        </p>
      </div>

      {/* How AI uses this */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">How AI tools use your profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ["Smart Remarks", "Writes remarks relevant to your insurance type"],
                  ["Follow-up Generator", "Personalises messages for your services"],
                  ["Lead Scoring", "Weights scores based on your focus area"],
                  ["CRM Chatbot", "Answers questions with your business context"],
                ].map(([tool, desc]) => (
                  <div key={tool} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{tool}</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">{data?.name || "Your Agency"}</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Company Profile</Label>
            <Textarea
              placeholder="e.g. We are a Pune-based insurance agency serving individual customers and SMEs. Our team of 10 telecallers focuses on motor and health insurance with a personalised approach. We primarily work with referrals and walk-in clients."
              value={form.businessProfile}
              onChange={(e) => setForm({ ...form, businessProfile: e.target.value })}
              rows={5}
              disabled={isReadOnly}
              data-testid="input-business-profile"
            />
            <p className="text-xs text-muted-foreground">
              Describe your agency — city, target customers (individual/SME/corporate), team approach, key strengths
            </p>
          </div>

          <div className="space-y-2">
            <Label>Products / Services Sold</Label>
            <Input
              placeholder="e.g. Motor Insurance, Health Insurance, Term Life, Personal Accident, Home Insurance"
              value={form.businessServices}
              onChange={(e) => setForm({ ...form, businessServices: e.target.value })}
              disabled={isReadOnly}
              data-testid="input-business-services"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list of insurance products your agency sells
            </p>
          </div>

          {/* Preview of what AI sees */}
          {(form.businessProfile || form.businessServices) && (
            <div className="bg-muted/40 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What AI sees</p>
              {form.businessProfile && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Agency profile:</span> {form.businessProfile}
                </p>
              )}
              {form.businessServices && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Services offered:</span> {form.businessServices}
                </p>
              )}
            </div>
          )}

          {isReadOnly ? (
            <p className="text-xs text-muted-foreground text-center">Only AGENCY_ADMIN can edit the business profile.</p>
          ) : (
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-profile"
            >
              {saveMutation.isPending ? "Saving..." : "Save Business Profile"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
