import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, LogIn, LogOut, Users, CheckCircle, XCircle, Calendar, Navigation, Settings } from "lucide-react";
import { useApi } from "@/hooks/use-api";

function formatTime(ts: string | null) {
  if (!ts) return "--";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
  const role = user?.role;
  const today = new Date().toISOString().split("T")[0];

  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/attendance/today"],
    queryFn: () => apiFetch("/api/attendance/today"),
    refetchInterval: 30000,
  });

  const { data: allRecords, isLoading: listLoading } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: () => apiFetch("/api/attendance"),
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
      if (err.code === 1) {
        toast({ title: "Location Required", description: "Please allow location access to punch in/out.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
      }
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
      toast({ title: "Location captured!", description: "Your current location has been filled in. Set radius and save." });
    } catch (err: any) {
      toast({ title: "Location Error", description: "Please allow location access in browser.", variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!officeLat || !officeLng) {
      toast({ title: "Error", description: "Please enter or capture office location first.", variant: "destructive" });
      return;
    }
    setSavingLocation(true);
    try {
      const res = await fetch("/api/agency/office-location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          officeLatitude: officeLat,
          officeLongitude: officeLng,
          officeRadiusMeters: Number(officeRadius) || 100,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/agency/commission-settings"] });
      toast({ title: "Office location saved!", description: `Radius: ${officeRadius}m — Telecallers must be within this range to punch in.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingLocation(false);
    }
  };

  const isPunchedIn = !!todayRecord?.punchInAt;
  const isPunchedOut = !!todayRecord?.punchOutAt;
  const hasOfficeLocation = commissionSettings?.officeLatitude && commissionSettings?.officeLongitude;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === "TELE_CALLER" ? "Track your daily attendance" : "Manage office location and view team attendance"}
        </p>
      </div>

      {/* Office Location Settings — Agency Admin only */}
      {role === "AGENCY_ADMIN" && (
        <Card className={!hasOfficeLocation ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Office Location Settings
              {hasOfficeLocation ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs ml-2">
                  <CheckCircle className="w-3 h-3 mr-1" />Set
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs ml-2">
                  Not Set
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasOfficeLocation && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠️ Office location not set. Telecallers can punch in from anywhere until you set the office location.
              </p>
            )}
            {hasOfficeLocation && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✅ Office: {parseFloat(commissionSettings.officeLatitude).toFixed(4)}, {parseFloat(commissionSettings.officeLongitude).toFixed(4)} — Radius: {commissionSettings.officeRadiusMeters}m
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Latitude</Label>
                <Input
                  placeholder="e.g. 17.6868"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Longitude</Label>
                <Input
                  placeholder="e.g. 75.9064"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Allowed Radius (meters)</Label>
                <Input
                  type="number"
                  min="10"
                  max="5000"
                  value={officeRadius}
                  onChange={(e) => setOfficeRadius(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handleUseMyLocation} disabled={locationLoading}>
                <Navigation className="w-4 h-4 mr-2" />
                {locationLoading ? "Getting Location..." : "Use My Current Location"}
              </Button>
              <Button onClick={handleSaveLocation} disabled={savingLocation || !officeLat || !officeLng}>
                <MapPin className="w-4 h-4 mr-2" />
                {savingLocation ? "Saving..." : "Save Office Location"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Open this page from your office and click "Use My Current Location" for accurate coordinates.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Punch In/Out Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Today — {formatDate(today)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Punch In</p>
                    <p className="font-semibold text-sm text-green-600">{formatTime(todayRecord?.punchInAt)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Punch Out</p>
                    <p className="font-semibold text-sm text-red-500">{formatTime(todayRecord?.punchOutAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isPunchedIn && (
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handlePunch("in")} disabled={loading}>
                      <LogIn className="w-4 h-4 mr-2" />
                      {loading ? "Getting Location..." : "Punch In"}
                    </Button>
                  )}
                  {isPunchedIn && !isPunchedOut && (
                    <Button className="flex-1" variant="destructive" onClick={() => handlePunch("out")} disabled={loading}>
                      <LogOut className="w-4 h-4 mr-2" />
                      {loading ? "Getting Location..." : "Punch Out"}
                    </Button>
                  )}
                  {isPunchedIn && isPunchedOut && (
                    <div className="flex-1 flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Attendance Marked
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS location required for punch in/out
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Team Today stats — TL + Admin */}
        {(role === "TEAM_LEADER" || role === "AGENCY_ADMIN") && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Team Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listLoading ? <Skeleton className="h-20" /> : (
                <div className="space-y-2">
                  {(() => {
                    const todayList = (allRecords || []).filter((r: any) => r.date === today);
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Present Today</span>
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">{todayList.filter((r: any) => r.punchInAt).length}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Punched Out</span>
                          <Badge variant="outline">{todayList.filter((r: any) => r.punchOutAt).length}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Still Working</span>
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{todayList.filter((r: any) => r.punchInAt && !r.punchOutAt).length}</Badge>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Attendance History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {role === "TELE_CALLER" ? "My Attendance History" : "Team Attendance Records"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : !allRecords || allRecords.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No attendance records yet</p>
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
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecords.map((r: any) => (
                    <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3">{formatDate(r.date)}</td>
                      {role !== "TELE_CALLER" && <td className="p-3 font-medium">{r.userName}</td>}
                      <td className="p-3 text-green-600 font-medium">{formatTime(r.punchInAt)}</td>
                      <td className="p-3 text-red-500 font-medium">{formatTime(r.punchOutAt)}</td>
                      <td className="p-3">
                        {r.punchInAt ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />Present
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs">
                            <XCircle className="w-3 h-3 mr-1" />Absent
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
