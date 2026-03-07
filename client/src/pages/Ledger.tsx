import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Sparkles, Check, ArrowDownRight, ArrowUpRight, Clock, CalendarDays } from "lucide-react";

// Mock data
const transactions = [
  { id: 1, date: "2023-10-24", rawDesc: "STRIPE - TRANSFER", merchant: "Stripe", amount: 4500.00, type: "inflow", class: "income", recurrence: "one-time", autoClassified: true, aiAssisted: false },
  { id: 2, date: "2023-10-23", rawDesc: "AWS EMEA *1X2Y3Z", merchant: "Amazon Web Services", amount: -340.50, type: "outflow", class: "expense", recurrence: "recurring", autoClassified: true, aiAssisted: false },
  { id: 3, date: "2023-10-22", rawDesc: "GUSTO GUSTO PAYROLL", merchant: "Gusto", amount: -12450.00, type: "outflow", class: "expense", recurrence: "recurring", autoClassified: true, aiAssisted: false },
  { id: 4, date: "2023-10-21", rawDesc: "TST* LOCAL COFFEE SHOP", merchant: "Local Coffee", amount: -24.50, type: "outflow", class: "expense", recurrence: "one-time", autoClassified: true, aiAssisted: false },
  { id: 5, date: "2023-10-20", rawDesc: "DEPOSIT - WIRE FROM ACME CORP", merchant: "Acme Corp", amount: 8500.00, type: "inflow", class: "income", recurrence: "one-time", autoClassified: false, aiAssisted: true },
  { id: 6, date: "2023-10-18", rawDesc: "ADOBE *CREATIVE CLOUD", merchant: "Adobe", amount: -54.99, type: "outflow", class: "expense", recurrence: "recurring", autoClassified: true, aiAssisted: false },
  { id: 7, date: "2023-10-15", rawDesc: "UBER   *TRIP", merchant: "Uber", amount: -42.10, type: "outflow", class: "expense", recurrence: "one-time", autoClassified: true, aiAssisted: false },
  { id: 8, date: "2023-10-14", rawDesc: "SQ *CONSULTING RETAINER", merchant: "Unknown Consulting", amount: -1200.00, type: "outflow", class: "expense", recurrence: "one-time", autoClassified: false, aiAssisted: true },
];

export default function Ledger() {
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unified Ledger</h1>
          <p className="text-muted-foreground mt-1">Review and correct transaction classifications.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Assistant Active
          </Badge>
        </div>
      </div>

      <Card className="shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/10">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search merchants or descriptions..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select defaultValue="all">
              <SelectTrigger className="w-[130px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="inflow">Inflows</SelectItem>
                <SelectItem value="outflow">Outflows</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="needs-review">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="needs-review">Needs Review</SelectItem>
                <SelectItem value="auto">Auto-classified</SelectItem>
                <SelectItem value="manual">Manual override</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[200px]">Merchant / Desc</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                <TableHead className="w-[140px]">Classification</TableHead>
                <TableHead className="w-[140px]">Recurrence</TableHead>
                <TableHead className="w-[80px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="group hover:bg-muted/10">
                  <TableCell className="font-medium text-xs whitespace-nowrap">
                    {tx.date}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center">
                      {tx.merchant}
                      {tx.aiAssisted && (
                        <span title="AI Classified">
                          <Sparkles className="w-3 h-3 ml-1.5 text-primary opacity-70" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5" title={tx.rawDesc}>
                      {tx.rawDesc}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`font-semibold ${tx.type === 'inflow' ? 'text-success' : ''}`}>
                      {tx.type === 'inflow' ? '+' : ''}{tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select defaultValue={tx.class}>
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1.5">
                          {tx.class === 'income' ? <ArrowUpRight className="w-3 h-3 text-success" /> : 
                           tx.class === 'expense' ? <ArrowDownRight className="w-3 h-3 text-destructive" /> : null}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select defaultValue={tx.recurrence}>
                      <SelectTrigger className="h-8 text-xs">
                        <div className="flex items-center gap-1.5">
                          {tx.recurrence === 'recurring' ? <Clock className="w-3 h-3 text-primary" /> : 
                           <CalendarDays className="w-3 h-3 text-muted-foreground" />}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recurring">Recurring</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success hover:bg-success/10 rounded-full" title="Confirm classification">
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground bg-muted/10">
          <div>Showing 8 of 342 transactions</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}