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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_documents: {
        Row: {
          application_id: string
          document_id: string | null
          file_name: string
          file_path: string
          id: string
          uploaded_at: string
        }
        Insert: {
          application_id: string
          document_id?: string | null
          file_name: string
          file_path: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          application_id?: string
          document_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "workflow_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      application_responses: {
        Row: {
          application_id: string
          field_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          application_id: string
          field_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          application_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "workflow_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          id: string
          is_editable: boolean
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_editable?: boolean
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_editable?: boolean
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_rules: {
        Row: {
          created_at: string
          id: string
          rule_type: string
          rule_value: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_type: string
          rule_value: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_type?: string
          rule_value?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_rules_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          application_id: string
          created_at: string
          id: string
          last_message_at: string
          subject: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          subject?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          subject?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          application_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["offer_status"]
          withdrawn_at: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          withdrawn_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          label: string
          source_application_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          label: string
          source_application_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          label?: string
          source_application_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          cv_path: string | null
          cv_text: string | null
          cv_uploaded_at: string | null
          department: string | null
          email: string
          faculty: string | null
          full_name: string | null
          id: string
          phone: string | null
          qualification: string | null
          staff_number: string | null
          student_number: string | null
          updated_at: string
          year_of_study: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          cv_path?: string | null
          cv_text?: string | null
          cv_uploaded_at?: string | null
          department?: string | null
          email: string
          faculty?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          qualification?: string | null
          staff_number?: string | null
          student_number?: string | null
          updated_at?: string
          year_of_study?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          cv_path?: string | null
          cv_text?: string | null
          cv_uploaded_at?: string | null
          department?: string | null
          email?: string
          faculty?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          qualification?: string | null
          staff_number?: string | null
          student_number?: string | null
          updated_at?: string
          year_of_study?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_documents: {
        Row: {
          created_at: string
          description: string | null
          doc_order: number
          id: string
          name: string
          required: boolean
          workflow_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doc_order?: number
          id?: string
          name: string
          required?: boolean
          workflow_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doc_order?: number
          id?: string
          name?: string
          required?: boolean
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_documents_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_fields: {
        Row: {
          created_at: string
          field_key: string
          field_order: number
          help_text: string | null
          id: string
          label: string
          options: Json | null
          placeholder: string | null
          profile_field: string | null
          required: boolean
          step_id: string | null
          type: Database["public"]["Enums"]["field_type"]
          workflow_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_order?: number
          help_text?: string | null
          id?: string
          label: string
          options?: Json | null
          placeholder?: string | null
          profile_field?: string | null
          required?: boolean
          step_id?: string | null
          type?: Database["public"]["Enums"]["field_type"]
          workflow_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_order?: number
          help_text?: string | null
          id?: string
          label?: string
          options?: Json | null
          placeholder?: string | null
          profile_field?: string | null
          required?: boolean
          step_id?: string | null
          type?: Database["public"]["Enums"]["field_type"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_fields_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_fields_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          step_order: number
          title: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          step_order?: number
          title: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          step_order?: number
          title?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          deadline: string | null
          department: string | null
          description: string | null
          faculty: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          target_role: Database["public"]["Enums"]["target_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          description?: string | null
          faculty?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          target_role?: Database["public"]["Enums"]["target_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          description?: string | null
          faculty?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          target_role?: Database["public"]["Enums"]["target_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "student" | "staff" | "admin"
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      field_type:
        | "text"
        | "textarea"
        | "select"
        | "multiselect"
        | "date"
        | "file"
        | "number"
        | "email"
        | "phone"
      offer_status: "pending" | "sent" | "accepted" | "declined" | "withdrawn"
      target_role: "student" | "staff" | "any"
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
      app_role: ["student", "staff", "admin"],
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      field_type: [
        "text",
        "textarea",
        "select",
        "multiselect",
        "date",
        "file",
        "number",
        "email",
        "phone",
      ],
      offer_status: ["pending", "sent", "accepted", "declined", "withdrawn"],
      target_role: ["student", "staff", "any"],
    },
  },
} as const
