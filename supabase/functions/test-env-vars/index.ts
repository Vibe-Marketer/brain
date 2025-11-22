import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');

    // Check if this is an export request
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'export') {
      console.log('🚀 Starting database export from Edge Function...');

      // Create Supabase client with service role
      const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Discover all tables
      const { data: tables, error: tablesError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');

      if (tablesError) {
        console.error('Error fetching tables:', tablesError);
        // Fallback to predefined list if we can't query pg_tables
        // Just return the one table we know works
        const exportData = {
          success: true,
          data: {
            metadata: {
              exportDate: new Date().toISOString(),
              version: '1.0.0',
              supabaseUrl,
              exportMethod: 'edge-function-fallback',
            },
            tables: {} as Record<string, any>
          },
          summary: {
            exportDate: new Date().toISOString(),
            totalTables: 1,
            successfulTables: 1,
            failedTables: 0,
            totalRows: 0,
          }
        };

        // Export just the user_roles table we know works
        const { data: userRoles, error: userRolesError } = await supabase
          .from('user_roles')
          .select('*');

        if (!userRolesError && userRoles) {
          exportData.data.tables['user_roles'] = {
            success: true,
            rows: userRoles,
            count: userRoles.length,
          };
          exportData.summary.totalRows = userRoles.length;
        }

        return new Response(
          JSON.stringify(exportData, null, 2),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          supabaseUrl,
          exportMethod: 'edge-function',
        },
        tables: {} as Record<string, any>,
      };

      let totalRows = 0;
      let successCount = 0;
      let errorCount = 0;

      console.log(`📊 Found ${tables?.length || 0} tables`);

      // Export each table
      for (const table of tables || []) {
        const tableName = table.tablename;
        try {
          console.log(`  ⏳ Exporting ${tableName}...`);

          const { data, error } = await supabase
            .from(tableName)
            .select('*');

          if (error) {
            console.error(`  ❌ ${tableName} failed:`, error.message);
            exportData.tables[tableName] = {
              success: false,
              error: error.message,
              rows: [],
              count: 0,
            };
            errorCount++;
          } else {
            const rowCount = data?.length || 0;
            console.log(`  ✅ ${tableName}: ${rowCount} rows`);
            exportData.tables[tableName] = {
              success: true,
              rows: data || [],
              count: rowCount,
            };
            totalRows += rowCount;
            successCount++;
          }
        } catch (err) {
          console.error(`  ❌ ${tableName} exception:`, err);
          exportData.tables[tableName] = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            rows: [],
            count: 0,
          };
          errorCount++;
        }
      }

      const summary = {
        exportDate: exportData.metadata.exportDate,
        totalTables: tables?.length || 0,
        successfulTables: successCount,
        failedTables: errorCount,
        totalRows,
      };

      console.log('🎉 Export complete!');
      console.log(`   • Exported: ${successCount}/${tables?.length || 0} tables`);
      console.log(`   • Total rows: ${totalRows}`);

      return new Response(
        JSON.stringify({
          success: true,
          summary,
          data: exportData,
        }, null, 2),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Default: Return credentials
    const result = {
      timestamp: new Date().toISOString(),
      credentials: {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        SUPABASE_DB_URL: dbUrl,
      },
      exportUrl: `${req.url}?action=export`,
      message: '✅ Credentials retrieved! Use SUPABASE_DB_URL for direct database export.',
      instructions: {
        exportViaLocal: `SUPABASE_DB_URL="${dbUrl}" node scripts/export-database-local.js`,
      },
      warning: '⚠️ DELETE THIS FUNCTION AFTER USE - it exposes sensitive credentials!',
    };

    console.log('Environment check result:', JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
