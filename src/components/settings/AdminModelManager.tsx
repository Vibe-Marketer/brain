import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  RiRefreshLine, 
  RiSearchLine, 
  RiCheckFill, 
  RiCloseFill, 
  RiSave3Line,
  RiArrowUpSLine,
  RiArrowDownSLine, 
  RiArrowUpDownLine
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
  supports_tools: boolean;
}

export function AdminModelManager() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [models, setModels] = React.useState<AIModel[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof AIModel | 'input_cost' | 'output_cost'; direction: 'asc' | 'desc' }>({ key: 'provider', direction: 'asc' });
  
  // Track local edits before saving
  const [edits, setEdits] = React.useState<Record<string, Partial<AIModel>>>({});

  const fetchModels = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select('*');

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
      if (!session) {
        toast.error('No active session');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-openrouter-models`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      toast.success(`Synced ${result.total} models (${result.message})`);
      fetchModels(); 
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
    
    // Optimistic update
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  };

  const requestSort = (key: keyof AIModel | 'input_cost' | 'output_cost') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedModels = React.useMemo(() => {
    let sortableModels = [...models];
    
    // Filter first
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      sortableModels = sortableModels.filter(m => 
        m.name.toLowerCase().includes(lower) || 
        m.id.toLowerCase().includes(lower) ||
        m.provider.toLowerCase().includes(lower)
      );
    }

    // Then sort
    if (sortConfig) {
      sortableModels.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof AIModel];
        let bValue: any = b[sortConfig.key as keyof AIModel];

        // Handle computed costs
        if (sortConfig.key === 'input_cost') {
          aValue = parseFloat(a.pricing?.prompt || '0');
          bValue = parseFloat(b.pricing?.prompt || '0');
        } else if (sortConfig.key === 'output_cost') {
          aValue = parseFloat(a.pricing?.completion || '0');
          bValue = parseFloat(b.pricing?.completion || '0');
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableModels;
  }, [models, searchQuery, sortConfig]);

  const formatCost = (costStr: string) => {
    const cost = parseFloat(costStr);
    if (isNaN(cost)) return '-';
    // Show cost per 1M tokens
    return `$${(cost * 1000000).toFixed(2)}`;
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) {
      return <RiArrowUpDownLine className="w-4 h-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' 
      ? <RiArrowUpSLine className="w-4 h-4 text-foreground" />
      : <RiArrowDownSLine className="w-4 h-4 text-foreground" />;
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
          Showing {sortedModels.length} of {models.length}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead 
                  className="w-[50px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('is_enabled')}
                >
                  <div className="flex items-center gap-1">On <SortIcon column="is_enabled" /></div>
                </TableHead>
                <TableHead 
                  className="w-[200px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('name')}
                >
                  <div className="flex items-center gap-1">Display Name <SortIcon column="name" /></div>
                </TableHead>
                <TableHead 
                  className="w-[180px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('id')}
                >
                   <div className="flex items-center gap-1">Model ID <SortIcon column="id" /></div>
                </TableHead>
                <TableHead 
                  className="w-[100px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('provider')}
                >
                   <div className="flex items-center gap-1">Provider <SortIcon column="provider" /></div>
                </TableHead>
                <TableHead 
                  className="w-[80px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('supports_tools')}
                >
                  <div className="flex items-center gap-1" title="Supports Tools/Function Calling">Tools <SortIcon column="supports_tools" /></div>
                </TableHead>
                <TableHead 
                  className="w-[100px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('input_cost')}
                >
                   <div className="flex items-center gap-1">Input / 1M <SortIcon column="input_cost" /></div>
                </TableHead>
                <TableHead 
                  className="w-[100px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('output_cost')}
                >
                   <div className="flex items-center gap-1">Output / 1M <SortIcon column="output_cost" /></div>
                </TableHead>
                <TableHead 
                  className="w-[80px] cursor-pointer hover:bg-muted transition-colors group select-none" 
                  onClick={() => requestSort('is_featured')}
                >
                   <div className="flex items-center gap-1">Featured <SortIcon column="is_featured" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Loading models...
                  </TableCell>
                </TableRow>
              ) : sortedModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No models found. Try clicking "Sync from OpenRouter".
                  </TableCell>
                </TableRow>
              ) : (
                sortedModels.map((model) => (
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
                     <TableCell>
                       {model.supports_tools ? (
                          <div className="flex justify-center" title="Supports Tools">
                            <RiCheckFill className="h-4 w-4 text-green-500" />
                          </div>
                       ) : (
                          <div className="flex justify-center" title="No Tool Support">
                            <RiCloseFill className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                       )}
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
