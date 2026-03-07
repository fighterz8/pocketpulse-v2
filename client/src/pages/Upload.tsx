import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setUploadStatus("idle");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.dataTransfer?.files.length !== 0) {
      setFile(e.target.files[0]);
      setUploadStatus("idle");
    }
  };

  const handleUpload = () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload and parsing
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadStatus("success");
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground mt-1">Import transactions via CSV from your bank or accounting software.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>File Import</CardTitle>
          <CardDescription>
            We support standard CSV exports. The system will automatically detect date, amount, and description fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-select">Target Account</Label>
              <Select defaultValue="checking">
                <SelectTrigger id="account-select">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Main Checking (...4589)</SelectItem>
                  <SelectItem value="savings">Business Savings (...1234)</SelectItem>
                  <SelectItem value="cc">Corporate Credit Card (...8899)</SelectItem>
                  <SelectItem value="new">+ Add New Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format (Optional)</Label>
              <Select defaultValue="auto">
                <SelectTrigger id="date-format">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="mmddyyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="ddmmyyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div 
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/30 hover:bg-muted/50'}
              ${uploadStatus === 'success' ? 'border-success/50 bg-success/5' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadStatus === 'success' ? (
              <div className="space-y-3 flex flex-col items-center">
                <div className="h-16 w-16 bg-success/20 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h3 className="font-semibold text-lg">Upload Complete</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Successfully imported and parsed 342 transactions from {file?.name}.
                </p>
              </div>
            ) : file ? (
              <div className="space-y-4 w-full max-w-md mx-auto">
                <div className="flex items-center gap-3 p-4 bg-background rounded-lg border shadow-sm">
                  <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  {!isUploading && (
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-8 text-muted-foreground hover:text-destructive shrink-0">
                      Remove
                    </Button>
                  )}
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                      <span>Parsing data...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-2">
                  <UploadIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Drag & drop your CSV</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    or click to browse files from your computer. Max file size 10MB.
                  </p>
                </div>
                <div className="mt-4">
                  <Input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    id="file-upload" 
                    onChange={handleFileChange}
                  />
                  <Label 
                    htmlFor="file-upload"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
                  >
                    Select File
                  </Label>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t justify-between items-center py-4">
          <p className="text-xs text-muted-foreground flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            AI classification will automatically run on ambiguous entries.
          </p>
          {uploadStatus === 'success' ? (
            <Button data-testid="button-view-ledger" onClick={() => window.location.href = "/transactions"}>
              Review Transactions
            </Button>
          ) : (
            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
              data-testid="button-process-upload"
            >
              {isUploading ? "Processing..." : "Process Upload"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}