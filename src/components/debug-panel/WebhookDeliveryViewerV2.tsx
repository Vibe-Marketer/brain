import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RiCheckboxCircleLine, 
  RiCloseCircleLine, 
  RiAlertLine, 
  RiTimeLine, 
  RiSearchLine,
  RiKey2Line,
  RiShieldCheckLine,
  RiFileTextLine,
  RiArrowRightLine,
  RiExternalLinkLine
} from "@remixicon/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

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

// --- Status Badge Component ---
function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
        <RiCheckboxCircleLine className="w-3.5 h-3.5" />
        Verified
      </span>
    );
  }
  if (status === 'duplicate') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
        <RiAlertLine className="w-3.5 h-3.5" />
        Duplicate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
      <RiCloseCircleLine className="w-3.5 h-3.5" />
      Failed
    </span>
  );
}

// --- Main Component ---
export default function WebhookDeliveryViewerV2() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);

  const selectedDelivery = deliveries.find(d => d.id === selectedId);

  useEffect(() => {
    loadData();
    
    // Realtime subscription
    const channel = supabase
      .channel('webhook-viewer-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_deliveries' }, (payload) => {
        const newDelivery = payload.new as WebhookDelivery;
        setDeliveries(prev => [newDelivery, ...prev]);
        if (!selectedId) setSelectedId(newDelivery.id); // Auto-select if first
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { user } = await getSafeUser();
      if (!user) return;

      // Fetch deliveries
      const { data: deliveryData } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (deliveryData) {
        setDeliveries(deliveryData);
        if (deliveryData.length > 0) setSelectedId(deliveryData[0].id);
      }

      // Fetch secrets for context
      const { data: secretData } = await supabase
        .from('user_settings')
        .select('host_email, webhook_secret')
        .not('webhook_secret', 'is', null);
        
      if (secretData) setSecrets(secretData);

    } catch (e) {
      logger.error("Failed to load webhooks", e);
    } finally {
      setLoading(false);
    }
  };

  const getRecordTitle = (d: WebhookDelivery) => d.request_body?.title || 'Unknown Meeting';
  const getRecordEmail = (d: WebhookDelivery) => d.request_body?.recorded_by?.email || 'Unknown Email';

  // --- Render ---
  return (
    <div className="flex h-full border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm">
      {/* LEFT SIDEBAR: LIST */}
      <div className="w-[350px] flex flex-col border-r bg-muted/10">
        <div className="p-4 border-b">
          <div className="relative">
            <RiSearchLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search webhooks..." className="pl-9 h-9 text-sm" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {deliveries.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`flex flex-col gap-1 p-4 text-left border-b transition-colors hover:bg-muted/50 ${
                  selectedId === d.id ? 'bg-muted/80 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <StatusBadge status={d.status} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </span>
                </div>
                <span className="font-medium text-sm truncate w-full">
                  {getRecordTitle(d)}
                </span>
                <span className="text-xs text-muted-foreground truncate w-full">
                  {d.webhook_id}
                </span>
              </button>
            ))}
            {deliveries.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No webhooks received yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT SIDE: DETAIL VIEW */}
      <div className="flex-1 flex flex-col h-full bg-background">
        {selectedDelivery ? (
          <ScrollArea className="h-full">
            <div className="p-8 space-y-8 max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold tracking-tight">Webhook Details</h2>
                    <StatusBadge status={selectedDelivery.status} />
                  </div>
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <RiTimeLine className="w-4 h-4" />
                    Processed {new Date(selectedDelivery.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                   <p className="text-xs font-mono text-muted-foreground mb-1">ID: {selectedDelivery.webhook_id}</p>
                   {selectedDelivery.request_body?.url && (
                     <a href={selectedDelivery.request_body.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 justify-end">
                       View in Fathom <RiExternalLinkLine className="w-3 h-3"/>
                     </a>
                   )}
                </div>
              </div>

              {/* Verification Flow Visualization */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <RiShieldCheckLine className="w-4 h-4" />
                  Security & Verification
                </h3>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="relative flex flex-col gap-8">
                       {/* Step 1: User Lookup */}
                       <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">1</div>
                            <div className="w-0.5 h-full bg-border mt-2"></div>
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">User Resolution</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Matched host email <code>{getRecordEmail(selectedDelivery)}</code>
                            </p>
                          </div>
                       </div>

                       {/* Step 2: Secret Lookup */}
                       <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                             <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">2</div>
                             <div className="w-0.5 h-full bg-border mt-2"></div>
                          </div>
                          <div>
                             <h4 className="font-medium text-sm">Secret Retrieval</h4>
                             <div className="flex flex-wrap gap-2 mt-2">
                                {/* Personal Secret Status */}
                                <Badge variant="outline" className={`font-mono text-xs ${
                                  selectedDelivery.payload?.verification_results?.personal_by_email?.available 
                                  ? 'bg-green-500/5 border-green-500/30' 
                                  : 'bg-muted text-muted-foreground'
                                }`}>
                                  Personal: {selectedDelivery.payload?.verification_results?.personal_by_email?.available ? 'Found' : 'Missing'}
                                </Badge>

                                {/* OAuth Secret Status */}
                                <Badge variant="outline" className={`font-mono text-xs ${
                                  selectedDelivery.payload?.verification_results?.oauth_app_secret?.available 
                                  ? 'bg-blue-500/5 border-blue-500/30' 
                                  : 'bg-muted text-muted-foreground'
                                }`}>
                                  OAuth App: {selectedDelivery.payload?.verification_results?.oauth_app_secret?.available ? 'Found' : 'Missing'}
                                </Badge>
                             </div>
                          </div>
                       </div>

                       {/* Step 3: Signature Verification */}
                       <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                               selectedDelivery.status === 'success' || selectedDelivery.status === 'duplicate' 
                               ? 'bg-green-500 text-white border-green-600' 
                               : 'bg-red-500 text-white border-red-600'
                             }`}>
                               {selectedDelivery.status !== 'failed' ? <RiCheckboxCircleLine className="w-5 h-5"/> : <RiCloseCircleLine className="w-5 h-5"/>}
                             </div>
                          </div>
                          <div>
                             <h4 className="font-medium text-sm">Signature Check</h4>
                             <p className="text-sm text-muted-foreground mt-1 mb-2">
                               {selectedDelivery.status === 'failed' 
                                 ? "All verification methods failed. The secret stored in DB does not match the signature sent by Fathom."
                                 : `Verified successfully using method: ${selectedDelivery.payload?.successful_method?.toUpperCase().replace(/_/g, ' ') || 'Unknown'}`
                               }
                             </p>
                             
                             {/* Detailed Comparison Grid */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(selectedDelivery.payload?.verification_results || {}).map(([key, result]: [string, any]) => (
                                  <div key={key} className={`p-3 rounded border text-xs ${result.verified ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30'}`}>
                                    <div className="font-semibold mb-1 uppercase tracking-wider opacity-70 text-[10px]">{key.replace(/_/g, ' ')}</div>
                                    <div className="flex justify-between items-center">
                                      <span>Result:</span>
                                      <span className={result.verified ? 'text-green-600 font-bold' : 'text-muted-foreground'}>
                                        {result.verified ? 'PASSED' : 'FAILED'}
                                      </span>
                                    </div>
                                    {result.secret_preview && (
                                      <div className="font-mono text-[10px] mt-1 opacity-60">
                                        Used Secret: {result.secret_preview}
                                      </div>
                                    )}
                                  </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Diagnostics Help Box (Only IF Failed) */}
                {selectedDelivery.status === 'failed' && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex gap-3">
                    <RiAlertLine className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Diagnosis: Secret Mismatch</h4>
                      <p className="text-sm text-red-600/90 dark:text-red-400/90 mt-1">
                        We found a secret for <strong>{getRecordEmail(selectedDelivery)}</strong> in your database, but it did not generate the correct signature. 
                        This almost always means the secret in Fathom Settings is different from the one in your database.
                      </p>
                      <Button variant="destructive" size="sm" className="mt-3" onClick={() => window.open('https://fathom.video/client/settings', '_blank')}>
                        Open Fathom Settings to Check Secret
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Payload Data */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                   <RiFileTextLine className="w-4 h-4" />
                   Record Payload
                </h3>
                <Card>
                  <CardContent className="p-0 overflow-hidden">
                    <ScrollArea className="h-[300px] w-full">
                      <div className="p-4">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(selectedDelivery.request_body, null, 2)}
                        </pre>
                      </div>
                    </ScrollArea>
                    <div className="bg-muted/50 p-2 text-xs text-center border-t text-muted-foreground">
                       Raw JSON Payload ({JSON.stringify(selectedDelivery.request_body).length} bytes)
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
             Select a webhook to view details
          </div>
        )}
      </div>
    </div>
  );
}
