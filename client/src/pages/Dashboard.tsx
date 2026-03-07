import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, TrendingUp, AlertTriangle, RefreshCcw, Download } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const mockCashflowData = [
  { month: "Jan", inflow: 45000, outflow: 32000, balance: 13000 },
  { month: "Feb", inflow: 52000, outflow: 38000, balance: 14000 },
  { month: "Mar", inflow: 48000, outflow: 35000, balance: 13000 },
  { month: "Apr", inflow: 61000, outflow: 42000, balance: 19000 },
  { month: "May", inflow: 59000, outflow: 45000, balance: 14000 },
  { month: "Jun", inflow: 65000, outflow: 41000, balance: 24000 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Financial overview and cashflow estimates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden sm:flex" data-testid="button-export">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button>Update View</Button>
        </div>
      </div>

      {/* Primary KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-sm">Safe-to-Spend Estimate</CardDescription>
            <CardTitle className="text-4xl md:text-5xl text-primary font-bold tracking-tight">
              $24,500.00
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm mt-2 text-muted-foreground">
              <span className="flex items-center text-success font-medium bg-success/10 px-2 py-0.5 rounded mr-2">
                <TrendingUp className="mr-1 h-3 w-3" />
                +12%
              </span>
              vs last month based on scheduled recurring expenses.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 shadow-sm border-warning/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="font-medium text-sm">Expense Leaks Detected</CardDescription>
              <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight mt-1">
              3 items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Estimated $450/mo in unused recurring charges.</p>
            <Button variant="outline" size="sm" className="w-full text-xs font-medium border-warning/50 hover:bg-warning/10" data-testid="button-review-leaks">
              Review Leaks
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Inflows</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$65,000</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outflows</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$41,000</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Income</CardTitle>
            <RefreshCcw className="h-4 w-4 text-success opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$48,500</div>
            <p className="text-xs text-muted-foreground mt-1">Baseline</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Expenses</CardTitle>
            <RefreshCcw className="h-4 w-4 text-destructive opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$22,400</div>
            <p className="text-xs text-muted-foreground mt-1">Baseline</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Cashflow Trends</CardTitle>
          <CardDescription>6-month historical view of inflows vs outflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockCashflowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 500 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Area type="monotone" dataKey="inflow" name="Inflow" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                <Area type="monotone" dataKey="outflow" name="Outflow" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}