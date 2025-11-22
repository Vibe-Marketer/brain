import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RiCheckDoubleLine, RiCloseCircleLine, RiTimeLine, RiShieldLine, RiLineChartLine } from "@remixicon/react";

interface AnalyticsData {
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  validSignatures: number;
  invalidSignatures: number;
  avgProcessingTime: number;
  last24Hours: TimeSeriesData[];
  statusDistribution: StatusData[];
}

interface TimeSeriesData {
  hour: string;
  success: number;
  failed: number;
  duplicate: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  success: '#22c55e',
  failed: '#ef4444',
  duplicate: '#f59e0b',
  valid: '#3b82f6',
  invalid: '#dc2626'
};

export default function WebhookAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: deliveries, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!deliveries || deliveries.length === 0) {
        setAnalytics({
          totalDeliveries: 0,
          successCount: 0,
          failureCount: 0,
          duplicateCount: 0,
          validSignatures: 0,
          invalidSignatures: 0,
          avgProcessingTime: 0,
          last24Hours: [],
          statusDistribution: []
        });
        return;
      }

      // Calculate overall stats
      const successCount = deliveries.filter(d => d.status === 'success').length;
      const failureCount = deliveries.filter(d => d.status === 'failed').length;
      const duplicateCount = deliveries.filter(d => d.status === 'duplicate').length;
      const validSignatures = deliveries.filter(d => d.signature_valid === true).length;
      const invalidSignatures = deliveries.filter(d => d.signature_valid === false).length;

      // Group by hour for time series
      const hourlyData = new Map<string, { success: number; failed: number; duplicate: number }>();
      
      deliveries.forEach(delivery => {
        const hour = new Date(delivery.created_at).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          hour12: false 
        });
        
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, { success: 0, failed: 0, duplicate: 0 });
        }
        
        const data = hourlyData.get(hour)!;
        if (delivery.status === 'success') data.success++;
        else if (delivery.status === 'failed') data.failed++;
        else if (delivery.status === 'duplicate') data.duplicate++;
      });

      const last24Hours: TimeSeriesData[] = Array.from(hourlyData.entries())
        .map(([hour, data]) => ({
          hour,
          ...data
        }))
        .slice(-12); // Last 12 hours for readability

      // Status distribution for pie chart
      const statusDistribution: StatusData[] = [
        { name: 'Success', value: successCount, color: COLORS.success },
        { name: 'Failed', value: failureCount, color: COLORS.failed },
        { name: 'Duplicate', value: duplicateCount, color: COLORS.duplicate }
      ].filter(d => d.value > 0);

      setAnalytics({
        totalDeliveries: deliveries.length,
        successCount,
        failureCount,
        duplicateCount,
        validSignatures,
        invalidSignatures,
        avgProcessingTime: 0, // Could calculate from timestamps if available
        last24Hours,
        statusDistribution
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load webhook analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Analytics</CardTitle>
          <CardDescription>Loading analytics data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading webhook analytics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.totalDeliveries === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Analytics</CardTitle>
          <CardDescription>Last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <RiLineChartLine className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium mb-1">No analytics data yet</p>
            <p className="text-sm">Analytics will appear after webhook deliveries are received</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRate = ((analytics.successCount / analytics.totalDeliveries) * 100).toFixed(1);
  const failureRate = ((analytics.failureCount / analytics.totalDeliveries) * 100).toFixed(1);
  const signatureValidRate = analytics.validSignatures + analytics.invalidSignatures > 0
    ? ((analytics.validSignatures / (analytics.validSignatures + analytics.invalidSignatures)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook Analytics</CardTitle>
          <CardDescription>Last 24 hours performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiCheckDoubleLine className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Success Rate</span>
              </div>
              <div className="text-2xl font-bold">{successRate}%</div>
              <div className="text-xs text-muted-foreground">{analytics.successCount} successful</div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiCloseCircleLine className="w-4 h-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Failure Rate</span>
              </div>
              <div className="text-2xl font-bold">{failureRate}%</div>
              <div className="text-xs text-muted-foreground">{analytics.failureCount} failed</div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiShieldLine className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Valid Signatures</span>
              </div>
              <div className="text-2xl font-bold">{signatureValidRate}%</div>
              <div className="text-xs text-muted-foreground">{analytics.validSignatures} valid</div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiTimeLine className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Total Deliveries</span>
              </div>
              <div className="text-2xl font-bold">{analytics.totalDeliveries}</div>
              <div className="text-xs text-muted-foreground">in 24 hours</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Time Series Chart */}
            {analytics.last24Hours.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">Delivery Trends (Last 12 Hours)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.last24Hours}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="hour" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="success" fill={COLORS.success} name="Success" />
                    <Bar dataKey="failed" fill={COLORS.failed} name="Failed" />
                    <Bar dataKey="duplicate" fill={COLORS.duplicate} name="Duplicate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status Distribution Pie Chart */}
            {analytics.statusDistribution.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">Status Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Signature Verification Stats */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium mb-4">Signature Verification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                <RiShieldLine className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {analytics.validSignatures}
                  </div>
                  <div className="text-xs text-muted-foreground">Valid Signatures</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                <RiCloseCircleLine className="w-8 h-8 text-red-500" />
                <div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {analytics.invalidSignatures}
                  </div>
                  <div className="text-xs text-muted-foreground">Invalid Signatures</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
