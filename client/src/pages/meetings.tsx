import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Brain, Plus, Target, Award, Users, BarChart3,
  Calendar, AlertTriangle, ChevronDown, ChevronUp,
  Upload, FileAudio, Trash2, Building2, CheckCircle2,
  Lightbulb, ArrowRight, UserCheck, Hash, SmilePlus,
  FileText, ClipboardList, Zap, Lock, TrendingUp
} from "lucide-react";

export default function MeetingsPage() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState("auto");
  const [jobProgress, setJobProgress] = useState<{ progress: number; message: string } | null>(null);
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isMasterAdmin = user?.role === "MASTER_ADMIN";
  const isTeamLeader = user?.role === "TEAM_LEADER";
  const isViewOnly = isTeamLeader;

  const { data: agencies } = useQuery({
    queryKey: ["/api/agencies"],
    queryFn: () => apiFetch("/api/agencies"),
    enabled: isMasterAdmin,
  });

  const meetingsUrl = isMasterAdmin && agencyFilter !== "all"
    ? `/api/meetings?agency=${agencyFilter}`
    : "/api/meetings";

  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ["/api/meetings", agencyFilter],
    queryFn: () => apiFetch(meetingsUrl),
  });

  // Fetch usage data for agency admins (not master admin)
  const { data: usageData } = useQuery({
    queryKey: ["/api/meetings/usage"],
    queryFn: () => apiFetch("/api/meetings/usage"),
    enabled: !isMasterAdmin && !isTeamLeader,
    refetchOnWindowFocus: true,
  });

  const usage = usageData;
  const limitReached = usage?.limitReached === true;
  const isWarning = usage && usage.limit !== null && usage.remaining !== null && usage.remaining <= 2 && !limitReached;
  const usagePercent = usage && usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  const deleteMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return apiFetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", agencyFilter] });
      setDeleteConfirm(null);
      toast({ title: "Meeting deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setJobProgress(null);
    try {
      const formData = new FormData();
      formData.append("title", title);
      if (audioLanguage && audioLanguage !== "auto") formData.append("language", audioLanguage);
      if (transcript) formData.append("transcript", transcript);
      if (audioFile) formData.append("audio", audioFile);

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // If audio file — poll for background job completion
      if (audioFile && data.jobId) {
        setJobProgress({ progress: 10, message: "🎵 Audio uploaded, processing started..." });
        const jobId = data.jobId;

        // Poll every 3 seconds
        await new Promise<void>((resolve, reject) => {
          const interval = setInterval(async () => {
            try {
              const jobRes = await fetch(`/api/meetings/job/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const job = await jobRes.json();
              setJobProgress({ progress: job.progress, message: job.message });

              if (job.status === "done") {
                clearInterval(interval);
                resolve();
              } else if (job.status === "error") {
                clearInterval(interval);
                reject(new Error(job.error || "Processing failed"));
              }
            } catch (err) {
              clearInterval(interval);
              reject(err);
            }
          }, 3000);

          // Timeout after 10 minutes
          setTimeout(() => {
            clearInterval(interval);
            reject(new Error("Processing timed out. Please try again."));
          }, 10 * 60 * 1000);
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/usage"] });
      setOpen(false);
      setTitle("");
      setTranscript("");
      setAudioFile(null);
      setJobProgress(null);
      if (fileRef.current) fileRef.current.value = "";
      toast({ title: "✅ AI Proceeding analysis complete!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/usage"] });
    } finally {
      setCreating(false);
      setJobProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">{[1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">AI Proceeding</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isMasterAdmin || isTeamLeader
                ? "Unable to load AI proceeding data. Please try again."
                : "This feature requires PRO or ENTERPRISE plan. Contact your administrator to upgrade."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const agencyList = agencies || [];

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "positive": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "concerned": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            AI Proceeding {isMasterAdmin && "- All Agencies"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isMasterAdmin
              ? "View and manage AI proceeding analyses across all agencies"
              : "Analyze meetings and extract structured insights with AI"}
          </p>
        </div>
        {!isMasterAdmin && !isViewOnly && (
          <div className="flex items-center gap-3">
            {/* New Analysis Button — blocked when limit reached */}
            {limitReached ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" data-testid="button-limit-reached">
                    <Lock className="w-4 h-4 mr-2" />
                    Limit Reached
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      Monthly Limit Reached
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">
                      Your PRO plan has used all <strong>{usage?.limit} AI Proceeding analyses</strong> for this month.
                      Your quota resets on the 1st of next month.
                    </p>
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Used this month</span>
                        <span className="font-bold text-destructive">{usage?.used} / {usage?.limit}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-destructive w-full" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Zap className="w-4 h-4 text-primary" />
                        Upgrade to ENTERPRISE
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Unlimited AI Proceeding analyses</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Higher lead & user limits</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Priority support</li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">Contact your administrator to request an upgrade.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-meeting" disabled={limitReached}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Analysis
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Analyze Proceeding</DialogTitle>
                  </DialogHeader>
                  {/* Warning banner inside dialog when close to limit */}
                  {isWarning && (
                    <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-3 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                      <span className="text-yellow-800 dark:text-yellow-300">
                        Only <strong>{usage?.remaining}</strong> AI analysis{usage?.remaining === 1 ? "" : "es"} remaining this month on your PRO plan.
                      </span>
                    </div>
                  )}
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        data-testid="input-meeting-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Q1 Sales Review"
                        required
                  />
                </div>
                <div className="space-y-2">
                      <Label>Audio File (optional)</Label>
                      <Input
                        ref={fileRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                        data-testid="input-audio-file"
                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      />
                      {audioFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileAudio className="w-4 h-4" />
                          {audioFile.name}
                        </div>
                      )}
                    </div>
                    {audioFile && (
                      <div className="space-y-2">
                        <Label>Audio Language</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                          value={audioLanguage}
                          onChange={(e) => setAudioLanguage(e.target.value)}
                        >
                          <option value="auto">🌐 Auto Detect</option>
                          <option value="hi">🇮🇳 Hindi</option>
                          <option value="mr">🇮🇳 Marathi</option>
                          <option value="en">🇬🇧 English</option>
                          <option value="gu">🇮🇳 Gujarati</option>
                          <option value="pa">🇮🇳 Punjabi</option>
                          <option value="ur">🇵🇰 Urdu</option>
                          <option value="te">🇮🇳 Telugu</option>
                          <option value="ta">🇮🇳 Tamil</option>
                          <option value="kn">🇮🇳 Kannada</option>
                          <option value="bn">🇮🇳 Bengali</option>
                        </select>
                        <p className="text-xs text-muted-foreground">Select language if auto-detect is incorrect</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Transcript / Notes (optional if audio provided)</Label>
                      <Textarea
                        data-testid="input-meeting-transcript"
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        placeholder="Paste meeting transcript or notes here..."
                        rows={6}
                      />
                    </div>
                    {/* Progress indicator */}
                    {creating && jobProgress && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{jobProgress.message}</span>
                          <span className="font-medium text-primary">{jobProgress.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${jobProgress.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          ⏱️ Large audio files (5-15 min) take 2-4 minutes to process. Please wait...
                        </p>
                      </div>
                    )}

                    {creating && !jobProgress && (
                      <div className="rounded-lg border bg-muted/30 p-4 text-center">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Uploading audio file...</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={creating} data-testid="button-analyze-meeting">
                      {creating ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          Analyze Proceeding
                        </span>
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      {/* Usage bar — visible to agency admins on PRO plan */}
      {!isMasterAdmin && usage && usage.limit !== null && (
        <Card className={`border ${limitReached ? "border-destructive/50 bg-destructive/5" : isWarning ? "border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20" : "border-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${limitReached ? "text-destructive" : isWarning ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">AI Proceeding Usage — This Month</span>
                <Badge variant="outline" className="text-[10px]">{usage.plan} Plan</Badge>
              </div>
              <span className={`text-sm font-bold ${limitReached ? "text-destructive" : isWarning ? "text-yellow-700 dark:text-yellow-400" : "text-foreground"}`}>
                {usage.used} / {usage.limit} used
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${limitReached ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {limitReached
                ? "Monthly limit reached. Quota resets on the 1st of next month. Upgrade to ENTERPRISE for unlimited analyses."
                : isWarning
                  ? `Only ${usage.remaining} analysis${usage.remaining === 1 ? "" : "es"} remaining this month. Consider upgrading to ENTERPRISE for unlimited access.`
                  : `${usage.remaining} of ${usage.limit} analyses remaining this month. Resets on the 1st.`}
            </p>
          </CardContent>
        </Card>
      )}
      
      {isMasterAdmin && (
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select value={agencyFilter} onValueChange={setAgencyFilter}>
            <SelectTrigger className="w-64" data-testid="select-agency-filter">
              <SelectValue placeholder="Filter by agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {agencyList.map((agency: any) => (
                <SelectItem key={agency.agencyCode} value={agency.agencyCode}>
                  {agency.name} ({agency.agencyCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" data-testid="text-meeting-count">
            {meetings?.length || 0} analyses
          </Badge>
        </div>
      )}

      <div className="grid gap-4">
        {meetings?.map((meeting: any) => (
          <Card key={meeting.id} data-testid={`card-meeting-${meeting.id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{meeting.title}</h3>
                      {meeting.sentiment && (
                        <Badge className={`text-[10px] ${getSentimentColor(meeting.sentiment)}`} data-testid={`badge-sentiment-${meeting.id}`}>
                          <SmilePlus className="w-3 h-3 mr-1" />
                          {meeting.sentiment}
                        </Badge>
                      )}
                      {meeting.language && meeting.language !== "English" && (
                        <Badge className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          🌐 {meeting.language}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(meeting.createdAt).toLocaleDateString()}
                      </Badge>
                      {meeting.audioFileName && (
                        <Badge variant="outline" className="text-[10px]">
                          <FileAudio className="w-3 h-3 mr-1" />
                          {meeting.audioFileName}
                        </Badge>
                      )}
                      {isMasterAdmin && meeting.agencyName && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <Building2 className="w-3 h-3 mr-1" />
                          {meeting.agencyName}
                        </Badge>
                      )}
                    </div>
                    {isMasterAdmin && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Agency: {meeting.agencyCode}
                      </p>
                    )}
                    {meeting.summary && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{meeting.summary}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isMasterAdmin && (
                    deleteConfirm === meeting.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => deleteMutation.mutate(meeting.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-confirm-delete-${meeting.id}`}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setDeleteConfirm(null)}
                          data-testid={`button-cancel-delete-${meeting.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => setDeleteConfirm(meeting.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-${meeting.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )
                  )}
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setExpanded(expanded === meeting.id ? null : meeting.id)}
                    data-testid={`button-expand-${meeting.id}`}
                  >
                    {expanded === meeting.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {expanded === meeting.id && (
                <div className="mt-4">
                  <Tabs defaultValue="insights" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="insights" data-testid={`tab-insights-${meeting.id}`}>
                        <ClipboardList className="w-4 h-4 mr-1" />
                        AI Insights
                      </TabsTrigger>
                      <TabsTrigger value="transcript" data-testid={`tab-transcript-${meeting.id}`}>
                        <FileText className="w-4 h-4 mr-1" />
                        Full Transcript
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="insights">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InsightSection icon={CheckCircle2} title="Action Items" items={meeting.actionItems} color="text-emerald-600 dark:text-emerald-400" />
                        <InsightSection icon={Lightbulb} title="Key Decisions" items={meeting.keyDecisions} color="text-amber-600 dark:text-amber-400" />
                        <InsightSection icon={Target} title="Targets & Goals" items={meeting.targets} color="text-chart-1" />
                        <InsightSection icon={Award} title="Achievements" items={meeting.achievements} color="text-chart-4" />
                        <InsightSection icon={ArrowRight} title="Next Steps" items={meeting.nextSteps} color="text-indigo-600 dark:text-indigo-400" />
                        <InsightSection icon={Users} title="Responsible Persons" items={meeting.responsiblePersons} color="text-chart-2" />
                        <InsightSection icon={BarChart3} title="KPIs & Metrics" items={meeting.kpis} color="text-chart-3" />
                        <InsightSection icon={Hash} title="Key Figures & Numbers" items={meeting.keyFigures} color="text-cyan-600 dark:text-cyan-400" />
                        <InsightSection icon={Calendar} title="Deadlines & Timelines" items={meeting.deadlines} color="text-chart-5" />
                        <InsightSection icon={UserCheck} title="Clients Mentioned" items={meeting.clientMentions} color="text-violet-600 dark:text-violet-400" />
                        <InsightSection icon={AlertTriangle} title="Risks & Concerns" items={meeting.riskPoints} color="text-destructive" className="md:col-span-2" />
                      </div>
                    </TabsContent>

                    <TabsContent value="transcript">
                      {meeting.transcript ? (
                        <div className="p-4 rounded-md bg-muted/30 border space-y-1">
                          {/* Render speaker-labeled transcript with color coding */}
                          {meeting.transcript.split("\n").filter((line: string) => line.trim()).map((line: string, idx: number) => {
                            const speakerColors = [
                              "text-blue-700 dark:text-blue-300",
                              "text-emerald-700 dark:text-emerald-300",
                              "text-purple-700 dark:text-purple-300",
                              "text-orange-700 dark:text-orange-300",
                            ];
                            // Detect speaker label (e.g. "Speaker 1:", "Sir Ji:", "Haji:")
                            const speakerMatch = line.match(/^([^:]{1,30}):\s*(.*)/);
                            if (speakerMatch) {
                              const speakerLabel = speakerMatch[1].trim();
                              const dialogue = speakerMatch[2].trim();
                              // Assign color based on speaker number or name hash
                              const colorIndex = Math.abs(speakerLabel.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % speakerColors.length;
                              return (
                                <div key={idx} className="flex gap-2 py-1.5 border-b border-muted last:border-0">
                                  <span className={`text-xs font-bold shrink-0 w-24 pt-0.5 ${speakerColors[colorIndex]}`} data-testid={`speaker-label-${idx}`}>
                                    {speakerLabel}
                                  </span>
                                  <span className="text-sm leading-relaxed flex-1" data-testid={`speaker-text-${idx}`}>
                                    {dialogue}
                                  </span>
                                </div>
                              );
                            }
                            // Plain line (no speaker label)
                            return (
                              <p key={idx} className="text-sm leading-relaxed py-1 text-muted-foreground font-mono">
                                {line}
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No transcript available for this analysis.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!meetings || meetings.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">
              {isMasterAdmin ? "No AI proceeding analyses found" : "No proceeding analyses yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isMasterAdmin
                ? agencyFilter !== "all"
                  ? "This agency has no AI proceeding analyses. Try selecting a different agency."
                  : "No agencies have created AI proceeding analyses yet."
                : isTeamLeader
                  ? "No AI proceeding analyses have been created yet."
                  : "Upload an audio file or transcript to extract structured insights"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InsightSection({ icon: Icon, title, items, color, className }: {
  icon: any; title: string; items: string[] | null; color: string; className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`p-4 rounded-md bg-muted/30 border ${className || ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <h4 className="font-semibold text-sm">{title}</h4>
        <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.replace('text-', 'bg-')}`} />
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
