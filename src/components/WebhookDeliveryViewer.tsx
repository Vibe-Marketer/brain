import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { RiRefreshLine, RiCheckboxCircleLine, RiCloseCircleLine, RiAlertLine, RiArrowDownSLine, RiArrowUpSLine, RiExternalLinkLine } from "@remixicon/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { logger } from "@/lib/logger";

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  recording_id: number | null;
  status: string;
  error_message: string | null;
  request_headers: Record<string, string> | null;
  request_body: {
    url?: string;
    title?: string;
    recorded_by?: { email?: string };
    [key: string]: unknown;
  } | null;
  payload: {
    verification_results?: VerificationResults;
    successful_method?: string;
  } | null;
  signature_valid: boolean | null;
  created_at: string;
  user_id: string;
}

interface WebhookSecret {
  user_id: string;
  webhook_secret: string;
  host_email: string;
}

interface VerificationResults {
  personal_by_email?: { available: boolean; verified: boolean; secret_preview?: string };
  oauth_app_secret?: { available: boolean; verified: boolean; secret_preview?: string };
  first_user_fallback?: { available: boolean; verified: boolean; secret_preview?: string };
}

export default function WebhookDeliveryViewer() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLive, setIsLive] = useState(false);
  const [secrets, setSecrets] = useState<WebhookSecret[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook`;

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const { user, error: authError } = await getSafeUser();

      if (authError || !user) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setDeliveries(data || []);
      
      // Load webhook secrets for diagnostics
      const { data: secretsData } = await supabase
        .from('user_settings')
        .select('user_id, webhook_secret, host_email')
        .not('webhook_secret', 'is', null);
      
      if (secretsData) {
        setSecrets(secretsData);
      }
    } catch (error) {
      logger.error('Error loading webhook deliveries', error);
      toast.error('Failed to load webhook deliveries');
    } finally {
      setLoading(false);
    }
  };
  
  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };
  
  const maskSecret = (secret: string) => {
    if (!secret) return '';
    return secret.substring(0, 15) + '...';
  };
  
  const getRecordedByEmail = (delivery: WebhookDelivery) => {
    return delivery.request_body?.recorded_by?.email || 'Unknown';
  };
  
  const getMatchedSecret = (delivery: WebhookDelivery) => {
    const email = getRecordedByEmail(delivery);
    return secrets.find(s => s.host_email === email);
  };
  
  const getSuccessCount = () => deliveries.filter(d => d.status === 'success').length;
  const getFailedCount = () => deliveries.filter(d => d.status === 'failed').length;
  const getDuplicateCount = () => deliveries.filter(d => d.status === 'duplicate').length;

  useEffect(() => {
    loadDeliveries();

    // Set up realtime subscription for new webhook deliveries
    const channel = supabase
      .channel('webhook-deliveries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_deliveries'
        },
        (payload) => {
          const newDelivery = payload.new as WebhookDelivery;
          
          // Add to the list
          setDeliveries(prev => [newDelivery, ...prev]);
          
          // Flash the live indicator
          setIsLive(true);
          setTimeout(() => setIsLive(false), 2000);
          
          // Show toast notification
          if (newDelivery.status === 'success') {
            toast.success('✅ Webhook Received', {
              description: `Successfully processed recording #${newDelivery.recording_id || 'unknown'}`,
              duration: 5000,
            });
          } else if (newDelivery.status === 'failed') {
            toast.error('❌ Webhook Failed', {
              description: newDelivery.error_message || 'Failed to process webhook',
              duration: 7000,
            });
          } else if (newDelivery.status === 'duplicate') {
            toast.warning('⚠️ Duplicate Webhook', {
              description: `Recording #${newDelivery.recording_id || 'unknown'} already processed`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="hollow" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <RiCheckboxCircleLine className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="hollow" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <RiCloseCircleLine className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'duplicate':
        return (
          <Badge variant="hollow" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            <RiAlertLine className="w-3 h-3 mr-1" />
            Duplicate
          </Badge>
        );
      default:
        return <Badge variant="hollow">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Webhook Delivery Log</span>
            <Button variant="hollow" size="sm" disabled>
              <RiRefreshLine className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </Button>
          </CardTitle>
          <CardDescription>
            Recent webhook deliveries and their processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading webhook deliveries...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      {/* Live indicator overlay */}
      {isLive && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 bg-green-500/5 animate-pulse rounded-lg"></div>
        </div>
      )}
      
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Webhook Diagnostics</span>
            <Badge 
              variant="hollow" 
              className={`${isLive ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : 'bg-muted/50'}`}
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isLive ? 'Activity Detected' : 'Listening'}
            </Badge>
          </div>
          <Button variant="hollow" size="sm" onClick={loadDeliveries}>
            <RiRefreshLine className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Monitor webhook deliveries and diagnose configuration issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook Endpoint Section */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Webhook Endpoint</h3>
            <Button variant="hollow" size="sm" onClick={copyWebhookUrl}>
              <RiExternalLinkLine className="w-4 h-4 mr-2" />
              Copy URL
            </Button>
          </div>
          <code className="text-xs bg-background px-3 py-2 rounded block overflow-x-auto">
            {webhookUrl}
          </code>
          <p className="text-xs text-muted-foreground">
            Use this URL when configuring webhooks in Fathom
          </p>
        </div>

        {/* Statistics Section */}
        {deliveries.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 bg-green-500/5">
              <div className="flex items-center gap-2 mb-1">
                <RiCheckboxCircleLine className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">Success</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{getSuccessCount()}</p>
            </div>
            <div className="border rounded-lg p-3 bg-red-500/5">
              <div className="flex items-center gap-2 mb-1">
                <RiCloseCircleLine className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-muted-foreground">Failed</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{getFailedCount()}</p>
            </div>
            <div className="border rounded-lg p-3 bg-yellow-500/5">
              <div className="flex items-center gap-2 mb-1">
                <RiAlertLine className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-medium text-muted-foreground">Duplicate</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{getDuplicateCount()}</p>
            </div>
          </div>
        )}

        {/* Webhook Secrets Configuration Section */}
        <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
          <div className="border rounded-lg p-4 space-y-3">
            <CollapsibleTrigger asChild>
              <Button variant="hollow" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <h3 className="font-semibold text-sm">Webhook Secret Configuration</h3>
                {showDiagnostics ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* OAuth App Secret - This is the primary method for multi-user apps */}
              <div className="bg-primary/5 border border-primary/20 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="hollow" className="bg-primary/10 text-primary border-primary/30">
                    OAuth App
                  </Badge>
                  <span className="text-xs text-muted-foreground">Primary - Used for ALL OAuth users</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Secret:</span>
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    FATHOM_OAUTH_WEBHOOK_SECRET (configured in Supabase Edge Functions)
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  🔑 This secret is set in Fathom Developer Portal → Your OAuth App → Webhook Secret.
                  All OAuth users share this ONE secret.
                </p>
              </div>

              {/* Personal Webhook Secrets */}
              {secrets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="hollow" className="bg-muted">
                      Personal API
                    </Badge>
                    <span className="text-xs text-muted-foreground">Fallback - {secrets.length} configured</span>
                  </div>
                  {secrets.map((secret) => (
                    <div key={secret.user_id} className="bg-muted/50 rounded p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Host Email:</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">{secret.host_email}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Secret:</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">{maskSecret(secret.webhook_secret)}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  <strong>How verification works:</strong> The webhook function tries BOTH secrets:
                  <br />1️⃣ First tries OAuth App secret (for multi-user apps)
                  <br />2️⃣ Falls back to Personal secret matched by <code>recorded_by.email</code>
                </p>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Recent Deliveries Header */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm mb-3">Recent Deliveries (Last 50)</h3>
        </div>
        {deliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-3">
              <div className="inline-flex p-3 rounded-full bg-muted/50">
                <RiRefreshLine className="w-6 h-6" />
              </div>
            </div>
            <p className="font-medium mb-1">No webhook deliveries yet</p>
            <p className="text-sm">
              Webhooks will appear here when Fathom sends them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">{
          deliveries.map((delivery) => (
            <Collapsible
              key={delivery.id}
              open={expandedIds.has(delivery.id)}
              onOpenChange={() => toggleExpanded(delivery.id)}
            >
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(delivery.status)}
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="hollow" size="sm">
                      {expandedIds.has(delivery.id) ? (
                        <RiArrowUpSLine className="w-4 h-4" />
                      ) : (
                        <RiArrowDownSLine className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Webhook ID:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {delivery.webhook_id}
                    </code>
                  </div>
                  {delivery.recording_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Recording:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {delivery.recording_id}
                      </code>
                      {delivery.request_body?.url && (
                        <a
                          href={delivery.request_body.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          View in Fathom
                          <RiExternalLinkLine className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                  
                  {/* Diagnostic Info */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Recorded By:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {getRecordedByEmail(delivery)}
                    </code>
                  </div>
                  
                  {(() => {
                    const matchedSecret = getMatchedSecret(delivery);
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Secret Match:</span>
                        {matchedSecret ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="hollow" className="bg-green-500/10 text-green-700 dark:text-green-400">
                              ✓ Matched
                            </Badge>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {maskSecret(matchedSecret.webhook_secret)}
                            </code>
                          </div>
                        ) : (
                          <Badge variant="hollow" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                            ⚠ Fallback Used
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  
                  {delivery.signature_valid !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Signature:</span>
                      {delivery.signature_valid ? (
                        <Badge variant="hollow" className="bg-green-500/10 text-green-700 dark:text-green-400">
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="hollow" className="bg-red-500/10 text-red-700 dark:text-red-400">
                          Invalid
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Verification Results - Shows which secrets were tried and which passed */}
                  {delivery.payload?.verification_results && (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Verification Attempts:</span>
                        {delivery.payload.successful_method && (
                          <Badge variant="hollow" className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                            Passed via: {delivery.payload.successful_method}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* OAuth App Secret */}
                        {delivery.payload.verification_results.oauth_app_secret && (
                          <div className={`text-xs p-2 rounded border ${
                            delivery.payload.verification_results.oauth_app_secret.verified
                              ? 'bg-green-500/5 border-green-500/20'
                              : delivery.payload.verification_results.oauth_app_secret.available
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-muted/30 border-muted'
                          }`}>
                            <div className="font-medium mb-1">OAuth App</div>
                            <div className="flex items-center gap-1">
                              {delivery.payload.verification_results.oauth_app_secret.verified ? (
                                <><RiCheckboxCircleLine className="w-3 h-3 text-green-600" /> Passed</>
                              ) : delivery.payload.verification_results.oauth_app_secret.available ? (
                                <><RiCloseCircleLine className="w-3 h-3 text-red-600" /> Failed</>
                              ) : (
                                <><RiAlertLine className="w-3 h-3 text-gray-400" /> Not configured</>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Personal by Email */}
                        {delivery.payload.verification_results.personal_by_email && (
                          <div className={`text-xs p-2 rounded border ${
                            delivery.payload.verification_results.personal_by_email.verified
                              ? 'bg-green-500/5 border-green-500/20'
                              : delivery.payload.verification_results.personal_by_email.available
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-muted/30 border-muted'
                          }`}>
                            <div className="font-medium mb-1">Personal (by email)</div>
                            <div className="flex items-center gap-1">
                              {delivery.payload.verification_results.personal_by_email.verified ? (
                                <><RiCheckboxCircleLine className="w-3 h-3 text-green-600" /> Passed</>
                              ) : delivery.payload.verification_results.personal_by_email.available ? (
                                <><RiCloseCircleLine className="w-3 h-3 text-red-600" /> Failed</>
                              ) : (
                                <><RiAlertLine className="w-3 h-3 text-gray-400" /> No match</>
                              )}
                            </div>
                          </div>
                        )}

                        {/* First User Fallback */}
                        {delivery.payload.verification_results.first_user_fallback && (
                          <div className={`text-xs p-2 rounded border ${
                            delivery.payload.verification_results.first_user_fallback.verified
                              ? 'bg-green-500/5 border-green-500/20'
                              : delivery.payload.verification_results.first_user_fallback.available
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-muted/30 border-muted'
                          }`}>
                            <div className="font-medium mb-1">First User Fallback</div>
                            <div className="flex items-center gap-1">
                              {delivery.payload.verification_results.first_user_fallback.verified ? (
                                <><RiCheckboxCircleLine className="w-3 h-3 text-green-600" /> Passed</>
                              ) : delivery.payload.verification_results.first_user_fallback.available ? (
                                <><RiCloseCircleLine className="w-3 h-3 text-red-600" /> Failed</>
                              ) : (
                                <><RiAlertLine className="w-3 h-3 text-gray-400" /> Not available</>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {delivery.error_message && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      Error: {delivery.error_message}
                    </p>
                  </div>
                )}

                <CollapsibleContent className="space-y-3 pt-2">
                  {delivery.request_body?.title && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Meeting Title:</p>
                      <p className="text-sm">{delivery.request_body.title}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Request Headers:</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(delivery.request_headers, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Request Body (preview):</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-64">
                      {JSON.stringify(delivery.request_body, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
