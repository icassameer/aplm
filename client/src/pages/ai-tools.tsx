import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, MessageSquare, Bot, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AIToolsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  // Remark suggester state
  const [remarkForm, setRemarkForm] = useState({ leadName: "", service: "", status: "CONTACTED", previousRemark: "" });
  const [remarkResult, setRemarkResult] = useState("");
  const [remarkLoading, setRemarkLoading] = useState(false);

  // Follow-up message state
  const [followupForm, setFollowupForm] = useState({ leadName: "", service: "", status: "FOLLOW_UP", previousRemark: "", messageType: "whatsapp" });
  const [followupResult, setFollowupResult] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);

  // Lead scoring state
  const [scoreForm, setScoreForm] = useState({ leadName: "", service: "", status: "NEW", source: "", remarks: "" });
  const [scoreResult, setScoreResult] = useState<any>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Chatbot state
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{q: string, a: string}[]>([]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const suggestRemark = async () => {
    setRemarkLoading(true);
    setRemarkResult("");
    try {
      const res = await fetch("/api/ai/suggest-remark", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(remarkForm),
      });
      const data = await res.json();
      if (data.success) setRemarkResult(data.remark);
      else toast({ title: "Error", description: data.message, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "AI service unavailable", variant: "destructive" });
    }
    setRemarkLoading(false);
  };

  const generateFollowup = async () => {
    setFollowupLoading(true);
    setFollowupResult("");
    try {
      const res = await fetch("/api/ai/followup-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(followupForm),
      });
      const data = await res.json();
      if (data.success) setFollowupResult(data.message);
      else toast({ title: "Error", description: data.message, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "AI service unavailable", variant: "destructive" });
    }
    setFollowupLoading(false);
  };

  const scoreLead = async () => {
    setScoreLoading(true);
    setScoreResult(null);
    try {
      const res = await fetch("/api/ai/score-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(scoreForm),
      });
      const data = await res.json();
      if (data.success) setScoreResult(data);
      else toast({ title: "Error", description: data.message, variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "AI service unavailable", variant: "destructive" });
    }
    setScoreLoading(false);
  };

  const askChatbot = async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    const q = chatQuestion;
    setChatQuestion("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory(prev => [...prev, { q, a: data.answer }]);
        setChatAnswer(data.answer);
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "AI service unavailable", variant: "destructive" });
    }
    setChatLoading(false);
  };

  const scoreLabelColor: Record<string, string> = {
    Hot: "bg-red-100 text-red-700 border-red-200",
    Warm: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Cold: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const statusOptions = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED"];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-600" /> AI Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Claude-powered tools to boost your team's productivity
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Smart Remark Suggestions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Smart remark suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Lead name" value={remarkForm.leadName}
              onChange={e => setRemarkForm(p => ({ ...p, leadName: e.target.value }))} />
            <Input placeholder="Service (e.g. Term Insurance)" value={remarkForm.service}
              onChange={e => setRemarkForm(p => ({ ...p, service: e.target.value }))} />
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={remarkForm.status} onChange={e => setRemarkForm(p => ({ ...p, status: e.target.value }))}>
              {statusOptions.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <Input placeholder="Previous remark (optional)" value={remarkForm.previousRemark}
              onChange={e => setRemarkForm(p => ({ ...p, previousRemark: e.target.value }))} />
            <Button className="w-full" onClick={suggestRemark} disabled={remarkLoading || !remarkForm.leadName}>
              {remarkLoading ? "Generating..." : "✨ Suggest remark"}
            </Button>
            {remarkLoading && <Skeleton className="h-16" />}
            {remarkResult && (
              <div className="relative bg-muted rounded-md p-3 text-sm">
                <p>{remarkResult}</p>
                <button onClick={() => copyToClipboard(remarkResult, "remark")}
                  className="absolute top-2 right-2 p-1 hover:bg-background rounded">
                  {copied === "remark" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-up Message Generator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-500" />
              Follow-up message generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Lead name" value={followupForm.leadName}
              onChange={e => setFollowupForm(p => ({ ...p, leadName: e.target.value }))} />
            <Input placeholder="Service (e.g. Health Insurance)" value={followupForm.service}
              onChange={e => setFollowupForm(p => ({ ...p, service: e.target.value }))} />
            <Input placeholder="Last remark (optional)" value={followupForm.previousRemark}
              onChange={e => setFollowupForm(p => ({ ...p, previousRemark: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setFollowupForm(p => ({ ...p, messageType: "whatsapp" }))}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${followupForm.messageType === "whatsapp" ? "bg-green-600 text-white border-green-600" : "bg-background"}`}>
                WhatsApp
              </button>
              <button onClick={() => setFollowupForm(p => ({ ...p, messageType: "call" }))}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${followupForm.messageType === "call" ? "bg-blue-600 text-white border-blue-600" : "bg-background"}`}>
                Call script
              </button>
            </div>
            <Button className="w-full" onClick={generateFollowup} disabled={followupLoading || !followupForm.leadName}>
              {followupLoading ? "Generating..." : "✨ Generate message"}
            </Button>
            {followupLoading && <Skeleton className="h-20" />}
            {followupResult && (
              <div className="relative bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                <p>{followupResult}</p>
                <button onClick={() => copyToClipboard(followupResult, "followup")}
                  className="absolute top-2 right-2 p-1 hover:bg-background rounded">
                  {copied === "followup" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Scoring */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-orange-500" />
              Lead scoring
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Lead name" value={scoreForm.leadName}
              onChange={e => setScoreForm(p => ({ ...p, leadName: e.target.value }))} />
            <Input placeholder="Service" value={scoreForm.service}
              onChange={e => setScoreForm(p => ({ ...p, service: e.target.value }))} />
            <div className="flex gap-2">
              <select className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                value={scoreForm.status} onChange={e => setScoreForm(p => ({ ...p, status: e.target.value }))}>
                {statusOptions.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
              <Input className="flex-1" placeholder="Source" value={scoreForm.source}
                onChange={e => setScoreForm(p => ({ ...p, source: e.target.value }))} />
            </div>
            <Input placeholder="Last remarks (optional)" value={scoreForm.remarks}
              onChange={e => setScoreForm(p => ({ ...p, remarks: e.target.value }))} />
            <Button className="w-full" onClick={scoreLead} disabled={scoreLoading || !scoreForm.leadName}>
              {scoreLoading ? "Scoring..." : "✨ Score this lead"}
            </Button>
            {scoreLoading && <Skeleton className="h-16" />}
            {scoreResult && (
              <div className="bg-muted rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{scoreResult.score}<span className="text-lg text-muted-foreground">/100</span></span>
                  <Badge className={`text-sm ${scoreLabelColor[scoreResult.label] || ""}`}>{scoreResult.label}</Badge>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${scoreResult.score}%`, background: scoreResult.label === "Hot" ? "#ef4444" : scoreResult.label === "Warm" ? "#f59e0b" : "#3b82f6" }} />
                </div>
                <p className="text-sm text-muted-foreground">{scoreResult.reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Chatbot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-500" />
              CRM AI assistant
              <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">ENTERPRISE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chatHistory.length > 0 && (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {chatHistory.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">You: {item.q}</p>
                    <div className="bg-muted rounded-md p-2 text-sm">{item.a}</div>
                  </div>
                ))}
              </div>
            )}
            {chatLoading && <Skeleton className="h-16" />}
            <Textarea
              placeholder="Ask anything... e.g. Which leads should I prioritize today? Why is my conversion rate low?"
              value={chatQuestion}
              onChange={e => setChatQuestion(e.target.value)}
              rows={3}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askChatbot(); }}}
            />
            <Button className="w-full" onClick={askChatbot} disabled={chatLoading || !chatQuestion.trim()}>
              {chatLoading ? "Thinking..." : "✨ Ask AI assistant"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
