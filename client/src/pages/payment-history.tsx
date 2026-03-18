import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IndianRupee, Receipt, Building2, CheckCircle, Clock, XCircle } from "lucide-react";

const planColors: Record<string, string> = {
  BASIC: "bg-slate-100 text-slate-700 border-slate-200",
  PRO: "bg-blue-100 text-blue-700 border-blue-200",
  ENTERPRISE: "bg-purple-100 text-purple-700 border-purple-200",
};

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  PAID:     { color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle, label: "Paid" },
  CAPTURED: { color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle, label: "Captured" },
  CREATED:  { color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock,       label: "Pending" },
  FAILED:   { color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle,     label: "Failed" },
};

export default function PaymentHistoryPage() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const res = await fetch("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data as any[];
    },
  });

  const payments = data || [];

  const totalRevenue = payments
    .filter((p: any) => ["PAID", "CAPTURED"].includes(p.status))
    .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

  const paidCount = payments.filter((p: any) => ["PAID", "CAPTURED"].includes(p.status)).length;
  const pendingCount = payments.filter((p: any) => p.status === "CREATED").length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-52" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All agency subscription payments — {payments.length} transaction{payments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue Collected</p>
              <p className="text-xl font-bold">₹{(totalRevenue / 100).toLocaleString("en-IN")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Successful Payments</p>
              <p className="text-xl font-bold">{paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending / Incomplete</p>
              <p className="text-xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No payments yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Payment records will appear here once agencies subscribe</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-4 font-medium text-muted-foreground">Agency</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Razorpay Order ID</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Payment ID</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any, idx: number) => {
                    const sc = statusConfig[p.status] || statusConfig.CREATED;
                    const StatusIcon = sc.icon;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        <td className="p-4">
                          <div className="font-medium">{p.agencyName || p.agencyCode}</div>
                          <div className="text-xs text-muted-foreground">{p.agencyCode}</div>
                        </td>
                        <td className="p-4">
                          <Badge className={`text-xs ${planColors[p.plan] || "bg-gray-100 text-gray-700"}`}>{p.plan}</Badge>
                        </td>
                        <td className="p-4">
                          <span className={`font-semibold ${["PAID","CAPTURED"].includes(p.status) ? "text-green-700" : "text-muted-foreground"}`}>
                            ₹{p.amount ? (p.amount / 100).toLocaleString("en-IN") : "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge className={`text-xs flex items-center gap-1 w-fit ${sc.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                            {p.razorpayOrderId ? p.razorpayOrderId.slice(-12) : "—"}
                          </code>
                        </td>
                        <td className="p-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                            {p.razorpayPaymentId ? p.razorpayPaymentId.slice(-12) : "—"}
                          </code>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
