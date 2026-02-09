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
      bank_memberships: {
        Row: {
          bank_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_memberships_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          cross_bank_default: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cross_bank_default?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cross_bank_default?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
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
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
        ]
      }
      content_library: {
        Row: {
          content: string
          content_type: string
          created_at: string | null
          id: string
          metadata: Json | null
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
          tags?: string[] | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_library_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      fathom_calls: {
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
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          position: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
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
        ]
      }
      manager_notes: {
        Row: {
          call_recording_id: number
          created_at: string | null
          id: string
          manager_user_id: string
          note: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          call_recording_id: number
          created_at?: string | null
          id?: string
          manager_user_id: string
          note: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          call_recording_id?: number
          created_at?: string | null
          id?: string
          manager_user_id?: string
          note?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_notes_call_recording_id_user_id_fkey"
            columns: ["call_recording_id", "user_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id", "user_id"]
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
      team_memberships: {
        Row: {
          created_at: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          invited_by_user_id: string | null
          joined_at: string | null
          manager_membership_id: string | null
          onboarding_complete: boolean | null
          role: string | null
          status: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_by_user_id?: string | null
          joined_at?: string | null
          manager_membership_id?: string | null
          onboarding_complete?: boolean | null
          role?: string | null
          status?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          invited_by_user_id?: string | null
          joined_at?: string | null
          manager_membership_id?: string | null
          onboarding_complete?: boolean | null
          role?: string | null
          status?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_manager_membership_id_fkey"
            columns: ["manager_membership_id"]
            isOneToOne: false
            referencedRelation: "team_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_shares: {
        Row: {
          created_at: string | null
          folder_id: string | null
          id: string
          owner_user_id: string
          recipient_user_id: string
          share_type: string
          tag_id: string | null
          team_id: string
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          owner_user_id: string
          recipient_user_id: string
          share_type: string
          tag_id?: string | null
          team_id: string
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          id?: string
          owner_user_id?: string
          recipient_user_id?: string
          share_type?: string
          tag_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_shares_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "call_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_sees_all: boolean | null
          created_at: string | null
          domain_auto_join: string | null
          id: string
          invite_expires_at: string | null
          invite_token: string | null
          name: string
          owner_user_id: string
          updated_at: string | null
        }
        Insert: {
          admin_sees_all?: boolean | null
          created_at?: string | null
          domain_auto_join?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          name: string
          owner_user_id: string
          updated_at?: string | null
        }
        Update: {
          admin_sees_all?: boolean | null
          created_at?: string | null
          domain_auto_join?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string | null
          name?: string
          owner_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          content_type: string
          created_at: string | null
          description: string | null
          id: string
          is_shared: boolean | null
          name: string
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
          team_id?: string | null
          template_content?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
        Relationships: [
          {
            foreignKeyName: "user_settings_active_team_id_fkey"
            columns: ["active_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          vault_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          vault_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_memberships_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      vaults: {
        Row: {
          bank_id: string
          created_at: string
          default_sharelink_ttl_days: number | null
          id: string
          name: string
          updated_at: string
          vault_type: string
        }
        Insert: {
          bank_id: string
          created_at?: string
          default_sharelink_ttl_days?: number | null
          id?: string
          name: string
          updated_at?: string
          vault_type: string
        }
        Update: {
          bank_id?: string
          created_at?: string
          default_sharelink_ttl_days?: number | null
          id?: string
          name?: string
          updated_at?: string
          vault_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaults_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
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
    }
    Views: {
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
      finalize_embedding_jobs: { Args: never; Returns: number }
      generate_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: string
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
      get_indexed_recording_count: {
        Args: { p_user_id: string }
        Returns: {
          indexed_count: number
          total_chunks: number
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
      get_vault_bank_id: { Args: { p_vault_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hybrid_search_transcripts:
        | {
            Args: {
              filter_categories?: string[]
              filter_date_end?: string
              filter_date_start?: string
              filter_intent?: string[]
              filter_recording_ids?: number[]
              filter_sentiment?: string
              filter_speakers?: string[]
              filter_topics?: string[]
              filter_user_id?: string
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
              fts_rank: number
              intent_signals: string[]
              recording_id: number
              rrf_score: number
              sentiment: string
              similarity_score: number
              speaker_email: string
              speaker_name: string
              topics: string[]
            }[]
          }
        | {
            Args: {
              filter_categories?: string[]
              filter_date_end?: string
              filter_date_start?: string
              filter_intent_signals?: string[]
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
      is_bank_admin_or_owner: {
        Args: { p_bank_id: string; p_user_id: string }
        Returns: boolean
      }
      is_bank_member: {
        Args: { p_bank_id: string; p_user_id: string }
        Returns: boolean
      }
      is_manager_of: {
        Args: { p_manager_user_id: string; p_report_user_id: string }
        Returns: boolean
      }
      is_team_admin: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_vault_admin_or_owner: {
        Args: { p_user_id: string; p_vault_id: string }
        Returns: boolean
      }
      is_vault_member: {
        Args: { p_user_id: string; p_vault_id: string }
        Returns: boolean
      }
      manual_google_poll_sync: { Args: never; Returns: string }
      parse_transcript_to_segments: {
        Args: { p_full_transcript: string; p_recording_id: number }
        Returns: number
      }
      revoke_automation_webhook_secret: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      trigger_google_poll_sync: { Args: never; Returns: undefined }
      would_create_circular_hierarchy: {
        Args: { p_membership_id: string; p_new_manager_membership_id: string }
        Returns: boolean
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["FREE", "PRO", "TEAM", "ADMIN"],
    },
  },
} as const
