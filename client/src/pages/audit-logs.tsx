import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const statusLabels: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow Up",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not Interested",
};

const statusColors: Record<string, string> = {
  NEW: "bg-chart-1 text-white dark:text-white",
  CONTACTED: "bg-chart-2 text-white dark:text-white",
  FOLLOW_UP: "bg-chart-5 text-white dark:text-white",
  CONVERTED: "bg-chart-4 text-white dark:text-white",
  NOT_INTERESTED: "bg-destructive text-destructive-foreground",
};

export default function AuditLogsPage() {
  const { apiFetch } = useApi();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/audit-logs", page],
    queryFn: () => apiFetch(`/api/audit-logs?page=${page}&limit=${limit}`),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track all lead status changes ({total} total)</p>
      </div>

      <div className="grid gap-3">
        {logs.map((log: any) => (
          <Card key={log.id} data-testid={`card-log-${log.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.action}</span>
                      {log.oldStatus && (
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] ${statusColors[log.oldStatus] || ""}`}>
                            {statusLabels[log.oldStatus] || log.oldStatus}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge className={`text-[10px] ${statusColors[log.newStatus] || ""}`}>
                            {statusLabels[log.newStatus] || log.newStatus}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.remarks && <span>- {log.remarks}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {logs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No audit logs yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Status changes will appear here automatically</p>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
