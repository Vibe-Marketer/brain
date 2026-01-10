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
          is_primary: boolean | null
          meeting_fingerprint: string | null
          merged_from: number[] | null
          recorded_by_email: string | null
          recorded_by_name: string | null
          recording_end_time: string | null
          recording_id: number
          recording_start_time: string | null
          share_url: string | null
          source_platform: string | null
          summary: string | null
          summary_edited_by_user: boolean | null
          synced_at: string | null
          title: string
          title_edited_by_user: boolean | null
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
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id: number
          recording_start_time?: string | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title: string
          title_edited_by_user?: boolean | null
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
          is_primary?: boolean | null
          meeting_fingerprint?: string | null
          merged_from?: number[] | null
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id?: number
          recording_start_time?: string | null
          share_url?: string | null
          source_platform?: string | null
          summary?: string | null
          summary_edited_by_user?: boolean | null
          synced_at?: string | null
          title?: string
          title_edited_by_user?: boolean | null
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
          id: string
          is_active: boolean | null
          last_applied_at: string | null
          name: string
          priority: number
          rule_type: string
          tag_id: string
          times_applied: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conditions: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_applied_at?: string | null
          name: string
          priority?: number
          rule_type: string
          tag_id: string
          times_applied?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_applied_at?: string | null
          name?: string
          priority?: number
          rule_type?: string
          tag_id?: string
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
      user_profiles: {
        Row: {
          auto_processing_preferences: Json | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          last_login_at: string | null
          onboarding_completed: boolean | null
          setup_wizard_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_processing_preferences?: Json | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          setup_wizard_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_processing_preferences?: Json | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean | null
          setup_wizard_completed?: boolean | null
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
          ai_model_preset: string | null
          bulk_import_enabled: boolean | null
          created_at: string | null
          dedup_platform_order: string[] | null
          dedup_priority_mode: string | null
          fathom_api_key: string | null
          fathom_api_secret: string | null
          host_email: string | null
          id: string
          oauth_access_token: string | null
          oauth_last_tested_at: string | null
          oauth_refresh_token: string | null
          oauth_state: string | null
          oauth_test_status: string | null
          oauth_token_expires: number | null
          setup_completed_at: string | null
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
          ai_model_preset?: string | null
          bulk_import_enabled?: boolean | null
          created_at?: string | null
          dedup_platform_order?: string[] | null
          dedup_priority_mode?: string | null
          fathom_api_key?: string | null
          fathom_api_secret?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          setup_completed_at?: string | null
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
          ai_model_preset?: string | null
          bulk_import_enabled?: boolean | null
          created_at?: string | null
          dedup_platform_order?: string[] | null
          dedup_priority_mode?: string | null
          fathom_api_key?: string | null
          fathom_api_secret?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          setup_completed_at?: string | null
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
          match_reason: string
          matched_rule_id: string
          matched_rule_name: string
          tag_name: string
        }[]
      }
      apply_tag_rules_to_untagged: {
        Args: { p_dry_run?: boolean; p_limit?: number; p_user_id: string }
        Returns: {
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
      get_available_metadata: {
        Args: {
          p_user_id: string
          p_metadata_type: string
        }
        Returns: Json
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
          filter_recording_ids?: number[]
          filter_sentiment?: string
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
      parse_transcript_to_segments: {
        Args: { p_full_transcript: string; p_recording_id: number }
        Returns: number
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
