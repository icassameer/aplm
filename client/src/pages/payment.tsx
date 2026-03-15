import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, CreditCard, Shield, Zap } from "lucide-react";

declare global {
  interface Window { Razorpay: any; }
}

const PLAN_FEATURES: Record<string, string[]> = {
  BASIC: ["500 Leads", "5 Users", "WhatsApp Integration", "Automated Emails", "Basic Reports"],
  PRO: ["2,000 Leads", "10 Users", "15 AI Proceedings/month", "50 RC Lookups/month", "Advanced Reports", "Email + Chat Support"],
  ENTERPRISE: ["10,000 Leads", "25 Users", "40 AI Proceedings/month", "200 RC Lookups/month", "Full Analytics", "Dedicated Manager"],
};

export default function PaymentPage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId");
  const plan = params.get("plan") || "";
  const amount = parseInt(params.get("amount") || "0");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const orderData = await apiFetch("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify({ plan, agencyCode: user?.agencyCode }),
      });
      if (!orderData.success) {
        toast({ title: "Failed to create order", description: orderData.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const { orderId: newOrderId, amount: newAmount, keyId } = orderData.data;

      const options = {
        key: keyId,
        amount: newAmount,
        currency: "INR",
        name: "ICA CRM",
        description: `${plan} Plan - Monthly Subscription`,
        order_id: orderId || newOrderId,
        prefill: { name: user?.fullName || "", email: user?.email || "" },
        theme: { color: "#1e3a5f" },
        handler: async (response: any) => {
          try {
            const verify = await apiFetch("/api/payments/verify", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verify.success) {
              setPaid(true);
              toast({ title: "Payment successful! Plan upgraded." });
            } else {
              toast({ title: "Verification failed", description: verify.message, variant: "destructive" });
            }
          } catch (err: any) {
            toast({ title: "Verification error", description: err.message, variant: "destructive" });
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700">Payment Successful!</h2>
            <p className="text-muted-foreground">Your <strong>{plan} Plan</strong> is now active. A confirmation email has been sent.</p>
            <Button className="w-full mt-4" onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Complete Your Payment</h1>
          <p className="text-muted-foreground mt-1">ICA CRM — {plan} Plan</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">{plan} Plan</p>
                <p className="text-sm text-muted-foreground">Monthly Subscription</p>
              </div>
              <Badge className="text-lg px-4 py-2 bg-primary text-white">
                ₹{(amount / 100).toLocaleString()}
              </Badge>
            </div>
            <div className="border-t pt-4 space-y-2">
              {(PLAN_FEATURES[plan] || []).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Button className="w-full gap-2 mt-2" onClick={handlePayment} disabled={loading}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CreditCard className="w-4 h-4" />}
              {loading ? "Processing..." : `Pay ₹${(amount / 100).toLocaleString()}`}
            </Button>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure Payment</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant Activation</span>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Powered by Razorpay • UPI, Cards, NetBanking accepted
        </p>
      </div>
    </div>
  );
}
