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
  RiExternalLinkLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

    const sub = supabase.channel('webhook-fresh-start')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        setDeliveries(prev => [payload.new as WebhookDelivery, ...prev]);
        // Auto-select is optional; keeping it stable is usually better UX
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  // Check Call Status on Selection
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
    <div className="flex w-full h-full bg-slate-950 text-slate-200 font-sans border border-slate-800 rounded-lg overflow-hidden">
      
      {/* LEFT SIDEBAR: Dense List */}
      <div className="w-[280px] flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-500 uppercase tracking-widest">
          Event Stream
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {deliveries.map(d => {
              const active = selectedId === d.id;
              const success = d.status === 'success';
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`flex flex-col gap-1 px-4 py-3 text-left border-l-2 transition-colors
                    ${active 
                      ? 'bg-slate-800 border-indigo-500' // Active
                      : 'border-transparent hover:bg-slate-800/50' // Idle
                    }`}
                >
                  <div className="flex items-center justify-between">
                     <span className={`text-[10px] font-bold uppercase ${success ? 'text-green-500' : 'text-red-500'}`}>
                        {d.status}
                     </span>
                     <span className="text-[10px] text-slate-600 font-mono">
                       {formatDistanceToNow(new Date(d.created_at), { addSuffix: true }).replace("about ", "")}
                     </span>
                  </div>
                  <div className="text-xs font-medium text-slate-300 truncate font-mono">
                    {d.request_body?.title || 'Unknown Event'}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT MAIN: Data Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {selected ? (
           <ScrollArea className="h-full">
             <div className="p-8 space-y-8">
                
                {/* 1. HEADER */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-6">
                   <div>
                      <h1 className="text-xl font-bold text-white mb-2 font-mono">
                         {selected.request_body?.title || "No Title"}
                      </h1>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                         <span>ID: {selected.webhook_id}</span>
                         <span>•</span>
                         <span>{new Date(selected.created_at).toLocaleString()}</span>
                         <span>•</span>
                         <a href={selected.request_body?.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-400">
                            Fathom Link <RiExternalLinkLine className="w-3 h-3" />
                         </a>
                      </div>
                   </div>
                   <div className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border
                      ${selected.status === 'success' 
                        ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                      {selected.status}
                   </div>
                </div>

                {/* 2. DIAGNOSTICS GRID */}
                <div className="grid grid-cols-3 gap-4">
                   
                   {/* Security */}
                   <div className={`p-4 rounded border ${selected.status === 'success' ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest opacity-70">
                         <RiShieldCheckLine className="w-4 h-4"/> Authenticity
                      </div>
                      <div className={`text-sm font-medium ${selected.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                         {selected.status === 'success' 
                           ? `Verified (${selected.payload?.successful_method || 'Signature'})` 
                           : "Signature Mismatch"}
                      </div>
                   </div>

                   {/* Database */}
                   <div className={`p-4 rounded border ${callStatus?.found ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-800 bg-slate-900/50'}`}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest opacity-70">
                         <RiDatabase2Line className="w-4 h-4"/> Storage
                      </div>
                      <div className={`text-sm font-medium ${callStatus?.found ? 'text-indigo-400' : 'text-slate-500'}`}>
                         {callStatus?.found ? "Record Synced" : "Not Found"}
                      </div>
                   </div>

                   {/* Intelligence */}
                   <div className={`p-4 rounded border ${callStatus?.status === 'completed' ? 'border-purple-500/20 bg-purple-500/5' : 'border-slate-800 bg-slate-900/50'}`}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest opacity-70">
                         <RiBrainLine className="w-4 h-4"/> AI Processing
                      </div>
                      <div className={`text-sm font-medium ${callStatus?.status === 'completed' ? 'text-purple-400' : 'text-slate-500'}`}>
                         {callStatus?.status ? callStatus.status.replace('_', ' ').toUpperCase() : "Pending"}
                      </div>
                   </div>
                </div>

                {/* 3. RAW PAYLOAD */}
                <div>
                   <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase text-slate-500 tracking-widest">
                      <RiFileCodeLine className="w-4 h-4"/> Raw Payload
                   </div>
                   <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 overflow-x-auto">
                      <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                         {JSON.stringify(selected.request_body, null, 2)}
                      </pre>
                   </div>
                </div>

             </div>
           </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
             <div className="text-center">
                <RiSearchLine className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Select an event</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
