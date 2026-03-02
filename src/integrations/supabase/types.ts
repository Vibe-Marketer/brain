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
  public: {
    Tables: {
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
          call_recording_id: number
          created_at: string | null
          id: string
          speaker_id: string
          user_id: string
        }
        Insert: {
          call_recording_id: number
          created_at?: string | null
          id?: string
          speaker_id: string
          user_id: string
        }
        Update: {
          call_recording_id?: number
          created_at?: string | null
          id?: string
          speaker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_speakers_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "call_speakers_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
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
          call_recording_id: number
          created_at: string | null
          id: string
          is_primary: boolean | null
          tag_id: string
          user_id: string
        }
        Insert: {
          auto_assigned?: boolean | null
          call_recording_id: number
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          tag_id: string
          user_id: string
        }
        Update: {
          auto_assigned?: boolean | null
          call_recording_id?: number
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
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
            foreignKeyName: "call_tag_assignments_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "call_tag_assignments_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
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
            foreignKeyName: "call_tags_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          completion_tokens: number | null
          content: string | null
          created_at: string | null
          finish_reason: string | null
          id: string
          model: string | null
          parts: Json | null
          prompt_tokens: number | null
          role: string
          session_id: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          content?: string | null
          created_at?: string | null
          finish_reason?: string | null
          id?: string
          model?: string | null
          parts?: Json | null
          prompt_tokens?: number | null
          role: string
          session_id: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          content?: string | null
          created_at?: string | null
          finish_reason?: string | null
          id?: string
          model?: string | null
          parts?: Json | null
          prompt_tokens?: number | null
          role?: string
          session_id?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          description: string | null
          filter_categories: string[] | null
          filter_date_end: string | null
          filter_date_start: string | null
          filter_folder_ids: string[] | null
          filter_recording_ids: number[] | null
          filter_speakers: string[] | null
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          last_message_at: string | null
          message_count: number | null
          organization_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filter_categories?: string[] | null
          filter_date_end?: string | null
          filter_date_start?: string | null
          filter_folder_ids?: string[] | null
          filter_recording_ids?: number[] | null
          filter_speakers?: string[] | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          organization_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filter_categories?: string[] | null
          filter_date_end?: string | null
          filter_date_start?: string | null
          filter_folder_ids?: string[] | null
          filter_recording_ids?: number[] | null
          filter_speakers?: string[] | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          organization_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tool_calls: {
        Row: {
          completed_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          message_id: string
          session_id: string
          started_at: string | null
          status: string
          tool_call_id: string
          tool_input: Json
          tool_name: string
          tool_output: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          message_id: string
          session_id: string
          started_at?: string | null
          status?: string
          tool_call_id: string
          tool_input: Json
          tool_name: string
          tool_output?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          message_id?: string
          session_id?: string
          started_at?: string | null
          status?: string
          tool_call_id?: string
          tool_input?: Json
          tool_name?: string
          tool_output?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          account_identifier: string | null
          composio_connection_id: string | null
          connected_at: string | null
          id: string
          last_used_at: string | null
          service: string
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          account_identifier?: string | null
          composio_connection_id?: string | null
          connected_at?: string | null
          id?: string
          last_used_at?: string | null
          service: string
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          account_identifier?: string | null
          composio_connection_id?: string | null
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
          contact_id: string
          recording_id: number
          user_id: string
        }
        Insert: {
          appeared_at?: string | null
          contact_id: string
          recording_id: number
          user_id: string
        }
        Update: {
          appeared_at?: string | null
          contact_id?: string
          recording_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_call_appearances_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
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
          last_seen_at: string | null
          name: string | null
          notes: string | null
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
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
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
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          tags?: string[] | null
          track_health?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "content_items_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_hook_id_fkey"
            columns: ["hook_id"]
            isOneToOne: false
            referencedRelation: "hooks"
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
            foreignKeyName: "content_library_bank_id_fkey"
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
      embedding_jobs: {
        Row: {
          chunks_created: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          failed_recording_ids: number[] | null
          id: string
          progress_current: number | null
          progress_total: number | null
          queue_completed: number | null
          queue_failed: number | null
          queue_total: number | null
          recording_ids: number[]
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          chunks_created?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_recording_ids?: number[] | null
          id?: string
          progress_current?: number | null
          progress_total?: number | null
          queue_completed?: number | null
          queue_failed?: number | null
          queue_total?: number | null
          recording_ids: number[]
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          chunks_created?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_recording_ids?: number[] | null
          id?: string
          progress_current?: number | null
          progress_total?: number | null
          queue_completed?: number | null
          queue_failed?: number | null
          queue_total?: number | null
          recording_ids?: number[]
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      embedding_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          job_id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number | null
          next_retry_at: string | null
          recording_id: number
          started_at: string | null
          status: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          recording_id: number
          started_at?: string | null
          status?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          recording_id?: number
          started_at?: string | null
          status?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "embedding_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_usage_logs: {
        Row: {
          batch_size: number | null
          chunk_id: string | null
          cost_cents: number
          created_at: string | null
          error_message: string | null
          id: string
          input_tokens: number
          job_id: string | null
          latency_ms: number | null
          model: string
          operation_type: string
          output_tokens: number | null
          recording_id: number | null
          request_id: string | null
          session_id: string | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          batch_size?: number | null
          chunk_id?: string | null
          cost_cents?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          job_id?: string | null
          latency_ms?: number | null
          model: string
          operation_type: string
          output_tokens?: number | null
          recording_id?: number | null
          request_id?: string | null
          session_id?: string | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          batch_size?: number | null
          chunk_id?: string | null
          cost_cents?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          job_id?: string | null
          latency_ms?: number | null
          model?: string
          operation_type?: string
          output_tokens?: number | null
          recording_id?: number | null
          request_id?: string | null
          session_id?: string | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embedding_usage_logs_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "transcript_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_usage_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "embedding_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_usage_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
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
      fathom_calls_archive: {
        Row: {
          ai_generated_title: string | null
          ai_title_generated_at: string | null
          auto_tags: string[] | null
          auto_tags_generated_at: string | null
          calendar_invitees: Json | null
          created_at: string
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
          created_at: string
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
          created_at?: string
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
        Relationships: []
      }
      fathom_transcripts: {
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
            referencedRelation: "fathom_calls_archive"
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
            referencedRelation: "fathom_calls_archive"
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
            foreignKeyName: "folders_bank_id_fkey"
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
            foreignKeyName: "folders_vault_id_fkey"
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
            referencedRelation: "fathom_calls_archive"
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
          target_folder_id: string | null
          target_workspace_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          organization_id: string
          target_folder_id?: string | null
          target_workspace_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          organization_id?: string
          target_folder_id?: string | null
          target_workspace_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_routing_defaults_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
            foreignKeyName: "import_routing_defaults_target_vault_id_fkey"
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
          enabled: boolean
          id: string
          logic_operator: string
          name: string
          organization_id: string
          priority: number
          target_folder_id: string | null
          target_workspace_id: string
          updated_at: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          logic_operator?: string
          name: string
          organization_id: string
          priority?: number
          target_folder_id?: string | null
          target_workspace_id: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          logic_operator?: string
          name?: string
          organization_id?: string
          priority?: number
          target_folder_id?: string | null
          target_workspace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_routing_rules_bank_id_fkey"
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
            foreignKeyName: "import_routing_rules_target_vault_id_fkey"
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
          created_at: string
          error_message: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          source_app: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          source_app: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          source_app?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
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
            foreignKeyName: "bank_memberships_bank_id_fkey"
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
          cross_bank_default: string | null
          id: string
          logo_url: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cross_bank_default?: string | null
          id?: string
          logo_url?: string | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cross_bank_default?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
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
          audio_url: string | null
          created_at: string
          duration: number | null
          full_transcript: string | null
          global_tags: string[] | null
          id: string
          legacy_recording_id: number | null
          organization_id: string
          owner_user_id: string
          recording_end_time: string | null
          recording_start_time: string | null
          source_app: string | null
          source_metadata: Json | null
          summary: string | null
          synced_at: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          full_transcript?: string | null
          global_tags?: string[] | null
          id?: string
          legacy_recording_id?: number | null
          organization_id: string
          owner_user_id: string
          recording_end_time?: string | null
          recording_start_time?: string | null
          source_app?: string | null
          source_metadata?: Json | null
          summary?: string | null
          synced_at?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          full_transcript?: string | null
          global_tags?: string[] | null
          id?: string
          legacy_recording_id?: number | null
          organization_id?: string
          owner_user_id?: string
          recording_end_time?: string | null
          recording_start_time?: string | null
          source_app?: string | null
          source_metadata?: Json | null
          summary?: string | null
          synced_at?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          failed_ids: number[] | null
          id: string
          metadata: Json | null
          progress_current: number | null
          progress_total: number | null
          recording_ids: number[] | null
          skipped_count: number | null
          started_at: string | null
          status: string
          synced_ids: number[] | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          failed_ids?: number[] | null
          id?: string
          metadata?: Json | null
          progress_current?: number | null
          progress_total?: number | null
          recording_ids?: number[] | null
          skipped_count?: number | null
          started_at?: string | null
          status: string
          synced_ids?: number[] | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          failed_ids?: number[] | null
          id?: string
          metadata?: Json | null
          progress_current?: number | null
          progress_total?: number | null
          recording_ids?: number[] | null
          skipped_count?: number | null
          started_at?: string | null
          status?: string
          synced_ids?: number[] | null
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
            foreignKeyName: "templates_bank_id_fkey"
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
          composio_entity_id: string | null
          created_at: string | null
          id: string
          is_admin: boolean | null
          name: string
        }
        Insert: {
          business_name?: string | null
          composio_entity_id?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          name: string
        }
        Update: {
          business_name?: string | null
          composio_entity_id?: string | null
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          name?: string
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
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          entities: Json | null
          fts: unknown
          id: string
          intent_signals: string[] | null
          recording_id: number
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
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          entities?: Json | null
          fts?: unknown
          id?: string
          intent_signals?: string[] | null
          recording_id: number
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
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          entities?: Json | null
          fts?: unknown
          id?: string
          intent_signals?: string[] | null
          recording_id?: number
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
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
          },
        ]
      }
      transcript_tag_assignments: {
        Row: {
          call_recording_id: number
          created_at: string | null
          id: string
          tag_id: string
          user_id: string | null
        }
        Insert: {
          call_recording_id: number
          created_at?: string | null
          id?: string
          tag_id: string
          user_id?: string | null
        }
        Update: {
          call_recording_id?: number
          created_at?: string | null
          id?: string
          tag_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_tag_assignments_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
          },
          {
            foreignKeyName: "transcript_tag_assignments_recording_user_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls_archive"
            referencedColumns: ["recording_id", "user_id"]
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
          created_at: string | null
          current_period_end: string | null
          display_name: string | null
          email: string | null
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
          created_at?: string | null
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
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
          created_at?: string | null
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
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
            foreignKeyName: "vault_entries_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_entries_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_entries_vault_id_fkey"
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
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_memberships_vault_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          name: string
          organization_id: string
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
          name: string
          organization_id: string
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
          name?: string
          organization_id?: string
          updated_at?: string
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaults_bank_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      accept_workspace_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      apply_tag_rules: {
        Args: { p_dry_run?: boolean; p_recording_id: number; p_user_id: string }
        Returns: {
          folder_name: string
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
      claim_embedding_tasks: {
        Args: { p_batch_size?: number; p_job_id?: string; p_worker_id: string }
        Returns: {
          attempts: number
          id: string
          job_id: string
          max_attempts: number
          recording_id: number
          user_id: string
        }[]
      }
      create_business_organization: {
        Args: {
          p_cross_bank_default?: string
          p_default_workspace_name?: string
          p_logo_url?: string
          p_name: string
        }
        Returns: {
          organization_id: string
          workspace_id: string
        }[]
      }
      ensure_personal_organization: {
        Args: { p_user_id: string }
        Returns: string
      }
      finalize_embedding_jobs: { Args: never; Returns: number }
      generate_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_workspace_invite: {
        Args: { p_force?: boolean; p_workspace_id: string }
        Returns: {
          invite_expires_at: string
          invite_token: string
        }[]
      }
      get_admin_cost_summary: {
        Args: { p_period?: string }
        Returns: {
          feature_breakdown: Json
          model_breakdown: Json
          total_cost_cents: number
          total_requests: number
          total_tokens: number
          user_breakdown: Json
        }[]
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
      get_embedding_cost_summary: {
        Args: { p_months?: number; p_user_id: string }
        Returns: {
          avg_tokens_per_request: number
          month: string
          operation_type: string
          request_count: number
          total_cost_cents: number
          total_tokens: number
        }[]
      }
      get_import_counts: {
        Args: { p_user_id: string }
        Returns: {
          call_count: number
          source_app: string
        }[]
      }
      get_indexed_recording_count: {
        Args: { p_user_id: string }
        Returns: {
          indexed_count: number
          total_chunks: number
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
      get_recording_embedding_costs: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          created_at: string
          embedding_tokens: number
          enrichment_tokens: number
          recording_id: number
          total_cost_cents: number
          total_tokens: number
        }[]
      }
      get_recording_organization_id: {
        Args: { p_recording_id: string }
        Returns: string
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
      get_vault_organization_id: {
        Args: { p_workspace_id: string }
        Returns: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search_transcripts: {
        Args: {
          filter_categories?: string[]
          filter_date_end?: string
          filter_date_start?: string
          filter_intent_signals?: string[]
          filter_organization_id?: string
          filter_recording_ids?: number[]
          filter_sentiment?: string
          filter_source_platforms?: string[]
          filter_speakers?: string[]
          filter_topics?: string[]
          filter_user_id?: string
          filter_user_tags?: string[]
          full_text_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          call_category: string
          call_date: string
          call_title: string
          chunk_id: string
          chunk_index: number
          chunk_text: string
          entities: Json
          fts_rank: number
          intent_signals: string[]
          recording_id: number
          rrf_score: number
          sentiment: string
          similarity_score: number
          source_platform: string
          speaker_email: string
          speaker_name: string
          topics: string[]
          user_tags: string[]
        }[]
      }
      hybrid_search_transcripts_scoped: {
        Args: {
          filter_categories?: string[]
          filter_date_end?: string
          filter_date_start?: string
          filter_intent_signals?: string[]
          filter_organization_id?: string
          filter_recording_ids?: number[]
          filter_sentiment?: string
          filter_speakers?: string[]
          filter_topics?: string[]
          filter_user_id?: string
          filter_user_tags?: string[]
          filter_workspace_id?: string
          full_text_weight?: number
          match_count: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          call_category: string
          call_date: string
          call_title: string
          chunk_id: string
          chunk_index: number
          chunk_text: string
          entities: Json
          fts_rank: number
          intent_signals: string[]
          recording_id: number
          rrf_score: number
          sentiment: string
          similarity_score: number
          source_platform: string
          speaker_email: string
          speaker_name: string
          topics: string[]
          user_tags: string[]
          workspace_id: string
          workspace_name: string
        }[]
      }
      increment_embedding_progress: {
        Args: {
          p_chunks_created?: number
          p_job_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      is_active_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_organization_admin_or_owner: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { p_team_id: string; p_user_id: string }
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
      manual_google_poll_sync: { Args: never; Returns: string }
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
      revoke_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      trigger_google_poll_sync: { Args: never; Returns: undefined }
      update_routing_rule_priorities: {
        Args: { p_organization_id: string; p_rule_ids: string[] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "FREE" | "PRO" | "TEAM" | "ADMIN"
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
  public: {
    Enums: {
      app_role: ["FREE", "PRO", "TEAM", "ADMIN"],
    },
  },
} as const
