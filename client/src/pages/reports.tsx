import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Users, BarChart3, TrendingUp } from "lucide-react";
import { useState } from "react";

export default function ReportsPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadReport = async (type: string, filename: string) => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/reports/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: `${filename} downloaded` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    {
      key: "leads",
      title: "Lead Report",
      description: "Export all leads with status, source, follow-up dates, and remarks",
      icon: Users,
      filename: "lead_report.xlsx",
    },
    {
      key: "performance",
      title: "Performance Report",
      description: "Export telecaller performance metrics including conversion rates and scores",
      icon: BarChart3,
      filename: "performance_report.xlsx",
    },
    {
      key: "conversion",
      title: "Conversion Report",
      description: "Export lead conversion funnel statistics and rates",
      icon: TrendingUp,
      filename: "conversion_report.xlsx",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Reports</h1>
        <p className="text-muted-foreground">Download Excel reports for analysis</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.key} data-testid={`card-report-${report.key}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription>{report.description}</CardDescription>
              <Button
                className="w-full"
                onClick={() => downloadReport(report.key, report.filename)}
                disabled={downloading === report.key}
                data-testid={`button-download-${report.key}`}
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading === report.key ? "Downloading..." : "Download Excel"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
