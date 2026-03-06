import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy, TrendingUp, Target, AlertTriangle,
  CheckCircle2, Clock, BarChart3, Medal
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

export default function PerformancePage() {
  const { user } = useAuth();
  const { apiFetch } = useApi();

  const { data: performances, isLoading } = useQuery({
    queryKey: ["/api/performance/telecaller"],
    queryFn: () => apiFetch("/api/performance/telecaller"),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  const isTelecaller = user?.role === "TELE_CALLER";

  if (isTelecaller && performances?.length > 0) {
    return <PersonalPerformance data={performances[0]} />;
  }

  return <TeamPerformance data={performances || []} />;
}

function PersonalPerformance({ data }: { data: any }) {
  const radarData = [
    { metric: "Conversion", value: data.conversionRate, fullMark: 100 },
    { metric: "Follow-Up", value: data.followUpDiscipline, fullMark: 100 },
    { metric: "Activity", value: data.activityConsistency, fullMark: 100 },
    { metric: "Timeliness", value: Math.max(0, 100 - data.overduePenalty), fullMark: 100 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">My Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal KPI dashboard</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard icon={Trophy} label="Overall Score" value={`${data.score}%`} color="text-chart-5" />
        <ScoreCard icon={Target} label="Conversion Rate" value={`${data.conversionRate}%`} color="text-chart-4" />
        <ScoreCard icon={CheckCircle2} label="Converted" value={data.converted} color="text-chart-4" />
        <ScoreCard icon={Clock} label="Follow Ups" value={data.followUps} color="text-chart-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Performance Radar</h3>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="hsl(217, 91%, 35%)"
                    fill="hsl(217, 91%, 35%)"
                    fillOpacity={0.2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Score Breakdown</h3>
          </CardHeader>
          <CardContent className="space-y-5">
            <MetricBar label="Conversion Rate" value={data.conversionRate} weight="40%" color="bg-chart-4" />
            <MetricBar label="Follow-Up Discipline" value={data.followUpDiscipline} weight="30%" color="bg-chart-2" />
            <MetricBar label="Activity Consistency" value={data.activityConsistency} weight="20%" color="bg-chart-3" />
            <MetricBar label="Overdue Penalty" value={data.overduePenalty} weight="10%" color="bg-destructive" isNegative />

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="font-semibold text-sm">Overall Score</span>
                <span className="text-2xl font-bold">{data.score}%</span>
              </div>
              <Progress value={data.score} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total Leads</p>
            <p className="text-2xl font-bold mt-1">{data.totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Converted</p>
            <p className="text-2xl font-bold mt-1 text-chart-4">{data.converted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active Follow Ups</p>
            <p className="text-2xl font-bold mt-1 text-chart-2">{data.followUps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{data.overdueFollowUps}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeamPerformance({ data }: { data: any[] }) {
  const barData = data.map((p, i) => ({
    name: p.fullName || `User ${i + 1}`,
    score: p.score,
    fill: i === 0 ? "hsl(142, 71%, 28%)" : i === 1 ? "hsl(195, 76%, 32%)" : i === 2 ? "hsl(27, 87%, 45%)" : "hsl(217, 91%, 35%)",
  }));

  const medals = ["text-chart-5", "text-muted-foreground", "text-chart-5"];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Team Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Telecaller rankings and KPIs</p>
      </div>

      {barData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-sm">Performance Rankings</h3>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {data.map((p: any, index: number) => {
          const initials = (p.fullName || "").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
          return (
            <Card key={p.userId} data-testid={`card-performance-${p.userId}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="text-sm bg-muted">{initials}</AvatarFallback>
                      </Avatar>
                      {index < 3 && (
                        <Medal className={`w-4 h-4 absolute -top-1 -right-1 ${medals[index]}`} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{p.fullName}</p>
                        <Badge variant="secondary" className="text-[10px]">#{index + 1}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>Leads: {p.totalLeads}</span>
                        <span>Converted: {p.converted}</span>
                        <span>Follow-ups: {p.followUps}</span>
                        <span>Overdue: {p.overdueFollowUps}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-2xl font-bold">{p.score}%</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                  <MiniStat label="Conv. Rate" value={`${p.conversionRate}%`} />
                  <MiniStat label="Follow-Up" value={`${p.followUpDiscipline}%`} />
                  <MiniStat label="Activity" value={`${p.activityConsistency}%`} />
                  <MiniStat label="Overdue" value={`${p.overduePenalty}%`} negative />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No performance data</h3>
            <p className="text-sm text-muted-foreground mt-1">Assign leads to telecallers to see performance data</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
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
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="p-2 rounded-md bg-muted/30">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${negative ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
