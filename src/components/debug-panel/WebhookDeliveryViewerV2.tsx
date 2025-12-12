import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RiSearchLine,
  RiDatabase2Line,
  RiBrainLine,
  RiShieldCheckLine,
  RiFileCodeLine,
  RiExternalLinkLine,
  RiWebhookLine,
  RiArrowLeftLine,
  RiToolsLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiTerminalBoxLine,
  RiLockPasswordLine,
  RiBugLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  created_at: string;
  status: 'success' | 'failed' | 'duplicate';
  request_body: any;
  request_headers: Record<string, string>;
  payload: {
    verification_results?: {
      personal_by_email?: { available: boolean; verified: boolean; secret_preview?: string };
      oauth_app_secret?: { available: boolean; verified: boolean; secret_preview?: string };
      first_user_fallback?: { available: boolean; verified: boolean };
    };
    signature_debug?: {
      received_signature?: string;
      svix_computed?: string;
      simple_full_secret?: string;
      simple_no_prefix?: string;
      simple_base64_decoded?: string;
    };
    successful_method?: string;
  };
}

interface CallStatus {
  found: boolean;
  status?: string;
  title?: string;
  summary?: string;
  id?: number;
}

// --- Component ---

export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Container Responsive Logic
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(true);
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 700);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load Data
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) {
        setDeliveries(data as any);
      }
    };
    fetch();

    const sub = supabase.channel('webhook-forensics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        setDeliveries(prev => [payload.new as WebhookDelivery, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  // Check Call Status
  useEffect(() => {
    if (!selectedId) return;
    const item = deliveries.find(d => d.id === selectedId);
    if (!item?.request_body?.id) {
       setCallStatus(null);
       return;
    }
    
    supabase.from('fathom_calls').select('id, status, notification_title, summary').eq('meeting_id', item.request_body.id).maybeSingle()
      .then(({data}) => {
        if (data) setCallStatus({ found: true, ...data });
        else setCallStatus({ found: false });
      });
  }, [selectedId, deliveries]);

  const selected = deliveries.find(d => d.id === selectedId);

  // Interaction Handlers
  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (isNarrow) setShowDetailMobile(true);
  };

  const handleBack = () => {
    setShowDetailMobile(false);
    setSelectedId(null);
  };

  // Tools Actions
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-background text-foreground flex overflow-hidden relative rounded-md">
      
      {/* LIST PANE */}
      <div className={`
        flex-col border-r border-border bg-muted/10 h-full transition-all
        ${isNarrow ? (showDetailMobile ? 'hidden' : 'w-full flex') : 'w-[280px] flex shrink-0'}
      `}>
        <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 bg-background/95 backdrop-blur shrink-0">
          <RiWebhookLine className="w-3.5 h-3.5"/>
          Event Stream
        </div>
        <ScrollArea className="flex-1 bg-background/50">
          <div className="flex flex-col">
            {deliveries.length === 0 ? (
               <div className="p-4 text-center text-xs text-muted-foreground">No events found</div>
            ) : (
               deliveries.map(d => {
                const active = selectedId === d.id;
                const isSuccess = d.status === 'success';
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelect(d.id)}
                    className={`flex flex-col gap-1 px-4 py-3 text-left border-b border-border/40 transition-colors
                      ${active && !isNarrow 
                        ? 'bg-muted border-l-2 border-l-primary' 
                        : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                       <span className={`text-[10px] font-bold uppercase ${isSuccess ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {d.status}
                       </span>
                       <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                         {formatDistanceToNow(new Date(d.created_at), { addSuffix: true }).replace("about ", "")}
                       </span>
                    </div>
                    <div className="text-xs font-medium truncate w-full mt-0.5">
                      {d.request_body?.title || 'Unknown Event'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* DETAIL PANE */}
      <div className={`
        flex-col bg-background h-full min-w-0
        ${isNarrow ? (showDetailMobile ? 'w-full flex' : 'hidden') : 'flex-1 flex'}
      `}>
        {selected ? (
           <ScrollArea className="h-full w-full">
             <div className="flex flex-col h-full">
                
                {/* Header */}
                <div className="p-4 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30 flex items-start gap-3">
                   {isNarrow && (
                      <Button variant="ghost" size="icon" className="-ml-2 -mt-1 h-8 w-8 shrink-0" onClick={handleBack}>
                         <RiArrowLeftLine className="w-5 h-5"/>
                      </Button>
                   )}
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                         <Badge variant={selected.status === 'success' ? 'default' : 'destructive'} className="text-[10px] h-5">
                           {selected.status.toUpperCase()}
                         </Badge>
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline-block">{selected.webhook_id.slice(0, 12)}...</span>
                            
                            {/* TOOLS MENU */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <RiToolsLine className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Event Tools</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => copyToClipboard(JSON.stringify(selected.request_body, null, 2), "Payload")}>
                                  <RiFileCopyLine className="w-3.5 h-3.5 mr-2" /> Copy JSON Body
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyToClipboard(JSON.stringify(selected, null, 2), "Full Report")}>
                                  <RiBugLine className="w-3.5 h-3.5 mr-2" /> Copy Full Debug Report
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => downloadJson(selected, `webhook-${selected.webhook_id}.json`)}>
                                  <RiDownloadLine className="w-3.5 h-3.5 mr-2" /> Export JSON File
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                      </div>
                      <h2 className="text-base font-bold leading-tight break-words mb-1">
                         {selected.request_body?.title || "No Title"}
                      </h2>
                      <div className="text-xs text-muted-foreground font-mono">
                         {new Date(selected.created_at).toLocaleString()}
                      </div>
                   </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                   
                   {/* Verification Status Cards */}
                   <div className={`grid gap-3 ${isNarrow ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      {/* Security */}
                      <div className={`p-3 rounded-lg border flex flex-col gap-1 ${selected.status === 'success' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiShieldCheckLine className="w-4 h-4" /> Security
                         </div>
                         <div className={`text-sm font-medium ${selected.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {selected.status === 'success' ? 'Verified' : 'Invalid Signature'}
                         </div>
                      </div>

                      {/* Storage */}
                      <div className={`p-3 rounded-lg border flex flex-col gap-1 ${callStatus?.found ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiDatabase2Line className="w-4 h-4" /> Storage
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.found ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {callStatus?.found ? 'Synced' : 'Missing'}
                         </div>
                      </div>

                      {/* AI */}
                      <div className={`p-3 rounded-lg border flex flex-col gap-1 ${callStatus?.status === 'completed' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiBrainLine className="w-4 h-4" /> AI Status
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.status === 'completed' ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            {callStatus?.status ? callStatus.status.split('_').slice(-1)[0] : 'Idle'}
                         </div>
                      </div>
                   </div>

                   {/* ADVANCED FORENSICS TOGGLE */}
                   <div className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowDebug(!showDebug)} 
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                         <RiTerminalBoxLine className="w-3.5 h-3.5 mr-1.5" />
                         {showDebug ? "Hide Forensics" : "Show Forensic Analysis"}
                      </Button>
                   </div>

                   {/* FORENSICS PANEL */}
                   {showDebug && (
                     <div className="bg-slate-950 text-slate-300 rounded-lg border border-slate-800 overflow-hidden text-xs font-mono">
                        <div className="p-3 bg-slate-900 border-b border-slate-800 font-bold flex items-center gap-2 text-slate-400">
                           <RiLockPasswordLine className="w-3.5 h-3.5" /> Cryptographic Verification Log
                        </div>
                        
                        {/* 1. Secrets Tried */}
                        <div className="p-4 border-b border-slate-800 space-y-3">
                           <div className="opacity-50 uppercase tracking-wider text-[10px] font-bold">Secrets Tested</div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {/* OAuth Secret */}
                             <div className="flex justify-between p-2 bg-slate-900/50 rounded border border-slate-800">
                                <span>OAuth App Secret</span>
                                <span className={selected.payload?.verification_results?.oauth_app_secret?.verified ? "text-green-400" : "text-red-400"}>
                                   {selected.payload?.verification_results?.oauth_app_secret?.verified ? "MATCH" : "FAIL"}
                                </span>
                             </div>
                             {/* Personal Secret */}
                             <div className="flex justify-between p-2 bg-slate-900/50 rounded border border-slate-800">
                                <span>Personal Secret ({selected.request_body?.recorded_by?.email || 'N/A'})</span>
                                <span className={selected.payload?.verification_results?.personal_by_email ? (selected.payload.verification_results.personal_by_email.verified ? "text-green-400" : "text-red-400") : "text-slate-600"}>
                                   {selected.payload?.verification_results?.personal_by_email ? (selected.payload.verification_results.personal_by_email.verified ? "MATCH" : "FAIL") : "N/A"}
                                </span>
                             </div>
                           </div>
                        </div>

                        {/* 2. Signatures */}
                        <div className="p-4 space-y-3 overflow-x-auto">
                           <div className="opacity-50 uppercase tracking-wider text-[10px] font-bold">Signature Comparison</div>
                           
                           {/* Received */}
                           <div>
                              <div className="text-slate-500 mb-1">Received Header (x-signature or webhook-signature)</div>
                              <div className="p-2 bg-blue-900/20 text-blue-200 border border-blue-900/40 rounded break-all select-all">
                                 {selected.payload?.signature_debug?.received_signature || 
                                  selected.request_headers['x-signature'] || 
                                  selected.request_headers['webhook-signature'] || "MISSING"}
                              </div>
                           </div>

                           {/* Computed (Comparison) */}
                           <div className="grid gap-2 mt-2">
                              <div className="text-slate-500 mb-1">Computed Candidates</div>
                              
                              {/* Native */}
                              <div className="flex gap-2 items-center p-2 bg-slate-900 rounded border border-slate-800">
                                 <span className="w-24 shrink-0 text-slate-500">Native Simple:</span>
                                 <code className="text-orange-300 break-all select-all">{selected.payload?.signature_debug?.simple_full_secret || "N/A"}</code>
                              </div>

                              {/* Svix */}
                              <div className="flex gap-2 items-center p-2 bg-slate-900 rounded border border-slate-800">
                                 <span className="w-24 shrink-0 text-slate-500">Svix (Complex):</span>
                                 <code className="text-purple-300 break-all select-all">{selected.payload?.signature_debug?.svix_computed || "N/A"}</code>
                              </div>
                           </div>
                        </div>
                     </div>
                   )}

                   {/* Raw Payload Section (Default) */}
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold flex items-center gap-2">
                           <RiFileCodeLine className="w-4 h-4 text-muted-foreground" />
                           Payload
                        </div>
                        {selected.request_body?.url && (
                           <a href={selected.request_body.url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline">
                              Fathom <RiExternalLinkLine className="w-3 h-3" />
                           </a>
                        )}
                      </div>
                      
                      <div className="bg-muted/30 p-3 rounded-md border border-border overflow-auto text-xs font-mono text-foreground leading-relaxed max-w-full">
                         <div className="w-0 min-w-full">
                           <pre>{JSON.stringify(selected.request_body, null, 2)}</pre>
                         </div>
                      </div>
                   </div>

                </div>
             </div>
           </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
             <div className="text-center">
                <RiSearchLine className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select an event</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
