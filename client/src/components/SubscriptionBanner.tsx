import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window { Razorpay: any; }
}

const PLAN_PRICES: Record<string, number> = {
  BASIC: 2500,
  PRO: 5500,
  ENTERPRISE: 12000,
};

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const { apiFetch } = useApi();

  const { data: subData } = useQuery({
    queryKey: ["/api/subscription/status"],
    queryFn: () => apiFetch("/api/subscription/status"),
    refetchInterval: 60000, // check every minute
    enabled: user?.role !== "MASTER_ADMIN",
  });

  if (!subData?.data || user?.role === "MASTER_ADMIN") return null;

  const { plan, status, daysLeft, expiry, isExpired, isTrial } = subData.data;

  const handleRenew = () => {
    const amount = PLAN_PRICES[plan] || 2500;

    const loadRazorpay = () => new Promise<void>((resolve) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      document.body.appendChild(script);
    });

    loadRazorpay().then(() => {
      const options = {
        key: "rzp_live_SRR1yJrdnx1oaW", // ← your live key
        amount: amount * 100,
        currency: "INR",
        name: "ICA – Innovation, Consulting & Automation",
        description: `ICA CRM – ${plan} Plan Renewal`,
        prefill: {
          name: user?.fullName || "",
          email: user?.email || "",
          contact: user?.mobile || "",
        },
        notes: {
          agency_code: user?.agencyCode || "",
          plan,
          user_id: user?.id || "",
          type: "renewal",
        },
        theme: { color: "#00c853" },
        handler: function (response: any) {
          alert(`✅ Payment successful! Payment ID: ${response.razorpay_payment_id}\n\nYour plan will be renewed within a few minutes.`);
        },
      };
      new window.Razorpay(options).open();
    });
  };

  // Don't show banner if status is ACTIVE and more than 7 days left
  if (status === "ACTIVE" && daysLeft > 7) return null;

  // EXPIRED banner
  if (isExpired || status === "EXPIRED") {
    return (
      <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Plan Expired</p>
            <p className="text-xs text-red-600 dark:text-red-500">Your {plan} plan has expired. Renew now to restore full access.</p>
          </div>
        </div>
        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-2 shrink-0" onClick={handleRenew}>
          <CreditCard className="w-4 h-4" />
          Renew ₹{PLAN_PRICES[plan]?.toLocaleString("en-IN")}/mo
        </Button>
      </div>
    );
  }

  // TRIAL banner
  if (isTrial) {
    return (
      <div className="mx-6 mt-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <p className="font-semibold text-blue-700 dark:text-blue-400 text-sm">Trial Period</p>
            <p className="text-xs text-blue-600 dark:text-blue-500">You're on a trial. Subscribe to keep your data and access.</p>
          </div>
        </div>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0" onClick={handleRenew}>
          <CreditCard className="w-4 h-4" />
          Subscribe — ₹{PLAN_PRICES[plan]?.toLocaleString("en-IN")}/mo
        </Button>
      </div>
    );
  }

  // EXPIRING SOON (≤7 days)
  if (daysLeft !== null && daysLeft <= 7 && daysLeft > 0) {
    const isUrgent = daysLeft <= 1;
    return (
      <div className={`mx-6 mt-4 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap border ${
        isUrgent
          ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
          : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
      }`}>
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 shrink-0 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
          <div>
            <p className={`font-semibold text-sm ${isUrgent ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
              {isUrgent ? "Plan expires tomorrow!" : `Plan expires in ${daysLeft} days`}
            </p>
            <p className={`text-xs ${isUrgent ? "text-red-600 dark:text-red-500" : "text-amber-600 dark:text-amber-500"}`}>
              Renew before {new Date(expiry).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to avoid interruption.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className={`gap-2 shrink-0 text-white ${isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
          onClick={handleRenew}
        >
          <CreditCard className="w-4 h-4" />
          Renew Now
        </Button>
      </div>
    );
  }

  return null;
}
