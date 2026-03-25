import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy, Target, AlertTriangle,
  CheckCircle2, Clock, BarChart3, Medal,
  Zap, TrendingUp, Users, XCircle, Timer
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Excellent", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (score >= 60) return { label: "Good",      color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30" };
  if (score >= 40) return { label: "Average",   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" };
  return               { label: "Needs Work",   color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/30" };
}

function getSpeedLabel(hours: number): { label: string; color: string } {
  if (hours <= 4)  return { label: "Same day",   color: "text-emerald-600" };
  if (hours <= 24) return { label: "Next day",   color: "text-blue-600" };
  if (hours <= 48) return { label: "2 days",     color: "text-amber-600" };
  return               { label: "3+ days",       color: "text-red-600" };
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 1)   return "High confidence";
  if (confidence >= 0.6) return "Moderate confidence";
  return "Low confidence (few leads)";
}

// ─── Main export ─────────────────────────────────────────────────────────────

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

// ─── Personal Performance (Telecaller view) ──────────────────────────────────

function PersonalPerformance({ data }: { data: any }) {
  const scoreInfo    = getScoreLabel(data.score);
  const speedInfo    = getSpeedLabel(data.avgContactHours ?? 72);
  const confidenceLabel = getConfidenceLabel(data.confidence ?? 1);

  const radarData = [
    { metric: "Conversion",  value: Math.round(data.conversionQuality  ?? data.conversionRate  ?? 0) },
    { metric: "Speed",       value: Math.round(data.speedScore         ?? 0) },
    { metric: "Follow-Up",   value: Math.round(data.followUpDiscipline ?? 0) },
    { metric: "Coverage",    value: Math.round(data.leadCoverage       ?? data.activityConsistency ?? 0) },
    { metric: "Closure",     value: Math.round(data.closureScore       ?? 0) },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">My Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal KPI dashboard</p>
      </div>

      {/* Overall score hero */}
      <Card className={`border-2 ${scoreInfo.bg}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <div className="flex items-end gap-3">
                <span className={`text-6xl font-black ${scoreInfo.color}`}>{data.score}</span>
                <span className="text-2xl font-bold text-muted-foreground mb-2">/ 100</span>
              </div>
              <Badge className={`mt-2 ${scoreInfo.color} border-current`} variant="outline">
                {scoreInfo.label}
              </Badge>
              {(data.confidence ?? 1) < 1 && (
                <p className="text-xs text-muted-foreground mt-2">⚡ {confidenceLabel} — score stabilises as more leads are assigned</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <MiniStatBox label="Total Leads" value={data.totalLeads} icon={Users} color="text-blue-500" />
              <MiniStatBox label="Converted"   value={data.converted}  icon={CheckCircle2} color="text-emerald-500" />
              <MiniStatBox label="Follow-Ups"  value={data.followUps}  icon={Clock} color="text-amber-500" />
              <MiniStatBox label="Overdue"     value={data.overdueFollowUps} icon={AlertTriangle} color="text-red-500" />
            </div>
          </div>
          <Progress value={data.score} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* 5-metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Conversion Quality */}
        <MetricCard
          icon={Target}
          label="Conversion Quality"
          value={data.conversionQuality ?? data.conversionRate ?? 0}
          weight="35%"
          color="text-emerald-600"
          barColor="bg-emerald-500"
          description={`${data.converted} converted out of ${data.inPlay ?? (data.totalLeads - (data.newLeads ?? 0) - (data.notInterested ?? 0))} active leads`}
        />

        {/* Speed to Contact */}
        <MetricCard
          icon={Zap}
          label="Speed to Contact"
          value={data.speedScore ?? 0}
          weight="25%"
          color="text-blue-600"
          barColor="bg-blue-500"
          description={
            data.avgContactHours !== undefined
              ? `Avg ${data.avgContactHours}h to first contact — ${speedInfo.label}`
              : "No worked leads yet"
          }
          descriptionColor={data.avgContactHours !== undefined ? speedInfo.color : undefined}
        />

        {/* Follow-Up Discipline */}
        <MetricCard
          icon={Clock}
          label="Follow-Up Discipline"
          value={data.followUpDiscipline ?? 0}
          weight="20%"
          color="text-amber-600"
          barColor="bg-amber-500"
          description={
            data.followUps > 0
              ? `${data.followUps - data.overdueFollowUps} on-time out of ${data.followUps} follow-ups`
              : "No follow-ups scheduled yet"
          }
        />

        {/* Lead Coverage */}
        <MetricCard
          icon={TrendingUp}
          label="Lead Coverage"
          value={data.leadCoverage ?? data.activityConsistency ?? 0}
          weight="15%"
          color="text-purple-600"
          barColor="bg-purple-500"
          description={`${data.totalLeads - (data.newLeads ?? 0)} of ${data.totalLeads} leads touched`}
        />

        {/* Closure Decisiveness */}
        <MetricCard
          icon={XCircle}
          label="Closure Decisiveness"
          value={data.closureScore ?? 0}
          weight="5%"
          color="text-slate-600"
          barColor="bg-slate-500"
          description={`${data.notInterested ?? 0} leads decisively closed as Not Interested`}
        />

        {/* Confidence indicator */}
        <Card className="border border-dashed">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Data Confidence</span>
              </div>
              <span className="text-sm font-bold">{Math.round((data.confidence ?? 1) * 100)}%</span>
            </div>
            <Progress value={(data.confidence ?? 1) * 100} className="h-1.5 mb-3" />
            <p className="text-xs text-muted-foreground">{confidenceLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalLeads < 5
                ? `${5 - data.totalLeads} more lead${5 - data.totalLeads === 1 ? "" : "s"} needed for full accuracy`
                : "Score is fully reliable"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Radar chart */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-semibold text-sm">Performance Radar</h3>
          <p className="text-xs text-muted-foreground">All 5 metrics visualised — higher is better</p>
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
    </div>
  );
}

// ─── Team Performance (Admin / Team Leader view) ─────────────────────────────

function TeamPerformance({ data }: { data: any[] }) {
  const barData = data.map((p, i) => ({
    name: (p.fullName || "").split(" ")[0],
    score: p.score,
    fill: i === 0
      ? "hsl(142, 71%, 28%)"
      : i === 1
        ? "hsl(195, 76%, 32%)"
        : i === 2
          ? "hsl(27, 87%, 45%)"
          : "hsl(217, 91%, 35%)",
  }));

  const medals = ["text-yellow-500", "text-slate-400", "text-amber-700"];

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
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
          const initials   = (p.fullName || "").split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
          const scoreInfo  = getScoreLabel(p.score);
          const speedInfo  = getSpeedLabel(p.avgContactHours ?? 72);
          const lowConf    = (p.confidence ?? 1) < 0.6;

          return (
            <Card key={p.userId} data-testid={`card-performance-${p.userId}`}>
              <CardContent className="p-4">

                {/* Top row — name + score */}
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
                        {lowConf && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Low data
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>{p.totalLeads} leads</span>
                        <span>{p.converted} converted</span>
                        {p.overdueFollowUps > 0 && (
                          <span className="text-red-500">⚠ {p.overdueFollowUps} overdue</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-3xl font-black ${scoreInfo.color}`}>{p.score}</p>
                    <p className="text-xs text-muted-foreground">/ 100</p>
                    <Badge variant="outline" className={`text-[10px] mt-1 ${scoreInfo.color} border-current`}>
                      {scoreInfo.label}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <Progress value={p.score} className="mt-3 h-1.5" />

                {/* 5-metric mini grid */}
                <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                  <MiniStat
                    label="Conversion"
                    value={`${Math.round(p.conversionQuality ?? p.conversionRate ?? 0)}%`}
                    tooltip="Conversion Quality (35%)"
                  />
                  <MiniStat
                    label="Speed"
                    value={`${Math.round(p.speedScore ?? 0)}%`}
                    tooltip={p.avgContactHours !== undefined ? `Avg ${p.avgContactHours}h — ${speedInfo.label}` : "No data"}
                    valueColor={speedInfo.color}
                  />
                  <MiniStat
                    label="Follow-Up"
                    value={`${Math.round(p.followUpDiscipline ?? 0)}%`}
                    tooltip="Follow-Up Discipline (20%)"
                  />
                  <MiniStat
                    label="Coverage"
                    value={`${Math.round(p.leadCoverage ?? p.activityConsistency ?? 0)}%`}
                    tooltip="Lead Coverage (15%)"
                  />
                  <MiniStat
                    label="Closure"
                    value={`${Math.round(p.closureScore ?? 0)}%`}
                    tooltip="Closure Decisiveness (5%)"
                  />
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

// ─── Shared sub-components ───────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, weight, color, barColor, description, descriptionColor,
}: {
  icon: any; label: string; value: number; weight: string;
  color: string; barColor: string; description?: string; descriptionColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{weight}</Badge>
            <span className={`text-sm font-bold ${color}`}>{Math.round(value)}%</span>
          </div>
        </div>
        <Progress value={value} className="h-1.5 mb-2" />
        {description && (
          <p className={`text-xs mt-2 ${descriptionColor ?? "text-muted-foreground"}`}>{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStatBox({
  icon: Icon, label, value, color,
}: {
  icon: any; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 text-center">
      <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({
  label, value, tooltip, negative, valueColor,
}: {
  label: string; value: string; tooltip?: string; negative?: boolean; valueColor?: string;
}) {
  return (
    <div className="bg-muted/40 rounded p-2" title={tooltip}>
      <p className={`text-xs font-semibold ${valueColor ?? (negative ? "text-red-500" : "")}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}
