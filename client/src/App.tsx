import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/Upload";
import Ledger from "@/pages/Ledger";
import Leaks from "@/pages/Leaks";
import AuthPage from "@/pages/Auth";

// A simple mock protected route wrapper
function ProtectedRoute({ component: Component }: { component: any }) {
  // Always render the component for mockup purposes, but normally we'd check auth state
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/upload">
        <ProtectedRoute component={UploadPage} />
      </Route>
      <Route path="/transactions">
        <ProtectedRoute component={Ledger} />
      </Route>
      <Route path="/leaks">
        <ProtectedRoute component={Leaks} />
      </Route>
      
      {/* Fallback to dashboard for unknown routes or explicitly settings for now */}
      <Route path="/settings">
         <Redirect to="/" />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;