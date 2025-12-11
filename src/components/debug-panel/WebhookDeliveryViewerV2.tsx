import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RiCheckboxCircleLine, 
  RiCloseCircleLine, 
  RiAlertLine, 
  RiTimeLine, 
  RiSearchLine,
  RiShieldCheckLine,
  RiFileTextLine,
  RiExternalLinkLine,
  RiArrowRightLine,
  RiKey2Line,
  RiCpuLine
} from "@remixicon/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

// --- Types ---
interface WebhookDelivery {
  id: string;
  webhook_id: string;
  recording_id: number | null;
  status: 'success' | 'failed' | 'duplicate';
  error_message: string | null;
  request_headers: Record<string, string>;
  request_body: any;
  payload: {
    verification_results?: {
      personal_by_email?: { available: boolean; verified: boolean; secret_preview?: string };
      oauth_app_secret?: { available: boolean; verified: boolean; secret_preview?: string };
      first_user_fallback?: { available: boolean; verified: boolean; secret_preview?: string };
    };
    successful_method?: string;
  };
  created_at: string;
  user_id: string;
}

interface SecretInfo {
  host_email: string;
  webhook_secret: string;
}

// --- Neon Components ---

function NeonBadge({ status, text }: { status: string, text?: string }) {
  const styles = {
    success: "bg-green-500/10 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]",
    failed: "bg-red-500/10 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(248,113,113,0.2)]",
    duplicate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/50 shadow-[0_0_10px_rgba(250,204,21,0.2)]",
    neutral: "bg-slate-700/50 text-slate-400 border-slate-600",
  };
  
  const icon = {
    success: <RiCheckboxCircleLine className="w-3.5 h-3.5" />,
    failed: <RiCloseCircleLine className="w-3.5 h-3.5" />,
    duplicate: <RiAlertLine className="w-3.5 h-3.5" />,
    neutral: null
  };

  const type = (status as keyof typeof styles) || 'neutral';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-md ${styles[type]}`}>
      {icon[type]}
      {text || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function FlowNode({ icon: Icon, title, subtitle, status = 'neutral', isEnd = false }: any) {
  const statusColors = {
    success: "border-green-500/50 text-green-400 bg-green-950/20 shadow-[0_0_15px_rgba(74,222,128,0.1)]",
    failed: "border-red-500/50 text-red-400 bg-red-950/20 shadow-[0_0_15px_rgba(248,113,113,0.1)]",
    neutral: "border-white/10 text-slate-400 bg-slate-800/30",
    active: "border-blue-500/50 text-blue-400 bg-blue-950/20 shadow-[0_0_15px_rgba(96,165,250,0.1)]"
  };

  return (
    <div className="flex items-center">
      <div className={`relative flex flex-col items-center justify-center p-4 rounded-xl border min-w-[140px] transition-all duration-300 ${statusColors[status as keyof typeof statusColors]}`}>
        <Icon className={`w-6 h-6 mb-2 ${status === 'neutral' ? 'opacity-50' : 'opacity-100'}`} />
        <span className="text-xs font-bold tracking-wide uppercase opacity-80">{title}</span>
        {subtitle && <span className="text-[10px] opacity-60 mt-1">{subtitle}</span>}
        
        {/* Status indicator dot */}
        {status !== 'neutral' && (
           <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
             status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 
             status === 'failed' ? 'bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-blue-500'
           }`}></div>
        )}
      </div>
      {!isEnd && (
        <div className="mx-2 text-slate-600">
          <RiArrowRightLine className="w-5 h-5 opacity-30" />
        </div>
      )}
    </div>
  );
}

