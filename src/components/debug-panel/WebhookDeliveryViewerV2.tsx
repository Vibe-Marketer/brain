import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RiCheckboxCircleFill, 
  RiCloseCircleFill, 
  RiTimeLine, 
  RiSearchLine,
  RiShieldCheckLine,
  RiFileTextLine,
  RiExternalLinkLine,
  RiArrowRightLine,
  RiKey2Line,
  RiCpuLine,
  RiCheckLine,
  RiCloseLine,
  RiRefreshLine,
  RiDatabase2Line,
  RiBrainLine,
  RiCheckboxBlankCircleLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  created_at: string;
  status: 'success' | 'failed' | 'duplicate';
  request_body: any; // { id, title, ... }
  payload: {
    verification_results?: {
      personal_by_email?: { available: boolean; verified: boolean; secret_preview?: string };
      oauth_app_secret?: { available: boolean; verified: boolean; secret_preview?: string };
    };
    successful_method?: string;
  };
}

interface CallStatus {
  found: boolean;
  status?: string;
  title?: string;
  summary?: string;
}

// --- styled Components ---

const LogicNode = ({ title, status, subtext, active = false }: { title: string, status: 'success' | 'failed' | 'neutral' | 'active', subtext?: string, active?: boolean }) => {
  const styles = {
    success: "border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.1)]",
    failed: "border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.1)]",
    neutral: "border-white/10 bg-slate-900/40 text-slate-500 opacity-60",
    active: "border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
  };
  
  return (
    <div className={`
      relative px-4 py-3 rounded-xl border flex flex-col items-center justify-center min-w-[150px] backdrop-blur-md transition-all duration-300 z-10
      ${styles[status]}
    `}>
      <div className="text-[11px] font-bold tracking-wider uppercase mb-0.5">{title}</div>
      {subtext && <div className="text-[10px] opacity-70 font-mono">{subtext}</div>}
      
      {/* Connector Dot (Right) */}
      <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-[#0B0F1A] 
        ${status === 'success' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-slate-700'}
      `} />
      
      {/* Connector Dot (Left - Only for non-roots) */}
       <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-700`} />
    </div>
  );
};

const MethodNode = ({ name, status }: { name: string, status: 'success' | 'failed' | 'neutral' }) => (
  <div className={`
    flex items-center gap-3 px-4 py-2 rounded-lg border text-[10px] font-bold uppercase transition-all
    ${status === 'success' ? 'border-green-500/40 bg-green-950/30 text-green-400 opacity-100' : 
      status === 'failed' ? 'border-red-500/20 bg-red-950/10 text-red-500/70 opacity-70 grayscale-[0.3]' : 
      'border-white/5 bg-slate-900/40 text-slate-600'}
  `}>
    {status === 'success' ? <RiCheckboxCircleFill className="w-4 h-4" /> : 
     status === 'failed' ? <RiCloseCircleFill className="w-4 h-4" /> : 
     <RiCheckboxBlankCircleLine className="w-4 h-4 opacity-50" />}
    <span>{name}</span>
  </div>
);

export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Webhooks
  useEffect(() => {
    loadData();
    const channel = supabase.channel('webhook-viewer-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        setDeliveries(prev => [payload.new as WebhookDelivery, ...prev]);
        setDeliveries(curr => { if (curr.length === 0) setSelectedId(payload.new.id); return [payload.new as WebhookDelivery, ...curr]; });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) { 
      setDeliveries(data as any); 
      if (data.length > 0) setSelectedId(data[0].id); 
    }
    setLoading(false);
  };

  // Check Call Status when selected changes
  useEffect(() => {
    const checkCall = async () => {
      setCallStatus(null);
      const delivery = deliveries.find(d => d.id === selectedId);
      if (!delivery?.request_body?.id) return; // No meeting ID

      // Check fathom_calls table
      const { data } = await supabase.from('fathom_calls').select('status, notification_title, summary').eq('meeting_id', delivery.request_body.id).maybeSingle();
      
      if (data) {
        setCallStatus({ found: true, status: data.status, title: data.notification_title, summary: data.summary });
      } else {
        setCallStatus({ found: false });
      }
    };
    checkCall();
  }, [selectedId, deliveries]);

  const selected = deliveries.find(d => d.id === selectedId);

  const handleReplay = () => {
    toast.info("Replaying webhook logic...", { description: "This simulates the webhook event." });
    // In future: Call an edge function to re-process headers/body
  }

  return (
    <div className="flex w-full h-full bg-[#0B0F1A] text-slate-200 font-sans shadow-2xl overflow-hidden rounded-md border border-white/5">
      
      {/* 1. Sidebar List */}
      <div className="w-[320px] flex flex-col border-r border-white/5 bg-[#0F131F] flex-shrink-0">
        <div className="p-4 border-b border-white/5 bg-[#0F131F] z-10 w-full">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Event Log</h2>
        </div>
        <ScrollArea className="flex-1 w-full">
          <div className="p-3 space-y-2 w-full">
            {deliveries.map(d => {
              const isActive = selectedId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full group text-left relative p-3 rounded-lg border transition-all duration-200 outline-none
                    ${isActive 
                      ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-lg' 
                      : 'bg-[#161b2c] border-white/5 hover:bg-slate-800 hover:border-white/10 opacity-80 hover:opacity-100'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1.5 w-full">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide
                      ${d.status === 'success' ? 'text-green-400' : 'text-red-400'}
                    `}>
                      <div className={`w-1.5 h-1.5 rounded-full ${d.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {d.status}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true }).replace('about ', '')}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-200 truncate pr-2 mb-1 w-full">
                    {d.request_body?.title || 'Unknown Event'}
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono truncate opacity-60 w-full">
                    {d.webhook_id}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Detail View */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0F1A] relative h-full overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

        {selected ? (
          <ScrollArea className="h-full w-full">
             <div className="p-8 max-w-5xl mx-auto space-y-12 pb-20">
              
              {/* Header */}
              <div className="flex items-start justify-between w-full">
                <div>
                   <h1 className="text-2xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
                     {selected.request_body?.title || 'Webhook Details'}
                   </h1>
                   <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
                     <span className="px-2 py-0.5 rounded bg-slate-800 border border-white/10">{selected.webhook_id}</span>
                     <span>•</span>
                     <span>{new Date(selected.created_at).toLocaleString()}</span>
                   </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="bg-transparent border-white/10 hover:bg-white/5" onClick={handleReplay}>
                    <RiRefreshLine className="w-4 h-4 mr-2" />
                    Replay Event
                  </Button>
                </div>
              </div>

              {/* OUTCOME / VALUE SECTION (New) */}
              <div className="grid grid-cols-2 gap-4 w-full">
                 <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                       <RiDatabase2Line className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                       <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Data Storage</div>
                       <div className="text-sm font-medium text-slate-200">
                          {callStatus?.found ? (
                            <span className="text-green-400 flex items-center gap-1.5">
                              <RiCheckLine className="w-3.5 h-3.5" /> Call Record Created
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No record found yet</span>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="p-5 rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                       <RiBrainLine className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                       <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Processing</div>
                       <div className="text-sm font-medium text-slate-200">
                          {callStatus?.status === 'completed' ? (
                            <span className="text-purple-400 flex items-center gap-1.5">
                              <RiCheckLine className="w-3.5 h-3.5" /> Analysis Complete
                            </span>
                          ) : callStatus?.status ? (
                            <span className="text-yellow-400 capitalize">{callStatus.status.replace(/_/g, ' ')}</span>
                          ) : (
                            <span className="text-slate-500">Waiting for data...</span>
                          )}
                       </div>
                    </div>
                 </div>
              </div>


              {/* LOGIC GRAPH (The Tree) */}
              <div className="relative w-full">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Verification Path</h3>
                 
                 <div className="relative p-12 rounded-2xl border border-white/5 bg-[#0D111D] overflow-hidden w-full">
                    {/* SVG Connector Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
                       {/* Path from Resolution to Secret */}
                       <path d="M220 70 L340 70" stroke="white" strokeWidth="2" fill="none" />
                       {/* Path from Secret to Methods (Branching) */}
                       <path d="M490 70 L550 70 L550 40 L580 40" stroke="white" strokeWidth="2" fill="none" className={selected.payload?.successful_method === 'svix' ? 'opacity-20' : ''}/>
                       <path d="M550 70 L580 70" stroke="white" strokeWidth="2" fill="none" />
                       <path d="M550 70 L550 100 L580 100" stroke="white" strokeWidth="2" fill="none" />
                    </svg>

                    <div className="relative flex items-center gap-16 z-10 pl-10">
                       
                       {/* 1. Root */}
                       <LogicNode 
                         title="User Resolution" 
                         subtext="Matched Email"
                         status="success" 
                       />

                       {/* 2. Secret */}
                       <LogicNode 
                         title="Secret Handling" 
                         subtext={selected.payload?.verification_results?.personal_by_email?.available ? "Found Personal Key" : "Found OAuth Key"}
                         status="success" 
                       />

                       {/* 3. Branching Methods */}
                       <div className="flex flex-col gap-3 ml-8">
                          {/* Native */}
                          <MethodNode name="Native (x-signature)" status="failed" />
                          
                          {/* Simple */}
                          <MethodNode name="Simple (Header)" status="failed" />
                          
                          {/* Svix (or active) */}
                          <MethodNode 
                             name={selected.payload?.successful_method === 'svix' ? "Svix (Standard)" : "Checking..."} 
                             status={selected.status === 'success' ? 'success' : 'failed'} 
                          />
                       </div>

                    </div>
                 </div>
              </div>

              {/* PAYLOAD PREVIEW */}
              <div className="space-y-4 w-full">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Raw Payload</h3>
                 <div className="rounded-xl border border-white/5 bg-[#0A0E17] font-mono text-xs p-6 overflow-x-auto text-indigo-200/70 leading-relaxed shadow-inner w-full">
                   <pre>{JSON.stringify(selected.request_body, null, 2)}</pre>
                 </div>
              </div>

             </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
             Select an event to inspect
          </div>
        )}
      </div>
    </div>
  );
}
