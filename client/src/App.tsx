import { useState, useRef, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, Info } from "lucide-react";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AgenciesPage from "@/pages/agencies";
import UsersPage from "@/pages/users";
import LeadsPage from "@/pages/leads";
import PerformancePage from "@/pages/performance";
import MeetingsPage from "@/pages/meetings";
import AuditLogsPage from "@/pages/audit-logs";
import ChangePasswordPage from "@/pages/change-password";
import ApprovalsPage from "@/pages/approvals";
import ReportsPage from "@/pages/reports";
import ServicesPage from "@/pages/services";
import UpgradeRequestsPage from "@/pages/upgrade-requests";
import RCLookupPage from "@/pages/rc-lookup";

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function NotificationBell() {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    refetchInterval: 60000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = notifications || [];
  const totalCount = items.reduce((sum: number, n: any) => sum + (n.count || 0), 0);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-notification-count">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-lg shadow-lg z-50" data-testid="dropdown-notifications">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              items.map((n: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 border-b last:border-0 hover:bg-muted/50" data-testid={`notification-item-${i}`}>
                  {n.severity === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-chart-5 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.type.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-2 border-b shrink-0 h-12">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/">
                <ProtectedRoute component={DashboardPage} />
              </Route>
              <Route path="/agencies">
                <ProtectedRoute component={AgenciesPage} allowedRoles={["MASTER_ADMIN"]} />
              </Route>
              <Route path="/users">
                <ProtectedRoute component={UsersPage} allowedRoles={["MASTER_ADMIN", "AGENCY_ADMIN", "TEAM_LEADER"]} />
              </Route>
              <Route path="/approvals">
                <ProtectedRoute component={ApprovalsPage} allowedRoles={["MASTER_ADMIN", "AGENCY_ADMIN"]} />
              </Route>
              <Route path="/leads">
                <ProtectedRoute component={LeadsPage} allowedRoles={["AGENCY_ADMIN", "TEAM_LEADER", "TELE_CALLER"]} />
              </Route>
              <Route path="/performance">
                <ProtectedRoute component={PerformancePage} allowedRoles={["AGENCY_ADMIN", "TEAM_LEADER", "TELE_CALLER"]} />
              </Route>
              <Route path="/meetings">
                <ProtectedRoute component={MeetingsPage} allowedRoles={["AGENCY_ADMIN", "MASTER_ADMIN","TEAM_LEADER"]} />
              </Route>
              <Route path="/services">
                <ProtectedRoute component={ServicesPage} allowedRoles={["AGENCY_ADMIN"]} />
              </Route>
              <Route path="/upgrade-requests">
                <ProtectedRoute component={UpgradeRequestsPage} allowedRoles={["MASTER_ADMIN", "AGENCY_ADMIN"]} />
              </Route>
              <Route path="/reports">
                <ProtectedRoute component={ReportsPage} allowedRoles={["AGENCY_ADMIN"]} />
              </Route>
              <Route path="/audit-logs">
                <ProtectedRoute component={AuditLogsPage} allowedRoles={["AGENCY_ADMIN", "TEAM_LEADER", "MASTER_ADMIN"]} />
              </Route>
              <Route path="/change-password">
                <ProtectedRoute component={ChangePasswordPage} />
              </Route>
              <Route path="/rc-lookup">
                <ProtectedRoute component={RCLookupPage} allowedRoles={["AGENCY_ADMIN", "TEAM_LEADER", "MASTER_ADMIN"]} />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route>
              <AuthenticatedLayout />
            </Route>
          </Switch>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
