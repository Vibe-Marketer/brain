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
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          failed_ids: number[] | null
          id: string
          job_type: string
          processed_ids: number[] | null
          progress_current: number | null
          progress_total: number
          recording_ids: number[]
          status: string
          success_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_ids?: number[] | null
          id?: string
          job_type: string
          processed_ids?: number[] | null
          progress_current?: number | null
          progress_total: number
          recording_ids: number[]
          status?: string
          success_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_ids?: number[] | null
          id?: string
          job_type?: string
          processed_ids?: number[] | null
          progress_current?: number | null
          progress_total?: number
          recording_ids?: number[]
          status?: string
          success_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      call_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      call_category_assignments: {
        Row: {
          auto_assigned: boolean | null
          call_recording_id: number
          category_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          auto_assigned?: boolean | null
          call_recording_id: number
          category_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          auto_assigned?: boolean | null
          call_recording_id?: number
          category_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_category_assignments_call_recording_id_fkey"
            columns: ["call_recording_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id"]
          },
          {
            foreignKeyName: "call_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "call_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      call_speakers: {
        Row: {
          call_recording_id: number
          created_at: string | null
          id: string
          speaker_id: string
        }
        Insert: {
          call_recording_id: number
          created_at?: string | null
          id?: string
          speaker_id: string
        }
        Update: {
          call_recording_id?: number
          created_at?: string | null
          id?: string
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_speakers_call_recording_id_fkey"
            columns: ["call_recording_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id"]
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
      fathom_calls: {
        Row: {
          ai_generated_title: string | null
          ai_title_generated_at: string | null
          auto_tags: string[] | null
          auto_tags_generated_at: string | null
          calendar_invitees: Json | null
          created_at: string
          full_transcript: string | null
          recorded_by_email: string | null
          recorded_by_name: string | null
          recording_end_time: string | null
          recording_id: number
          recording_start_time: string | null
          share_url: string | null
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
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id: number
          recording_start_time?: string | null
          share_url?: string | null
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
          recorded_by_email?: string | null
          recorded_by_name?: string | null
          recording_end_time?: string | null
          recording_id?: number
          recording_start_time?: string | null
          share_url?: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: "fathom_transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id"]
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
      shared_links: {
        Row: {
          accessed_count: number | null
          call_recording_ids: number[]
          created_at: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          share_token: string
          user_id: string
        }
        Insert: {
          accessed_count?: number | null
          call_recording_ids: number[]
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          share_token: string
          user_id: string
        }
        Update: {
          accessed_count?: number | null
          call_recording_ids?: number[]
          created_at?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          share_token?: string
          user_id?: string
        }
        Relationships: []
      }
      speakers: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_ids: number[] | null
          id: string
          progress_current: number
          progress_total: number
          recording_ids: number[]
          status: string
          synced_ids: number[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_ids?: number[] | null
          id?: string
          progress_current?: number
          progress_total: number
          recording_ids: number[]
          status?: string
          synced_ids?: number[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_ids?: number[] | null
          id?: string
          progress_current?: number
          progress_total?: number
          recording_ids?: number[]
          status?: string
          synced_ids?: number[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transcript_tag_assignments: {
        Row: {
          call_recording_id: number
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          call_recording_id: number
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          call_recording_id?: number
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_tag_assignments_call_recording_id_fkey"
            columns: ["call_recording_id"]
            isOneToOne: false
            referencedRelation: "fathom_calls"
            referencedColumns: ["recording_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed?: boolean | null
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
          created_at: string | null
          fathom_api_key: string | null
          host_email: string | null
          id: string
          oauth_access_token: string | null
          oauth_last_tested_at: string | null
          oauth_refresh_token: string | null
          oauth_state: string | null
          oauth_test_status: string | null
          oauth_token_expires: number | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          webhook_last_tested_at: string | null
          webhook_secret: string | null
          webhook_test_status: string | null
        }
        Insert: {
          created_at?: string | null
          fathom_api_key?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          webhook_last_tested_at?: string | null
          webhook_secret?: string | null
          webhook_test_status?: string | null
        }
        Update: {
          created_at?: string | null
          fathom_api_key?: string | null
          host_email?: string | null
          id?: string
          oauth_access_token?: string | null
          oauth_last_tested_at?: string | null
          oauth_refresh_token?: string | null
          oauth_state?: string | null
          oauth_test_status?: string | null
          oauth_token_expires?: number | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          webhook_last_tested_at?: string | null
          webhook_secret?: string | null
          webhook_test_status?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recording_id: number | null
          request_body: Json | null
          request_headers: Json | null
          signature_valid: boolean | null
          status: string
          user_id: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recording_id?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          signature_valid?: boolean | null
          status: string
          user_id: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recording_id?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          signature_valid?: boolean | null
          status?: string
          user_id?: string
          webhook_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
  public: {
    Enums: {
      app_role: ["FREE", "PRO", "TEAM", "ADMIN"],
    },
  },
} as const
