import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/use-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Trash2, IndianRupee, Pencil } from "lucide-react";

export default function ServicesPage() {
  const { token } = useAuth();
  const { apiFetch } = useApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editCommission, setEditCommission] = useState("");

  const { data: serviceList, isLoading } = useQuery({
    queryKey: ["/api/services"],
    queryFn: () => apiFetch("/api/services"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/services", {
      method: "POST",
      body: JSON.stringify({ name, commissionAmount: Number(commission) || 0 }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setOpen(false);
      setName("");
      setCommission("");
      toast({ title: "Service added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commissionAmount: amount }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setEditId(null);
      setEditCommission("");
      toast({ title: "Commission updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage services and set commission per converted lead</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Service</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Motor Insurance, Health Insurance"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Commission per Converted Lead (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="e.g., 500 (leave 0 to use agency default)"
                />
                <p className="text-xs text-muted-foreground">If 0, agency default commission will be used</p>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Service"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {serviceList?.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {editId === s.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        min="0"
                        value={editCommission}
                        onChange={(e) => setEditCommission(e.target.value)}
                        className="w-24 h-8 text-sm"
                        autoFocus
                      />
                      <Button size="sm" className="h-8"
                        onClick={() => updateCommissionMutation.mutate({ id: s.id, amount: Number(editCommission) })}
                        disabled={updateCommissionMutation.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded text-green-700 text-xs font-medium">
                        <IndianRupee className="w-3 h-3" />
                        {s.commissionAmount > 0 ? `${s.commissionAmount} / lead` : "Agency default"}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditId(s.id); setEditCommission(String(s.commissionAmount || 0)); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => deleteMutation.mutate(s.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!serviceList || serviceList.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No services yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Add services your agency offers and set commission per converted lead</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
