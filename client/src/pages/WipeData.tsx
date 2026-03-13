import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function invalidateWorkspaceQueries() {
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/transactions"),
  });
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/cashflow"),
  });
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/leaks"),
  });
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/analysis"),
  });
  queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
  queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
}

export default function WipeDataPage() {
  const { toast } = useToast();

  const wipeDataMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/transactions");
      return res.json() as Promise<{ deletedTransactions: number; deletedUploads: number }>;
    },
    onSuccess: (data) => {
      invalidateWorkspaceQueries();
      toast({
        title: "Data wiped",
        description: `Deleted ${data.deletedTransactions} transactions and ${data.deletedUploads} uploads.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Wipe failed", description: err.message, variant: "destructive" });
    },
  });

  const wipeWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/workspace-data");
      return res.json() as Promise<{ deletedTransactions: number; deletedUploads: number; deletedAccounts: number }>;
    },
    onSuccess: (data) => {
      invalidateWorkspaceQueries();
      toast({
        title: "Workspace reset",
        description: `Deleted ${data.deletedTransactions} transactions, ${data.deletedUploads} uploads, and ${data.deletedAccounts} accounts.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const isPending = wipeDataMutation.isPending || wipeWorkspaceMutation.isPending;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wipe Data</h1>
        <p className="text-muted-foreground mt-1">
          Clear imported ledger data, or remove accounts too if you want a full workspace reset.
        </p>
      </div>

      <Card className="border-destructive/20 shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Clear imported data</CardTitle>
              <CardDescription className="mt-1">
                Choose whether to delete imported transactions and uploads only, or also remove saved accounts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>`Data only` removes imported transactions and upload history, but keeps your saved accounts in place.</p>
          <p>`Remove accounts too` performs a full workspace reset and also deletes saved accounts.</p>
          <p>Your login remains active in either case so you can immediately start fresh.</p>
        </CardContent>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-open-wipe-data-dialog">
                <Trash2 className="mr-2 h-4 w-4" />
                Wipe Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>What would you like to remove?</AlertDialogTitle>
                <AlertDialogDescription>
                  You can clear imported data only, or include saved accounts as part of a full workspace reset.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-between">
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <AlertDialogAction
                    onClick={() => wipeDataMutation.mutate()}
                    disabled={isPending}
                    data-testid="button-confirm-wipe-data-only"
                  >
                    {wipeDataMutation.isPending ? "Wiping..." : "Data only"}
                  </AlertDialogAction>
                  <AlertDialogAction
                    onClick={() => wipeWorkspaceMutation.mutate()}
                    disabled={isPending}
                    data-testid="button-confirm-wipe-data-with-accounts"
                  >
                    {wipeWorkspaceMutation.isPending ? "Resetting..." : "Remove accounts too"}
                  </AlertDialogAction>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
