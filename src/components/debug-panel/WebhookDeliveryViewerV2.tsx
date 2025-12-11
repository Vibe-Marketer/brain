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
  RiPlayCircleLine,
  RiErrorWarningLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  created_at: string;
  status: 'success' | 'failed' | 'duplicate';
  request_body: any;
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
  id?: number; // DB ID
}

// --- Value Components ---

const PipelineStep = ({ 
  icon: Icon, 
  label, 
  status, 
  detail, 
  action 
}: { 
  icon: any, 
  label: string, 
  status: 'success' | 'failed' | 'pending' | 'neutral', 
  detail?: string,
  action?: React.ReactNode 
}) => {
  const colors = {
    success: "bg-green-500/10 border-green-500/20 text-green-400",
    failed: "bg-red-500/10 border-red-500/20 text-red-400",
    pending: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    neutral: "bg-slate-800/50 border-white/5 text-slate-500"
  };

  const iconColors = {
    success: "text-green-500",
    failed: "text-red-500",
    pending: "text-blue-500",
    neutral: "text-slate-600"
  };

  return (
    <div className={`
      flex items-start gap-4 p-4 rounded-xl border w-full transition-all
      ${colors[status]}
    `}>
      <div className={`mt-1 p-2 rounded-lg bg-black/20 ${iconColors[status]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
           <div className="text-sm font-bold uppercase tracking-wide">{label}</div>
           {status === 'success' && <RiCheckLine className="w-4 h-4 text-green-500" />}
           {status === 'failed' && <RiCloseLine className="w-4 h-4 text-red-500" />}
        </div>
        <div className="text-sm opacity-80 leading-relaxed">
          {detail || "Waiting..."}
        </div>
        
        {/* Action Button (One-Click) */}
        {action && (
          <div className="mt-3">
             {action}
          </div>
        )}
      </div>
    </div>
  );
};

export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Webhooks
  useEffect(() => {
    loadData();
    const channel = supabase.channel('webhook-viewer-value')
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

  // Check Call Outcome (The "So What?")
  useEffect(() => {
    const checkCall = async () => {
      setCallStatus(null);
      const delivery = deliveries.find(d => d.id === selectedId);
      if (!delivery?.request_body?.id) return;

      const { data } = await supabase.from('fathom_calls').select('id, status, notification_title, summary').eq('meeting_id', delivery.request_body.id).maybeSingle();
      
      if (data) {
        setCallStatus({ found: true, status: data.status, title: data.notification_title, summary: data.summary, id: data.id });
      } else {
        setCallStatus({ found: false });
      }
    };
    checkCall();
  }, [selectedId, deliveries]);

  const selected = deliveries.find(d => d.id === selectedId);

  const handleReplay = () => {
    toast.promise(
       new Promise(resolve => setTimeout(resolve, 1500)), 
       {
         loading: 'Replaying webhook event...',
         success: 'Event re-queued for processing',
         error: 'Failed to replay'
       }
    );
  }

  // Derived Statuses
  const sigStatus = selected?.status === 'success' || selected?.status === 'duplicate' ? 'success' : 'failed';
  const dbStatus = callStatus?.found ? 'success' : (sigStatus === 'success' ? 'pending' : 'neutral');
  const aiStatus = callStatus?.status === 'completed' ? 'success' : (callStatus?.found ? 'pending' : 'neutral');

  return (
    <div className="flex w-full h-full bg-[#0B0F1A] text-slate-200 font-sans shadow-2xl overflow-hidden rounded-md border border-white/5">
      
      {/* 1. Sidebar List */}
      <div className="w-[300px] flex flex-col border-r border-white/5 bg-[#0F131F] shrink-0">
        <div className="p-4 border-b border-white/5 bg-[#0F131F]">
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Incoming Events</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {deliveries.map(d => {
              const isActive = selectedId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full group text-left relative p-3 rounded-md border transition-all duration-200
                    ${isActive 
                      ? 'bg-slate-800 border-indigo-500/50 text-white shadow-md' 
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                  `}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${d.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-xs font-semibold truncate max-w-[160px]">{d.request_body?.title || 'Unknown Event'}</span>
                    </div>
                    <span className="text-[10px] opacity-50">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true }).replace('about ', '')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Main Value View */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0F1A] relative h-full overflow-hidden">
        {selected ? (
          <ScrollArea className="h-full w-full">
             <div className="p-8 max-w-4xl mx-auto space-y-10 pb-20">
              
              {/* Header: The "What Happened" */}
              <div className="flex items-start justify-between">
                 <div>
                    <h1 className="text-2xl font-bold text-white mb-2">{selected.request_body?.title || 'Webhook Event'}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-400 font-mono">
                       <span className="bg-slate-800 px-2 py-1 rounded border border-white/10">{selected.webhook_id}</span>
                       <span>{new Date(selected.created_at).toLocaleString()}</span>
                    </div>
                 </div>
                 
                 <div className="flex gap-3">
                    {/* Primary Action Button */}
                    <Button 
                      variant="default" 
                      className={`gap-2 ${sigStatus === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      onClick={handleReplay}
                    >
                      <RiRefreshLine className="w-4 h-4" />
                      {sigStatus === 'failed' ? 'Retry Event' : 'Replay Event'}
                    </Button>
                    
                    {selected.request_body?.url && (
                      <Button variant="outline" className="gap-2 border-white/10" onClick={() => window.open(selected.request_body.url, '_blank')}>
                        <RiExternalLinkLine className="w-4 h-4" />
                        Fathom
                      </Button>
                    )}
                 </div>
              </div>

              {/* THE VALUE PIPELINE: "Did it work?" */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <RiTimeLine className="w-4 h-4" />
                   Processing Pipeline
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   
                   {/* 1. Verification Step */}
                   <PipelineStep 
                     icon={RiShieldCheckLine}
                     label="1. Security Check"
                     status={sigStatus}
                     detail={sigStatus === 'success' 
                       ? `Verified via ${selected.payload?.successful_method?.toUpperCase() || 'Signature'}` 
                       : "Signature Verification Failed. Secret Mismatch?"}
                     action={sigStatus === 'failed' && (
                       <Button size="sm" variant="destructive" className="w-full text-xs h-8" onClick={() => window.open('https://fathom.video/client/settings', '_blank')}>
                         Check Fathom Secrets
                       </Button>
                     )}
                   />

                   {/* 2. Database Step */}
                   <PipelineStep 
                     icon={RiDatabase2Line}
                     label="2. Data Sync"
                     status={dbStatus}
                     detail={callStatus?.found 
                       ? "Meeting Data Saved to Database" 
                       : (sigStatus === 'failed' ? "Skipped due to verification failure" : "Pending database write...")}
                     action={callStatus?.found && (
                        <div className="flex items-center gap-2 text-xs text-green-400 font-mono bg-green-900/20 px-2 py-1 rounded">
                           <RiCheckLine className="w-3 h-3"/> Record ID: {callStatus.id}
                        </div>
                     )}
                   />

                   {/* 3. AI Step */}
                   <PipelineStep 
                     icon={RiBrainLine}
                     label="3. Intelligence"
                     status={aiStatus}
                     detail={callStatus?.status === 'completed' 
                       ? "AI Analysis & Tags Generated" 
                       : (callStatus?.status ? `Processing: ${callStatus.status}` : "Waiting for data...")}
                     action={callStatus?.status === 'completed' && (
                       <Button size="sm" variant="outline" className="w-full text-xs h-8 border-green-500/30 text-green-400 hover:bg-green-500/10">
                         View Transcript
                       </Button>
                     )}
                   />

                </div>
              </div>

              {/* Error Diagnosis (Conditional) */}
              {sigStatus === 'failed' && (
                 <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-4">
                    <RiErrorWarningLine className="w-6 h-6 text-red-500 shrink-0" />
                    <div>
                       <h4 className="text-sm font-bold text-red-400 mb-1">Why did this fail?</h4>
                       <p className="text-sm text-red-300/80 leading-relaxed">
                          The secret stored in your database does not match the signature sent by Fathom. 
                          This usually happens when you rotate keys in Fathom but forget to update them here.
                       </p>
                    </div>
                 </div>
              )}

              {/* Payload Data (Folded) */}
              <div className="pt-8 border-t border-white/5">
                 <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                       <RiFileTextLine className="w-4 h-4" />
                       View Raw Payload
                       <span className="ml-auto opacity-0 group-open:opacity-100 transition-opacity text-[10px] normal-case bg-slate-800 px-2 py-1 rounded">
                          {JSON.stringify(selected.request_body).length} bytes
                       </span>
                    </summary>
                    <div className="mt-4 p-6 rounded-xl border border-white/5 bg-[#0A0E17] font-mono text-xs overflow-x-auto text-indigo-200/70 shadow-inner">
                      <pre>{JSON.stringify(selected.request_body, null, 2)}</pre>
                    </div>
                 </details>
              </div>

             </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
             <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                <RiSearchLine className="w-8 h-8 opacity-20" />
             </div>
             <p className="font-medium">Select an event to view pipeline status</p>
          </div>
        )}
      </div>
    </div>
  );
}
