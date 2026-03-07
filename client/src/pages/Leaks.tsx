import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ArrowRight, ShieldCheck, XCircle } from "lucide-react";

const leakData = [
  {
    id: 1,
    merchant: "SaaS Provider Inc",
    description: "Monthly subscription",
    amount: 149.00,
    frequency: "Monthly",
    lastSeen: "2023-10-15",
    confidence: "High",
    status: "Active",
    savingsPotential: 1788.00 // annual
  },
  {
    id: 2,
    merchant: "Unknown Consulting",
    description: "Retainer fee",
    amount: 1200.00,
    frequency: "Monthly",
    lastSeen: "2023-10-14",
    confidence: "Medium",
    status: "Active",
    savingsPotential: 14400.00 // annual
  },
  {
    id: 3,
    merchant: "Cloud Storage Backup",
    description: "Extra capacity",
    amount: 45.99,
    frequency: "Monthly",
    lastSeen: "2023-10-02",
    confidence: "High",
    status: "Active",
    savingsPotential: 551.88 // annual
  }
];

export default function Leaks() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leak Detection</h1>
          <p className="text-muted-foreground mt-1">Identify unused or redundant recurring expenses.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-warning/5 border-warning/20 md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle>Potential Savings Identified</CardTitle>
            </div>
            <CardDescription>
              We found 3 recurring charges that might be unnecessary based on your patterns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground mt-2">
              $16,739.88
            </div>
            <p className="text-sm text-muted-foreground mt-1">Total potential annual savings</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Detection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-3">
                 <div className="bg-success/20 p-2 rounded-full">
                    <ShieldCheck className="w-4 h-4 text-success" />
                 </div>
                 <div className="text-sm">
                   <p className="font-medium">Active Monitoring</p>
                   <p className="text-xs text-muted-foreground">Last scan: 2 hrs ago</p>
                 </div>
              </div>
              <div className="flex items-center gap-3 opacity-60">
                 <div className="bg-muted p-2 rounded-full">
                    <Clock className="w-4 h-4" />
                 </div>
                 <div className="text-sm">
                   <p className="font-medium">Next Scan</p>
                   <p className="text-xs text-muted-foreground">Tomorrow, 08:00 AM</p>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold mt-8 mb-4">Ranked Opportunities</h3>
      <div className="space-y-4">
        {leakData.map((leak) => (
          <Card key={leak.id} className="overflow-hidden transition-all hover:shadow-md">
            <div className="p-0 sm:flex items-stretch">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-lg">{leak.merchant}</h4>
                    <p className="text-sm text-muted-foreground">{leak.description}</p>
                  </div>
                  <Badge variant="outline" className={
                    leak.confidence === 'High' ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"
                  }>
                    {leak.confidence} Confidence
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Amount</p>
                    <p className="font-semibold">${leak.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Frequency</p>
                    <p className="font-medium">{leak.frequency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Seen</p>
                    <p className="font-medium">{leak.lastSeen}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Annual Cost</p>
                    <p className="font-bold text-destructive">${leak.savingsPotential.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 p-6 border-t sm:border-t-0 sm:border-l sm:w-64 flex flex-col justify-center gap-3">
                <Button className="w-full" variant="default" data-testid={`btn-ignore-${leak.id}`}>
                  Keep Active
                </Button>
                <Button className="w-full" variant="outline" data-testid={`btn-cancel-${leak.id}`}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark as Cancelled
                </Button>
                <Button variant="link" size="sm" className="w-full text-xs mt-2 text-muted-foreground hover:text-primary">
                  Review transaction history <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}