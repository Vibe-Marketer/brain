export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_automation_settings: {
        Row: {
          agent_command: string
          agent_model: string
          auto_ship_classes: Json
          crawler_max_routes: number
          digest_enabled: boolean
          digest_recipient: string | null
          id: number
          max_attempts: number
          max_tickets_per_run: number
          resolver_enabled: boolean
          updated_at: string
        }
        Insert: {
          agent_command?: string
          agent_model?: string
          auto_ship_classes?: Json
          crawler_max_routes?: number
          digest_enabled?: boolean
          digest_recipient?: string | null
          id?: number
          max_attempts?: number
          max_tickets_per_run?: number
          resolver_enabled?: boolean
          updated_at?: string
        }
        Update: {
          agent_command?: string
          agent_model?: string
          auto_ship_classes?: Json
          crawler_max_routes?: number
          digest_enabled?: boolean
          digest_recipient?: string | null
          id?: number
          max_attempts?: number
          max_tickets_per_run?: number
          resolver_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          context_window_max: number | null
          context_window_used: number | null
          created_at: string | null
          fallback_models: Json | null
          gateway_url: string | null
          id: string
          last_active_at: string | null
          name: string
          primary_model: string | null
          role: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          context_window_max?: number | null
          context_window_used?: number | null
          created_at?: string | null
          fallback_models?: Json | null
          gateway_url?: string | null
          id?: string
          last_active_at?: string | null
          name: string
          primary_model?: string | null
          role?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          context_window_max?: number | null
          context_window_used?: number | null
          created_at?: string | null
          fallback_models?: Json | null
          gateway_url?: string | null
          id?: string
          last_active_at?: string | null
          name?: string
          primary_model?: string | null
          role?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          context_length: number | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean
          is_enabled: boolean | null
          is_featured: boolean | null
          min_tier: Database["public"]["Enums"]["app_role"]
          name: string
          pricing: Json | null
          provider: string
          supports_tools: boolean
          updated_at: string | null
        }
        Insert: {
          context_length?: number | null
          created_at?: string | null
          description?: string | null
          id: string
          is_default?: boolean
          is_enabled?: boolean | null
          is_featured?: boolean | null
          min_tier?: Database["public"]["Enums"]["app_role"]
          name: string
          pricing?: Json | null
          provider: string
          supports_tools?: boolean
          updated_at?: string | null
        }
        Update: {
          context_length?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          is_enabled?: boolean | null
          is_featured?: boolean | null
          min_tier?: Database["public"]["Enums"]["app_role"]
          name?: string
          pricing?: Json | null
          provider?: string
          supports_tools?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_processing_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          progress_current: number
          progress_total: number
          status: string
          success_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          progress_current?: number
          progress_total?: number
          status: string
          success_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          progress_current?: number
          progress_total?: number
          status?: string
          success_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          action_type: string
          created_at: string
          id: string
          month_year: string
          org_id: string | null
          recording_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          month_year: string
          org_id?: string | null
          recording_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          month_year?: string
          org_id?: string | null
          recording_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_execution_history: {
        Row: {
          completed_at: string | null
          created_at: string | null
          debug_info: Json
          error_message: string | null
          execution_time_ms: number | null
          id: string
          rule_id: string
          success: boolean
          trigger_source: Json | null
          trigger_type: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          debug_info?: Json
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          rule_id: string
          success?: boolean
          trigger_source?: Json | null
          trigger_type: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          debug_info?: Json
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          rule_id?: string
          success?: boolean
          trigger_source?: Json | null
          trigger_type?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_execution_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_actions: {
        Row: {
          action_type: string
          config: Json
          continue_on_error: boolean
          created_at: string | null
          enabled: boolean
          id: string
          position: number
          retry_count: number
          retry_delay_seconds: number
          rule_id: string
          updated_at: string | null
        }
        Insert: {
          action_type: string
          config?: Json
          continue_on_error?: boolean
          created_at?: string | null
          enabled?: boolean
          id?: string
          position?: number
          retry_count?: number
          retry_delay_seconds?: number
          rule_id: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          config?: Json
          continue_on_error?: boolean
          created_at?: string | null
          enabled?: boolean
          id?: string
          position?: number
          retry_count?: number
          retry_delay_seconds?: number
          rule_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_conditions: {
        Row: {
          condition_type: string
          created_at: string | null
          field_name: string | null
          id: string
          logic_operator: string | null
          operator: string
          parent_condition_id: string | null
          position: number
          rule_id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          condition_type: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          logic_operator?: string | null
          operator: string
          parent_condition_id?: string | null
          position?: number
          rule_id: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          condition_type?: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          logic_operator?: string | null
          operator?: string
          parent_condition_id?: string | null
          position?: number
          rule_id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_conditions_parent_condition_id_fkey"
            columns: ["parent_condition_id"]
            isOneToOne: false
            referencedRelation: "automation_rule_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rule_conditions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string | null
          description: string | null
          enabled: boolean
          id: string
          last_applied_at: string | null
          name: string
          next_run_at: string | null
          priority: number
          schedule_config: Json | null
          times_applied: number
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          last_applied_at?: string | null
          name: string
          next_run_at?: string | null
          priority?: number
          schedule_config?: Json | null
          times_applied?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          last_applied_at?: string | null
          name?: string
          next_run_at?: string | null
          priority?: number
          schedule_config?: Json | null
          times_applied?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      autopilot_category_trust: {
        Row: {
          category: string
          completed_fixes_30d: number
          deferred_runs_30d: number
          last_demoted_at: string | null
          last_demoted_by: string | null
          last_promoted_at: string | null
          last_promoted_by: string | null
          last_rollup_at: string | null
          min_fixes: number
          reopened_fixes_30d: number
          rung: string
          survival_rate_30d: number
          survival_threshold: number
          survived_fixes_30d: number
          updated_at: string
        }
        Insert: {
          category: string
          completed_fixes_30d?: number
          deferred_runs_30d?: number
          last_demoted_at?: string | null
          last_demoted_by?: string | null
          last_promoted_at?: string | null
          last_promoted_by?: string | null
          last_rollup_at?: string | null
          min_fixes?: number
          reopened_fixes_30d?: number
          rung?: string
          survival_rate_30d?: number
          survival_threshold?: number
          survived_fixes_30d?: number
          updated_at?: string
        }
        Update: {
          category?: string
          completed_fixes_30d?: number
          deferred_runs_30d?: number
          last_demoted_at?: string | null
          last_demoted_by?: string | null
          last_promoted_at?: string | null
          last_promoted_by?: string | null
          last_rollup_at?: string | null
          min_fixes?: number
          reopened_fixes_30d?: number
          rung?: string
          survival_rate_30d?: number
          survival_threshold?: number
          survived_fixes_30d?: number
          updated_at?: string
        }
        Relationships: []
      }
      autopilot_trust_events: {
        Row: {
          actor_id: string | null
          category: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          run_id: string | null
          ticket_id: string | null
        }
        Insert: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          run_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          actor_id?: string | null
          category?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          run_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_trust_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runner_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_trust_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          average_order_value: number | null
          biggest_growth_constraint: string | null
          brand_voice: string | null
          business_model: string | null
          common_sayings_trust_signals: string | null
          company_name: string | null
          created_at: string | null
          current_tech_status: string | null
          customer_acquisition_process: string | null
          customer_average_order_value: number | null
          customer_lifetime_value: number | null
          customer_onboarding_process: string | null
          employees_count: number | null
          guarantees: string | null
          icp_customer_segments: string | null
          id: string
          industry: string | null
          is_default: boolean | null
          marketing_channels: string | null
          messaging_angles: string | null
          other_products: string | null
          primary_advertising_mode: string | null
          primary_delivery_method: string | null
          primary_lead_getter: string | null
          primary_marketing_channel: string | null
          primary_pain_points: string | null
          primary_product_service: string | null
          primary_selling_mechanism: string | null
          primary_social_platforms: string | null
          product_service_delivery: string | null
          prohibited_terms: string | null
          promotions_offers: string | null
          proof_assets_social_proof: string | null
          sales_cycle_length: number | null
          top_decision_drivers: string | null
          top_objections: string | null
          updated_at: string | null
          user_id: string
          value_prop_differentiators: string | null
          website: string | null
        }
        Insert: {
          average_order_value?: number | null
          biggest_growth_constraint?: string | null
          brand_voice?: string | null
          business_model?: string | null
          common_sayings_trust_signals?: string | null
          company_name?: string | null
          created_at?: string | null
          current_tech_status?: string | null
          customer_acquisition_process?: string | null
          customer_average_order_value?: number | null
          customer_lifetime_value?: number | null
          customer_onboarding_process?: string | null
          employees_count?: number | null
          guarantees?: string | null
          icp_customer_segments?: string | null
          id?: string
          industry?: string | null
          is_default?: boolean | null
          marketing_channels?: string | null
          messaging_angles?: string | null
          other_products?: string | null
          primary_advertising_mode?: string | null
          primary_delivery_method?: string | null
          primary_lead_getter?: string | null
          primary_marketing_channel?: string | null
          primary_pain_points?: string | null
          primary_product_service?: string | null
          primary_selling_mechanism?: string | null
          primary_social_platforms?: string | null
          product_service_delivery?: string | null
          prohibited_terms?: string | null
          promotions_offers?: string | null
          proof_assets_social_proof?: string | null
          sales_cycle_length?: number | null
          top_decision_drivers?: string | null
          top_objections?: string | null
          updated_at?: string | null
          user_id: string
          value_prop_differentiators?: string | null
          website?: string | null
        }
        Update: {
          average_order_value?: number | null
          biggest_growth_constraint?: string | null
          brand_voice?: string | null
          business_model?: string | null
          common_sayings_trust_signals?: string | null
          company_name?: string | null
          created_at?: string | null
          current_tech_status?: string | null
          customer_acquisition_process?: string | null
          customer_average_order_value?: number | null
          customer_lifetime_value?: number | null
          customer_onboarding_process?: string | null
          employees_count?: number | null
          guarantees?: string | null
          icp_customer_segments?: string | null
          id?: string
          industry?: string | null
          is_default?: boolean | null
          marketing_channels?: string | null
          messaging_angles?: string | null
          other_products?: string | null
          primary_advertising_mode?: string | null
          primary_delivery_method?: string | null
          primary_lead_getter?: string | null
          primary_marketing_channel?: string | null
          primary_pain_points?: string | null
          primary_product_service?: string | null
          primary_selling_mechanism?: string | null
          primary_social_platforms?: string | null
          product_service_delivery?: string | null
          prohibited_terms?: string | null
          promotions_offers?: string | null
          proof_assets_social_proof?: string | null
          sales_cycle_length?: number | null
          top_decision_drivers?: string | null
          top_objections?: string | null
          updated_at?: string | null
          user_id?: string
          value_prop_differentiators?: string | null
          website?: string | null
        }
        Relationships: []
      }
      call_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          recording_id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recording_id: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recording_id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          organization_id: string
          participant_type: string
          recording_id: string
          sources: string[]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          organization_id: string
          participant_type?: string
          recording_id: string
          sources?: string[]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          participant_type?: string
          recording_id?: string
          sources?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      call_share_links: {
        Row: {
          call_recording_id: number
          created_at: string
          created_by_user_id: string | null
          expires_at: string | null
          id: string
          recipient_email: string | null
          revoked_at: string | null
          share_token: string | null
          status: string
          user_id: string
        }
        Insert: {
          call_recording_id: number
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          recipient_email?: string | null
          revoked_at?: string | null
          share_token?: string | null
          status?: string
          user_id: string
        }
        Update: {
          call_recording_id?: number
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string | null
          id?: string
          recipient_email?: string | null
          revoked_at?: string | null
          share_token?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      call_speakers: {
        Row: {
          created_at: string | null
          id: string
          recording_id: string
          speaker_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recording_id: string
          speaker_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recording_id?: string
          speaker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_speakers_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_speakers_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_tag_assignments: {
        Row: {
          auto_assigned: boolean | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          recording_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          auto_assigned?: boolean | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          recording_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          auto_assigned?: boolean | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          recording_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_category_assignments_category_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "call_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_tag_assignments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      call_tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          account_identifier: string | null
          connected_at: string | null
          id: string
          last_used_at: string | null
          service: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          account_identifier?: string | null
          connected_at?: string | null
          id?: string
          last_used_at?: string | null
          service: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          account_identifier?: string | null
          connected_at?: string | null
          id?: string
          last_used_at?: string | null
          service?: string
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_call_appearances: {
        Row: {
          appeared_at: string | null
          canonical_recording_id: string | null
          contact_id: string
          org_id: string
          recording_id: number
          user_id: string
        }
        Insert: {
          appeared_at?: string | null
          canonical_recording_id?: string | null
          contact_id: string
          org_id: string
          recording_id: number
          user_id: string
        }
        Update: {
          appeared_at?: string | null
          canonical_recording_id?: string | null
          contact_id?: string
          org_id?: string
          recording_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_call_appearances_canonical_recording_id_fkey"
            columns: ["canonical_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_call_appearances_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_call_appearances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_call_appearances_recording_id_user_id_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "contact_call_appearances_recording_id_user_id_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      contact_folder_assignments: {
        Row: {
          contact_folder_id: string
          contact_id: string
          created_at: string
          id: string
        }
        Insert: {
          contact_folder_id: string
          contact_id: string
          created_at?: string
          id?: string
        }
        Update: {
          contact_folder_id?: string
          contact_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_folder_assignments_contact_folder_id_fkey"
            columns: ["contact_folder_id"]
            isOneToOne: false
            referencedRelation: "contact_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_folder_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_type: string | null
          created_at: string | null
          email: string
          health_alert_threshold_days: number | null
          id: string
          last_alerted_at: string | null
          last_call_recording_id: number | null
          last_call_recording_uuid: string | null
          last_seen_at: string | null
          name: string | null
          notes: string | null
          org_id: string
          tags: string[] | null
          track_health: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_type?: string | null
          created_at?: string | null
          email: string
          health_alert_threshold_days?: number | null
          id?: string
          last_alerted_at?: string | null
          last_call_recording_id?: number | null
          last_call_recording_uuid?: string | null
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          org_id: string
          tags?: string[] | null
          track_health?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_type?: string | null
          created_at?: string | null
          email?: string
          health_alert_threshold_days?: number | null
          id?: string
          last_alerted_at?: string | null
          last_call_recording_id?: number | null
          last_call_recording_uuid?: string | null
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          org_id?: string
          tags?: string[] | null
          track_health?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_last_call_recording_uuid_fkey"
            columns: ["last_call_recording_uuid"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          content_text: string
          content_type: string
          created_at: string | null
          email_subject: string | null
          hook_id: string | null
          id: string
          organization_id: string
          status: string | null
          updated_at: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          content_text: string
          content_type: string
          created_at?: string | null
          email_subject?: string | null
          hook_id?: string | null
          id?: string
          organization_id: string
          status?: string | null
          updated_at?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          content_text?: string
          content_type?: string
          created_at?: string | null
          email_subject?: string | null
          hook_id?: string | null
          id?: string
          organization_id?: string
          status?: string | null
          updated_at?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_hook_id_fkey"
            columns: ["hook_id"]
            isOneToOne: false
            referencedRelation: "hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_library: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          tags: string[] | null
          team_id: string | null
          title: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          content: string
          content_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          tags?: string[] | null
          team_id?: string | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          tags?: string[] | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company: string | null
          contact_frequency_days: number | null
          created_at: string | null
          email: string | null
          enrichment_data: Json | null
          enrichment_status: string | null
          full_name: string | null
          id: string
          last_contact_date: string | null
          notes: string | null
          phone: string | null
          relationship_score: number | null
          source: string | null
          source_detail: string | null
          status: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          contact_frequency_days?: number | null
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          full_name?: string | null
          id?: string
          last_contact_date?: string | null
          notes?: string | null
          phone?: string | null
          relationship_score?: number | null
          source?: string | null
          source_detail?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          contact_frequency_days?: number | null
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          enrichment_status?: string | null
          full_name?: string | null
          id?: string
          last_contact_date?: string | null
          notes?: string | null
          phone?: string | null
          relationship_score?: number | null
          source?: string | null
          source_detail?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          occurred_at: string | null
          source_id: string | null
          summary: string | null
          tenant_id: string | null
          type: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          occurred_at?: string | null
          source_id?: string | null
          summary?: string | null
          tenant_id?: string | null
          type: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          occurred_at?: string | null
          source_id?: string | null
          summary?: string | null
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          tag: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          tag: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_queue: {
        Row: {
          contact_id: string | null
          id: string
          priority: number | null
          processed_at: string | null
          queued_at: string | null
          result: Json | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          contact_id?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          queued_at?: string | null
          result?: Json | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          queued_at?: string | null
          result?: Json | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fathom_raw_calls: {
        Row: {
          ai_generated_title: string | null
          ai_title_generated_at: string | null
          auto_tags: string[] | null
          auto_tags_generated_at: string | null
          calendar_invitees: Json | null
          canonical_recording_id: string | null
          created_at: string
          full_transcript: string | null
          fuzzy_match_score: number | null
          google_calendar_event_id: string | null
          google_drive_file_id: string | null
          import_source_id: string | null
          is_primary: boolean | null
          meeting_fingerprint: string | null
          merged_from: number[] | null
          metadata: Json | null
          mirror_version: number
          recorded_by_email: string | null
          recorded_by_name: string | null
          recording_end_time: string | null
          recording_id: number
          recording_start_time: string | null
          sentiment_cache: Json | null
          share_url: string | null
          source_platform: string | null
          summary: string | null
          summary_edited_by_user: boolean | null
          synced_at: string | null
          title: string
          title_edited_by_user: boolean | null
          transcript_source: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          ai_generated_title?: string | null
          ai_title_generated_at?: string | null
          auto_tags?: string[] | null
          auto_tags_generated_at?: string | null
          calendar_invitees?: Json | null
          canonical_recording_id?: string | null
          created_at: string
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          google_calendar_event_id?: string | null
          google_drive_file_id?: string | null
          import_source_id?: string | null
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          metadata?: Json | null
          mirror_version?: number
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id: number
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title: string
          title_edited_by_user?: boolean | null
          transcript_source?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          ai_generated_title?: string | null
          ai_title_generated_at?: string | null
          auto_tags?: string[] | null
          auto_tags_generated_at?: string | null
          calendar_invitees?: Json | null
          canonical_recording_id?: string | null
          created_at?: string
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          google_calendar_event_id?: string | null
          google_drive_file_id?: string | null
          import_source_id?: string | null
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          metadata?: Json | null
          mirror_version?: number
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id?: number
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title?: string
          title_edited_by_user?: boolean | null
          transcript_source?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fathom_raw_calls_canonical_recording_id_fkey"
            columns: ["canonical_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fathom_raw_calls_import_source_id_fkey"
            columns: ["import_source_id"]
            isOneToOne: false
            referencedRelation: "import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fathom_raw_transcripts: {
        Row: {
          created_at: string | null
          edited_at: string | null
          edited_by: string | null
          edited_speaker_email: string | null
          edited_speaker_name: string | null
          edited_text: string | null
          id: string
          is_deleted: boolean | null
          recording_id: number
          speaker_email: string | null
          speaker_name: string | null
          text: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          edited_speaker_email?: string | null
          edited_speaker_name?: string | null
          edited_text?: string | null
          id?: string
          is_deleted?: boolean | null
          recording_id: number
          speaker_email?: string | null
          speaker_name?: string | null
          text: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          edited_speaker_email?: string | null
          edited_speaker_name?: string | null
          edited_text?: string | null
          id?: string
          is_deleted?: boolean | null
          recording_id?: number
          speaker_email?: string | null
          speaker_name?: string | null
          text?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcripts_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "fathom_transcripts_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      folder_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          call_recording_id: number
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          call_recording_id: number
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          call_recording_id?: number
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_assignments_call_recording_id_user_id_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "folder_assignments_call_recording_id_user_id_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "folder_assignments_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          organization_id: string
          parent_id: string | null
          position: number | null
          updated_at: string | null
          user_id: string
          visibility: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hooks: {
        Row: {
          created_at: string | null
          emotion_category: string | null
          hook_text: string
          id: string
          insight_ids: string[] | null
          is_starred: boolean | null
          recording_id: number | null
          status: string | null
          topic_hint: string | null
          updated_at: string | null
          user_id: string
          virality_score: number | null
        }
        Insert: {
          created_at?: string | null
          emotion_category?: string | null
          hook_text: string
          id?: string
          insight_ids?: string[] | null
          is_starred?: boolean | null
          recording_id?: number | null
          status?: string | null
          topic_hint?: string | null
          updated_at?: string | null
          user_id: string
          virality_score?: number | null
        }
        Update: {
          created_at?: string | null
          emotion_category?: string | null
          hook_text?: string
          id?: string
          insight_ids?: string[] | null
          is_starred?: boolean | null
          recording_id?: number | null
          status?: string | null
          topic_hint?: string | null
          updated_at?: string | null
          user_id?: string
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hooks_fathom_call_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "hooks_fathom_call_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      human_tasks: {
        Row: {
          added_by: string | null
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          priority: string | null
          status: string | null
          tenant_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "human_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_routing_defaults: {
        Row: {
          organization_id: string
          source_app: string
          target_folder_id: string | null
          target_workspace_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          organization_id: string
          source_app?: string
          target_folder_id?: string | null
          target_workspace_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          organization_id?: string
          source_app?: string
          target_folder_id?: string | null
          target_workspace_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_routing_defaults_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_routing_defaults_target_folder_id_fkey"
            columns: ["target_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_routing_defaults_target_workspace_id_fkey"
            columns: ["target_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_routing_rules: {
        Row: {
          conditions: Json
          created_at: string
          created_by: string
          delete_after_copy: boolean
          enabled: boolean
          id: string
          logic_operator: string
          name: string
          organization_id: string
          priority: number
          target_folder_id: string | null
          target_organization_id: string | null
          target_workspace_id: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          created_by: string
          delete_after_copy?: boolean
          enabled?: boolean
          id?: string
          logic_operator?: string
          name: string
          organization_id: string
          priority?: number
          target_folder_id?: string | null
          target_organization_id?: string | null
          target_workspace_id: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string
          delete_after_copy?: boolean
          enabled?: boolean
          id?: string
          logic_operator?: string
          name?: string
          organization_id?: string
          priority?: number
          target_folder_id?: string | null
          target_organization_id?: string | null
          target_workspace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_routing_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_routing_rules_target_folder_id_fkey"
            columns: ["target_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_routing_rules_target_organization_id_fkey"
            columns: ["target_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_routing_rules_target_workspace_id_fkey"
            columns: ["target_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sources: {
        Row: {
          account_email: string | null
          api_key: string | null
          connection_metadata: Json
          created_at: string
          error_message: string | null
          fathom_api_key: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          oauth_access_token: string | null
          oauth_refresh_token: string | null
          oauth_token_expires: number | null
          source_app: string
          updated_at: string
          user_id: string
          webhook_path_token: string | null
          webhook_signing_secret: string | null
          workspace_id: string | null
        }
        Insert: {
          account_email?: string | null
          api_key?: string | null
          connection_metadata?: Json
          created_at?: string
          error_message?: string | null
          fathom_api_key?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires?: number | null
          source_app: string
          updated_at?: string
          user_id: string
          webhook_path_token?: string | null
          webhook_signing_secret?: string | null
          workspace_id?: string | null
        }
        Update: {
          account_email?: string | null
          api_key?: string | null
          connection_metadata?: Json
          created_at?: string
          error_message?: string | null
          fathom_api_key?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          oauth_token_expires?: number | null
          source_app?: string
          updated_at?: string
          user_id?: string
          webhook_path_token?: string | null
          webhook_signing_secret?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          category: string
          created_at: string | null
          emotion_category: string | null
          exact_quote: string
          id: string
          recording_id: number
          score: number
          speaker: string | null
          timestamp: string | null
          topic_hint: string | null
          user_id: string
          virality_score: number | null
          why_it_matters: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          emotion_category?: string | null
          exact_quote: string
          id?: string
          recording_id: number
          score: number
          speaker?: string | null
          timestamp?: string | null
          topic_hint?: string | null
          user_id: string
          virality_score?: number | null
          why_it_matters?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          emotion_category?: string | null
          exact_quote?: string
          id?: string
          recording_id?: number
          score?: number
          speaker?: string | null
          timestamp?: string | null
          topic_hint?: string | null
          user_id?: string
          virality_score?: number | null
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_fathom_call_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "insights_fathom_call_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      mcp_oauth_client_grants: {
        Row: {
          client_id: string
          client_name: string | null
          created_at: string
          enabled_categories: Json
          id: string
          last_used_at: string | null
          org_id: string | null
          revoked_at: string | null
          scope: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          client_id: string
          client_name?: string | null
          created_at?: string
          enabled_categories?: Json
          id?: string
          last_used_at?: string | null
          org_id?: string | null
          revoked_at?: string | null
          scope: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string | null
          created_at?: string
          enabled_categories?: Json
          id?: string
          last_used_at?: string | null
          org_id?: string | null
          revoked_at?: string | null
          scope?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_client_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_oauth_client_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_oauth_org_bindings: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_org_bindings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tokens: {
        Row: {
          created_at: string | null
          enabled_categories: Json | null
          id: string
          last_used_at: string | null
          name: string
          org_id: string | null
          revoked_at: string | null
          scope: string
          token: string
          token_label: string | null
          token_source: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled_categories?: Json | null
          id?: string
          last_used_at?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          scope: string
          token?: string
          token_label?: string | null
          token_source?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled_categories?: Json | null
          id?: string
          last_used_at?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          scope?: string
          token?: string
          token_label?: string | null
          token_source?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      org_slug_tombstone: {
        Row: {
          retired_at: string
          slug: string
        }
        Insert: {
          retired_at?: string
          slug: string
        }
        Update: {
          retired_at?: string
          slug?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invite_token?: string
          invited_by: string
          organization_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_organization_memberships_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          cross_org_default: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cross_org_default?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cross_org_default?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_folder_recordings: {
        Row: {
          created_at: string
          folder_id: string
          recording_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          recording_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          recording_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_folder_recordings_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "personal_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_folder_recordings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_tag_recordings: {
        Row: {
          created_at: string
          recording_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recording_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recording_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_tag_recordings_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_tag_recordings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "personal_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhooks: {
        Row: {
          processed_at: string | null
          webhook_id: string
        }
        Insert: {
          processed_at?: string | null
          webhook_id: string
        }
        Update: {
          processed_at?: string | null
          webhook_id?: string
        }
        Relationships: []
      }
      qa_runs: {
        Row: {
          critical_count: number
          findings_count: number
          finished_at: string | null
          id: string
          report: Json | null
          routes_crawled: number
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          critical_count?: number
          findings_count?: number
          finished_at?: string | null
          id?: string
          report?: Json | null
          routes_crawled?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          critical_count?: number
          findings_count?: number
          finished_at?: string | null
          id?: string
          report?: Json | null
          routes_crawled?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      rate_limit_configs: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          max_requests: number
          resource_type: string
          updated_at: string | null
          window_duration_ms: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_requests: number
          resource_type: string
          updated_at?: string | null
          window_duration_ms: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_requests?: number
          resource_type?: string
          updated_at?: string | null
          window_duration_ms?: number
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string | null
          id: string
          max_requests: number
          request_count: number
          resource_type: string
          updated_at: string | null
          user_id: string
          window_duration_ms: number
          window_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_requests?: number
          request_count?: number
          resource_type: string
          updated_at?: string | null
          user_id: string
          window_duration_ms?: number
          window_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_requests?: number
          request_count?: number
          resource_type?: string
          updated_at?: string | null
          user_id?: string
          window_duration_ms?: number
          window_start?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          action_items_cache: Json | null
          audio_url: string | null
          coaching_cache: Json | null
          created_at: string
          duration: number | null
          fathom_provider_id: number | null
          full_transcript: string | null
          global_tags: string[] | null
          id: string
          organization_id: string
          owner_user_id: string
          participant_count: number
          recording_end_time: string | null
          recording_start_time: string | null
          sentiment_cache: Json | null
          share_token: string | null
          source_app: string | null
          source_call_id: string | null
          source_metadata: Json | null
          summary: string | null
          synced_at: string | null
          title: string
          transcript_segments: Json | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          action_items_cache?: Json | null
          audio_url?: string | null
          coaching_cache?: Json | null
          created_at?: string
          duration?: number | null
          fathom_provider_id?: number | null
          full_transcript?: string | null
          global_tags?: string[] | null
          id?: string
          organization_id: string
          owner_user_id: string
          participant_count?: number
          recording_end_time?: string | null
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_token?: string | null
          source_app?: string | null
          source_call_id?: string | null
          source_metadata?: Json | null
          summary?: string | null
          synced_at?: string | null
          title: string
          transcript_segments?: Json | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          action_items_cache?: Json | null
          audio_url?: string | null
          coaching_cache?: Json | null
          created_at?: string
          duration?: number | null
          fathom_provider_id?: number | null
          full_transcript?: string | null
          global_tags?: string[] | null
          id?: string
          organization_id?: string
          owner_user_id?: string
          participant_count?: number
          recording_end_time?: string | null
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_token?: string | null
          source_app?: string | null
          source_call_id?: string | null
          source_metadata?: Json | null
          summary?: string | null
          synced_at?: string | null
          title?: string
          transcript_segments?: Json | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resolution_notes: {
        Row: {
          created_at: string
          files_touched: string[] | null
          fingerprint: string | null
          fix_branch: string | null
          fix_commit: string | null
          id: string
          note: string | null
          root_cause: string | null
          symptom: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          files_touched?: string[] | null
          fingerprint?: string | null
          fix_branch?: string | null
          fix_commit?: string | null
          id?: string
          note?: string | null
          root_cause?: string | null
          symptom: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          files_touched?: string[] | null
          fingerprint?: string | null
          fix_branch?: string | null
          fix_commit?: string | null
          id?: string
          note?: string | null
          root_cause?: string | null
          symptom?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      rpc_type_smoke_skip_list: {
        Row: {
          added_at: string
          function_name: string
          reason: string
        }
        Insert: {
          added_at?: string
          function_name: string
          reason: string
        }
        Update: {
          added_at?: string
          function_name?: string
          reason?: string
        }
        Relationships: []
      }
      runner_runs: {
        Row: {
          branch: string | null
          canary_failure_detail: Json | null
          canary_last_run_at: string | null
          canary_next_run_at: string | null
          canary_status: string | null
          detail: Json | null
          diff_stat: string | null
          duration_sec: number | null
          est_cost: string | null
          finished_at: string | null
          fix_category: string | null
          fix_sha: string | null
          gate_stage: string | null
          gate_verdict: string | null
          id: string
          merged_at: string | null
          outcome: string | null
          reopened_at: string | null
          reopened_event_id: string | null
          started_at: string
          status: string | null
          survival_due_at: string | null
          survival_status: string | null
          test_cmd: string | null
          test_exit: number | null
          ticket_id: string | null
          tickets_processed: number
        }
        Insert: {
          branch?: string | null
          canary_failure_detail?: Json | null
          canary_last_run_at?: string | null
          canary_next_run_at?: string | null
          canary_status?: string | null
          detail?: Json | null
          diff_stat?: string | null
          duration_sec?: number | null
          est_cost?: string | null
          finished_at?: string | null
          fix_category?: string | null
          fix_sha?: string | null
          gate_stage?: string | null
          gate_verdict?: string | null
          id?: string
          merged_at?: string | null
          outcome?: string | null
          reopened_at?: string | null
          reopened_event_id?: string | null
          started_at?: string
          status?: string | null
          survival_due_at?: string | null
          survival_status?: string | null
          test_cmd?: string | null
          test_exit?: number | null
          ticket_id?: string | null
          tickets_processed?: number
        }
        Update: {
          branch?: string | null
          canary_failure_detail?: Json | null
          canary_last_run_at?: string | null
          canary_next_run_at?: string | null
          canary_status?: string | null
          detail?: Json | null
          diff_stat?: string | null
          duration_sec?: number | null
          est_cost?: string | null
          finished_at?: string | null
          fix_category?: string | null
          fix_sha?: string | null
          gate_stage?: string | null
          gate_verdict?: string | null
          id?: string
          merged_at?: string | null
          outcome?: string | null
          reopened_at?: string | null
          reopened_event_id?: string | null
          started_at?: string
          status?: string | null
          survival_due_at?: string | null
          survival_status?: string | null
          test_cmd?: string | null
          test_exit?: number | null
          ticket_id?: string | null
          tickets_processed?: number
        }
        Relationships: [
          {
            foreignKeyName: "runner_runs_reopened_event_id_fkey"
            columns: ["reopened_event_id"]
            isOneToOne: false
            referencedRelation: "ticket_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_runs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_state: {
        Row: {
          current_ticket_id: string | null
          id: number
          kill_switch: boolean
          last_heartbeat: string | null
          last_result: string | null
          run_started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          current_ticket_id?: string | null
          id?: number
          kill_switch?: boolean
          last_heartbeat?: string | null
          last_result?: string | null
          run_started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          current_ticket_id?: string | null
          id?: number
          kill_switch?: boolean
          last_heartbeat?: string | null
          last_result?: string | null
          run_started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_state_current_ticket_id_fkey"
            columns: ["current_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          failed_ids: string[] | null
          id: string
          metadata: Json | null
          progress_current: number | null
          progress_total: number | null
          recording_ids: string[] | null
          skipped_count: number | null
          started_at: string | null
          status: string
          synced_ids: string[] | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          failed_ids?: string[] | null
          id?: string
          metadata?: Json | null
          progress_current?: number | null
          progress_total?: number | null
          recording_ids?: string[] | null
          skipped_count?: number | null
          started_at?: string | null
          status: string
          synced_ids?: string[] | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          failed_ids?: string[] | null
          id?: string
          metadata?: Json | null
          progress_current?: number | null
          progress_total?: number | null
          recording_ids?: string[] | null
          skipped_count?: number | null
          started_at?: string | null
          status?: string
          synced_ids?: string[] | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tag_preferences: {
        Row: {
          attendee_domains: string[] | null
          attendee_emails: string[] | null
          attendee_names: string[] | null
          content_keywords: string[] | null
          created_at: string | null
          enabled: boolean | null
          id: string
          max_attendees: number | null
          min_attendees: number | null
          notes: string | null
          priority: number | null
          tag: string
          title_keywords: string[] | null
          title_patterns: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendee_domains?: string[] | null
          attendee_emails?: string[] | null
          attendee_names?: string[] | null
          content_keywords?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          max_attendees?: number | null
          min_attendees?: number | null
          notes?: string | null
          priority?: number | null
          tag: string
          title_keywords?: string[] | null
          title_patterns?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendee_domains?: string[] | null
          attendee_emails?: string[] | null
          attendee_names?: string[] | null
          content_keywords?: string[] | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          max_attendees?: number | null
          min_attendees?: number | null
          notes?: string | null
          priority?: number | null
          tag?: string
          title_keywords?: string[] | null
          title_patterns?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tag_rules: {
        Row: {
          conditions: Json
          created_at: string | null
          description: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          last_applied_at: string | null
          name: string
          priority: number
          rule_type: string
          tag_id: string | null
          times_applied: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conditions: Json
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          last_applied_at?: string | null
          name: string
          priority?: number
          rule_type: string
          tag_id?: string | null
          times_applied?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          last_applied_at?: string | null
          name?: string
          priority?: number
          rule_type?: string
          tag_id?: string | null
          times_applied?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "call_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_rules_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          prompt_quality_score: number | null
          status: string | null
          tenant_id: string | null
          title: string
          token_actual: number | null
          token_estimate: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          prompt_quality_score?: number | null
          status?: string | null
          tenant_id?: string | null
          title: string
          token_actual?: number | null
          token_estimate?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          prompt_quality_score?: number | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          token_actual?: number | null
          token_estimate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          content_type: string
          created_at: string | null
          description: string | null
          id: string
          is_shared: boolean | null
          name: string
          organization_id: string
          team_id: string | null
          template_content: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
          variables: Json | null
        }
        Insert: {
          content_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          name: string
          organization_id: string
          team_id?: string | null
          template_content: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
          variables?: Json | null
        }
        Update: {
          content_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          name?: string
          organization_id?: string
          team_id?: string | null
          template_content?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          business_name: string | null
          created_at: string | null
          id: string
          is_admin: boolean | null
          name: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          name: string
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          name?: string
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_type: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_type: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attempts: number
          context: Json
          created_at: string
          fingerprint: string | null
          id: string
          last_seen_at: string
          next_attempt_at: string | null
          occurrence_count: number
          priority: number
          reporter_id: string | null
          severity: Database["public"]["Enums"]["ticket_severity"]
          source: Database["public"]["Enums"]["ticket_source"]
          status: Database["public"]["Enums"]["ticket_status"]
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
          urgent: boolean
        }
        Insert: {
          attempts?: number
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          last_seen_at?: string
          next_attempt_at?: string | null
          occurrence_count?: number
          priority?: number
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"]
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          attempts?: number
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          last_seen_at?: string
          next_attempt_at?: string | null
          occurrence_count?: number
          priority?: number
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["ticket_severity"]
          source?: Database["public"]["Enums"]["ticket_source"]
          status?: Database["public"]["Enums"]["ticket_status"]
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
          urgent?: boolean
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          agent_id: string | null
          cost_usd: number | null
          created_at: string | null
          error_reason: string | null
          id: string
          input_tokens: number | null
          is_subscription: boolean | null
          model: string
          output_tokens: number | null
          session_date: string | null
          tenant_id: string | null
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          input_tokens?: number | null
          is_subscription?: boolean | null
          model: string
          output_tokens?: number | null
          session_date?: string | null
          tenant_id?: string | null
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          error_reason?: string | null
          id?: string
          input_tokens?: number | null
          is_subscription?: boolean | null
          model?: string
          output_tokens?: number | null
          session_date?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_chunks: {
        Row: {
          call_category: string | null
          call_date: string | null
          call_title: string | null
          canonical_recording_id: string | null
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedded_at: string | null
          entities: Json | null
          fts: unknown
          id: string
          intent_signals: string[] | null
          recording_id: number | null
          sentiment: string | null
          source_platform: string | null
          speaker_email: string | null
          speaker_name: string | null
          timestamp_end: string | null
          timestamp_start: string | null
          topics: string[] | null
          updated_at: string | null
          user_id: string
          user_tags: string[] | null
        }
        Insert: {
          call_category?: string | null
          call_date?: string | null
          call_title?: string | null
          canonical_recording_id?: string | null
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedded_at?: string | null
          entities?: Json | null
          fts?: unknown
          id?: string
          intent_signals?: string[] | null
          recording_id?: number | null
          sentiment?: string | null
          source_platform?: string | null
          speaker_email?: string | null
          speaker_name?: string | null
          timestamp_end?: string | null
          timestamp_start?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id: string
          user_tags?: string[] | null
        }
        Update: {
          call_category?: string | null
          call_date?: string | null
          call_title?: string | null
          canonical_recording_id?: string | null
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedded_at?: string | null
          entities?: Json | null
          fts?: unknown
          id?: string
          intent_signals?: string[] | null
          recording_id?: number | null
          sentiment?: string | null
          source_platform?: string | null
          speaker_email?: string | null
          speaker_name?: string | null
          timestamp_end?: string | null
          timestamp_start?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string
          user_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_chunks_canonical_recording_id_fkey"
            columns: ["canonical_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_chunks_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "transcript_chunks_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      transcript_tag_assignments: {
        Row: {
          created_at: string | null
          id: string
          recording_id: string
          tag_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recording_id: string
          tag_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recording_id?: string
          tag_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_tag_assignments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "transcript_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trial_purchases: {
        Row: {
          amount: number | null
          created_at: string | null
          crm_contact_id: string | null
          currency: string | null
          email: string | null
          id: string
          name: string | null
          source: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          crm_contact_id?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          crm_contact_id?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_purchases_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_raw_files: {
        Row: {
          created_at: string
          file_size: number | null
          full_transcript: string | null
          id: string
          mime_type: string | null
          original_filename: string
          raw_payload: Json | null
          recording_id: string | null
          storage_path: string | null
          transcription_language: string | null
          user_id: string
          whisper_model: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          full_transcript?: string | null
          id?: string
          mime_type?: string | null
          original_filename: string
          raw_payload?: Json | null
          recording_id?: string | null
          storage_path?: string | null
          transcription_language?: string | null
          user_id: string
          whisper_model?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number | null
          full_transcript?: string | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          raw_payload?: Json | null
          recording_id?: string | null
          storage_path?: string | null
          transcription_language?: string | null
          user_id?: string
          whisper_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_raw_files_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contact_settings: {
        Row: {
          created_at: string | null
          default_health_threshold_days: number | null
          track_all_contacts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_health_threshold_days?: number | null
          track_all_contacts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_health_threshold_days?: number | null
          track_all_contacts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auto_processing_preferences: Json | null
          avatar_url: string | null
          created_at: string | null
          current_period_end: string | null
          display_name: string | null
          email: string | null
          grandfathered: boolean
          id: string
          last_login_at: string | null
          onboarding_completed: boolean | null
          polar_customer_id: string | null
          polar_external_id: string | null
          product_id: string | null
          setup_wizard_completed: boolean | null
          subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_processing_preferences?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
          grandfathered?: boolean
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          polar_customer_id?: string | null
          polar_external_id?: string | null
          product_id?: string | null
          setup_wizard_completed?: boolean | null
          subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_processing_preferences?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
          grandfathered?: boolean
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          polar_customer_id?: string | null
          polar_external_id?: string | null
          product_id?: string | null
          setup_wizard_completed?: boolean | null
          subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_team_id: string | null
          ai_model_preset: string | null
          auto_naming_enabled: boolean | null
          automation_webhook_secret: string | null
          automation_webhook_secret_created_at: string | null
          bulk_import_enabled: boolean | null
          created_at: string | null
          dedup_platform_order: string[] | null
          dedup_priority_mode: string | null
          fathom_api_key: string | null
          fathom_api_secret: string | null
          google_last_poll_at: string | null
          google_oauth_access_token: string | null
          google_oauth_email: string | null
          google_oauth_refresh_token: string | null
          google_oauth_state: string | null
          google_oauth_token_expires: number | null
          google_sync_token: string | null
          host_email: string | null
          id: string
          oauth_access_token: string | null
          oauth_last_tested_at: string | null
          oauth_refresh_token: string | null
          oauth_state: string | null
          oauth_test_status: string | null
          oauth_token_expires: number | null
          pending_import_source_id: string | null
          setup_completed_at: string | null
          sync_source_filter: string[] | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          webhook_last_tested_at: string | null
          webhook_secret: string | null
          webhook_test_status: string | null
          zoom_oauth_access_token: string | null
          zoom_oauth_refresh_token: string | null
          zoom_oauth_state: string | null
          zoom_oauth_token_expires: number | null
        }
        Insert: {
          active_team_id?: string | null
          ai_model_preset?: string | null
          auto_naming_enabled?: boolean | null
          automation_webhook_secret?: string | null
          automation_webhook_secret_created_at?: string | null
          bulk_import_enabled?: boolean | null
          created_at?: string | null
          dedup_platform_order?: string[] | null
          dedup_priority_mode?: string | null
          fathom_api_key?: string | null
          fathom_api_secret?: string | null
          google_last_poll_at?: string | null
          google_oauth_access_token?: string | null
          google_oauth_email?: string | null
          google_oauth_refresh_token?: string | null
          google_oauth_state?: string | null
          google_oauth_token_expires?: number | null
          google_sync_token?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          pending_import_source_id?: string | null
          setup_completed_at?: string | null
          sync_source_filter?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          webhook_last_tested_at?: string | null
          webhook_secret?: string | null
          webhook_test_status?: string | null
          zoom_oauth_access_token?: string | null
          zoom_oauth_refresh_token?: string | null
          zoom_oauth_state?: string | null
          zoom_oauth_token_expires?: number | null
        }
        Update: {
          active_team_id?: string | null
          ai_model_preset?: string | null
          auto_naming_enabled?: boolean | null
          automation_webhook_secret?: string | null
          automation_webhook_secret_created_at?: string | null
          bulk_import_enabled?: boolean | null
          created_at?: string | null
          dedup_platform_order?: string[] | null
          dedup_priority_mode?: string | null
          fathom_api_key?: string | null
          fathom_api_secret?: string | null
          google_last_poll_at?: string | null
          google_oauth_access_token?: string | null
          google_oauth_email?: string | null
          google_oauth_refresh_token?: string | null
          google_oauth_state?: string | null
          google_oauth_token_expires?: number | null
          google_sync_token?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          pending_import_source_id?: string | null
          setup_completed_at?: string | null
          sync_source_filter?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_last_tested_at?: string | null
          webhook_secret?: string | null
          webhook_test_status?: string | null
          zoom_oauth_access_token?: string | null
          zoom_oauth_refresh_token?: string | null
          zoom_oauth_state?: string | null
          zoom_oauth_token_expires?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          password_hash: string
          tenant_id: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          password_hash: string
          tenant_id?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          password_hash?: string
          tenant_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          recording_id: number | null
          request_body: Json | null
          request_headers: Json | null
          response_code: number | null
          signature_valid: boolean | null
          status: string
          user_id: string | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          recording_id?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_code?: number | null
          signature_valid?: boolean | null
          status: string
          user_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          recording_id?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_code?: number | null
          signature_valid?: boolean | null
          status?: string
          user_id?: string | null
          webhook_id?: string | null
        }
        Relationships: []
      }
      workspace_entries: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          local_tags: string[] | null
          notes: string | null
          recording_id: string
          scores: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          local_tags?: string[] | null
          notes?: string | null
          recording_id: string
          scores?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          local_tags?: string[] | null
          notes?: string | null
          recording_id?: string
          scores?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_entries_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_entries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: string
          status?: string
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          sort_order: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          sort_order?: number
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          sort_order?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace_memberships_user_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_slug_tombstone: {
        Row: {
          org_id: string
          retired_at: string
          slug: string
        }
        Insert: {
          org_id: string
          retired_at?: string
          slug: string
        }
        Update: {
          org_id?: string
          retired_at?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_slug_tombstone_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          default_sharelink_ttl_days: number | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          is_default: boolean
          is_home: boolean
          name: string
          organization_id: string
          slug: string
          updated_at: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          default_sharelink_ttl_days?: number | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          is_default?: boolean
          is_home?: boolean
          name: string
          organization_id: string
          slug: string
          updated_at?: string
          workspace_type: string
        }
        Update: {
          created_at?: string
          default_sharelink_ttl_days?: number | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          is_default?: boolean
          is_home?: boolean
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_raw_calls: {
        Row: {
          created_at: string
          full_transcript: string | null
          id: string
          import_source: string | null
          raw_payload: Json | null
          recording_id: string | null
          user_id: string
          youtube_category_id: string | null
          youtube_channel_description: string | null
          youtube_channel_id: string | null
          youtube_channel_title: string | null
          youtube_channel_video_count: number | null
          youtube_comment_count: number | null
          youtube_definition: string | null
          youtube_description: string | null
          youtube_duration: string | null
          youtube_like_count: number | null
          youtube_published_at: string | null
          youtube_subscriber_count: number | null
          youtube_tags: Json | null
          youtube_thumbnail: string | null
          youtube_video_id: string
          youtube_view_count: number | null
        }
        Insert: {
          created_at?: string
          full_transcript?: string | null
          id?: string
          import_source?: string | null
          raw_payload?: Json | null
          recording_id?: string | null
          user_id: string
          youtube_category_id?: string | null
          youtube_channel_description?: string | null
          youtube_channel_id?: string | null
          youtube_channel_title?: string | null
          youtube_channel_video_count?: number | null
          youtube_comment_count?: number | null
          youtube_definition?: string | null
          youtube_description?: string | null
          youtube_duration?: string | null
          youtube_like_count?: number | null
          youtube_published_at?: string | null
          youtube_subscriber_count?: number | null
          youtube_tags?: Json | null
          youtube_thumbnail?: string | null
          youtube_video_id: string
          youtube_view_count?: number | null
        }
        Update: {
          created_at?: string
          full_transcript?: string | null
          id?: string
          import_source?: string | null
          raw_payload?: Json | null
          recording_id?: string | null
          user_id?: string
          youtube_category_id?: string | null
          youtube_channel_description?: string | null
          youtube_channel_id?: string | null
          youtube_channel_title?: string | null
          youtube_channel_video_count?: number | null
          youtube_comment_count?: number | null
          youtube_definition?: string | null
          youtube_description?: string | null
          youtube_duration?: string | null
          youtube_like_count?: number | null
          youtube_published_at?: string | null
          youtube_subscriber_count?: number | null
          youtube_tags?: Json | null
          youtube_thumbnail?: string | null
          youtube_video_id?: string
          youtube_view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_raw_calls_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_raw_calls: {
        Row: {
          account_id: string | null
          created_at: string
          duration: number | null
          full_transcript: string | null
          fuzzy_match_score: number | null
          host_email: string | null
          host_id: string | null
          id: string
          is_primary: boolean | null
          meeting_fingerprint: string | null
          meeting_type: number | null
          merged_from: number[] | null
          participants: Json | null
          raw_payload: Json | null
          recording_id: string | null
          recording_url: string | null
          share_url: string | null
          start_time: string | null
          synced_at: string | null
          timezone: string | null
          topic: string | null
          transcript_url: string | null
          user_id: string
          zoom_meeting_id: string | null
          zoom_meeting_uuid: string | null
          zoom_numeric_id: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          duration?: number | null
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          host_email?: string | null
          host_id?: string | null
          id?: string
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          meeting_type?: number | null
          merged_from?: number[] | null
          participants?: Json | null
          raw_payload?: Json | null
          recording_id?: string | null
          recording_url?: string | null
          share_url?: string | null
          start_time?: string | null
          synced_at?: string | null
          timezone?: string | null
          topic?: string | null
          transcript_url?: string | null
          user_id: string
          zoom_meeting_id?: string | null
          zoom_meeting_uuid?: string | null
          zoom_numeric_id?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          duration?: number | null
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          host_email?: string | null
          host_id?: string | null
          id?: string
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          meeting_type?: number | null
          merged_from?: number[] | null
          participants?: Json | null
          raw_payload?: Json | null
          recording_id?: string | null
          recording_url?: string | null
          share_url?: string | null
          start_time?: string | null
          synced_at?: string | null
          timezone?: string | null
          topic?: string | null
          transcript_url?: string | null
          user_id?: string
          zoom_meeting_id?: string | null
          zoom_meeting_uuid?: string | null
          zoom_numeric_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zoom_raw_calls_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fathom_calls: {
        Row: {
          ai_generated_title: string | null
          ai_title_generated_at: string | null
          auto_tags: string[] | null
          auto_tags_generated_at: string | null
          calendar_invitees: Json | null
          canonical_recording_id: string | null
          created_at: string | null
          full_transcript: string | null
          fuzzy_match_score: number | null
          google_calendar_event_id: string | null
          google_drive_file_id: string | null
          is_primary: boolean | null
          meeting_fingerprint: string | null
          merged_from: number[] | null
          metadata: Json | null
          recorded_by_email: string | null
          recorded_by_name: string | null
          recording_end_time: string | null
          recording_id: number | null
          recording_start_time: string | null
          sentiment_cache: Json | null
          share_url: string | null
          source_platform: string | null
          summary: string | null
          summary_edited_by_user: boolean | null
          synced_at: string | null
          title: string | null
          title_edited_by_user: boolean | null
          transcript_source: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          ai_generated_title?: string | null
          ai_title_generated_at?: string | null
          auto_tags?: string[] | null
          auto_tags_generated_at?: string | null
          calendar_invitees?: Json | null
          canonical_recording_id?: string | null
          created_at?: string | null
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          google_calendar_event_id?: string | null
          google_drive_file_id?: string | null
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          metadata?: Json | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id?: number | null
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title?: string | null
          title_edited_by_user?: boolean | null
          transcript_source?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          ai_generated_title?: string | null
          ai_title_generated_at?: string | null
          auto_tags?: string[] | null
          auto_tags_generated_at?: string | null
          calendar_invitees?: Json | null
          canonical_recording_id?: string | null
          created_at?: string | null
          full_transcript?: string | null
          fuzzy_match_score?: number | null
          google_calendar_event_id?: string | null
          google_drive_file_id?: string | null
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          metadata?: Json | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id?: number | null
          recording_start_time?: string | null
          sentiment_cache?: Json | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title?: string | null
          title_edited_by_user?: boolean | null
          transcript_source?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fathom_raw_calls_canonical_recording_id_fkey"
            columns: ["canonical_recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      fathom_transcripts: {
        Row: {
          created_at: string | null
          edited_at: string | null
          edited_by: string | null
          edited_speaker_email: string | null
          edited_speaker_name: string | null
          edited_text: string | null
          id: string | null
          is_deleted: boolean | null
          recording_id: number | null
          speaker_email: string | null
          speaker_name: string | null
          text: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          edited_speaker_email?: string | null
          edited_speaker_name?: string | null
          edited_text?: string | null
          id?: string | null
          is_deleted?: boolean | null
          recording_id?: number | null
          speaker_email?: string | null
          speaker_name?: string | null
          text?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          edited_speaker_email?: string | null
          edited_speaker_name?: string | null
          edited_text?: string | null
          id?: string | null
          is_deleted?: boolean | null
          recording_id?: number | null
          speaker_email?: string | null
          speaker_name?: string | null
          text?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcripts_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "fathom_transcripts_recording_user_fkey"
            columns: ["recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_raw_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      fireflies_credential_encryption_status: {
        Row: {
          encrypted_rows: number | null
          plaintext_rows: number | null
          total_rows: number | null
        }
        Relationships: []
      }
      oauth_token_encryption_status: {
        Row: {
          encrypted_rows: number | null
          plaintext_rows: number | null
          table_name: string | null
          total_rows: number | null
        }
        Relationships: []
      }
      recurring_call_titles: {
        Row: {
          current_tags: string[] | null
          first_occurrence: string | null
          last_occurrence: string | null
          occurrence_count: number | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      accept_workspace_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      admin_delete_user: { Args: { p_target_user_id: string }; Returns: Json }
      apply_tag_rules:
        | {
            Args: {
              p_dry_run?: boolean
              p_recording_id: number
              p_user_id: string
            }
            Returns: {
              folder_name: string
              match_reason: string
              matched_rule_id: string
              matched_rule_name: string
              tag_name: string
            }[]
          }
        | {
            Args: {
              p_dry_run?: boolean
              p_recording_id: string
              p_user_id: string
            }
            Returns: {
              match_reason: string
              matched_rule_id: string
              matched_rule_name: string
              tag_name: string
            }[]
          }
      apply_tag_rules_to_untagged: {
        Args: { p_dry_run?: boolean; p_limit?: number; p_user_id: string }
        Returns: {
          folder_name: string
          match_reason: string
          matched_rule: string
          recording_id: number
          tag_name: string
          title: string
        }[]
      }
      autopilot_trust_metrics: {
        Args: never
        Returns: {
          canary_due_count: number
          canary_failed_count: number
          category: string
          completed_fixes: number
          deferred_runs: number
          eligible: boolean
          min_fixes: number
          reopened_fixes: number
          rung: string
          survival_rate: number
          survived_fixes: number
          threshold: number
        }[]
      }
      backfill_transcript_segments: {
        Args: { p_batch_size?: number }
        Returns: {
          processed: number
          segments_created: number
        }[]
      }
      check_and_increment_rate_limit: {
        Args: {
          p_current_time: string
          p_max_requests: number
          p_resource_type: string
          p_user_id: string
          p_window_duration_ms: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: number
        }[]
      }
      cleanup_test_fixture_users: {
        Args: { p_max_age_minutes?: number }
        Returns: Json
      }
      copy_recording_to_org: {
        Args: {
          p_delete_original?: boolean
          p_recording_id: string
          p_target_org_id: string
          p_target_workspace_id: string
        }
        Returns: string
      }
      copy_recording_to_organization: {
        Args: { p_recording_id: string; p_target_org_id: string }
        Returns: string
      }
      create_business_organization: {
        Args: {
          p_cross_org_default?: string
          p_default_workspace_name?: string
          p_logo_url?: string
          p_name: string
        }
        Returns: {
          organization_id: string
          workspace_id: string
        }[]
      }
      decrypt_token: {
        Args: { ciphertext: string; encryption_key: string }
        Returns: string
      }
      delete_recording: { Args: { p_recording_id: string }; Returns: Json }
      delete_workspace: {
        Args: { p_transfer_to_workspace_id?: string; p_workspace_id: string }
        Returns: undefined
      }
      disconnect_connector_source: {
        Args: { p_source_app: string; p_source_id?: string }
        Returns: Json
      }
      encrypt_existing_fireflies_credentials: {
        Args: { p_key: string }
        Returns: Json
      }
      encrypt_existing_oauth_tokens: { Args: { p_key: string }; Returns: Json }
      encrypt_token: {
        Args: { encryption_key: string; plaintext: string }
        Returns: string
      }
      ensure_personal_organization: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_api_token: {
        Args: {
          p_name: string
          p_org_id: string
          p_scope?: string
          p_workspace_id?: string
        }
        Returns: {
          created_at: string
          id: string
          name: string
          org_id: string
          scope: string
          token: string
          workspace_id: string
        }[]
      }
      generate_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_org_slug: { Args: { p_name: string }; Returns: string }
      generate_prefixed_mcp_token: {
        Args: { p_scope: string }
        Returns: string
      }
      generate_workspace_invite: {
        Args: { p_force?: boolean; p_workspace_id: string }
        Returns: {
          invite_expires_at: string
          invite_token: string
        }[]
      }
      generate_workspace_slug: {
        Args: { p_name: string; p_organization_id: string }
        Returns: string
      }
      get_available_metadata: {
        Args: { p_metadata_type: string; p_user_id: string }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_calls_shared_with_me: {
        Args: never
        Returns: {
          call_name: string
          duration: string
          owner_user_id: string
          recording_id: number
          recording_start_time: string
          source_label: string
          source_type: string
        }[]
      }
      get_calls_shared_with_me_v2: {
        Args: { p_include_expired?: boolean }
        Returns: {
          call_name: string
          duration: string
          owner_user_id: string
          recording_id: number
          recording_start_time: string
          source_label: string
          source_type: string
        }[]
      }
      get_decrypted_fireflies_source_by_path_token: {
        Args: { p_encryption_key: string; p_path_token: string }
        Returns: {
          api_key: string
          id: string
          user_id: string
          webhook_path_token: string
          webhook_signing_secret: string
        }[]
      }
      get_decrypted_fireflies_source_for_user: {
        Args: { p_encryption_key: string; p_user_id: string }
        Returns: {
          api_key: string
          id: string
          user_id: string
          webhook_signing_secret: string
        }[]
      }
      get_decrypted_oauth_tokens: {
        Args: {
          p_encryption_key: string
          p_source_id: string
          p_user_id: string
        }
        Returns: {
          access_token: string
          refresh_token: string
          token_expires: number
        }[]
      }
      get_import_counts: {
        Args: { p_user_id: string }
        Returns: {
          call_count: number
          source_app: string
        }[]
      }
      get_migration_progress: {
        Args: never
        Returns: {
          migrated_recordings: number
          percent_complete: number
          remaining: number
          total_fathom_calls: number
        }[]
      }
      get_monthly_ai_usage: {
        Args: { p_month_year: string; p_user_id: string }
        Returns: number
      }
      get_monthly_org_ai_usage: {
        Args: { p_month_year: string; p_org_id: string }
        Returns: number
      }
      get_org_billing_tier: { Args: { p_org_id: string }; Returns: string }
      get_org_members: {
        Args: { p_org_id: string }
        Returns: {
          display_name: string
          email: string
          joined_at: string
          membership_id: string
          role: string
          user_id: string
        }[]
      }
      get_org_reserved_member_count: {
        Args: { p_org_id: string }
        Returns: number
      }
      get_organization_invite_details: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          invitation_id: string
          inviter_display_name: string
          organization_name: string
          role: string
        }[]
      }
      get_people_summary: {
        Args: { p_organization_id: string }
        Returns: {
          call_count: number
          display_name: string
          email: string
          first_call_at: string
          last_call_at: string
          recording_ids: string[]
        }[]
      }
      get_recording_organization_id: {
        Args: { p_recording_id: string }
        Returns: string
      }
      get_recordings_for_person: {
        Args: { p_email?: string; p_name?: string; p_organization_id: string }
        Returns: {
          duration: number
          participant_count: number
          participant_email: string
          participant_name: string
          participant_type: string
          recording_id: string
          recording_start_time: string
          title: string
        }[]
      }
      get_unindexed_recording_ids: {
        Args: { p_user_id: string }
        Returns: {
          recording_id: string
        }[]
      }
      get_user_categories: {
        Args: { p_user_id: string }
        Returns: {
          call_count: number
          category: string
        }[]
      }
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_speakers: {
        Args: { p_user_id: string }
        Returns: {
          call_count: number
          latest_call: string
          speaker_email: string
          speaker_name: string
        }[]
      }
      get_workspace_invite_details: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          invitation_id: string
          inviter_display_name: string
          organization_name: string
          role: string
          workspace_name: string
        }[]
      }
      get_workspace_organization_id: {
        Args: { p_workspace_id: string }
        Returns: string
      }
      get_workspace_recordings: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_limit: number
          p_offset: number
          p_search?: string
          p_sources?: string[]
          p_workspace_id: string
        }
        Returns: {
          ai_generated_title: string
          created_at: string
          duration: number
          entry_folder_id: string
          entry_id: string
          fathom_provider_id: number
          global_tags: string[]
          id: string
          organization_id: string
          owner_user_id: string
          recording_end_time: string
          recording_start_time: string
          source_app: string
          source_metadata: Json
          summary: string
          synced_at: string
          title: string
          total_count: number
        }[]
      }
      get_workspace_shareable_invite_details: {
        Args: { p_token: string }
        Returns: {
          invite_expires_at: string
          organization_name: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      global_search: {
        Args: {
          filter_date_end?: string
          filter_date_start?: string
          filter_folder_ids?: string[]
          filter_source_apps?: string[]
          filter_tag_ids?: string[]
          filter_user_id: string
          filter_workspace_id?: string
          match_count?: number
          query_text: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          metadata: Json
          relevance_score: number
          subtitle: string
          title: string
        }[]
      }
      has_other_workspace_owner: {
        Args: { p_excluded_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ingest_sentry_ticket: {
        Args: {
          p_context: Json
          p_fingerprint: string
          p_notify_body: string
          p_notify_title: string
          p_severity: Database["public"]["Enums"]["ticket_severity"]
        }
        Returns: {
          created: boolean
          occurrence_count: number
          ticket_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_organization_admin_or_owner: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_paid_tier: {
        Args: { p_period_end: string; p_product_id: string; p_status: string }
        Returns: boolean
      }
      is_workspace_admin_or_owner: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      jsonb_merge_source_metadata: {
        Args: { p_merge_data: Json; p_recording_id: string }
        Returns: undefined
      }
      list_decrypted_active_fireflies_sources: {
        Args: { p_encryption_key: string }
        Returns: {
          api_key: string
          id: string
          user_id: string
          webhook_signing_secret: string
        }[]
      }
      manual_google_poll_sync: { Args: never; Returns: string }
      maybe_provision_mcp_token: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      migrate_batch_fathom_calls: {
        Args: { p_batch_size?: number }
        Returns: {
          error_count: number
          migrated_count: number
        }[]
      }
      migrate_fathom_call_to_recording: {
        Args: { p_recording_id: number; p_user_id: string }
        Returns: string
      }
      parse_transcript_to_segments: {
        Args: { p_full_transcript: string; p_recording_id: number }
        Returns: number
      }
      placeholder_for_type: { Args: { p_type: string }; Returns: string }
      regenerate_mcp_token: {
        Args: { p_token_id: string }
        Returns: {
          created_at: string
          enabled_categories: Json
          id: string
          last_used_at: string
          name: string
          org_id: string
          revoked_at: string
          scope: string
          token: string
          user_id: string
          workspace_id: string
        }[]
      }
      revoke_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      rollup_autopilot_category_trust: { Args: never; Returns: undefined }
      route_recording_cross_org: {
        Args: {
          p_delete_source?: boolean
          p_recording_id: string
          p_target_org_id: string
          p_target_workspace_id?: string
          p_user_id: string
        }
        Returns: string
      }
      set_default_workspace: {
        Args: { p_workspace_id: string }
        Returns: {
          created_at: string
          default_sharelink_ttl_days: number | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          is_default: boolean
          is_home: boolean
          name: string
          organization_id: string
          slug: string
          updated_at: string
          workspace_type: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_recording_atomic: {
        Args: {
          p_audio_url?: string
          p_organization_id: string
          p_owner_user_id: string
          p_part1_fathom_id: number
          p_part1_recordings_id: string
          p_part1_title: string
          p_part1_transcript: string
          p_part2_title: string
          p_part2_transcript: string
          p_recording_end_time?: string
          p_recording_start_time?: string
          p_source_app?: string
          p_source_metadata?: Json
          p_video_url?: string
        }
        Returns: string
      }
      store_encrypted_fireflies_credentials: {
        Args: {
          p_account_email: string
          p_api_key: string
          p_encryption_key: string
          p_source_id: string
          p_user_id: string
          p_webhook_path_token: string
          p_webhook_signing_secret: string
        }
        Returns: string
      }
      store_encrypted_oauth_tokens: {
        Args: {
          p_access_token: string
          p_encryption_key: string
          p_is_active?: boolean
          p_refresh_token: string
          p_source_id: string
          p_token_expires: number
          p_user_id: string
        }
        Returns: undefined
      }
      store_encrypted_user_settings_tokens: {
        Args: {
          p_access_token: string
          p_encryption_key: string
          p_refresh_token: string
          p_token_expires: number
          p_user_id: string
        }
        Returns: undefined
      }
      ticket_source_metrics: {
        Args: never
        Returns: {
          avg_cycle_time_hours: number
          fix_rate: number
          resolved: number
          source: Database["public"]["Enums"]["ticket_source"]
          volume: number
        }[]
      }
      trigger_google_poll_sync: { Args: never; Returns: undefined }
      update_routing_rule_priorities: {
        Args: { p_organization_id: string; p_rule_ids: string[] }
        Returns: undefined
      }
      verify_rpc_type_signatures: {
        Args: never
        Returns: {
          error_code: string
          error_message: string
          function_signature: string
        }[]
      }
    }
    Enums: {
      app_role: "FREE" | "PRO" | "TEAM" | "ADMIN"
      ticket_severity: "critical" | "high" | "medium" | "low"
      ticket_source: "manual" | "sentry" | "unknown" | "nightly_qa" | "internal"
      ticket_status:
        | "new"
        | "triaged"
        | "in_progress"
        | "awaiting_approval"
        | "awaiting_user"
        | "resolved"
        | "rejected"
        | "escalated"
      ticket_type: "bug" | "suggestion" | "question" | "task"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["FREE", "PRO", "TEAM", "ADMIN"],
      ticket_severity: ["critical", "high", "medium", "low"],
      ticket_source: ["manual", "sentry", "unknown", "nightly_qa", "internal"],
      ticket_status: [
        "new",
        "triaged",
        "in_progress",
        "awaiting_approval",
        "awaiting_user",
        "resolved",
        "rejected",
        "escalated",
      ],
      ticket_type: ["bug", "suggestion", "question", "task"],
    },
  },
} as const
