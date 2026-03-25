import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Phone, TrendingUp, CheckCircle2, Clock,
  XCircle, AlertTriangle, BarChart3, UserCheck, ArrowUpCircle,
  Trophy, Target, Briefcase
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  NEW: "hsl(217, 91%, 35%)",
  CONTACTED: "hsl(195, 76%, 32%)",
  FOLLOW_UP: "hsl(27, 87%, 45%)",
  CONVERTED: "hsl(142, 71%, 28%)",
  NOT_INTERESTED: "hsl(0, 84%, 35%)",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow Up",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not Interested",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiFetch("/api/dashboard"),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (user?.role === "MASTER_ADMIN") return <MasterDashboard data={dashboard} />;
  if (user?.role === "AGENCY_ADMIN") return <AgencyAdminDashboard data={dashboard} />;
  if (user?.role === "TEAM_LEADER") return <TeamLeaderDashboard data={dashboard} />;
  return <TelecallerDashboard data={dashboard} />;
}

function MasterDashboard({ data }: { data: any }) {
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Global Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System-wide overview across all agencies</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Agencies" value={data?.totalAgencies || 0} sub={`${data?.activeAgencies || 0} active`} color="text-chart-1" />
        <StatCard icon={Phone} label="Total Leads" value={data?.totalLeads || 0} sub="Across all agencies" color="text-chart-2" />
        <StatCard icon={Users} label="Total Users" value={data?.totalUsers || 0} sub="All roles" color="text-chart-3" />
        <StatCard icon={UserCheck} label="Pending Approvals" value={data?.pendingApprovals || 0} sub="Awaiting action" color="text-chart-5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-chart-4" />
              <div>
                <p className="text-xs text-muted-foreground">Active Agencies</p>
                <p className="text-lg font-bold">{data?.activeAgencies || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Inactive Agencies</p>
                <p className="text-lg font-bold">{data?.inactiveAgencies || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="w-5 h-5 text-chart-2" />
              <div>
                <p className="text-xs text-muted-foreground">Pending Upgrades</p>
                <p className="text-lg font-bold">{data?.pendingUpgradeRequests || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.agencies && data.agencies.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Leads per Agency
              </h3>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.agencies.map((a: any) => ({ name: a.name, leads: a.leadCount, limit: a.leadLimit }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="leads" fill="hsl(217, 91%, 35%)" name="Current Leads" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="limit" fill="hsl(var(--muted))" name="Lead Limit" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Agency Overview
              </h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.agencies.map((agency: any) => (
                  <div
                    key={agency.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/30"
                    data-testid={`card-agency-${agency.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{agency.name}</p>
                        <Badge variant="secondary" className="text-[10px]">{agency.agencyCode}</Badge>
                        <Badge variant={agency.isActive ? "default" : "destructive"} className="text-[10px]">
                          {agency.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{agency.plan}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Leads: {agency.leadCount}/{agency.leadLimit} | Users: {agency.userLimit} max
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AgencyAdminDashboard({ data }: { data: any }) {
  const stats = data?.leadStats || {};
  const totalLeads = data?.totalLeads || 0;
  const conversionRate = totalLeads > 0 ? ((stats.CONVERTED || 0) / totalLeads * 100).toFixed(1) : "0";
  const followUpRate = totalLeads > 0 ? ((stats.FOLLOW_UP || 0) / totalLeads * 100).toFixed(1) : "0";

  const pieData = Object.entries(stats)
    .filter(([_, v]) => (v as number) > 0)
    .map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value: value as number, color: STATUS_COLORS[key] || "#888" }));

  const inProgressCount = (stats.CONTACTED || 0) + (stats.FOLLOW_UP || 0) + (stats.CONVERTED || 0) + (stats.NOT_INTERESTED || 0);
  const barData = [
    { name: "New", count: stats.NEW || 0, fill: STATUS_COLORS["NEW"] || "#888" },
    { name: "In Progress", count: inProgressCount, fill: STATUS_COLORS["CONTACTED"] || "#888" },
    { name: "Follow Up", count: stats.FOLLOW_UP || 0, fill: STATUS_COLORS["FOLLOW_UP"] || "#888" },
    { name: "Converted", count: stats.CONVERTED || 0, fill: STATUS_COLORS["CONVERTED"] || "#888" },
    { name: "Not Interested", count: stats.NOT_INTERESTED || 0, fill: STATUS_COLORS["NOT_INTERESTED"] || "#888" },
  ];

  const perfData = data?.telecallerPerformances || [];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Agency Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.agency?.name ? `${data.agency.name} (${data.agency.agencyCode})` : "Agency overview"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Total Leads" value={totalLeads} color="text-chart-1" />
        <StatCard icon={CheckCircle2} label="Converted" value={stats.CONVERTED || 0} sub={`${conversionRate}%`} color="text-chart-4" />
        <StatCard icon={Clock} label="Follow Ups" value={stats.FOLLOW_UP || 0} sub={`${followUpRate}%`} color="text-chart-5" />
        <StatCard icon={TrendingUp} label="New Leads" value={stats.NEW || 0} color="text-chart-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-chart-3" />
              <div>
                <p className="text-xs text-muted-foreground">Team Size</p>
                <p className="text-lg font-bold">{data?.userCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-chart-2" />
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <Badge variant="secondary">{data?.agency?.plan}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-chart-4" />
              <div>
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="text-lg font-bold">{data?.services?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-chart-5" />
              <div>
                <p className="text-xs text-muted-foreground">Not Interested</p>
                <p className="text-lg font-bold">{stats.NOT_INTERESTED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm">Lead Distribution</h3>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm">Status Breakdown</h3>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {perfData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Telecaller Performance
            </h3>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="score" fill="hsl(217, 91%, 35%)" name="Score" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamLeaderDashboard({ data }: { data: any }) {
  const stats = data?.leadStats || {};
  const totalLeads = data?.totalLeads || 0;
  const conversionRate = totalLeads > 0 ? ((stats.CONVERTED || 0) / totalLeads * 100).toFixed(1) : "0";
  const telecallerStats = data?.telecallerStats || [];

  const comparisonData = telecallerStats.map((tc: any) => ({
    name: tc.name,
    NEW: tc.NEW || 0,
    CONTACTED: tc.CONTACTED || 0,
    FOLLOW_UP: tc.FOLLOW_UP || 0,
    CONVERTED: tc.CONVERTED || 0,
    NOT_INTERESTED: tc.NOT_INTERESTED || 0,
  }));

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Team Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.agency?.name ? `${data.agency.name}` : "Team overview"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Total Leads" value={totalLeads} color="text-chart-1" />
        <StatCard icon={CheckCircle2} label="Converted" value={stats.CONVERTED || 0} sub={`${conversionRate}%`} color="text-chart-4" />
        <StatCard icon={Clock} label="Follow Ups" value={stats.FOLLOW_UP || 0} color="text-chart-5" />
        <StatCard icon={Users} label="Team Size" value={data?.userCount || 0} color="text-chart-3" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Lead Distribution</h3>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(stats).filter(([_, v]) => (v as number) > 0).map(([k, v]) => ({
                      name: STATUS_LABELS[k] || k, value: v as number, color: STATUS_COLORS[k] || "#888"
                    }))}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                  >
                    {Object.entries(stats).filter(([_, v]) => (v as number) > 0).map(([k], i) => (
                      <Cell key={i} fill={STATUS_COLORS[k] || "#888"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {comparisonData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-sm">Telecaller Comparison</h3>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="CONVERTED" stackId="a" fill={STATUS_COLORS.CONVERTED} name="Converted" />
                    <Bar dataKey="FOLLOW_UP" stackId="a" fill={STATUS_COLORS.FOLLOW_UP} name="Follow Up" />
                    <Bar dataKey="CONTACTED" stackId="a" fill={STATUS_COLORS.CONTACTED} name="Contacted" />
                    <Bar dataKey="NEW" stackId="a" fill={STATUS_COLORS.NEW} name="New" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TelecallerDashboard({ data }: { data: any }) {
  const stats = data?.leadStats || {};
  const totalLeads = data?.totalLeads || 0;
  const perf = data?.performance || {};
  const conversionRate = totalLeads > 0 ? ((stats.CONVERTED || 0) / totalLeads * 100).toFixed(1) : "0";

  const radarData = [
    { metric: "Conversion", value: perf.conversionRate || 0, fullMark: 100 },
    { metric: "Follow-Up", value: perf.followUpDiscipline || 0, fullMark: 100 },
    { metric: "Activity", value: perf.activityConsistency || 0, fullMark: 100 },
    { metric: "Timeliness", value: Math.max(0, 100 - (perf.overduePenalty || 0)), fullMark: 100 },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal performance overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Score" value={`${perf.score || 0}%`} color="text-chart-5" />
        <StatCard icon={Target} label="Conversion" value={`${conversionRate}%`} color="text-chart-4" />
        <StatCard icon={Phone} label="Total Leads" value={totalLeads} color="text-chart-1" />
        <StatCard icon={CheckCircle2} label="Converted" value={stats.CONVERTED || 0} color="text-chart-4" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active Follow Ups</p>
            <p className="text-2xl font-bold mt-1 text-chart-2">{stats.FOLLOW_UP || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{perf.overdueFollowUps || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Status Distribution</h3>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(stats).filter(([_, v]) => (v as number) > 0).map(([k, v]) => ({
                      name: STATUS_LABELS[k] || k, value: v as number, color: STATUS_COLORS[k] || "#888"
                    }))}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                  >
                    {Object.entries(stats).filter(([_, v]) => (v as number) > 0).map(([k], i) => (
                      <Cell key={i} fill={STATUS_COLORS[k] || "#888"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {Object.entries(stats).filter(([_, v]) => (v as number) > 0).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[k] }} />
                  <span className="text-muted-foreground">{STATUS_LABELS[k]}: {v as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Performance Radar</h3>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Score" dataKey="value" stroke="hsl(217, 91%, 35%)" fill="hsl(217, 91%, 35%)" fillOpacity={0.2} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {perf.score !== undefined && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Score Breakdown</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricBar label="Conversion Rate" value={perf.conversionRate || 0} weight="40%" color="bg-chart-4" />
            <MetricBar label="Follow-Up Discipline" value={perf.followUpDiscipline || 0} weight="30%" color="bg-chart-2" />
            <MetricBar label="Activity Consistency" value={perf.activityConsistency || 0} weight="20%" color="bg-chart-3" />
            <MetricBar label="Overdue Penalty" value={perf.overduePenalty || 0} weight="10%" color="bg-destructive" isNegative />
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-semibold text-sm">Overall Score</span>
                <span className="text-2xl font-bold">{perf.score}%</span>
              </div>
              <Progress value={perf.score} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1" data-testid={`text-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-5 h-5 ${color} shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBar({ label, value, weight, color, isNegative }: {
  label: string; value: number; weight: string; color: string; isNegative?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-sm">{label}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{weight}</Badge>
          <span className={`text-sm font-semibold ${isNegative ? "text-destructive" : ""}`}>
            {isNegative ? `-${value}%` : `${value}%`}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><Skeleton className="h-64" /></CardContent></Card>
        <Card><CardContent className="p-4"><Skeleton className="h-64" /></CardContent></Card>
      </div>
    </div>
  );
}