// --- Main Component ---
export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedDelivery = deliveries.find(d => d.id === selectedId);

  useEffect(() => {
    loadData();
    const channel = supabase.channel('webhook-viewer-neon')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        setDeliveries(prev => [payload.new as WebhookDelivery, ...prev]);
        if (!selectedId) setSelectedId(payload.new.id);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) { setDeliveries(data as any); if (data.length > 0) setSelectedId(data[0].id); }
    setLoading(false);
  };

  // Helper to determine step status
  const getStepStatus = (d: WebhookDelivery, step: 'secret' | 'signature') => {
    const res = d.payload?.verification_results;
    if (step === 'secret') {
      const hasPersonal = res?.personal_by_email?.available;
      const hasOauth = res?.oauth_app_secret?.available;
      return (hasPersonal || hasOauth) ? 'success' : 'failed';
    }
    if (step === 'signature') return d.signature_valid ? 'success' : 'failed';
    return 'neutral';
  };

  return (
    <div className="flex h-[800px] w-full bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
      
      {/* Sidebar */}
      <div className="w-[320px] flex flex-col border-r border-white/5 bg-slate-900/50 backdrop-blur-sm">
        <div className="p-5 border-b border-white/5">
           <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Recent Webhooks</h2>
           <div className="relative">
             <RiSearchLine className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
             <input 
               type="text" 
               placeholder="Search event..." 
               className="w-full bg-slate-800/50 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
             />
           </div>
        </div>
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-2">
            {deliveries.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`group flex flex-col w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                  selectedId === d.id 
                  ? 'bg-slate-800/80 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                  : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                   <div className={`w-2 h-2 rounded-full ${
                     d.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 
                     d.status === 'failed' ? 'bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.6)]' : 'bg-yellow-500'
                   }`}></div>
                   <span className="text-[10px] font-mono text-slate-500">
                     {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                   </span>
                </div>
                <h3 className={`text-sm font-medium truncate w-full ${selectedId === d.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {d.request_body?.title || 'Unknown Event'}
                </h3>
                <code className="text-[10px] text-slate-600 mt-1 truncate w-full font-mono opacity-60">
                  {d.webhook_id}
                </code>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950">
        
        {/* Subtle background grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

        {selectedDelivery ? (
          <ScrollArea className="flex-1 h-full z-10">
            <div className="p-8 max-w-5xl mx-auto space-y-8">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                   <div className="flex items-center gap-4 mb-2">
                     <h1 className="text-2xl font-bold text-white tracking-tight">Webhook Verified</h1>
                     <NeonBadge status={selectedDelivery.status} />
                   </div>
                   <p className="text-slate-400 text-sm flex items-center gap-2">
                     <RiTimeLine className="w-4 h-4 text-slate-600" />
                     {new Date(selectedDelivery.created_at).toUTCString()}
                   </p>
                </div>
                <div className="flex gap-2">
                  {selectedDelivery.request_body?.url && (
                    <a href={selectedDelivery.request_body.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-xs font-medium transition-colors border border-white/5">
                      Open in Fathom <RiExternalLinkLine className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* Logic Flow */}
              <div className="space-y-4">
                 <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Verification Logic</h3>
                 <GlassCard className="p-8">
                    <div className="flex flex-wrap items-center justify-center gap-y-4">
                       {/* 1. Start */}
                       <FlowNode 
                         icon={RiSearchLine}
                         title="Resolution"
                         subtitle="Match User"
                         status="active" // Always active as step 1
                       />
                       
                       {/* 2. Secret */}
                       <FlowNode 
                         icon={RiKey2Line}
                         title="Found Secret"
                         subtitle={selectedDelivery.payload?.verification_results?.personal_by_email?.available ? "Personal API" : "OAuth App"}
                         status={getStepStatus(selectedDelivery, 'secret')}
                       />

                       {/* 3. Signature */}
                       <FlowNode
                         icon={RiShieldCheckLine}
                         title={selectedDelivery.successful_method === 'svix' ? 'Svix Algo' : (selectedDelivery.successful_method ? 'Simple Algo' : 'Checking')}
                         subtitle="HMAC-SHA256"
                         status={getStepStatus(selectedDelivery, 'signature')}
                       />

                       {/* 4. End */}
                       <FlowNode
                         icon={selectedDelivery.status === 'success' ? RiCheckboxCircleLine : RiCloseCircleLine}
                         title={selectedDelivery.status === 'success' ? 'Verified' : 'Rejected'}
                         status={selectedDelivery.status === 'success' ? 'success' : 'failed'}
                         isEnd={true}
                       />
                    </div>
                 </GlassCard>
              </div>

              {/* Diagnostics (if failed) */}
              {selectedDelivery.status === 'failed' && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                  <div className="relative flex gap-4">
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/20 shrink-0 h-fit">
                      <RiAlertLine className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <h4 className="text-red-400 font-bold text-sm mb-1">Signature Mismatch Detected</h4>
                      <p className="text-red-300/70 text-sm leading-relaxed max-w-2xl">
                        The secret in your database (<code>{selectedDelivery.payload?.verification_results?.personal_by_email?.secret_preview || '...'}</code>) 
                        did not match the signature provided by Fathom. This usually happens when the secret is regenerated in Fathom but not updated here.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payload Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 
                 {/* Metadata Card */}
                 <GlassCard className="p-5 md:col-span-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                       <RiFileTextLine className="w-4 h-4" /> Payload Overview
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       <div>
                          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Meeting Title</div>
                          <div className="text-slate-200 font-medium truncate" title={selectedDelivery.request_body?.title}>
                             {selectedDelivery.request_body?.title || '—'}
                          </div>
                       </div>
                       <div>
                          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Duration</div>
                          <div className="text-slate-200 font-medium">
                             {selectedDelivery.request_body?.duration ? `${Math.round(selectedDelivery.request_body.duration / 60)} mins` : '—'}
                          </div>
                       </div>
                       <div>
                          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Participants</div>
                          <div className="text-slate-200 font-medium">
                             {selectedDelivery.request_body?.participants?.length || 0} People
                          </div>
                       </div>
                       <div>
                          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Action Items</div>
                          <div className="text-slate-200 font-medium">
                             {selectedDelivery.request_body?.action_items?.length || 0} Items
                          </div>
                       </div>
                    </div>
                 </GlassCard>

                 {/* Raw JSON viewer */}
                 <div className="md:col-span-3">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Raw Payload</h3>
                       <span className="text-[10px] text-slate-600 font-mono">JSON • Read-only</span>
                    </div>
                    <div className="bg-slate-950 rounded-xl border border-white/5 p-4 overflow-hidden relative">
                       <ScrollArea className="h-[200px] w-full">
                         <div className="font-mono text-xs text-slate-400">
                           <pre className="whitespace-pre-wrap break-all">
                             {JSON.stringify(selectedDelivery.request_body, null, 2)}
                           </pre>
                         </div>
                       </ScrollArea>
                    </div>
                 </div>

              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
             <div className="w-16 h-16 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-center">
                <RiCpuLine className="w-8 h-8 opacity-20" />
             </div>
             <p className="text-sm font-medium">Select a webhook to inspect verification</p>
          </div>
        )}
      </div>
    </div>
  );
}
