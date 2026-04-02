import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/use-api";
import {
  MapPin, Clock, LogIn, LogOut, Users, CheckCircle, XCircle,
  Calendar, Navigation, Settings, ChevronDown, ChevronUp,
  TrendingUp, Award, AlertCircle, Timer
} from "lucide-react";

function formatTime(ts: string | null) {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function getDayName(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
}
function calcHours(punchIn: string | null, punchOut: string | null): string {
  if (!punchIn || !punchOut) return "--";
  const diff = (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / 3600000;
  return diff > 0 ? `${diff.toFixed(1)}h` : "--";
}
function calcHoursNum(punchIn: string | null, punchOut: string | null): number {
  if (!punchIn || !punchOut) return 0;
  return Math.max(0, (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / 3600000);
}

export default function AttendancePage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [officeRadius, setOfficeRadius] = useState("100");
  const [showDetails, setShowDetails] = useState(false);
  const role = user?.role;
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedEmployee, setSelectedEmployee] = useState("ALL");

  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/attendance/today"],
    queryFn: () => apiFetch("/api/attendance/today"),
    refetchInterval: 30000,
  });

  const { data: allRecords, isLoading: listLoading } = useQuery({
    queryKey: ["/api/attendance", selectedMonth],
    queryFn: () => apiFetch(`/api/attendance?month=${selectedMonth}`),
  });

  const { data: commissionSettings } = useQuery({
    queryKey: ["/api/agency/commission-settings"],
    queryFn: () => apiFetch("/api/agency/commission-settings"),
    enabled: role === "AGENCY_ADMIN",
    onSuccess: (data: any) => {
      if (data?.officeLatitude) setOfficeLat(data.officeLatitude);
      if (data?.officeLongitude) setOfficeLng(data.officeLongitude);
      if (data?.officeRadiusMeters) setOfficeRadius(String(data.officeRadiusMeters));
    }
  });

  const handlePunch = async (type: "in" | "out") => {
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`/api/attendance/punch-${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude, longitude }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: type === "in" ? "Punched In!" : "Punched Out!", description: `Time: ${formatTime(new Date().toISOString())}` });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = async () => {
    setLocationLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      setOfficeLat(String(pos.coords.latitude));
      setOfficeLng(String(pos.coords.longitude));
      toast({ title: "Location captured!" });
    } catch {
      toast({ title: "Location Error", description: "Please allow location access.", variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    setSavingLocation(true);
    try {
      const res = await fetch("/api/agency/office-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ officeLatitude: officeLat, officeLongitude: officeLng, officeRadiusMeters: Number(officeRadius) || 100 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/commission-settings"] });
      toast({ title: "Office location saved!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingLocation(false);
    }
  };

  const isPunchedIn = !!todayRecord?.punchInAt;
  const isPunchedOut = !!todayRecord?.punchOutAt;
  const hasOfficeLocation = commissionSettings?.officeLatitude && commissionSettings?.officeLongitude;
  const allRecordsRaw = allRecords || [];
  const records = selectedEmployee === "ALL"
    ? allRecordsRaw
    : allRecordsRaw.filter((r: any) => r.userId === selectedEmployee);

  // ── Analytics ──────────────────────────────────────────────────────────────
  // Build full staff list from unfiltered records for dropdown
  const allStaff: Record<string, string> = {};
  (allRecords || []).forEach((r: any) => { allStaff[r.userId] = r.userName || "Unknown"; });
  const isTeamView = role === "AGENCY_ADMIN" || role === "TEAM_LEADER";

  // Get all unique staff and working days in selected month
  const staffMap: Record<string, { name: string; records: any[] }> = {};
  const daySet = new Set<string>();
  records.forEach((r: any) => {
    if (!staffMap[r.userId]) staffMap[r.userId] = { name: r.userName || "Unknown", records: [] };
    staffMap[r.userId].records.push(r);
    daySet.add(r.date);
  });

  // Get working days in selected month (Mon-Sat)
  const [selYear, selMonthNum] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
  const workingDaysInMonth: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedMonth}-${String(d).padStart(2, "0")}`;
    const dow = new Date(dateStr + "T00:00:00").getDay();
    if (dow !== 0) workingDaysInMonth.push(dateStr); // exclude Sunday only
  }
  // Filter to dates up to today
  const today2 = new Date().toISOString().split("T")[0];
  const relevantWorkingDays = workingDaysInMonth.filter(d => d <= today2);

  // Person-wise summary
  const personSummary = Object.entries(staffMap).map(([userId, { name, records: recs }]) => {
    const presentDays = recs.filter(r => r.punchInAt).length;
    const absentDays = Math.max(0, relevantWorkingDays.length - presentDays);
    const hoursArr = recs.map(r => calcHoursNum(r.punchInAt, r.punchOutAt)).filter(h => h > 0);
    const avgHours = hoursArr.length > 0 ? hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length : 0;
    const punchIns = recs.filter(r => r.punchInAt).map(r => new Date(r.punchInAt).getHours() * 60 + new Date(r.punchInAt).getMinutes());
    const avgPunchIn = punchIns.length > 0 ? Math.round(punchIns.reduce((a, b) => a + b, 0) / punchIns.length) : null;
    return { userId, name, presentDays, absentDays, avgHours, avgPunchIn, totalDays: relevantWorkingDays.length };
  }).sort((a, b) => b.presentDays - a.presentDays);

  // Day-wise summary
  const dayWise = relevantWorkingDays.slice().reverse().map(date => {
    const dayRecords = records.filter((r: any) => r.date === date);
    const present = dayRecords.filter((r: any) => r.punchInAt).length;
    const totalStaff = Object.keys(staffMap).length;
    const absent = Math.max(0, totalStaff - present);
    const pct = totalStaff > 0 ? Math.round((present / totalStaff) * 100) : 0;
    return { date, present, absent, total: totalStaff, pct };
  });

  // Quick stats
  const totalPresent = records.filter((r: any) => r.punchInAt).length;
  const totalStaffCount = Object.keys(staffMap).length;
  const avgAttPct = relevantWorkingDays.length > 0 && totalStaffCount > 0
    ? Math.round(totalPresent / (relevantWorkingDays.length * totalStaffCount) * 100)
    : 0;
  const bestPerformer = personSummary[0];
  const needsAttention = [...personSummary].sort((a, b) => a.presentDays - b.presentDays)[0];

  const monthLabel = new Date(selectedMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === "TELE_CALLER" ? "Track your daily attendance" : "Team attendance management"}
          </p>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedEmployee("ALL"); }}
              className="border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {isTeamView && Object.keys(allStaff).length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">All Employees</option>
                {Object.entries(allStaff).sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Office Location Settings — Agency Admin only */}
      {role === "AGENCY_ADMIN" && (
        <Card className={!hasOfficeLocation ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Office Location Settings
              {hasOfficeLocation ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs ml-2"><CheckCircle className="w-3 h-3 mr-1" />Set</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs ml-2">Not Set</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasOfficeLocation && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠️ Office location not set. Telecallers can punch in from anywhere.
              </p>
            )}
            {hasOfficeLocation && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✅ Office: {parseFloat(commissionSettings.officeLatitude).toFixed(4)}, {parseFloat(commissionSettings.officeLongitude).toFixed(4)} — Radius: {commissionSettings.officeRadiusMeters}m
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input placeholder="e.g. 17.6868" value={officeLat} onChange={(e) => setOfficeLat(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input placeholder="e.g. 75.9064" value={officeLng} onChange={(e) => setOfficeLng(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Allowed Radius (meters)</Label><Input type="number" min="10" max="5000" value={officeRadius} onChange={(e) => setOfficeRadius(e.target.value)} /></div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handleUseMyLocation} disabled={locationLoading}>
                <Navigation className="w-4 h-4 mr-2" />{locationLoading ? "Getting..." : "Use My Current Location"}
              </Button>
              <Button onClick={handleSaveLocation} disabled={savingLocation || !officeLat || !officeLng}>
                <MapPin className="w-4 h-4 mr-2" />{savingLocation ? "Saving..." : "Save Office Location"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Punch In/Out + Team Today */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />Today — {formatDate(today)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayLoading ? <Skeleton className="h-20" /> : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Punch In</p>
                    <p className="font-semibold text-sm text-green-600">{formatTime(todayRecord?.punchInAt)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Punch Out</p>
                    <p className="font-semibold text-sm text-red-500">{formatTime(todayRecord?.punchOutAt)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Hours</p>
                    <p className="font-semibold text-sm text-blue-600">{calcHours(todayRecord?.punchInAt, todayRecord?.punchOutAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isPunchedIn && (
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handlePunch("in")} disabled={loading}>
                      <LogIn className="w-4 h-4 mr-2" />{loading ? "Getting Location..." : "Punch In"}
                    </Button>
                  )}
                  {isPunchedIn && !isPunchedOut && (
                    <Button className="flex-1" variant="destructive" onClick={() => handlePunch("out")} disabled={loading}>
                      <LogOut className="w-4 h-4 mr-2" />{loading ? "Getting Location..." : "Punch Out"}
                    </Button>
                  )}
                  {isPunchedIn && isPunchedOut && (
                    <div className="flex-1 flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />Attendance Marked
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />GPS location required
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {isTeamView && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />Team Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listLoading ? <Skeleton className="h-20" /> : (() => {
                const todayList = records.filter((r: any) => r.date === today);
                const present = todayList.filter((r: any) => r.punchInAt).length;
                const punchedOut = todayList.filter((r: any) => r.punchOutAt).length;
                const stillWorking = todayList.filter((r: any) => r.punchInAt && !r.punchOutAt).length;
                const totalStaff = Object.keys(staffMap).length;
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Present</span>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">{present} / {totalStaff}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Still Working</span>
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{stillWorking}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Punched Out</span>
                      <Badge variant="outline">{punchedOut}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Absent Today</span>
                      <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">{Math.max(0, totalStaff - present)}</Badge>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Stats — Team View */}
      {isTeamView && !listLoading && personSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Working Days</span>
              </div>
              <p className="text-2xl font-bold">{relevantWorkingDays.length}</p>
              <p className="text-xs text-muted-foreground">{monthLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Avg Attendance</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{avgAttPct}%</p>
              <p className="text-xs text-muted-foreground">{totalStaffCount} staff</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Best Performer</span>
              </div>
              <p className="text-sm font-bold truncate">{bestPerformer?.name || "--"}</p>
              <p className="text-xs text-green-600">{bestPerformer?.presentDays || 0} days present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Needs Attention</span>
              </div>
              <p className="text-sm font-bold truncate">{needsAttention?.name || "--"}</p>
              <p className="text-xs text-red-500">{needsAttention?.absentDays || 0} days absent</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Person-wise Monthly Summary */}
      {isTeamView && !listLoading && personSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Staff Summary — {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Present</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Absent</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Attendance %</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Avg Hours/Day</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Avg Punch In</th>
                  </tr>
                </thead>
                <tbody>
                  {personSummary.map((p, i) => {
                    const pct = p.totalDays > 0 ? Math.round((p.presentDays / p.totalDays) * 100) : 0;
                    const avgPunchInStr = p.avgPunchIn !== null
                      ? `${String(Math.floor(p.avgPunchIn / 60)).padStart(2, "0")}:${String(p.avgPunchIn % 60).padStart(2, "0")}`
                      : "--";
                    return (
                      <tr key={i} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{p.presentDays}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${p.absentDays > 0 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>{p.absentDays}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 min-w-[60px]">
                              <div className={`h-2 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {p.avgHours > 0 ? `${p.avgHours.toFixed(1)}h` : "--"}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">{avgPunchInStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day-wise Summary */}
      {isTeamView && !listLoading && dayWise.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Day-wise Summary — {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Day</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Present</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Absent</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {dayWise.map((d, i) => (
                    <tr key={i} className={`border-b hover:bg-muted/20 transition-colors ${d.date === today ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}>
                      <td className="p-3 font-medium">{formatDate(d.date)}{d.date === today && <span className="ml-2 text-xs text-blue-500">(Today)</span>}</td>
                      <td className="p-3 text-muted-foreground">{getDayName(d.date)}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{d.present}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${d.absent > 0 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>{d.absent}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 min-w-[80px]">
                            <div className={`h-2 rounded-full ${d.pct >= 80 ? "bg-green-500" : d.pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className="text-xs font-medium w-9 text-right">{d.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telecaller own monthly summary */}
      {role === "TELE_CALLER" && !listLoading && records.length > 0 && (() => {
        const present = records.filter((r: any) => r.punchInAt).length;
        const absent = Math.max(0, relevantWorkingDays.length - present);
        const pct = relevantWorkingDays.length > 0 ? Math.round((present / relevantWorkingDays.length) * 100) : 0;
        const totalHours = records.reduce((sum: number, r: any) => sum + calcHoursNum(r.punchInAt, r.punchOutAt), 0);
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Working Days</p><p className="text-2xl font-bold">{relevantWorkingDays.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Present</p><p className="text-2xl font-bold text-green-600">{present}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Absent</p><p className="text-2xl font-bold text-red-500">{absent}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Attendance %</p><p className="text-2xl font-bold">{pct}%</p></CardContent></Card>
          </div>
        );
      })()}

      {/* Detailed Records — Collapsible */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {role === "TELE_CALLER" ? "My Attendance Records" : "Detailed Attendance Records"} — {monthLabel}
              <Badge variant="outline" className="text-xs">{records.length} records</Badge>
            </div>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showDetails && (
          <CardContent className="p-0">
            {listLoading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No records for {monthLabel}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                      {role !== "TELE_CALLER" && <th className="text-left p-3 font-medium text-muted-foreground">Name</th>}
                      <th className="text-left p-3 font-medium text-muted-foreground">Punch In</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Punch Out</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Hours</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...records].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3">{formatDate(r.date)} <span className="text-xs text-muted-foreground">{getDayName(r.date)}</span></td>
                        {role !== "TELE_CALLER" && <td className="p-3 font-medium">{r.userName}</td>}
                        <td className="p-3 text-green-600 font-medium">{formatTime(r.punchInAt)}</td>
                        <td className="p-3 text-red-500 font-medium">{formatTime(r.punchOutAt)}</td>
                        <td className="p-3 text-blue-600 font-medium">{calcHours(r.punchInAt, r.punchOutAt)}</td>
                        <td className="p-3">
                          {r.punchInAt ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Present</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs"><XCircle className="w-3 h-3 mr-1" />Absent</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
