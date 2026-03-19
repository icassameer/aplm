import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpCircle, CheckCircle2, XCircle, CreditCard } from "lucide-react";

const planOrder = ["BASIC", "PRO", "ENTERPRISE"];

const PLAN_PRICES: Record<string, number> = {
  BASIC: 2500,
  PRO: 5500,
  ENTERPRISE: 12000,
};

const planColors: Record<string, string> = {
  BASIC: "bg-muted text-muted-foreground",
  PRO: "bg-chart-2 text-white dark:text-white",
  ENTERPRISE: "bg-chart-1 text-white dark:text-white",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  APPROVED: "bg-green-100 text-green-700 border-green-200",
  DENIED: "bg-red-100 text-red-700 border-red-200",
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function UpgradeRequestsPage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMaster = user?.role === "MASTER_ADMIN";
  const [open, setOpen] = useState(false);
  const [requestedPlan, setRequestedPlan] = useState("");
  const [remarks, setRemarks] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const { data: dashboard } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiFetch("/api/dashboard"),
    enabled: !isMaster,
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["/api/upgrade-requests"],
    queryFn: () => apiFetch("/api/upgrade-requests"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/upgrade-requests", {
      method: "POST",
      body: JSON.stringify({ requestedPlan, remarks }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upgrade-requests"] });
      setOpen(false);
      setRequestedPlan("");
      setRemarks("");
      toast({ title: "Upgrade request submitted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/upgrade-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/upgrade-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agencies"] });
      toast({ title: "Request updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handlePayAndUpgrade = (planKey: string) => {
    const amount = PLAN_PRICES[planKey];
    if (!amount) return;

    setPayLoading(true);

    // Load Razorpay script dynamically if not already loaded
    const loadRazorpay = () => new Promise<void>((resolve) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    });

    loadRazorpay().then(() => {
      const options = {
        key: "rzp_live_SRR1yJrdnx1oaW", // ← paste your live key here
        amount: amount * 100, // in paise
        currency: "INR",
        name: "ICA – Innovation, Consulting & Automation",
        description: `ICA CRM – ${planKey} Plan`,
        prefill: {
          name: user?.fullName || "",
          email: user?.email || "",
          contact: user?.mobile || "",
        },
        notes: {
          agency_code: user?.agencyCode || "",
          plan: planKey,
          user_id: user?.id || "",
        },
        theme: { color: "#00c853" },
        handler: function (response: any) {
          setPayLoading(false);
          toast({
            title: "✅ Payment Successful!",
            description: `Payment ID: ${response.razorpay_payment_id}. Our team will activate your ${planKey} plan shortly.`,
          });
          // Submit upgrade request automatically after payment
          apiFetch("/api/upgrade-requests", {
            method: "POST",
            body: JSON.stringify({
              requestedPlan: planKey,
              remarks: `Payment completed. Payment ID: ${response.razorpay_payment_id}`,
            }),
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/upgrade-requests"] });
          });
        },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setPayLoading(false);
        toast({
          title: "Payment Failed",
          description: response.error?.description || "Please try again.",
          variant: "destructive",
        });
      });
      rzp.open();
    }).catch(() => {
      setPayLoading(false);
      toast({ title: "Error", description: "Could not load payment gateway. Please try again.", variant: "destructive" });
    });
  };

  const agency = dashboard?.agency;
  const currentPlan = agency?.plan || "BASIC";
  const availableUpgrades = planOrder.filter(p => planOrder.indexOf(p) > planOrder.indexOf(currentPlan));

  const { data: addonBalance } = useQuery({
    queryKey: ["/api/addons/balance", agency?.agencyCode],
    queryFn: async () => {
      if (!agency?.agencyCode) return null;
      const res = await fetch(`/api/addons/balance?agencyCode=${agency.agencyCode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.success ? data.data : null;
    },
    enabled: !!agency?.agencyCode && !isMaster,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            {isMaster ? "Upgrade Requests" : "Plan & Upgrade"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isMaster ? "Review agency plan upgrade requests" : "Manage your subscription plan"}
          </p>
        </div>
      </div>

      {!isMaster && agency && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <div className="mt-1">
                <Badge className={planColors[currentPlan]}>{currentPlan}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Lead Limit</p>
              <p className="text-2xl font-bold mt-1" data-testid="text-lead-limit">{agency.leadLimit}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">User Limit</p>
              <p className="text-2xl font-bold mt-1" data-testid="text-user-limit">{agency.userLimit}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">RC Add-on Credits</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{addonBalance?.rcAddonCredits ?? 0}</p>
              <a href="https://icaweb.in/#addons" target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-1 block">+ Buy more</a>
            </CardContent>
          </Card>
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">AI Add-on Credits</p>
              <p className="text-2xl font-bold mt-1 text-purple-600">{addonBalance?.aiAddonCredits ?? 0}</p>
              <a href="https://icaweb.in/#addons" target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-500 hover:underline mt-1 block">+ Buy more</a>
            </CardContent>
          </Card>
        </div>
      )}

      {!isMaster && availableUpgrades.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {/* Pay & Upgrade button — opens Razorpay directly */}
          {availableUpgrades.map(plan => (
            <Button
              key={plan}
              variant="default"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handlePayAndUpgrade(plan)}
              disabled={payLoading}
            >
              <CreditCard className="w-4 h-4" />
              {payLoading ? "Loading..." : `Pay & Upgrade to ${plan} — ₹${PLAN_PRICES[plan].toLocaleString("en-IN")}/mo`}
            </Button>
          ))}

          {/* Request upgrade manually (no payment) */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-request-upgrade">
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Request Plan Upgrade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Plan Upgrade</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Plan</Label>
                  <Badge className={planColors[currentPlan]}>{currentPlan}</Badge>
                </div>
                <div className="space-y-2">
                  <Label>Upgrade To</Label>
                  <Select value={requestedPlan} onValueChange={setRequestedPlan}>
                    <SelectTrigger data-testid="select-plan"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {availableUpgrades.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Remarks (optional)</Label>
                  <Textarea
                    data-testid="input-upgrade-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Why do you need this upgrade?"
                    rows={3}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || !requestedPlan}
                  data-testid="button-submit-upgrade"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Request History</h3>
        {requests?.map((r: any) => (
          <Card key={r.id} data-testid={`card-upgrade-${r.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowUpCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={planColors[r.currentPlan]}>{r.currentPlan}</Badge>
                      <span className="text-xs text-muted-foreground">to</span>
                      <Badge className={planColors[r.requestedPlan]}>{r.requestedPlan}</Badge>
                      <Badge variant="outline" className={statusColors[r.status]}>{r.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{r.agencyCode}</span>
                      <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</span>
                    </div>
                    {r.remarks && <p className="text-xs text-muted-foreground mt-1">{r.remarks}</p>}
                  </div>
                </div>
                {isMaster && r.status === "PENDING" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm" variant="default"
                      onClick={() => actionMutation.mutate({ id: r.id, status: "APPROVED" })}
                      disabled={actionMutation.isPending}
                      data-testid={`button-approve-upgrade-${r.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm" variant="destructive"
                      onClick={() => actionMutation.mutate({ id: r.id, status: "DENIED" })}
                      disabled={actionMutation.isPending}
                      data-testid={`button-deny-upgrade-${r.id}`}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!requests || requests.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <ArrowUpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No upgrade requests yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
