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
  RiCloseLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  recording_id: number | null;
  status: 'success' | 'failed' | 'duplicate';
  created_at: string;
  request_body: any;
  payload: {
    verification_results?: {
      personal_by_email?: { available: boolean; verified: boolean; secret_preview?: string };
      oauth_app_secret?: { available: boolean; verified: boolean; secret_preview?: string };
      first_user_fallback?: { available: boolean; verified: boolean; secret_preview?: string };
    };
    successful_method?: string;
  };
}

// --- styled Components ---

const GlassCard = ({ children, className = "", active = false }: { children: React.ReactNode, className?: string, active?: boolean }) => (
  <div className={`
    backdrop-blur-xl border transition-all duration-300 relative overflow-hidden
    ${active 
      ? 'bg-slate-800/60 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.1)]' 
      : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/40'}
    ${className}
  `}>
    {children}
  </div>
);

const LogicNode = ({ title, status, isStart = false, isEnd = false, subtext }: { title: string, status: 'success' | 'failed' | 'neutral', isStart?: boolean, isEnd?: boolean, subtext?: string }) => {
  const colors = {
    success: "border-green-500/40 bg-green-900/10 text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.1)]",
    failed: "border-red-500/40 bg-red-900/10 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.1)]",
    neutral: "border-white/10 bg-slate-800/50 text-slate-400"
  };
  
  return (
    <div className="flex items-center">
      <div className={`
        relative px-5 py-3 rounded-xl border flex flex-col items-center justify-center min-w-[140px] z-10 backdrop-blur-md transition-all duration-500
        ${colors[status]}
      `}>
        <div className="text-xs font-bold tracking-wide uppercase">{title}</div>
        {subtext && <div className="text-[10px] opacity-70 mt-0.5">{subtext}</div>}
        
        {/* Status Icon Badge */}
        {status !== 'neutral' && (
          <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg ${status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {status === 'success' ? <RiCheckLine className="w-3 h-3 text-slate-950 stroke-[3]" /> : <RiCloseLine className="w-3 h-3 text-white" />}
          </div>
        )}
      </div>
      
      {!isEnd && (
        <div className="w-8 h-0.5 bg-gradient-to-r from-slate-700 to-slate-800 mx-1 relative">
           <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-700 rounded-full"></div>
        </div>
      )}
    </div>
  );
};

export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // FIX: Removed [selectedId] from dependency array to prevent reset on click
  useEffect(() => {
    loadData();
    const channel = supabase.channel('webhook-viewer-final')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        setDeliveries(prev => [payload.new as WebhookDelivery, ...prev]);
        // Only select new if we're at the top or nothing selected
        setDeliveries(current => {
           if (current.length === 0) setSelectedId(payload.new.id);
           return [payload.new as WebhookDelivery, ...current];
        });
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

  const selected = deliveries.find(d => d.id === selectedId);

  return (
    <div className="flex h-[850px] w-full bg-[#0B0F1A] text-slate-200 font-sans overflow-hidden rounded-2xl border border-white/5 shadow-2xl">
      
      {/* 1. Sidebar Panel */}
      <div className="w-[340px] flex flex-col border-r border-white/5 bg-[#0F131F]/80 backdrop-blur-md">
        <div className="p-6 pb-4">
           <h2 className="text-sm font-bold text-slate-100 mb-6">Recent Webhooks</h2>
           <ScrollArea className="h-[750px] pr-4">
             <div className="space-y-3">
               {deliveries.map(d => {
                 const isActive = selectedId === d.id;
                 return (
                   <button
                     key={d.id}
                     onClick={() => setSelectedId(d.id)}
                     className={`w-full group text-left relative p-4 rounded-xl border transition-all duration-300
                       ${isActive 
                         ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-green-500/30 ring-1 ring-green-500/20 shadow-lg' 
                         : 'bg-slate-900/20 border-white/5 hover:bg-slate-800/40 hover:border-white/10'}
                     `}
                   >
                     {/* Glow effect for active */}
                     {isActive && <div className="absolute inset-0 bg-green-500/5 rounded-xl blur-sm" />}

                     <div className="relative flex items-start gap-4">
                       <div className={`mt-1 w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0
                         ${d.status === 'success' ? 'text-green-500 bg-green-500' : 'text-red-500 bg-red-500'}
                       `} />
                       
                       <div className="flex-1 min-w-0">
                         <div className="text-xs font-semibold text-slate-200 truncate pr-2">
                           {d.request_body?.title || 'Unknown Event'}
                         </div>
                         <div className="text-[10px] text-slate-500 mt-1 font-mono truncate opacity-60">
                           {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                         </div>
                         <div className="text-[10px] text-slate-600 mt-1 font-mono truncate">
                           ID: {d.webhook_id.substring(0, 18)}...
                         </div>
                       </div>
                     </div>
                   </button>
                 );
               })}
             </div>
           </ScrollArea>
        </div>
      </div>

      {/* 2. Main Detail Panel */}
      <div className="flex-1 flex flex-col relative bg-[#0B0F1A]">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />

        {selected ? (
          <ScrollArea className="flex-1 z-10">
            <div className="p-8 max-w-5xl mx-auto space-y-10">
              
              {/* Header Title Area */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <h1 className="text-3xl font-bold text-white tracking-tight">Webhook Verified</h1>
                   <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-[0_0_15px_currentColor] flex items-center gap-2
                     ${selected.status === 'success' 
                       ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                       : 'bg-red-500/10 text-red-400 border border-red-500/20'}
                   `}>
                     {selected.status === 'success' ? 'Success' : 'Failed'}
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-slate-500 text-sm font-mono mb-1">{new Date(selected.created_at).toUTCString()}</div>
                   {selected.request_body?.url && (
                    <a href={selected.request_body.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-end gap-1">
                      View in Fathom <RiExternalLinkLine className="w-3 h-3"/>
                    </a>
                   )}
                </div>
              </div>

              {/* 3. Logic & Verification Flow (The Graph) */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 ml-1">Verification Logic</h3>
                <div className="relative p-10 rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-sm overflow-hidden">
                  {/* Grid Pattern Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                  <div className="relative flex flex-wrap items-center justify-center gap-y-8 z-10 w-full">
                     
                     {/* Step 1: User MATCH */}
                     <LogicNode 
                       title="Secret Resolution" 
                       subtext="Match User Email"
                       status="success" 
                       isStart
                     />

                     {/* Step 2: Secret FOUND */}
                     <LogicNode 
                       title="Found Personal Secret" 
                       subtext={selected.payload?.verification_results?.personal_by_email?.available ? "Matched by Email" : "Using Fallback"}
                       status={
                         (selected.payload?.verification_results?.personal_by_email?.available || selected.payload?.verification_results?.oauth_app_secret?.available) 
                         ? 'success' : 'failed'
                       }
                     />

                     <div className="flex flex-col gap-4 mx-4">
                        {/* Branch A: Native */}
                        <div className="flex items-center opacity-50">
                           <RiArrowRightLine className="w-5 h-5 text-slate-600 mr-2" />
                           <div className="px-4 py-2 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 text-[10px] font-bold uppercase">
                              Native (Failed)
                           </div>
                        </div>

                        {/* Branch B: Simply (Body Only) */}
                        <div className="flex items-center opacity-50">
                           <RiArrowRightLine className="w-5 h-5 text-slate-600 mr-2" />
                           <div className="px-4 py-2 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 text-[10px] font-bold uppercase">
                              Simple (Failed)
                           </div>
                        </div>

                        {/* Branch C: Svix (or Successful One) */}
                        <div className="flex items-center scale-110 origin-left">
                           <div className="w-8 h-0.5 bg-green-500 mr-2 shadow-[0_0_10px_#22c55e]"></div>
                           <div className={`px-5 py-3 rounded-xl border text-xs font-bold uppercase shadow-lg flex items-center gap-2
                             ${selected.status === 'success' 
                               ? 'border-green-500 text-slate-950 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                               : 'border-red-500 text-slate-950 bg-red-500'}
                           `}>
                              {selected.payload?.successful_method === 'svix' ? 'Svix Method' : 'Method'}
                              {selected.status === 'success' ? <RiCheckLine className="w-4 h-4"/> : <RiCloseLine className="w-4 h-4"/>}
                           </div>
                        </div>
                     </div>

                  </div>
                </div>
              </div>

              {/* 4. Payload Overview Cards */}
              <div className="grid grid-cols-4 gap-4">
                 {[
                   { label: "Meeting Title", val: selected.request_body?.title, width: "col-span-2" },
                   { label: "Duration", val: selected.request_body?.duration ? `${Math.round(selected.request_body.duration/60)} mins` : null },
                   { label: "Participants", val: `${selected.request_body?.participants?.length || 0} People` },
                 ].map((item, i) => (
                   <div key={i} className={`p-5 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur-sm ${item.width || ''}`}>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">{item.label}</div>
                      <div className="text-sm font-medium text-slate-200 truncate">{item.val || '—'}</div>
                   </div>
                 ))}
              </div>

              {/* 5. Raw JSON Payload */}
              <div className="rounded-xl border border-white/5 overflow-hidden bg-[#0A0E17]">
                 <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Raw JSON</span>
                    <div className="flex gap-1.5">
                       <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                    </div>
                 </div>
                 <ScrollArea className="h-[250px] w-full">
                    <div className="p-4 font-mono text-xs leading-relaxed text-indigo-200/80 selection:bg-indigo-500/30">
                       <pre>{JSON.stringify(selected.request_body, null, 2)}</pre>
                    </div>
                 </ScrollArea>
              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
             <RiCpuLine className="w-16 h-16 opacity-20" />
             <p className="font-medium tracking-wide">SELECT A WEBHOOK</p>
          </div>
        )}
      </div>
    </div>
  );
}
