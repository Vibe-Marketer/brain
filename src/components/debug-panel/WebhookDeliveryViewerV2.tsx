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
  RiArrowLeftLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  
  // Responsive State: If true, we show details full width and hide list
  // If false, we show list full width (on narrow screens)
  const [showDetailsMobile, setShowDetailsMobile] = useState(false);

  // Load Data
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) {
        setDeliveries(data as any);
        // Don't auto-select on mobile to keep list visible first
        // But on desktop we might want to. For now, strict 'click to view' is safer.
      }
    };
    fetch();

    const sub = supabase.channel('webhook-responsive')
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

  // Handlers
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowDetailsMobile(true);
  };

  const handleBack = () => {
    setShowDetailsMobile(false);
    setSelectedId(null);
  };

  return (
    <div className="@container w-full h-full bg-background text-foreground flex overflow-hidden relative">
      
      {/* 
         LIST VIEW 
         - Hidden on mobile IF details are showing
         - Full width on mobile IF details are NOT showing
         - Fixed width on Desktop always
      */}
      <div className={`
        flex-col border-r border-border bg-muted/10 h-full transition-all absolute inset-0 z-10 md:static md:w-[280px] md:translate-x-0 md:bg-transparent
        ${showDetailsMobile ? '-translate-x-full md:flex' : 'translate-x-0 flex'}
      `}>
        <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 bg-background/95 backdrop-blur shrink-0">
          <RiWebhookLine className="w-3.5 h-3.5"/>
          Event Stream
        </div>
        <ScrollArea className="flex-1 bg-background md:bg-transparent">
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
                      ${active 
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

      {/* 
         DETAIL VIEW 
         - Full width overlay on mobile (z-20)
         - Flex-1 on desktop
         - Hidden on mobile if not active
      */}
      <div className={`
        flex-col bg-background h-full w-full absolute inset-0 z-20 md:static md:flex-1 md:bg-transparent transition-transform duration-300
        ${showDetailsMobile ? 'translate-x-0 flex' : 'translate-x-full md:translate-x-0 md:flex'}
      `}>
        {selected ? (
           <ScrollArea className="h-full">
             <div className="flex flex-col h-full">
                
                {/* Header with Back Button (Mobile Only) */}
                <div className="p-4 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
                   <div className="flex items-start gap-3">
                      <Button variant="ghost" size="icon" className="md:hidden -ml-2 -mt-1 h-8 w-8 shrink-0" onClick={handleBack}>
                         <RiArrowLeftLine className="w-5 h-5"/>
                      </Button>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center justify-between mb-2">
                            <Badge variant={selected.status === 'success' ? 'default' : 'destructive'} className="text-[10px] h-5">
                              {selected.status.toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline-block">{selected.webhook_id}</span>
                         </div>
                         <h2 className="text-base font-bold leading-tight break-words mb-1">
                            {selected.request_body?.title || "No Title"}
                         </h2>
                         <div className="text-xs text-muted-foreground font-mono">
                            {new Date(selected.created_at).toLocaleString()}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                   
                   {/* Verification Status Cards: Stacks on small screens */}
                   <div className="grid grid-cols-1 @lg:grid-cols-3 gap-3">
                      
                      {/* Security */}
                      <div className={`p-3 rounded-lg border flex flex-row @lg:flex-col items-center @lg:items-start justify-between @lg:justify-start gap-2 ${selected.status === 'success' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiShieldCheckLine className="w-4 h-4" />
                            Security
                         </div>
                         <div className={`text-sm font-medium ${selected.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {selected.status === 'success' ? 'Verified' : 'Invalid'}
                         </div>
                      </div>

                      {/* Storage */}
                      <div className={`p-3 rounded-lg border flex flex-row @lg:flex-col items-center @lg:items-start justify-between @lg:justify-start gap-2 ${callStatus?.found ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiDatabase2Line className="w-4 h-4" />
                            Storage
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.found ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                            {callStatus?.found ? 'Synced' : 'Missing'}
                         </div>
                      </div>

                      {/* AI */}
                      <div className={`p-3 rounded-lg border flex flex-row @lg:flex-col items-center @lg:items-start justify-between @lg:justify-start gap-2 ${callStatus?.status === 'completed' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800' : 'bg-muted/40 border-border'}`}>
                         <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-80">
                            <RiBrainLine className="w-4 h-4" />
                            AI Status
                         </div>
                         <div className={`text-sm font-medium ${callStatus?.status === 'completed' ? 'text-purple-700 dark:text-purple-400' : 'text-muted-foreground'}`}>
                            {callStatus?.status ? callStatus.status.split('_').slice(-1)[0] : 'Idle'}
                         </div>
                      </div>

                   </div>

                   {/* Raw Payload Section */}
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
                         <div className="w-0 min-w-full"> {/* Forces pre to respect parent width */}
                           <pre>{JSON.stringify(selected.request_body, null, 2)}</pre>
                         </div>
                      </div>
                   </div>

                </div>
             </div>
           </ScrollArea>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground hidden md:flex">
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
