import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RiSearchLine,
  RiCheckDoubleLine,
  RiCloseCircleLine,
  RiTimeLine,
  RiDatabase2Line,
  RiBrainLine,
  RiShieldCheckLine,
  RiFileCodeLine,
  RiExternalLinkLine,
  RiWebhookLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  created_at: string;
  status: 'success' | 'failed' | 'duplicate';
  request_body: any;
  payload: {
    verification_results?: {
      personal_by_email?: { available: boolean; verified: boolean };
      oauth_app_secret?: { available: boolean; verified: boolean };
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

  // Load Data
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) {
        setDeliveries(data as any);
        if (data.length > 0) setSelectedId(data[0].id);
      }
    };
    fetch();

    const sub = supabase.channel('webhook-native-theme')
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

  return (
    <div className="flex h-full w-full flex-col md:flex-row bg-background text-foreground">
      
      {/* SIDEBAR LIST */}
      <div className="flex-1 md:flex-none md:w-[300px] flex flex-col border-r border-border bg-muted/10 h-[200px] md:h-full">
        <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <RiWebhookLine className="w-3.5 h-3.5"/>
          Event Stream
        </div>
        <ScrollArea className="flex-1">
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
                    onClick={() => setSelectedId(d.id)}
                    className={`flex flex-col gap-1 px-4 py-3 text-left border-b border-border/40 transition-colors
                      ${active 
                        ? 'bg-muted border-l-2 border-l-primary' 
                        : 'hover:bg-muted/50 border-l-2 border-l-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                       <span className={`text-[10px] font-bold uppercase ${isSuccess ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {d.status}
                       </span>
                       <span className="text-[10px] text-muted-foreground">
                         {formatDistanceToNow(new Date(d.created_at), { addSuffix: true }).replace("about ", "")}
                       </span>
                    </div>
                    <div className="text-xs font-medium truncate w-full">
                      {d.request_body?.title || 'Unknown Event'}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                       {d.webhook_id}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* DETAIL VIEW */}
      <div className="flex-[2] flex flex-col min-w-0 bg-background h-full">
        {selected ? (
           <ScrollArea className="h-full">
             <div className="p-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col gap-4 border-b border-border pb-6">
                   <div className="flex items-start justify-between">
                      <div>
                         <h2 className="text-lg font-bold tracking-tight mb-1">
                            {selected.request_body?.title || "No Title"}
                         </h2>
                         <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                            <span>{new Date(selected.created_at).toLocaleString()}</span>
                         </div>
                      </div>
                      <Badge variant={selected.status === 'success' ? 'default' : 'destructive'}>
                        {selected.status}
                      </Badge>
                   </div>
                   
                   {/* Verification Status Cards */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      {/* 1. Signature */}
                      <div className={`p-3 rounded-lg border ${selected.status === 'success' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                         <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase opacity-80">
                            <RiShieldCheckLine className="w-3.5 h-3.5" />
                            Security
                         </div>
                         <div className={`text-sm font-medium ${selected.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {selected.status === 'success' ? 'Verified' : 'Invalid Signature'}
                         </div>
                      </div>

                      {/* 2. Database */}
                      <div className={`p-3 rounded-lg border ${callStatus?.found ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase opacity-80">
                            <RiDatabase2Line className="w-3.5 h-3.5" />
                            Storage
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.found ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {callStatus?.found ? 'Record Synced' : 'Not Found'}
                         </div>
                      </div>

                      {/* 3. AI Processing */}
                      <div className={`p-3 rounded-lg border ${callStatus?.status === 'completed' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 mb-1 text-xs font-semibold uppercase opacity-80">
                            <RiBrainLine className="w-3.5 h-3.5" />
                            AI Status
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.status === 'completed' ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            {callStatus?.status ? callStatus.status.replace('_', ' ') : 'Pending'}
                         </div>
                      </div>

                   </div>
                </div>

                {/* Raw Payload Section */}
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <div className="text-sm font-semibold flex items-center gap-2">
                        <RiFileCodeLine className="w-4 h-4 text-muted-foreground" />
                        Payload Body
                     </div>
                     {selected.request_body?.url && (
                        <a href={selected.request_body.url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline">
                           View in Fathom <RiExternalLinkLine className="w-3 h-3" />
                        </a>
                     )}
                   </div>
                   
                   <div className="bg-muted/30 p-4 rounded-md border border-border overflow-auto max-h-[400px]">
                      <pre className="text-xs font-mono text-foreground leading-relaxed">
                         {JSON.stringify(selected.request_body, null, 2)}
                      </pre>
                   </div>
                </div>

             </div>
           </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
             <div className="text-center">
                <RiSearchLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select an event to view details</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
