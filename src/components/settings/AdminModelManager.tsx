import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  RiRefreshLine, 
  RiSearchLine, 
  RiCheckFill, 
  RiCloseFill, 
  RiSave3Line 
} from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  is_enabled: boolean;
  is_featured: boolean;
}

export function AdminModelManager() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [models, setModels] = React.useState<AIModel[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);
  
  // Track local edits before saving
  const [edits, setEdits] = React.useState<Record<string, Partial<AIModel>>>({});

  const fetchModels = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .order('provider', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setModels(data || []);
      setEdits({});
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load models:', err);
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('sync-openrouter-models', {
        method: 'POST',
      });

      if (error) throw error;
      
      const result = data;
      toast.success(`Synced ${result.total} models (${result.message})`);
      fetchModels(); // Refresh list
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to sync models from OpenRouter: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!Object.keys(edits).length) return;

    try {
      // Process updates in parallel
      const updates = Object.entries(edits).map(([id, changes]) => 
        supabase.from('ai_models').update(changes).eq('id', id)
      );

      await Promise.all(updates);
      
      toast.success('Changes saved successfully');
      fetchModels();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save changes');
    }
  };

  const updateModel = (id: string, changes: Partial<AIModel>) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...changes }
    }));
    setHasChanges(true);
    
    // Optimistic update for UI responsiveness
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  };

  const filteredModels = React.useMemo(() => {
    if (!searchQuery) return models;
    const lower = searchQuery.toLowerCase();
    return models.filter(m => 
      m.name.toLowerCase().includes(lower) || 
      m.id.toLowerCase().includes(lower) ||
      m.provider.toLowerCase().includes(lower)
    );
  }, [models, searchQuery]);

  const formatCost = (costStr: string) => {
    const cost = parseFloat(costStr);
    if (isNaN(cost)) return '-';
    // Show cost per 1M tokens
    return `$${(cost * 1000000).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-lg font-medium">Model Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage available models, rename them, and set visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RiRefreshLine className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sync from OpenRouter
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} className="gap-2 bg-vibe-orange hover:bg-vibe-orange-dark">
              <RiSave3Line className="h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search models..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredModels.length} of {models.length}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[50px]">On</TableHead>
                <TableHead className="w-[200px]">Display Name (Editable)</TableHead>
                <TableHead className="w-[180px]">Model ID</TableHead>
                <TableHead className="w-[100px]">Provider</TableHead>
                <TableHead className="w-[100px]">Input / 1M</TableHead>
                <TableHead className="w-[100px]">Output / 1M</TableHead>
                <TableHead className="w-[80px]">Featured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading models...
                  </TableCell>
                </TableRow>
              ) : filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No models found. Try clicking "Sync from OpenRouter".
                  </TableCell>
                </TableRow>
              ) : (
                filteredModels.map((model) => (
                  <TableRow key={model.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Switch 
                        checked={model.is_enabled}
                        onCheckedChange={(checked) => updateModel(model.id, { is_enabled: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={model.name}
                        onChange={(e) => updateModel(model.id, { name: e.target.value })}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={model.id}>
                      {model.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {model.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatCost(model.pricing?.prompt)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                       {formatCost(model.pricing?.completion)}
                    </TableCell>
                    <TableCell>
                       <Switch 
                        checked={model.is_featured}
                        onCheckedChange={(checked) => updateModel(model.id, { is_featured: checked })}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
