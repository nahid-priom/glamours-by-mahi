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
      account_groups: {
        Row: {
          account_class: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_class: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_class?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_groups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_transfers: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_account_id: string
          id: string
          note: string | null
          organization_id: string
          reference: string | null
          status: string
          to_account_id: string
          transfer_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_account_id: string
          id?: string
          note?: string | null
          organization_id: string
          reference?: string | null
          status?: string
          to_account_id: string
          transfer_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_account_id?: string
          id?: string
          note?: string | null
          organization_id?: string
          reference?: string | null
          status?: string
          to_account_id?: string
          transfer_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_transfers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          summary: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          summary?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_runtime_secrets: {
        Row: {
          description: string | null
          key: string
          secret_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          key: string
          secret_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          secret_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_runtime_secrets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          deleted_at: string | null
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          payload: Json
          reason: string | null
          request_type: string
          requested_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          payload?: Json
          reason?: string | null
          request_type: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          reason?: string | null
          request_type?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_adjustments: {
        Row: {
          after_values: Json
          approved_by: string | null
          attendance_record_id: string | null
          before_values: Json
          correction_request_id: string | null
          created_at: string
          employee_id: string
          id: string
          organization_id: string
          reason: string
          work_date: string
        }
        Insert: {
          after_values?: Json
          approved_by?: string | null
          attendance_record_id?: string | null
          before_values?: Json
          correction_request_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
          reason: string
          work_date: string
        }
        Update: {
          after_values?: Json
          approved_by?: string | null
          attendance_record_id?: string | null
          before_values?: Json
          correction_request_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_correction_request_id_fkey"
            columns: ["correction_request_id"]
            isOneToOne: false
            referencedRelation: "attendance_correction_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_app_version_policy: {
        Row: {
          created_at: string
          force_update: boolean
          id: string
          latest_version: string | null
          minimum_version: string
          organization_id: string | null
          platform: string
        }
        Insert: {
          created_at?: string
          force_update?: boolean
          id?: string
          latest_version?: string | null
          minimum_version?: string
          organization_id?: string | null
          platform: string
        }
        Update: {
          created_at?: string
          force_update?: boolean
          id?: string
          latest_version?: string | null
          minimum_version?: string
          organization_id?: string | null
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_app_version_policy_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_attempts: {
        Row: {
          accuracy: number | null
          challenge_id: string | null
          created_at: string
          decision: string
          device_id: string | null
          distance_metres: number | null
          employee_id: string | null
          event_type: string | null
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          organization_id: string
          payload: Json
          rejection_reason: string | null
          risk_score: number
          user_agent: string | null
        }
        Insert: {
          accuracy?: number | null
          challenge_id?: string | null
          created_at?: string
          decision: string
          device_id?: string | null
          distance_metres?: number | null
          employee_id?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          organization_id: string
          payload?: Json
          rejection_reason?: string | null
          risk_score?: number
          user_agent?: string | null
        }
        Update: {
          accuracy?: number | null
          challenge_id?: string | null
          created_at?: string
          decision?: string
          device_id?: string | null
          distance_metres?: number | null
          employee_id?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          payload?: Json
          rejection_reason?: string | null
          risk_score?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "attendance_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_attempts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "employee_attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_branch_qr_tokens: {
        Row: {
          branch_id: string
          created_by: string | null
          expires_at: string
          hmac_signature: string | null
          id: string
          issued_at: string
          location_id: string | null
          nonce_hash: string
          organization_id: string
          payload_hash: string | null
          single_use: boolean
          used_at: string | null
        }
        Insert: {
          branch_id: string
          created_by?: string | null
          expires_at: string
          hmac_signature?: string | null
          id?: string
          issued_at?: string
          location_id?: string | null
          nonce_hash: string
          organization_id: string
          payload_hash?: string | null
          single_use?: boolean
          used_at?: string | null
        }
        Update: {
          branch_id?: string
          created_by?: string | null
          expires_at?: string
          hmac_signature?: string | null
          id?: string
          issued_at?: string
          location_id?: string | null
          nonce_hash?: string
          organization_id?: string
          payload_hash?: string | null
          single_use?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_qr_tokens_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_branch_qr_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_branch_qr_tokens_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "attendance_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_branch_qr_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_challenges: {
        Row: {
          branch_id: string | null
          canonical_context: Json
          created_at: string
          device_id: string
          employee_id: string
          event_type: string
          expires_at: string
          id: string
          integrity_nonce_hash: string | null
          location_id: string | null
          nonce_hash: string
          organization_id: string
          qr_required: boolean
          shift_id: string | null
          used_at: string | null
        }
        Insert: {
          branch_id?: string | null
          canonical_context?: Json
          created_at?: string
          device_id: string
          employee_id: string
          event_type: string
          expires_at: string
          id?: string
          integrity_nonce_hash?: string | null
          location_id?: string | null
          nonce_hash: string
          organization_id: string
          qr_required?: boolean
          shift_id?: string | null
          used_at?: string | null
        }
        Update: {
          branch_id?: string | null
          canonical_context?: Json
          created_at?: string
          device_id?: string
          employee_id?: string
          event_type?: string
          expires_at?: string
          id?: string
          integrity_nonce_hash?: string | null
          location_id?: string | null
          nonce_hash?: string
          organization_id?: string
          qr_required?: boolean
          shift_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_challenges_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_challenges_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "employee_attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_challenges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_challenges_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "attendance_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_challenges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_challenges_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          after_values: Json
          attachment_path: string | null
          attendance_record_id: string | null
          before_values: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          organization_id: string
          reason: string
          request_type: string
          requested_check_in_at: string | null
          requested_check_out_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          after_values?: Json
          attachment_path?: string | null
          attendance_record_id?: string | null
          before_values?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          organization_id: string
          reason: string
          request_type: string
          requested_check_in_at?: string | null
          requested_check_out_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          after_values?: Json
          attachment_path?: string | null
          attendance_record_id?: string | null
          before_values?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string
          request_type?: string
          requested_check_in_at?: string | null
          requested_check_out_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_device_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          device_id: string | null
          employee_id: string | null
          id: string
          ip_address: string | null
          new_values: Json
          old_values: Json
          organization_id: string
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          device_id?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json
          old_values?: Json
          organization_id: string
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          device_id?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json
          old_values?: Json
          organization_id?: string
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_device_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_audit_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "employee_attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_device_requests: {
        Row: {
          auth_user_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          device_payload: Json
          employee_id: string
          id: string
          installation_id: string
          organization_id: string
          public_key: string
          request_type: string
          resulting_device_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_payload?: Json
          employee_id: string
          id?: string
          installation_id: string
          organization_id: string
          public_key: string
          request_type?: string
          resulting_device_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_payload?: Json
          employee_id?: string
          id?: string
          installation_id?: string
          organization_id?: string
          public_key?: string
          request_type?: string
          resulting_device_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_device_requests_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_resulting_device_id_fkey"
            columns: ["resulting_device_id"]
            isOneToOne: false
            referencedRelation: "employee_attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_device_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_devices: {
        Row: {
          base_url: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          name: string
          organization_id: string
          provider: string
          secret_ref: string | null
          serial_number: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          organization_id: string
          provider?: string
          secret_ref?: string | null
          serial_number?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          provider?: string
          secret_ref?: string | null
          serial_number?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_devices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          accuracy: number | null
          altitude: number | null
          attendance_record_id: string | null
          attestation_valid: boolean
          biometric_gate_used: boolean
          biometric_verified: boolean
          canonical_payload_hash: string | null
          challenge_id: string | null
          client_captured_at: string | null
          created_at: string
          decision: string
          device_id: string | null
          device_signature_valid: boolean
          distance_metres: number | null
          employee_id: string
          event_type: string
          heading: number | null
          id: string
          idempotency_key: string
          integrity_valid: boolean
          ip_address: string | null
          latitude: number | null
          location_valid: boolean
          longitude: number | null
          metadata: Json
          organization_id: string
          qr_valid: boolean | null
          rejection_reason: string | null
          risk_score: number
          server_received_at: string
          shift_valid: boolean
          speed: number | null
          user_agent: string | null
          work_date: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          attendance_record_id?: string | null
          attestation_valid?: boolean
          biometric_gate_used?: boolean
          biometric_verified?: boolean
          canonical_payload_hash?: string | null
          challenge_id?: string | null
          client_captured_at?: string | null
          created_at?: string
          decision?: string
          device_id?: string | null
          device_signature_valid?: boolean
          distance_metres?: number | null
          employee_id: string
          event_type: string
          heading?: number | null
          id?: string
          idempotency_key: string
          integrity_valid?: boolean
          ip_address?: string | null
          latitude?: number | null
          location_valid?: boolean
          longitude?: number | null
          metadata?: Json
          organization_id: string
          qr_valid?: boolean | null
          rejection_reason?: string | null
          risk_score?: number
          server_received_at?: string
          shift_valid?: boolean
          speed?: number | null
          user_agent?: string | null
          work_date: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          attendance_record_id?: string | null
          attestation_valid?: boolean
          biometric_gate_used?: boolean
          biometric_verified?: boolean
          canonical_payload_hash?: string | null
          challenge_id?: string | null
          client_captured_at?: string | null
          created_at?: string
          decision?: string
          device_id?: string | null
          device_signature_valid?: boolean
          distance_metres?: number | null
          employee_id?: string
          event_type?: string
          heading?: number | null
          id?: string
          idempotency_key?: string
          integrity_valid?: boolean
          ip_address?: string | null
          latitude?: number | null
          location_valid?: boolean
          longitude?: number | null
          metadata?: Json
          organization_id?: string
          qr_valid?: boolean | null
          rejection_reason?: string | null
          risk_score?: number
          server_received_at?: string
          shift_valid?: boolean
          speed?: number | null
          user_agent?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "attendance_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "employee_attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_idempotency_payloads: {
        Row: {
          created_at: string
          event_id: string | null
          idempotency_key: string
          organization_id: string
          payload_hash: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          idempotency_key: string
          organization_id: string
          payload_hash: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          idempotency_key?: string
          organization_id?: string
          payload_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_idempotency_payloads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_idempotency_payloads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_locations: {
        Row: {
          allowed_radius_metres: number
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          maximum_accuracy_metres: number
          maximum_location_age_seconds: number
          name: string
          organization_id: string
          requires_qr: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_radius_metres?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          maximum_accuracy_metres?: number
          maximum_location_age_seconds?: number
          name: string
          organization_id: string
          requires_qr?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_radius_metres?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          maximum_accuracy_metres?: number
          maximum_location_age_seconds?: number
          name?: string
          organization_id?: string
          requires_qr?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_rate_limits: {
        Row: {
          bucket_key: string
          hit_count: number
          id: string
          organization_id: string
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          hit_count?: number
          id?: string
          organization_id: string
          window_started_at?: string
        }
        Update: {
          bucket_key?: string
          hit_count?: number
          id?: string
          organization_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_rate_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_raw_logs: {
        Row: {
          created_at: string
          device_id: string | null
          device_user_id: string
          employee_id: string | null
          error_message: string | null
          external_event_id: string | null
          id: string
          organization_id: string
          processed_at: string | null
          processing_status: string
          punch_type: string
          punched_at: string
          raw_payload: Json
          received_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_user_id: string
          employee_id?: string | null
          error_message?: string | null
          external_event_id?: string | null
          id?: string
          organization_id: string
          processed_at?: string | null
          processing_status?: string
          punch_type?: string
          punched_at: string
          raw_payload?: Json
          received_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_user_id?: string
          employee_id?: string | null
          error_message?: string | null
          external_event_id?: string | null
          id?: string
          organization_id?: string
          processed_at?: string | null
          processing_status?: string
          punch_type?: string
          punched_at?: string
          raw_payload?: Json
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_raw_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_raw_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_raw_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          branch_id: string | null
          calculation_version: string
          check_in_event_id: string | null
          check_out_event_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          early_leave_minutes: number
          employee_id: string
          first_in: string | null
          id: string
          is_approved: boolean
          last_out: string | null
          late_minutes: number
          notes: string | null
          organization_id: string
          overtime_minutes: number
          policy_snapshot: Json
          requires_review: boolean
          risk_score: number
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          shift_id: string | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          work_date: string
          working_minutes: number
        }
        Insert: {
          branch_id?: string | null
          calculation_version?: string
          check_in_event_id?: string | null
          check_out_event_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          early_leave_minutes?: number
          employee_id: string
          first_in?: string | null
          id?: string
          is_approved?: boolean
          last_out?: string | null
          late_minutes?: number
          notes?: string | null
          organization_id: string
          overtime_minutes?: number
          policy_snapshot?: Json
          requires_review?: boolean
          risk_score?: number
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          shift_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date: string
          working_minutes?: number
        }
        Update: {
          branch_id?: string | null
          calculation_version?: string
          check_in_event_id?: string | null
          check_out_event_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          early_leave_minutes?: number
          employee_id?: string
          first_in?: string | null
          id?: string
          is_approved?: boolean
          last_out?: string | null
          late_minutes?: number
          notes?: string | null
          organization_id?: string
          overtime_minutes?: number
          policy_snapshot?: Json
          requires_review?: boolean
          risk_score?: number
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          shift_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: string
          working_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_check_in_event_fkey"
            columns: ["check_in_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_check_out_event_fkey"
            columns: ["check_out_event_id"]
            isOneToOne: false
            referencedRelation: "attendance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_risk_policies: {
        Row: {
          accept_max: number
          flag_max: number
          organization_id: string
          review_max: number
          updated_at: string
        }
        Insert: {
          accept_max?: number
          flag_max?: number
          organization_id: string
          review_max?: number
          updated_at?: string
        }
        Update: {
          accept_max?: number
          flag_max?: number
          organization_id?: string
          review_max?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_risk_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          reason: string | null
          request_meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          reason?: string | null
          request_meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          reason?: string | null
          request_meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_product_prices: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_price: number | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          organization_id: string
          product_id: string
          retail_price: number | null
          updated_at: string
          updated_by: string | null
          variant_id: string | null
          wholesale_price: number | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_price?: number | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          product_id: string
          retail_price?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          wholesale_price?: number | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_price?: number | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          product_id?: string
          retail_price?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_product_prices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_prices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_central: boolean
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_central?: boolean
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_central?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          organization_id: string
          show_in_menu: boolean
          slug: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          show_in_menu?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          show_in_menu?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_postable: boolean
          name: string
          organization_id: string
          parent_id: string | null
          system_role: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          system_role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          system_role?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_attribution_exceptions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          sale_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_attribution_exceptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_attribution_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_attribution_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_attribution_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_attribution_exceptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_companies: {
        Row: {
          api_base_url: string | null
          code: string | null
          connection_status: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          status: string
          success_rate: number | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          api_base_url?: string | null
          code?: string | null
          connection_status?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          success_rate?: number | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          api_base_url?: string | null
          code?: string | null
          connection_status?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          success_rate?: number | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_companies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_events: {
        Row: {
          courier_company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_type: string
          external_event_id: string
          id: string
          occurred_at: string | null
          organization_id: string
          parcel_id: string | null
          payload: Json
          processed_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          courier_company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_type: string
          external_event_id: string
          id?: string
          occurred_at?: string | null
          organization_id: string
          parcel_id?: string | null
          payload?: Json
          processed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          courier_company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          occurred_at?: string | null
          organization_id?: string
          parcel_id?: string | null
          payload?: Json
          processed_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_events_courier_company_id_fkey"
            columns: ["courier_company_id"]
            isOneToOne: false
            referencedRelation: "courier_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_events_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_events_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "v_recon_courier_cod_pending"
            referencedColumns: ["parcel_id"]
          },
          {
            foreignKeyName: "courier_events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_parcels: {
        Row: {
          booked_at: string
          branch_id: string | null
          cod_amount: number
          consignment_id: string | null
          courier_charge: number
          courier_company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: string | null
          id: string
          organization_id: string
          sale_id: string | null
          status: string
          tracking_no: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booked_at?: string
          branch_id?: string | null
          cod_amount?: number
          consignment_id?: string | null
          courier_charge?: number
          courier_company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          id?: string
          organization_id: string
          sale_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booked_at?: string
          branch_id?: string | null
          cod_amount?: number
          consignment_id?: string | null
          courier_charge?: number
          courier_company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          id?: string
          organization_id?: string
          sale_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_parcels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_courier_company_id_fkey"
            columns: ["courier_company_id"]
            isOneToOne: false
            referencedRelation: "courier_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_parcels_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_return_items: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expected_qty: number
          id: string
          notes: string | null
          organization_id: string
          received_qty: number | null
          request_id: string
          sale_item_id: string | null
          updated_at: string
          updated_by: string | null
          variant_id: string | null
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_qty?: number
          id?: string
          notes?: string | null
          organization_id: string
          received_qty?: number | null
          request_id: string
          sale_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expected_qty?: number
          id?: string
          notes?: string | null
          organization_id?: string
          received_qty?: number | null
          request_id?: string
          sale_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_return_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "courier_return_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_return_requests: {
        Row: {
          branch_id: string | null
          courier_company_id: string | null
          courier_event_id: string | null
          courier_reason: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          parcel_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sale_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          courier_company_id?: string | null
          courier_event_id?: string | null
          courier_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          parcel_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          courier_company_id?: string | null
          courier_event_id?: string | null
          courier_reason?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          parcel_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_return_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_courier_company_id_fkey"
            columns: ["courier_company_id"]
            isOneToOne: false
            referencedRelation: "courier_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_courier_event_id_fkey"
            columns: ["courier_event_id"]
            isOneToOne: false
            referencedRelation: "courier_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "v_recon_courier_cod_pending"
            referencedColumns: ["parcel_id"]
          },
          {
            foreignKeyName: "courier_return_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_return_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_settlements: {
        Row: {
          branch_id: string | null
          client_txn_key: string | null
          cod_amount: number
          courier_charge: number
          courier_company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_account_id: string | null
          id: string
          notes: string | null
          organization_id: string
          parcel_id: string | null
          return_charge: number
          sale_id: string | null
          settled_amount: number
          settlement_amount: number
          settlement_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          client_txn_key?: string | null
          cod_amount?: number
          courier_charge?: number
          courier_company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          parcel_id?: string | null
          return_charge?: number
          sale_id?: string | null
          settled_amount?: number
          settlement_amount?: number
          settlement_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          client_txn_key?: string | null
          cod_amount?: number
          courier_charge?: number
          courier_company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          parcel_id?: string | null
          return_charge?: number
          sale_id?: string | null
          settled_amount?: number
          settlement_amount?: number
          settlement_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_settlements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_courier_company_id_fkey"
            columns: ["courier_company_id"]
            isOneToOne: false
            referencedRelation: "courier_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "courier_settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "courier_parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "v_recon_courier_cod_pending"
            referencedColumns: ["parcel_id"]
          },
          {
            foreignKeyName: "courier_settlements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_settlements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_sync_logs: {
        Row: {
          action: string
          courier_company_id: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          organization_id: string
          provider_id: string
          request_meta: Json
          response_meta: Json
          success: boolean
        }
        Insert: {
          action: string
          courier_company_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          provider_id: string
          request_meta?: Json
          response_meta?: Json
          success?: boolean
        }
        Update: {
          action?: string
          courier_company_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          provider_id?: string
          request_meta?: Json
          response_meta?: Json
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "courier_sync_logs_courier_company_id_fkey"
            columns: ["courier_company_id"]
            isOneToOne: false
            referencedRelation: "courier_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_sync_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          area: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          district: string | null
          full_name: string
          id: string
          is_default: boolean
          label: string
          organization_id: string
          phone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address: string
          area?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          district?: string | null
          full_name: string
          id?: string
          is_default?: boolean
          label?: string
          organization_id: string
          phone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          area?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          district?: string | null
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string
          phone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          balance_after: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          credit: number
          customer_id: string
          debit: number
          deleted_at: string | null
          entry_type: string
          id: string
          notes: string | null
          occurred_at: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          balance_after: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          customer_id: string
          debit?: number
          deleted_at?: string | null
          entry_type: string
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          balance_after?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          customer_id?: string
          debit?: number
          deleted_at?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_rating_summaries: {
        Row: {
          branch_id: string | null
          computed_at: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          factors: Json
          id: string
          organization_id: string
          rating_status: string
          score: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          factors?: Json
          id?: string
          organization_id: string
          rating_status?: string
          score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          factors?: Json
          id?: string
          organization_id?: string
          rating_status?: string
          score?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_rating_summaries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_rating_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_rating_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_rating_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_rating_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_rating_summaries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_staff_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          organization_id: string
          staff_user_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id: string
          staff_user_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_at?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          organization_id?: string
          staff_user_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_staff_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staff_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staff_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_staff_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staff_assignments_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_staff_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          barcode: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          current_advance: number
          current_due: number
          deleted_at: string | null
          district: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          preferred_channel: string | null
          status: string
          total_paid: number
          total_spent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          barcode?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_advance?: number
          current_due?: number
          deleted_at?: string | null
          district?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          preferred_channel?: string | null
          status?: string
          total_paid?: number
          total_spent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          barcode?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_advance?: number
          current_due?: number
          deleted_at?: string | null
          district?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          preferred_channel?: string | null
          status?: string
          total_paid?: number
          total_spent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_closings: {
        Row: {
          approved_by: string | null
          branch_id: string
          cash_collections: number
          cash_expenses: number
          cash_sales: number
          cash_transfers_net: number
          closed_at: string | null
          closed_by: string | null
          closing_date: string
          counted_cash: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          difference: number
          expected_closing: number
          id: string
          note: string | null
          opening_cash: number
          organization_id: string
          other_cash_income: number
          status: string
          supplier_cash_payments: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_by?: string | null
          branch_id: string
          cash_collections?: number
          cash_expenses?: number
          cash_sales?: number
          cash_transfers_net?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_date: string
          counted_cash?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          difference?: number
          expected_closing?: number
          id?: string
          note?: string | null
          opening_cash?: number
          organization_id: string
          other_cash_income?: number
          status?: string
          supplier_cash_payments?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_by?: string | null
          branch_id?: string
          cash_collections?: number
          cash_expenses?: number
          cash_sales?: number
          cash_transfers_net?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_date?: string
          counted_cash?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          difference?: number
          expected_closing?: number
          id?: string
          note?: string | null
          opening_cash?: number
          organization_id?: string
          other_cash_income?: number
          status?: string
          supplier_cash_payments?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_closings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_closings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_reset_runs: {
        Row: {
          actor_id: string | null
          created_at: string
          error_message: string | null
          id: string
          mode: string
          organization_id: string
          scope: Json
          status: string
          summary: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mode: string
          organization_id: string
          scope?: Json
          status?: string
          summary?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mode?: string
          organization_id?: string
          scope?: Json
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "data_reset_runs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_reset_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          disbursed_at: string | null
          employee_id: string
          id: string
          organization_id: string
          reason: string | null
          recovered_amount: number
          recovery_per_payroll: number | null
          remaining_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          employee_id: string
          id?: string
          organization_id: string
          reason?: string | null
          recovered_amount?: number
          recovery_per_payroll?: number | null
          remaining_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          disbursed_at?: string | null
          employee_id?: string
          id?: string
          organization_id?: string
          reason?: string | null
          recovered_amount?: number
          recovery_per_payroll?: number | null
          remaining_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_advances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_attendance_devices: {
        Row: {
          app_version: string | null
          approved_at: string | null
          approved_by: string | null
          auth_user_id: string
          biometric_supported: boolean
          biometric_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          device_model: string | null
          device_name: string | null
          employee_id: string
          id: string
          installation_id: string
          integrity_provider: string | null
          integrity_status: string
          is_active: boolean
          last_used_at: string | null
          operating_system: string | null
          organization_id: string
          os_version: string | null
          platform: string
          public_key: string
          registration_accuracy: number | null
          registration_latitude: number | null
          registration_longitude: number | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auth_user_id: string
          biometric_supported?: boolean
          biometric_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_model?: string | null
          device_name?: string | null
          employee_id: string
          id?: string
          installation_id: string
          integrity_provider?: string | null
          integrity_status?: string
          is_active?: boolean
          last_used_at?: string | null
          operating_system?: string | null
          organization_id: string
          os_version?: string | null
          platform?: string
          public_key: string
          registration_accuracy?: number | null
          registration_latitude?: number | null
          registration_longitude?: number | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auth_user_id?: string
          biometric_supported?: boolean
          biometric_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_model?: string | null
          device_name?: string | null
          employee_id?: string
          id?: string
          installation_id?: string
          integrity_provider?: string | null
          integrity_status?: string
          is_active?: boolean
          last_used_at?: string | null
          operating_system?: string | null
          organization_id?: string
          os_version?: string | null
          platform?: string
          public_key?: string
          registration_accuracy?: number | null
          registration_latitude?: number | null
          registration_longitude?: number | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_attendance_devices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_devices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_attendance_monthly_summary: {
        Row: {
          absent_days: number
          created_at: string
          deleted_at: string | null
          early_leave_minutes: number
          employee_id: string
          finalized_at: string | null
          finalized_by: string | null
          holiday_days: number
          id: string
          late_days: number
          late_minutes: number
          missing_attendance_days: number
          organization_id: string
          overtime_minutes: number
          paid_leave_days: number
          payroll_period_id: string | null
          period_end: string
          period_month: number
          period_start: string
          period_year: number
          present_days: number
          scheduled_days: number
          unpaid_leave_days: number
          updated_at: string
          weekend_days: number
          working_minutes: number
        }
        Insert: {
          absent_days?: number
          created_at?: string
          deleted_at?: string | null
          early_leave_minutes?: number
          employee_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          holiday_days?: number
          id?: string
          late_days?: number
          late_minutes?: number
          missing_attendance_days?: number
          organization_id: string
          overtime_minutes?: number
          paid_leave_days?: number
          payroll_period_id?: string | null
          period_end: string
          period_month: number
          period_start: string
          period_year: number
          present_days?: number
          scheduled_days?: number
          unpaid_leave_days?: number
          updated_at?: string
          weekend_days?: number
          working_minutes?: number
        }
        Update: {
          absent_days?: number
          created_at?: string
          deleted_at?: string | null
          early_leave_minutes?: number
          employee_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          holiday_days?: number
          id?: string
          late_days?: number
          late_minutes?: number
          missing_attendance_days?: number
          organization_id?: string
          overtime_minutes?: number
          paid_leave_days?: number
          payroll_period_id?: string | null
          period_end?: string
          period_month?: number
          period_start?: string
          period_year?: number
          present_days?: number
          scheduled_days?: number
          unpaid_leave_days?: number
          updated_at?: string
          weekend_days?: number
          working_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_attendance_monthly_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_monthly_summary_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_attendance_monthly_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_device_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          device_id: string
          device_user_id: string
          employee_id: string
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_id: string
          device_user_id: string
          employee_id: string
          id?: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          device_id?: string
          device_user_id?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_device_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_device_mappings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "attendance_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_device_mappings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_device_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_device_mappings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          installment_amount: number
          organization_id: string
          paid_amount: number
          principal: number
          remaining_amount: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          installment_amount: number
          organization_id: string
          paid_amount?: number
          principal: number
          remaining_amount?: number
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          installment_amount?: number
          organization_id?: string
          paid_amount?: number
          principal?: number
          remaining_amount?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shift_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_primary: boolean
          organization_id: string
          shift_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_primary?: boolean
          organization_id: string
          shift_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          shift_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_shift_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowances: Json
          bank_details: Json
          basic_salary: number
          branch_id: string | null
          commission_eligible: boolean
          commission_payment_mode: string
          created_at: string
          created_by: string | null
          default_sales_branch_id: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          emergency_contact: Json
          employee_code: string
          employment_type: string
          full_name: string
          id: string
          include_commission_in_payroll: boolean
          joining_date: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          photo_path: string | null
          profile_id: string | null
          salary_type: string
          shift_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowances?: Json
          bank_details?: Json
          basic_salary?: number
          branch_id?: string | null
          commission_eligible?: boolean
          commission_payment_mode?: string
          created_at?: string
          created_by?: string | null
          default_sales_branch_id?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: Json
          employee_code: string
          employment_type?: string
          full_name: string
          id?: string
          include_commission_in_payroll?: boolean
          joining_date?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          salary_type?: string
          shift_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowances?: Json
          bank_details?: Json
          basic_salary?: number
          branch_id?: string | null
          commission_eligible?: boolean
          commission_payment_mode?: string
          created_at?: string
          created_by?: string | null
          default_sales_branch_id?: string | null
          deleted_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: Json
          employee_code?: string
          employment_type?: string
          full_name?: string
          id?: string
          include_commission_in_payroll?: boolean
          joining_date?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_path?: string | null
          profile_id?: string | null
          salary_type?: string
          shift_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_default_sales_branch_id_fkey"
            columns: ["default_sales_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_items: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction: string
          exchange_id: string
          id: string
          line_total: number
          organization_id: string
          original_sale_item_id: string | null
          qty: number
          unit_price: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction: string
          exchange_id: string
          id?: string
          line_total: number
          organization_id: string
          original_sale_item_id?: string | null
          qty: number
          unit_price: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string
          exchange_id?: string
          id?: string
          line_total?: number
          organization_id?: string
          original_sale_item_id?: string | null
          qty?: number
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_original_sale_item_id_fkey"
            columns: ["original_sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      exchanges: {
        Row: {
          branch_id: string
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          difference_amount: number
          exchange_no: string
          id: string
          note: string | null
          organization_id: string
          payment_account_id: string | null
          refund_account_id: string | null
          sale_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          difference_amount?: number
          exchange_no: string
          id?: string
          note?: string | null
          organization_id: string
          payment_account_id?: string | null
          refund_account_id?: string | null
          sale_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          difference_amount?: number
          exchange_no?: string
          id?: string
          note?: string | null
          organization_id?: string
          payment_account_id?: string | null
          refund_account_id?: string | null
          sale_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchanges_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "exchanges_refund_account_id_fkey"
            columns: ["refund_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_refund_account_id_fkey"
            columns: ["refund_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "exchanges_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          account_id: string
          amount: number
          approval_required: boolean
          approved_by: string | null
          attachment_path: string | null
          branch_id: string
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_date: string
          id: string
          note: string | null
          organization_id: string
          payee: string | null
          reference: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          approval_required?: boolean
          approved_by?: string | null
          attachment_path?: string | null
          branch_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          organization_id: string
          payee?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          approval_required?: boolean
          approved_by?: string | null
          attachment_path?: string | null
          branch_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          organization_id?: string
          payee?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "expense_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expiry_alerts: {
        Row: {
          batch_id: string
          branch_id: string | null
          created_at: string
          expires_at: string
          id: string
          is_read: boolean
          message: string
          organization_id: string
          product_id: string
          quantity_available: number
          severity: string
          variant_id: string
        }
        Insert: {
          batch_id: string
          branch_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          is_read?: boolean
          message: string
          organization_id: string
          product_id: string
          quantity_available?: number
          severity?: string
          variant_id: string
        }
        Update: {
          batch_id?: string
          branch_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string
          product_id?: string
          quantity_available?: number
          severity?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expiry_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expiry_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_kind: string
          branch_id: string | null
          chart_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_balance: number
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          opening_balance: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_kind?: string
          branch_id?: string | null
          chart_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          opening_balance?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_kind?: string
          branch_id?: string | null
          chart_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_balance?: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          opening_balance?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string
          id: string
          is_current: boolean
          name: string
          organization_id: string
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          organization_id: string
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          branch_id: string | null
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction: string
          id: string
          note: string | null
          organization_id: string
          reference: string | null
          reversal_of: string | null
          reversed_at: string | null
          source_id: string | null
          source_number: string | null
          source_type: string | null
          status: string
          transaction_date: string
          transaction_type: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          balance_before: number
          branch_id?: string | null
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction: string
          id?: string
          note?: string | null
          organization_id: string
          reference?: string | null
          reversal_of?: string | null
          reversed_at?: string | null
          source_id?: string | null
          source_number?: string | null
          source_type?: string | null
          status?: string
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          branch_id?: string | null
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string
          id?: string
          note?: string | null
          organization_id?: string
          reference?: string | null
          reversal_of?: string | null
          reversed_at?: string | null
          source_id?: string | null
          source_number?: string | null
          source_type?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sale_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          held_sale_id: string
          id: string
          line_discount: number
          line_total: number
          organization_id: string
          qty: number
          sort_order: number
          unit_price: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          held_sale_id: string
          id?: string
          line_discount?: number
          line_total: number
          organization_id: string
          qty: number
          sort_order?: number
          unit_price: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          held_sale_id?: string
          id?: string
          line_discount?: number
          line_total?: number
          organization_id?: string
          qty?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_sale_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_items_held_sale_id_fkey"
            columns: ["held_sale_id"]
            isOneToOne: false
            referencedRelation: "held_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      held_sales: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          discount: number
          grand_total: number
          hold_label: string | null
          id: string
          note: string | null
          organization_id: string
          salesperson_id: string | null
          shipping: number
          subtotal: number
          tax: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          hold_label?: string | null
          id?: string
          note?: string | null
          organization_id: string
          salesperson_id?: string | null
          shipping?: number
          subtotal?: number
          tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          discount?: number
          grand_total?: number
          hold_label?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          salesperson_id?: string | null
          shipping?: number
          subtotal?: number
          tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "held_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "held_sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          action: string
          created_at: string
          errors: string[]
          existing_id: string | null
          id: string
          job_id: string
          match_key: string | null
          organization_id: string
          payload: Json
          result: Json
          row_num: number
          status: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          errors?: string[]
          existing_id?: string | null
          id?: string
          job_id: string
          match_key?: string | null
          organization_id: string
          payload?: Json
          result?: Json
          row_num: number
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          errors?: string[]
          existing_id?: string | null
          id?: string
          job_id?: string
          match_key?: string | null
          organization_id?: string
          payload?: Json
          result?: Json
          row_num?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          entity_type: string
          filename: string | null
          id: string
          mode: string
          organization_id: string
          status: string
          summary: Json
          total_rows: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_type: string
          filename?: string | null
          id?: string
          mode?: string
          organization_id: string
          status?: string
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          entity_type?: string
          filename?: string | null
          id?: string
          mode?: string
          organization_id?: string
          status?: string
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          account_id: string
          amount: number
          attachment_path: string | null
          branch_id: string
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_date: string
          id: string
          note: string | null
          organization_id: string
          received_by: string | null
          reference: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          attachment_path?: string | null
          branch_id: string
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          organization_id: string
          received_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_path?: string | null
          branch_id?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          organization_id?: string
          received_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "income_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          average_unit_cost: number
          cost_is_fallback: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          location_id: string
          organization_id: string
          qty_reserved: number
          quantity: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          average_unit_cost?: number
          cost_is_fallback?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_id: string
          organization_id: string
          qty_reserved?: number
          quantity?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          average_unit_cost?: number
          cost_is_fallback?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_id?: string
          organization_id?: string
          qty_reserved?: number
          quantity?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_number: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          location_id: string | null
          manufactured_at: string | null
          organization_id: string
          product_id: string
          purchase_item_id: string | null
          quantity_available: number
          quantity_received: number
          received_at: string
          status: string
          unit_cost: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          batch_number: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_id?: string | null
          manufactured_at?: string | null
          organization_id: string
          product_id: string
          purchase_item_id?: string | null
          quantity_available?: number
          quantity_received?: number
          received_at?: string
          status?: string
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          batch_number?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_id?: string | null
          manufactured_at?: string | null
          organization_id?: string
          product_id?: string
          purchase_item_id?: string | null
          quantity_available?: number
          quantity_received?: number
          received_at?: string
          status?: string
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipt_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          original_branch_id: string | null
          original_location_id: string | null
          product_id: string | null
          purchase_id: string | null
          purchase_item_id: string | null
          receipt_unit_cost: number
          received_at: string
          received_quantity: number
          source_type: string
          supplier_id: string | null
          traceability_status: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          original_branch_id?: string | null
          original_location_id?: string | null
          product_id?: string | null
          purchase_id?: string | null
          purchase_item_id?: string | null
          receipt_unit_cost?: number
          received_at?: string
          received_quantity?: number
          source_type?: string
          supplier_id?: string | null
          traceability_status?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          original_branch_id?: string | null
          original_location_id?: string | null
          product_id?: string | null
          purchase_id?: string | null
          purchase_item_id?: string | null
          receipt_unit_cost?: number
          received_at?: string
          received_quantity?: number
          source_type?: string
          supplier_id?: string | null
          traceability_status?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipt_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_original_branch_id_fkey"
            columns: ["original_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_original_location_id_fkey"
            columns: ["original_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "inventory_receipt_sources_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          branch_id: string
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string | null
          id: string
          location_id: string
          organization_id: string
          qty: number
          sale_id: string
          sale_item_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          branch_id: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_id: string
          organization_id: string
          qty: number
          sale_id: string
          sale_item_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          branch_id?: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          location_id?: string
          organization_id?: string
          qty?: number
          sale_id?: string
          sale_item_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_source_allocations: {
        Row: {
          actor_id: string | null
          branch_id: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          location_id: string
          occurred_at: string
          organization_id: string
          quantity_delta: number
          receipt_source_id: string
          stock_ledger_id: string | null
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          branch_id: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          location_id: string
          occurred_at?: string
          organization_id: string
          quantity_delta: number
          receipt_source_id: string
          stock_ledger_id?: string | null
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          branch_id?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          location_id?: string
          occurred_at?: string
          organization_id?: string
          quantity_delta?: number
          receipt_source_id?: string
          stock_ledger_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_source_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_allocations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_allocations_receipt_source_id_fkey"
            columns: ["receipt_source_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipt_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_allocations_stock_ledger_id_fkey"
            columns: ["stock_ledger_id"]
            isOneToOne: false
            referencedRelation: "stock_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_allocations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_source_positions: {
        Row: {
          branch_id: string
          id: string
          location_id: string
          organization_id: string
          qty_reserved: number
          quantity: number
          receipt_source_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          branch_id: string
          id?: string
          location_id: string
          organization_id: string
          qty_reserved?: number
          quantity?: number
          receipt_source_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          branch_id?: string
          id?: string
          location_id?: string
          organization_id?: string
          qty_reserved?: number
          quantity?: number
          receipt_source_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_source_positions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_positions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_positions_receipt_source_id_fkey"
            columns: ["receipt_source_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipt_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_source_positions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entry_date: string
          entry_no: string
          id: string
          memo: string | null
          organization_id: string
          period_id: string | null
          posted_at: string | null
          reversed_entry_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          entry_no: string
          id?: string
          memo?: string | null
          organization_id: string
          period_id?: string | null
          posted_at?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entry_date?: string
          entry_no?: string
          id?: string
          memo?: string | null
          organization_id?: string
          period_id?: string | null
          posted_at?: string | null
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "v_recon_unbalanced_journals"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "journal_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          chart_account_id: string
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          deleted_at: string | null
          description: string | null
          financial_account_id: string | null
          id: string
          journal_entry_id: string
          line_no: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chart_account_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          deleted_at?: string | null
          description?: string | null
          financial_account_id?: string | null
          id?: string
          journal_entry_id: string
          line_no?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chart_account_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          deleted_at?: string | null
          description?: string | null
          financial_account_id?: string | null
          id?: string
          journal_entry_id?: string
          line_no?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_chart_account_id_fkey"
            columns: ["chart_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_recon_unbalanced_journals"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "journal_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          deleted_at: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          organization_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days?: number
          deleted_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          organization_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          deleted_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          organization_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          due_date: string
          id: string
          loan_id: string
          organization_id: string
          paid_amount: number
          payroll_item_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          due_date: string
          id?: string
          loan_id: string
          organization_id: string
          paid_amount?: number
          payroll_item_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          loan_id?: string
          organization_id?: string
          paid_amount?: number
          payroll_item_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          metadata: Json
          organization_id: string
          read_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          organization_id: string
          read_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          organization_id?: string
          read_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balance_documents: {
        Row: {
          amount: number | null
          branch_id: string | null
          client_txn_key: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_no: string
          document_type: string
          id: string
          journal_entry_id: string | null
          location_id: string | null
          notes: string | null
          organization_id: string
          party_id: string | null
          quantity: number | null
          source_metadata: Json
          updated_at: string
          updated_by: string | null
          variant_id: string | null
        }
        Insert: {
          amount?: number | null
          branch_id?: string | null
          client_txn_key: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_no: string
          document_type: string
          id?: string
          journal_entry_id?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id: string
          party_id?: string | null
          quantity?: number | null
          source_metadata?: Json
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Update: {
          amount?: number | null
          branch_id?: string | null
          client_txn_key?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_no?: string
          document_type?: string
          id?: string
          journal_entry_id?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          party_id?: string | null
          quantity?: number | null
          source_metadata?: Json
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_documents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_documents_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_documents_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_recon_unbalanced_journals"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "opening_balance_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balance_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_reference_sequences: {
        Row: {
          created_at: string
          id: string
          last_value: number
          organization_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_value?: number
          organization_id: string
          prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_value?: number
          organization_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_reference_sequences_organization_id_fkey"
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
          created_by: string | null
          currency: string
          deleted_at: string | null
          id: string
          is_sandbox: boolean
          name: string
          settings: Json
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          is_sandbox?: boolean
          name: string
          settings?: Json
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          is_sandbox?: boolean
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          branch_id: string | null
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction: string
          document_id: string
          document_type: string
          id: string
          notes: string | null
          organization_id: string
          party_id: string
          party_type: string
          source_id: string
          source_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction: string
          document_id: string
          document_type: string
          id?: string
          notes?: string | null
          organization_id: string
          party_id: string
          party_type: string
          source_id: string
          source_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string
          document_id?: string
          document_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          party_id?: string
          party_type?: string
          source_id?: string
          source_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_account_id: string | null
          id: string
          is_active: boolean
          is_due: boolean
          name: string
          organization_id: string
          requires_reference: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          is_active?: boolean
          is_due?: boolean
          name: string
          organization_id: string
          requires_reference?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          is_active?: boolean
          is_due?: boolean
          name?: string
          organization_id?: string
          requires_reference?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          payroll_item_id: string
          reason: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          payroll_item_id: string
          reason: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          payroll_item_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_approval_logs: {
        Row: {
          action: string
          comments: string | null
          created_at: string
          created_by: string | null
          from_status: string | null
          id: string
          organization_id: string
          payroll_run_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          comments?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          organization_id: string
          payroll_run_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          comments?: string | null
          created_at?: string
          created_by?: string | null
          from_status?: string | null
          id?: string
          organization_id?: string
          payroll_run_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_approval_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_approval_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_approval_logs_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_commission_allocations: {
        Row: {
          adjustment_amount: number
          commission_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          included_amount: number
          organization_id: string
          payroll_item_id: string | null
          payroll_run_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_amount?: number
          commission_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          included_amount?: number
          organization_id: string
          payroll_item_id?: string | null
          payroll_run_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_amount?: number
          commission_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          included_amount?: number
          organization_id?: string
          payroll_item_id?: string | null
          payroll_run_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_commission_allocations_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "salesman_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_commission_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_commission_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_commission_allocations_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_commission_allocations_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_commission_allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_item_deductions: {
        Row: {
          amount: number
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          payroll_item_id: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          payroll_item_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          payroll_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_item_deductions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_item_deductions_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_item_earnings: {
        Row: {
          amount: number
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          payroll_item_id: string
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          payroll_item_id: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          payroll_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_item_earnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_item_earnings_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          allowances: number
          attendance_deduction: number
          attendance_snapshot: Json
          basic_salary: number
          bonus: number
          breakdown: Json
          calculation_version: number
          commission_adjustment: number
          commission_amount: number
          created_at: string
          deleted_at: string | null
          employee_id: string
          employee_snapshot: Json
          excluded: boolean
          exclusion_reason: string | null
          gross_salary: number
          id: string
          leave_deduction: number
          net_salary: number
          organization_id: string
          other_deductions: number
          outstanding_amount: number
          overtime: number
          paid_amount: number
          payment_status: string
          payroll_run_id: string
          updated_at: string
        }
        Insert: {
          allowances?: number
          attendance_deduction?: number
          attendance_snapshot?: Json
          basic_salary?: number
          bonus?: number
          breakdown?: Json
          calculation_version?: number
          commission_adjustment?: number
          commission_amount?: number
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          employee_snapshot?: Json
          excluded?: boolean
          exclusion_reason?: string | null
          gross_salary?: number
          id?: string
          leave_deduction?: number
          net_salary?: number
          organization_id: string
          other_deductions?: number
          outstanding_amount?: number
          overtime?: number
          paid_amount?: number
          payment_status?: string
          payroll_run_id: string
          updated_at?: string
        }
        Update: {
          allowances?: number
          attendance_deduction?: number
          attendance_snapshot?: Json
          basic_salary?: number
          bonus?: number
          breakdown?: Json
          calculation_version?: number
          commission_adjustment?: number
          commission_amount?: number
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          employee_snapshot?: Json
          excluded?: boolean
          exclusion_reason?: string | null
          gross_salary?: number
          id?: string
          leave_deduction?: number
          net_salary?: number
          organization_id?: string
          other_deductions?: number
          outstanding_amount?: number
          overtime?: number
          paid_amount?: number
          payment_status?: string
          payroll_run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          payroll_item_id: string
          payroll_payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          payroll_item_id: string
          payroll_payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          payroll_item_id?: string
          payroll_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_allocations_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_allocations_payroll_payment_id_fkey"
            columns: ["payroll_payment_id"]
            isOneToOne: false
            referencedRelation: "payroll_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payments: {
        Row: {
          amount: number
          branch_id: string | null
          client_txn_key: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_account_id: string
          id: string
          journal_entry_id: string | null
          method: string
          notes: string | null
          organization_id: string
          paid_at: string
          payroll_run_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          client_txn_key: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id: string
          id?: string
          journal_entry_id?: string | null
          method?: string
          notes?: string | null
          organization_id: string
          paid_at?: string
          payroll_run_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          client_txn_key?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string
          id?: string
          journal_entry_id?: string | null
          method?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string
          payroll_run_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "payroll_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          calculated_at: string | null
          calculated_by: string | null
          calculation_version: number
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department: string | null
          employee_ids: Json
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string
          outstanding: number
          paid_at: string | null
          paid_by: string | null
          payment_date: string | null
          payment_journal_entry_id: string | null
          period_end: string
          period_label: string
          period_start: string
          recalculation_required: boolean
          rejected_reason: string | null
          reviewed_at: string | null
          scope_type: string
          status: string
          submitted_at: string | null
          total_deductions: number
          total_gross: number
          total_net: number
          total_paid: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_version?: number
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          employee_ids?: Json
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id: string
          outstanding?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_journal_entry_id?: string | null
          period_end: string
          period_label: string
          period_start: string
          recalculation_required?: boolean
          rejected_reason?: string | null
          reviewed_at?: string | null
          scope_type?: string
          status?: string
          submitted_at?: string | null
          total_deductions?: number
          total_gross?: number
          total_net?: number
          total_paid?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          calculated_at?: string | null
          calculated_by?: string | null
          calculation_version?: number
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          employee_ids?: Json
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string
          outstanding?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_journal_entry_id?: string | null
          period_end?: string
          period_label?: string
          period_start?: string
          recalculation_required?: boolean
          rejected_reason?: string | null
          reviewed_at?: string | null
          scope_type?: string
          status?: string
          submitted_at?: string | null
          total_deductions?: number
          total_gross?: number
          total_net?: number
          total_paid?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          code: string
          code_normalized: string | null
          conflict_flag: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_primary: boolean
          kind: string
          notes: string | null
          organization_id: string
          product_id: string | null
          source: string
          updated_at: string
          updated_by: string | null
          variant_id: string | null
        }
        Insert: {
          code: string
          code_normalized?: string | null
          conflict_flag?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          notes?: string | null
          organization_id: string
          product_id?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Update: {
          code?: string
          code_normalized?: string | null
          conflict_flag?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          kind?: string
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_cover: boolean
          metadata: Json
          organization_id: string
          product_id: string
          sort_order: number
          storage_path: string
          updated_at: string
          updated_by: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_cover?: boolean
          metadata?: Json
          organization_id: string
          product_id: string
          sort_order?: number
          storage_path: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_cover?: boolean
          metadata?: Json
          organization_id?: string
          product_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          file_name: string | null
          id: string
          mode: string
          organization_id: string
          skipped_count: number
          status: string
          success_count: number
          summary: Json
          total_rows: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          file_name?: string | null
          id?: string
          mode?: string
          organization_id: string
          skipped_count?: number
          status?: string
          success_count?: number
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          file_name?: string | null
          id?: string
          mode?: string
          organization_id?: string
          skipped_count?: number
          status?: string
          success_count?: number
          summary?: Json
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_rows: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          organization_id: string
          product_id: string | null
          raw_data: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          organization_id: string
          product_id?: string | null
          raw_data?: Json
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          product_id?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "product_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_rows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_import_rows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          option_id: string
          organization_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          option_id: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          option_id?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          product_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          product_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string | null
          organization_id: string
          product_id: string
          purchase_price: number
          selling_price: number
          sku: string
          updated_at: string
          updated_by: string | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string | null
          organization_id: string
          product_id: string
          purchase_price?: number
          selling_price?: number
          sku: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string | null
          organization_id?: string
          product_id?: string
          purchase_price?: number
          selling_price?: number
          sku?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allocation_strategy: string
          approved_at: string | null
          approved_by: string | null
          base_barcode: string | null
          base_sku: string | null
          batch_tracking_enabled: boolean
          brand_id: string | null
          category_id: string | null
          country_of_origin: string | null
          created_at: string
          created_by: string | null
          default_expiry_alert_days: number
          deleted_at: string | null
          description: string | null
          expiry_tracking_enabled: boolean
          gender_target: string | null
          has_variants: boolean
          id: string
          importer: string | null
          ingredients: string | null
          is_active: boolean
          manufacturer: string | null
          name: string
          organization_id: string
          product_type: string
          published_at: string | null
          purchase_price: number
          regulatory_notes: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          reorder_level: number
          selling_price: number
          skin_type: string | null
          status: string
          subcategory_id: string | null
          submitted_at: string | null
          submitted_by: string | null
          tags: string[]
          tax_rate: number
          track_inventory: boolean
          unit: string
          updated_at: string
          updated_by: string | null
          wholesale_price: number | null
        }
        Insert: {
          allocation_strategy?: string
          approved_at?: string | null
          approved_by?: string | null
          base_barcode?: string | null
          base_sku?: string | null
          batch_tracking_enabled?: boolean
          brand_id?: string | null
          category_id?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          default_expiry_alert_days?: number
          deleted_at?: string | null
          description?: string | null
          expiry_tracking_enabled?: boolean
          gender_target?: string | null
          has_variants?: boolean
          id?: string
          importer?: string | null
          ingredients?: string | null
          is_active?: boolean
          manufacturer?: string | null
          name: string
          organization_id: string
          product_type?: string
          published_at?: string | null
          purchase_price?: number
          regulatory_notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reorder_level?: number
          selling_price?: number
          skin_type?: string | null
          status?: string
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tags?: string[]
          tax_rate?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number | null
        }
        Update: {
          allocation_strategy?: string
          approved_at?: string | null
          approved_by?: string | null
          base_barcode?: string | null
          base_sku?: string | null
          batch_tracking_enabled?: boolean
          brand_id?: string | null
          category_id?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by?: string | null
          default_expiry_alert_days?: number
          deleted_at?: string | null
          description?: string | null
          expiry_tracking_enabled?: boolean
          gender_target?: string | null
          has_variants?: boolean
          id?: string
          importer?: string | null
          ingredients?: string | null
          is_active?: boolean
          manufacturer?: string | null
          name?: string
          organization_id?: string
          product_type?: string
          published_at?: string | null
          purchase_price?: number
          regulatory_notes?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reorder_level?: number
          selling_price?: number
          skin_type?: string | null
          status?: string
          subcategory_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tags?: string[]
          tax_rate?: number
          track_inventory?: boolean
          unit?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          default_branch_id: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          role_id: string | null
          updated_at: string
          updated_by: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_branch_id?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_branch_id?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          role_id?: string | null
          updated_at?: string
          updated_by?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          line_discount: number
          line_total: number
          organization_id: string
          purchase_id: string
          qty: number
          unit_cost: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_discount?: number
          line_total: number
          organization_id: string
          purchase_id: string
          qty: number
          unit_cost: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_discount?: number
          line_total?: number
          organization_id?: string
          purchase_id?: string
          qty?: number
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_account_id: string | null
          id: string
          method: string
          organization_id: string
          purchase_id: string
          reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          method: string
          organization_id: string
          purchase_id: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          method?: string
          organization_id?: string
          purchase_id?: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "purchase_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          condition: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          line_total: number
          organization_id: string
          purchase_item_id: string | null
          purchase_return_id: string
          qty: number
          unit_cost: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_total: number
          organization_id: string
          purchase_item_id?: string | null
          purchase_return_id: string
          qty: number
          unit_cost: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_total?: number
          organization_id?: string
          purchase_item_id?: string | null
          purchase_return_id?: string
          qty?: number
          unit_cost?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_purchase_return_id_fkey"
            columns: ["purchase_return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          branch_id: string
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          purchase_id: string
          reason: string | null
          return_no: string
          status: string
          supplier_id: string
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          purchase_id: string
          reason?: string | null
          return_no: string
          status?: string
          supplier_id: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          purchase_id?: string
          reason?: string | null
          return_no?: string
          status?: string
          supplier_id?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchase_returns_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          branch_id: string
          client_txn_key: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount: number
          due_date: string | null
          due_total: number
          grand_total: number
          id: string
          invoice_no: string
          note: string | null
          organization_id: string
          paid_total: number
          payment_status: string
          shipping: number
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          client_txn_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount?: number
          due_date?: string | null
          due_total?: number
          grand_total?: number
          id?: string
          invoice_no: string
          note?: string | null
          organization_id: string
          paid_total?: number
          payment_status?: string
          shipping?: number
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          client_txn_key?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount?: number
          due_date?: string | null
          due_total?: number
          grand_total?: number
          id?: string
          invoice_no?: string
          note?: string | null
          organization_id?: string
          paid_total?: number
          payment_status?: string
          shipping?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchases_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_batches: {
        Row: {
          batch_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          mode: string
          organization_id: string
          started_at: string
          status: string
          summary: Json
          updated_at: string
        }
        Insert: {
          batch_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mode: string
          organization_id: string
          started_at?: string
          status?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          batch_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mode?: string
          organization_id?: string
          started_at?: string
          status?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_results: {
        Row: {
          after_value: Json | null
          batch_id: string
          before_value: Json | null
          check_key: string
          created_at: string
          difference: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          organization_id: string
        }
        Insert: {
          after_value?: Json | null
          batch_id: string
          before_value?: Json | null
          check_key: string
          created_at?: string
          difference?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id: string
        }
        Update: {
          after_value?: Json | null
          batch_id?: string
          before_value?: Json | null
          check_key?: string
          created_at?: string
          difference?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          permission_id: string
          role_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          permission_id: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structure_components: {
        Row: {
          amount: number
          code: string
          component_type: string
          created_at: string
          deleted_at: string | null
          formula: string | null
          id: string
          is_recurring: boolean
          is_taxable: boolean
          name: string
          organization_id: string
          salary_structure_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          code: string
          component_type: string
          created_at?: string
          deleted_at?: string | null
          formula?: string | null
          id?: string
          is_recurring?: boolean
          is_taxable?: boolean
          name: string
          organization_id: string
          salary_structure_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          code?: string
          component_type?: string
          created_at?: string
          deleted_at?: string | null
          formula?: string | null
          id?: string
          is_recurring?: boolean
          is_taxable?: boolean
          name?: string
          organization_id?: string
          salary_structure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structure_components_salary_structure_id_fkey"
            columns: ["salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          basic_salary: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          salary_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          organization_id: string
          salary_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          salary_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structures_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_approvals: {
        Row: {
          approval_type: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          reason: string | null
          requested_by: string | null
          sale_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_type: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          requested_by?: string | null
          sale_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_type?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          requested_by?: string | null
          sale_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_approvals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_approvals_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_approvals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_discounts: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_type: string
          id: string
          organization_id: string
          percent: number | null
          reason: string | null
          sale_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_type?: string
          id?: string
          organization_id: string
          percent?: number | null
          reason?: string | null
          sale_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_type?: string
          id?: string
          organization_id?: string
          percent?: number | null
          reason?: string | null
          sale_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_discounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_discounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_discounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_discounts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_discounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_batches: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          organization_id: string
          quantity: number
          sale_id: string
          sale_item_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          organization_id: string
          quantity: number
          sale_id: string
          sale_item_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          quantity?: number
          sale_id?: string
          sale_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_batches_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_batches_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          contributor_employee_id: string | null
          contributor_profile_id: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          line_discount: number
          line_origin: string | null
          line_total: number
          organization_id: string
          parent_sale_item_id: string | null
          qty: number
          sale_id: string
          unit_price: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          batch_id?: string | null
          contributor_employee_id?: string | null
          contributor_profile_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_discount?: number
          line_origin?: string | null
          line_total: number
          organization_id: string
          parent_sale_item_id?: string | null
          qty: number
          sale_id: string
          unit_price: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          batch_id?: string | null
          contributor_employee_id?: string | null
          contributor_profile_id?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_discount?: number
          line_origin?: string | null
          line_total?: number
          organization_id?: string
          parent_sale_item_id?: string | null
          qty?: number
          sale_id?: string
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_contributor_employee_id_fkey"
            columns: ["contributor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_contributor_profile_id_fkey"
            columns: ["contributor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_parent_sale_item_id_fkey"
            columns: ["parent_sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_account_id: string | null
          id: string
          method: string
          organization_id: string
          reference: string | null
          reversal_note: string | null
          reversed_at: string | null
          sale_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          method: string
          organization_id: string
          reference?: string | null
          reversal_note?: string | null
          reversed_at?: string | null
          sale_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_account_id?: string | null
          id?: string
          method?: string
          organization_id?: string
          reference?: string | null
          reversal_note?: string | null
          reversed_at?: string | null
          sale_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "sale_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          condition: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          line_total: number
          organization_id: string
          qty: number
          sale_item_id: string | null
          sale_return_id: string
          unit_price: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_total: number
          organization_id: string
          qty: number
          sale_item_id?: string | null
          sale_return_id: string
          unit_price: number
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          line_total?: number
          organization_id?: string
          qty?: number
          sale_item_id?: string | null
          sale_return_id?: string
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_return_id_fkey"
            columns: ["sale_return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          client_txn_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          reason: string | null
          return_no: string
          sale_id: string
          status: string
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          return_no: string
          sale_id: string
          status?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          client_txn_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          return_no?: string
          sale_id?: string
          status?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_versions: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          reason: string | null
          sale_id: string
          snapshot: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          sale_id: string
          snapshot: Json
          updated_at?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          sale_id?: string
          snapshot?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_versions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_versions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          change_amount: number
          channel: string | null
          client_txn_key: string | null
          completed_at: string | null
          corrected_from_id: string | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          delivery_address: string | null
          delivery_area: string | null
          delivery_district: string | null
          discount: number
          due_date: string | null
          due_total: number
          fulfilled_by: string | null
          fulfilled_sale_posted_at: string | null
          fulfilment_status: string | null
          grand_total: number
          id: string
          invoice_no: string
          moderator_id: string | null
          note: string | null
          order_source: string | null
          organization_id: string
          paid_total: number
          payment_status: string
          previous_sale_id: string | null
          public_share_token: string | null
          reservation_expires_at: string | null
          salesperson_employee_id: string | null
          salesperson_id: string | null
          shipping: number
          status: string
          subtotal: number
          tax: number
          tele_salesman_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          change_amount?: number
          channel?: string | null
          client_txn_key?: string | null
          completed_at?: string | null
          corrected_from_id?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_district?: string | null
          discount?: number
          due_date?: string | null
          due_total?: number
          fulfilled_by?: string | null
          fulfilled_sale_posted_at?: string | null
          fulfilment_status?: string | null
          grand_total?: number
          id?: string
          invoice_no: string
          moderator_id?: string | null
          note?: string | null
          order_source?: string | null
          organization_id: string
          paid_total?: number
          payment_status?: string
          previous_sale_id?: string | null
          public_share_token?: string | null
          reservation_expires_at?: string | null
          salesperson_employee_id?: string | null
          salesperson_id?: string | null
          shipping?: number
          status?: string
          subtotal?: number
          tax?: number
          tele_salesman_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          change_amount?: number
          channel?: string | null
          client_txn_key?: string | null
          completed_at?: string | null
          corrected_from_id?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_area?: string | null
          delivery_district?: string | null
          discount?: number
          due_date?: string | null
          due_total?: number
          fulfilled_by?: string | null
          fulfilled_sale_posted_at?: string | null
          fulfilment_status?: string | null
          grand_total?: number
          id?: string
          invoice_no?: string
          moderator_id?: string | null
          note?: string | null
          order_source?: string | null
          organization_id?: string
          paid_total?: number
          payment_status?: string
          previous_sale_id?: string | null
          public_share_token?: string | null
          reservation_expires_at?: string | null
          salesperson_employee_id?: string | null
          salesperson_id?: string | null
          shipping?: number
          status?: string
          subtotal?: number
          tax?: number
          tele_salesman_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_corrected_from_id_fkey"
            columns: ["corrected_from_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_previous_sale_id_fkey"
            columns: ["previous_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_salesperson_employee_id_fkey"
            columns: ["salesperson_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tele_salesman_id_fkey"
            columns: ["tele_salesman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salesman_commission_rules: {
        Row: {
          applies_to_sources: string[]
          base_metric: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          period_unit: string
          profile_id: string | null
          rate: number
          rule_type: string
          structure_mode: string
          subject_type: string
          tiers: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to_sources?: string[]
          base_metric?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          period_unit?: string
          profile_id?: string | null
          rate?: number
          rule_type?: string
          structure_mode?: string
          subject_type?: string
          tiers?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to_sources?: string[]
          base_metric?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          period_unit?: string
          profile_id?: string | null
          rate?: number
          rule_type?: string
          structure_mode?: string
          subject_type?: string
          tiers?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salesman_commission_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commission_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commission_rules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commission_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commission_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commission_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salesman_commissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          branch_id: string | null
          client_txn_key: string | null
          cogs_amount: number
          commission_amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string | null
          event_type: string
          financial_account_id: string | null
          id: string
          needs_employee_link: boolean
          notes: string | null
          organization_id: string
          original_commission_amount: number | null
          paid_at: string | null
          product_id: string | null
          product_name: string | null
          profile_id: string | null
          qty: number | null
          recoverable_amount: number
          reversed_amount: number
          rule_snapshot: Json | null
          sale_id: string | null
          sale_item_id: string | null
          sale_return_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          branch_id?: string | null
          client_txn_key?: string | null
          cogs_amount?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          event_type?: string
          financial_account_id?: string | null
          id?: string
          needs_employee_link?: boolean
          notes?: string | null
          organization_id: string
          original_commission_amount?: number | null
          paid_at?: string | null
          product_id?: string | null
          product_name?: string | null
          profile_id?: string | null
          qty?: number | null
          recoverable_amount?: number
          reversed_amount?: number
          rule_snapshot?: Json | null
          sale_id?: string | null
          sale_item_id?: string | null
          sale_return_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          branch_id?: string | null
          client_txn_key?: string | null
          cogs_amount?: number
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          event_type?: string
          financial_account_id?: string | null
          id?: string
          needs_employee_link?: boolean
          notes?: string | null
          organization_id?: string
          original_commission_amount?: number | null
          paid_at?: string | null
          product_id?: string | null
          product_name?: string | null
          profile_id?: string | null
          qty?: number | null
          recoverable_amount?: number
          reversed_amount?: number
          rule_snapshot?: Json | null
          sale_id?: string | null
          sale_item_id?: string | null
          sale_return_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salesman_commissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "v_recon_financial_running_balance"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "salesman_commissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_sale_return_id_fkey"
            columns: ["sale_return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salesman_commissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_follow_ups: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          follow_up_at: string
          id: string
          note: string | null
          organization_id: string
          priority: string
          sale_id: string | null
          staff_user_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          follow_up_at: string
          id?: string
          note?: string | null
          organization_id: string
          priority?: string
          sale_id?: string | null
          staff_user_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          follow_up_at?: string
          id?: string
          note?: string | null
          organization_id?: string
          priority?: string
          sale_id?: string | null
          staff_user_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_recon_customer_due_vs_sales"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "staff_follow_ups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_follow_ups_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_follow_ups_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_follow_ups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_targets: {
        Row: {
          branch_id: string | null
          collection_amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends_at: string
          id: string
          new_customers: number
          note: string | null
          order_count: number
          organization_id: string
          sales_amount: number
          staff_user_id: string
          starts_at: string
          status: string
          target_period: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          collection_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at: string
          id?: string
          new_customers?: number
          note?: string | null
          order_count?: number
          organization_id: string
          sales_amount?: number
          staff_user_id: string
          starts_at: string
          status?: string
          target_period: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          collection_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at?: string
          id?: string
          new_customers?: number
          note?: string | null
          order_count?: number
          organization_id?: string
          sales_amount?: number
          staff_user_id?: string
          starts_at?: string
          status?: string
          target_period?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_targets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_targets_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_targets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_items: {
        Row: {
          adjustment_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          quantity_before: number
          quantity_counted: number
          quantity_delta: number
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          adjustment_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          quantity_before?: number
          quantity_counted: number
          quantity_delta: number
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          adjustment_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quantity_before?: number
          quantity_counted?: number
          quantity_delta?: number
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_no: string
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          location_id: string
          notes: string | null
          organization_id: string
          posted_at: string | null
          reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_no: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_id: string
          notes?: string | null
          organization_id: string
          posted_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_no?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          organization_id?: string
          posted_at?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          idempotency_key: string | null
          location_id: string
          movement_type: string
          notes: string | null
          occurred_at: string
          organization_id: string
          quantity_after: number
          quantity_before: number
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          total_cost: number | null
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          idempotency_key?: string | null
          location_id: string
          movement_type: string
          notes?: string | null
          occurred_at?: string
          organization_id: string
          quantity_after: number
          quantity_before: number
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          idempotency_key?: string | null
          location_id?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          quantity_after?: number
          quantity_before?: number
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          location_type: string
          name: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_type: string
          name: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_type?: string
          name?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          organization_id: string
          quantity_damaged: number
          quantity_received: number | null
          quantity_sent: number
          transfer_id: string
          unit_cost: number | null
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          quantity_damaged?: number
          quantity_received?: number | null
          quantity_sent: number
          transfer_id: string
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quantity_damaged?: number
          quantity_received?: number | null
          quantity_sent?: number
          transfer_id?: string
          unit_cost?: number | null
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_branch_id: string
          from_location_id: string
          id: string
          notes: string | null
          organization_id: string
          received_at: string | null
          shipped_at: string | null
          status: string
          to_branch_id: string
          to_location_id: string
          transfer_no: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_branch_id: string
          from_location_id: string
          id?: string
          notes?: string | null
          organization_id: string
          received_at?: string | null
          shipped_at?: string | null
          status?: string
          to_branch_id: string
          to_location_id: string
          transfer_no: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_branch_id?: string
          from_location_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          received_at?: string | null
          shipped_at?: string | null
          status?: string
          to_branch_id?: string
          to_location_id?: string
          transfer_no?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          organization_id: string
          show_in_menu: boolean
          slug: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          show_in_menu?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          show_in_menu?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_addresses: {
        Row: {
          address: string
          area: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district: string | null
          id: string
          is_default: boolean
          label: string
          organization_id: string
          phone: string | null
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address: string
          area?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          organization_id: string
          phone?: string | null
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          area?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string
          phone?: string | null
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_addresses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_addresses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_addresses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_addresses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          doc_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          organization_id: string
          storage_path: string | null
          supplier_id: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doc_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id: string
          storage_path?: string | null
          supplier_id: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          doc_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          storage_path?: string | null
          supplier_id?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_ledger: {
        Row: {
          balance_after: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          deleted_at: string | null
          entry_type: string
          id: string
          notes: string | null
          occurred_at: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          balance_after: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          deleted_at?: string | null
          entry_type: string
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          balance_after?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          deleted_at?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_ledger_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_rating_summaries: {
        Row: {
          branch_id: string | null
          computed_at: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          factors: Json
          id: string
          organization_id: string
          rating_status: string
          score: number | null
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          factors?: Json
          id?: string
          organization_id: string
          rating_status?: string
          score?: number | null
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          factors?: Json
          id?: string
          organization_id?: string
          rating_status?: string
          score?: number | null
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_rating_summaries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_rating_summaries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_rating_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_rating_summaries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_rating_summaries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_recon_supplier_due_vs_purchases"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_rating_summaries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          barcode: string | null
          branch_id: string | null
          business_type: string | null
          code: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          current_due: number
          deleted_at: string | null
          email: string | null
          established_year: number | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          payment_terms_days: number | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
          vat_reg_no: string | null
        }
        Insert: {
          address?: string | null
          barcode?: string | null
          branch_id?: string | null
          business_type?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_due?: number
          deleted_at?: string | null
          email?: string | null
          established_year?: number | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          payment_terms_days?: number | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vat_reg_no?: string | null
        }
        Update: {
          address?: string | null
          barcode?: string | null
          branch_id?: string | null
          business_type?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_due?: number
          deleted_at?: string | null
          email?: string | null
          established_year?: number | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          payment_terms_days?: number | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vat_reg_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_option_values: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          option_id: string
          option_value_id: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          option_id: string
          option_value_id: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          option_id?: string
          option_value_id?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_option_values_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      website_hero_slides: {
        Row: {
          coupon_code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          desktop_image_path: string
          discount_text: string | null
          ends_at: string | null
          eyebrow: string | null
          floating_badges: Json
          heading: string
          highlight_text: string | null
          id: string
          image_alt: string | null
          image_focal_x: number | null
          image_focal_y: number | null
          image_object_position: string
          internal_name: string
          layout_direction: string
          mobile_image_path: string | null
          offer_subtitle: string | null
          offer_title: string | null
          organization_id: string
          overlay_opacity: number
          primary_cta_config: Json
          primary_cta_label: string
          primary_cta_new_tab: boolean
          primary_cta_type: string
          primary_cta_url: string | null
          secondary_cta_config: Json
          secondary_cta_enabled: boolean
          secondary_cta_label: string | null
          secondary_cta_new_tab: boolean
          secondary_cta_type: string | null
          secondary_cta_url: string | null
          show_floating_badges: boolean
          show_trending_products: boolean
          show_trust_points: boolean
          sort_order: number
          starts_at: string | null
          status: string
          tablet_image_path: string | null
          text_alignment: string
          theme_variant: string
          trust_points: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          desktop_image_path?: string
          discount_text?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          floating_badges?: Json
          heading: string
          highlight_text?: string | null
          id?: string
          image_alt?: string | null
          image_focal_x?: number | null
          image_focal_y?: number | null
          image_object_position?: string
          internal_name: string
          layout_direction?: string
          mobile_image_path?: string | null
          offer_subtitle?: string | null
          offer_title?: string | null
          organization_id: string
          overlay_opacity?: number
          primary_cta_config?: Json
          primary_cta_label?: string
          primary_cta_new_tab?: boolean
          primary_cta_type?: string
          primary_cta_url?: string | null
          secondary_cta_config?: Json
          secondary_cta_enabled?: boolean
          secondary_cta_label?: string | null
          secondary_cta_new_tab?: boolean
          secondary_cta_type?: string | null
          secondary_cta_url?: string | null
          show_floating_badges?: boolean
          show_trending_products?: boolean
          show_trust_points?: boolean
          sort_order?: number
          starts_at?: string | null
          status?: string
          tablet_image_path?: string | null
          text_alignment?: string
          theme_variant?: string
          trust_points?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          desktop_image_path?: string
          discount_text?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          floating_badges?: Json
          heading?: string
          highlight_text?: string | null
          id?: string
          image_alt?: string | null
          image_focal_x?: number | null
          image_focal_y?: number | null
          image_object_position?: string
          internal_name?: string
          layout_direction?: string
          mobile_image_path?: string | null
          offer_subtitle?: string | null
          offer_title?: string | null
          organization_id?: string
          overlay_opacity?: number
          primary_cta_config?: Json
          primary_cta_label?: string
          primary_cta_new_tab?: boolean
          primary_cta_type?: string
          primary_cta_url?: string | null
          secondary_cta_config?: Json
          secondary_cta_enabled?: boolean
          secondary_cta_label?: string | null
          secondary_cta_new_tab?: boolean
          secondary_cta_type?: string | null
          secondary_cta_url?: string | null
          show_floating_badges?: boolean
          show_trending_products?: boolean
          show_trust_points?: boolean
          sort_order?: number
          starts_at?: string | null
          status?: string
          tablet_image_path?: string | null
          text_alignment?: string
          theme_variant?: string
          trust_points?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_hero_slides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_hero_slides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_hero_slides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          branch_id: string | null
          check_in_closes_minutes_after: number
          check_in_opens_minutes_before: number
          check_out_closes_minutes_after: number
          check_out_opens_minutes_before: number
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          early_leave_grace_minutes: number
          end_time: string
          id: string
          is_active: boolean
          is_overnight: boolean
          late_until_minutes: number
          name: string
          on_time_until_minutes: number
          organization_id: string
          overtime_after_minutes: number
          start_time: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          check_in_closes_minutes_after?: number
          check_in_opens_minutes_before?: number
          check_out_closes_minutes_after?: number
          check_out_opens_minutes_before?: number
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          early_leave_grace_minutes?: number
          end_time: string
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          late_until_minutes?: number
          name: string
          on_time_until_minutes?: number
          organization_id: string
          overtime_after_minutes?: number
          start_time: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          check_in_closes_minutes_after?: number
          check_in_opens_minutes_before?: number
          check_out_closes_minutes_after?: number
          check_out_opens_minutes_before?: number
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          early_leave_grace_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          late_until_minutes?: number
          name?: string
          on_time_until_minutes?: number
          organization_id?: string
          overtime_after_minutes?: number
          start_time?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_shifts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_inventory_valuation_balances: {
        Row: {
          available_quantity: number | null
          average_unit_cost: number | null
          balance_id: string | null
          barcode: string | null
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          cost_is_fallback: boolean | null
          is_head_office: boolean | null
          location_id: string | null
          location_name: string | null
          location_type: string | null
          organization_id: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          product_reorder_level: number | null
          product_type: string | null
          qty_reserved: number | null
          quantity: number | null
          sku: string | null
          track_inventory: boolean | null
          variant_id: string | null
          variant_name: string | null
          variant_selling_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_courier_cod_pending: {
        Row: {
          cod_amount: number | null
          cod_journal_posted: boolean | null
          organization_id: string | null
          parcel_id: string | null
          settlement_id: string | null
          settlement_status: string | null
          tracking_no: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_parcels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_customer_due_vs_sales: {
        Row: {
          customer_due: number | null
          customer_id: string | null
          delta: number | null
          name: string | null
          open_sale_due: number | null
          opening_balance_due: number | null
          organization_id: string | null
        }
        Insert: {
          customer_due?: number | null
          customer_id?: string | null
          delta?: never
          name?: string | null
          open_sale_due?: never
          opening_balance_due?: never
          organization_id?: string | null
        }
        Update: {
          customer_due?: number | null
          customer_id?: string | null
          delta?: never
          name?: string | null
          open_sale_due?: never
          opening_balance_due?: never
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_financial_running_balance: {
        Row: {
          account_id: string | null
          current_balance: number | null
          delta: number | null
          last_txn_balance_after: number | null
          name: string | null
          organization_id: string | null
        }
        Insert: {
          account_id?: string | null
          current_balance?: number | null
          delta?: never
          last_txn_balance_after?: never
          name?: string | null
          organization_id?: string | null
        }
        Update: {
          account_id?: string | null
          current_balance?: number | null
          delta?: never
          last_txn_balance_after?: never
          name?: string | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_inventory_ledger_qty: {
        Row: {
          balance_qty: number | null
          delta: number | null
          ledger_net_qty: number | null
          location_id: string | null
          organization_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_inventory_without_ledger: {
        Row: {
          branch_id: string | null
          inventory_balance_id: string | null
          location_id: string | null
          organization_id: string | null
          qty_reserved: number | null
          quantity: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_supplier_due_vs_purchases: {
        Row: {
          delta: number | null
          name: string | null
          open_purchase_due: number | null
          opening_balance_due: number | null
          organization_id: string | null
          supplier_due: number | null
          supplier_id: string | null
        }
        Insert: {
          delta?: never
          name?: string | null
          open_purchase_due?: never
          opening_balance_due?: never
          organization_id?: string | null
          supplier_due?: number | null
          supplier_id?: string | null
        }
        Update: {
          delta?: never
          name?: string | null
          open_purchase_due?: never
          opening_balance_due?: never
          organization_id?: string | null
          supplier_due?: number | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recon_unbalanced_journals: {
        Row: {
          delta: number | null
          entry_no: string | null
          journal_entry_id: string | null
          organization_id: string | null
          source_id: string | null
          source_type: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _accrue_contributor_commission: {
        Args: {
          p_base_amount: number
          p_cogs_amount: number
          p_employee_id: string
          p_profile_id: string
          p_sale: Database["public"]["Tables"]["sales"]["Row"]
          p_source: string
        }
        Returns: string
      }
      _accrue_contributor_commission_keyed: {
        Args: {
          p_base_amount: number
          p_client_txn_key: string
          p_cogs_amount: number
          p_employee_id: string
          p_extra_snapshot?: Json
          p_profile_id: string
          p_sale: Database["public"]["Tables"]["sales"]["Row"]
          p_source: string
        }
        Returns: string
      }
      _accrue_exchange_replacement_commission: {
        Args: { p_actor: string; p_exchange_id: string }
        Returns: string
      }
      _accrue_sale_commission: { Args: { p_sale_id: string }; Returns: string }
      _actor_is_owner_or_super_admin: { Args: never; Returns: boolean }
      _adjust_inventory: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_idempotency_key?: string
          p_location_id: string
          p_movement_type: string
          p_notes?: string
          p_org_id: string
          p_qty_delta: number
          p_reference_id: string
          p_reference_type: string
          p_unit_cost: number
          p_variant_id: string
        }
        Returns: undefined
      }
      _allocate_customer_collection: {
        Args: {
          p_actor: string
          p_allocations?: Json
          p_amount: number
          p_branch_id: string
          p_collection_id: string
          p_customer_id: string
          p_org_id: string
        }
        Returns: number
      }
      _allocate_supplier_payment: {
        Args: {
          p_actor: string
          p_allocations?: Json
          p_amount: number
          p_branch_id: string
          p_org_id: string
          p_payment_id: string
          p_purchase_id?: string
          p_supplier_id: string
        }
        Returns: number
      }
      _append_attributed_online_lines: {
        Args: {
          p_actor: string
          p_items: Json
          p_line_origin: string
          p_org_id: string
          p_parent_sale_item_id?: string
          p_sale: Database["public"]["Tables"]["sales"]["Row"]
        }
        Returns: number
      }
      _apply_contributor_commission_reversals: {
        Args: {
          p_actor?: string
          p_contributor_bases: Json
          p_fallback_total?: number
          p_marker_prefix: string
          p_sale_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: undefined
      }
      _apply_courier_cod_accounting: {
        Args: { p_actor?: string; p_parcel_id: string }
        Returns: Json
      }
      _apply_customer_balance_from_net: {
        Args: {
          p_actor: string
          p_customer_id: string
          p_signed_net: number
          p_total_paid_delta?: number
          p_total_spent_delta?: number
        }
        Returns: number
      }
      _apply_customer_sale_canonical_ledger: {
        Args: { p_actor: string; p_backfill?: boolean; p_sale_id: string }
        Returns: undefined
      }
      _apply_exchange_commission_effects: {
        Args: { p_actor: string; p_exchange_id: string }
        Returns: undefined
      }
      _apply_supplier_purchase_canonical_ledger: {
        Args: { p_actor: string; p_backfill?: boolean; p_purchase_id: string }
        Returns: undefined
      }
      _assert_assignable_permission_keys: {
        Args: { p_permission_keys: string[] }
        Returns: undefined
      }
      _assert_sale_period_open: {
        Args: { p_org_id: string; p_sale_date: string }
        Returns: undefined
      }
      _attendance_hmac_hex: {
        Args: { p_message: string; p_secret_key: string }
        Returns: string
      }
      _attendance_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_org_id: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      _attendance_secret: { Args: { p_key: string }; Returns: string }
      _attendance_work_date: {
        Args: {
          p_server_now: string
          p_shift: Database["public"]["Tables"]["work_shifts"]["Row"]
        }
        Returns: string
      }
      _auth_ctx: { Args: never; Returns: Record<string, unknown> }
      _calc_tier_commission: {
        Args: {
          p_base_metric: string
          p_profit: number
          p_sale_total: number
          p_tier: Json
        }
        Returns: number
      }
      _coa_by_role: {
        Args: { p_org_id: string; p_role: string }
        Returns: string
      }
      _commission_is_fixed_per_sale: {
        Args: { p_snapshot: Json }
        Returns: boolean
      }
      _complete_pos_sale_core: { Args: { payload: Json }; Returns: Json }
      _complete_purchase_core: { Args: { payload: Json }; Returns: Json }
      _data_reset_lock: { Args: { p_org: string }; Returns: undefined }
      _employee_active_shift: {
        Args: { p_employee_id: string; p_work_date: string }
        Returns: {
          branch_id: string | null
          check_in_closes_minutes_after: number
          check_in_opens_minutes_before: number
          check_out_closes_minutes_after: number
          check_out_opens_minutes_before: number
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          early_leave_grace_minutes: number
          end_time: string
          id: string
          is_active: boolean
          is_overnight: boolean
          late_until_minutes: number
          name: string
          on_time_until_minutes: number
          organization_id: string
          overtime_after_minutes: number
          start_time: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "work_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _ensure_inventory_balance: {
        Args: {
          p_actor: string
          p_location_id: string
          p_org_id: string
          p_variant_id: string
        }
        Returns: {
          average_unit_cost: number
          cost_is_fallback: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          location_id: string
          organization_id: string
          qty_reserved: number
          quantity: number
          updated_at: string
          updated_by: string | null
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _erp_acceptance_report_base: { Args: never; Returns: Json }
      _erp_assert: {
        Args: { p_condition: boolean; p_message: string }
        Returns: undefined
      }
      _erp_qa_cleanup_tracking: {
        Args: { p_tracking_prefix: string }
        Returns: undefined
      }
      _erp_qa_context: { Args: never; Returns: Json }
      _erp_qa_extended_scenarios: { Args: never; Returns: Json }
      _erp_qa_finalize_concurrent_transfer_probe: {
        Args: { p_transfer_id: string }
        Returns: Json
      }
      _erp_qa_prepare_concurrent_transfer: { Args: never; Returns: Json }
      _erp_qa_receive_transfer_probe: { Args: { payload: Json }; Returns: Json }
      _erp_qa_reconcile_sandbox: { Args: never; Returns: Json }
      _erp_qa_require_service: { Args: never; Returns: undefined }
      _erp_qa_set_sandbox_auth: { Args: never; Returns: undefined }
      _erp_security_probe_branch_isolation: { Args: never; Returns: Json }
      _erp_security_probe_parcel_status: { Args: never; Returns: Json }
      _erp_test_set_auth: { Args: { p_user_id: string }; Returns: undefined }
      _haversine_metres: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      _import_entity_permission: { Args: { p_entity: string }; Returns: string }
      _inventory_in_transit_qty: {
        Args: { p_branch_id?: string; p_org: string; p_variant_id: string }
        Returns: number
      }
      _inventory_search_matches: {
        Args: {
          p_barcode: string
          p_org: string
          p_product_code: string
          p_product_name: string
          p_search: string
          p_sku: string
          p_variant_id: string
        }
        Returns: boolean
      }
      _inventory_source_apply_delta: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_event_type: string
          p_idempotency_key?: string
          p_location_id: string
          p_org_id: string
          p_qty_delta: number
          p_receipt_source_id: string
          p_stock_ledger_id: string
          p_variant_id: string
        }
        Returns: undefined
      }
      _inventory_source_consume_fifo: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_event_type: string
          p_idempotency_prefix?: string
          p_location_id: string
          p_org_id: string
          p_qty: number
          p_stock_ledger_id: string
          p_variant_id: string
        }
        Returns: undefined
      }
      _inventory_source_ensure_unknown: {
        Args: {
          p_actor?: string
          p_branch_id: string
          p_location_id: string
          p_org_id: string
          p_variant_id: string
        }
        Returns: string
      }
      _inventory_source_move_fifo: {
        Args: {
          p_actor: string
          p_from_branch: string
          p_from_location: string
          p_idempotency_prefix: string
          p_org_id: string
          p_qty: number
          p_stock_ledger_id: string
          p_to_branch: string
          p_to_location: string
          p_variant_id: string
        }
        Returns: undefined
      }
      _inventory_source_receive: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_idempotency_key?: string
          p_location_id: string
          p_org_id: string
          p_product_id: string
          p_purchase_id: string
          p_purchase_item_id: string
          p_qty: number
          p_received_at: string
          p_source_type?: string
          p_stock_ledger_id: string
          p_supplier_id: string
          p_traceability?: string
          p_unit_cost: number
          p_variant_id: string
        }
        Returns: string
      }
      _inventory_source_reconcile_check: {
        Args: { p_org_id?: string }
        Returns: {
          attributed_qty: number
          balance_qty: number
          delta: number
          location_id: string
          variant_id: string
        }[]
      }
      _inventory_source_restore_sale_return: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_location_id: string
          p_org_id: string
          p_qty: number
          p_stock_ledger_id: string
          p_variant_id: string
        }
        Returns: undefined
      }
      _inventory_stock_status: {
        Args: { p_available: number; p_reorder: number }
        Returns: string
      }
      _link_sale_commission_employees: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      _location_by_type: {
        Args: { p_branch_id: string; p_org_id: string; p_type: string }
        Returns: string
      }
      _maybe_refresh_customer_rating: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      _mobile_attendance_employee: {
        Args: never
        Returns: {
          allowances: Json
          bank_details: Json
          basic_salary: number
          branch_id: string | null
          commission_eligible: boolean
          commission_payment_mode: string
          created_at: string
          created_by: string | null
          default_sales_branch_id: string | null
          deleted_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          emergency_contact: Json
          employee_code: string
          employment_type: string
          full_name: string
          id: string
          include_commission_in_payroll: boolean
          joining_date: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          photo_path: string | null
          profile_id: string | null
          salary_type: string
          shift_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "employees"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _normalize_money_payments: { Args: { payload: Json }; Returns: Json }
      _payment_method_is_due: {
        Args: { p_method: string; p_org_id: string }
        Returns: boolean
      }
      _payroll_scheduled_days: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      _pick_commission_tier: {
        Args: { p_amount: number; p_tiers: Json }
        Returns: Json
      }
      _post_customer_ledger_entry: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_credit: number
          p_customer_id: string
          p_debit: number
          p_entry_type: string
          p_notes: string
          p_org_id: string
          p_reference_id: string
          p_reference_type: string
          p_skip_party_update?: boolean
          p_total_paid_delta?: number
          p_total_spent_delta?: number
        }
        Returns: number
      }
      _post_financial_txn: {
        Args: {
          p_account_id: string
          p_amount: number
          p_apply_balance?: boolean
          p_branch_id: string
          p_created_by: string
          p_direction: string
          p_note: string
          p_organization_id: string
          p_reference: string
          p_source_id: string
          p_source_type: string
          p_transaction_type: string
        }
        Returns: string
      }
      _post_journal: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_entry_no: string
          p_lines: Json
          p_memo: string
          p_org_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      _post_supplier_ledger_entry: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_credit: number
          p_debit: number
          p_entry_type: string
          p_notes: string
          p_org_id: string
          p_reference_id: string
          p_reference_type: string
          p_skip_party_update?: boolean
          p_supplier_id: string
        }
        Returns: number
      }
      _rating_clamp: { Args: { p_value: number }; Returns: number }
      _rating_factor_from_ratio: { Args: { p_ratio: number }; Returns: number }
      _recompute_online_sale_totals: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      _recon_add_result: {
        Args: {
          p_after: Json
          p_batch_id: string
          p_before: Json
          p_check_key: string
          p_difference?: Json
          p_entity_id: string
          p_entity_type: string
          p_message: string
          p_org_id: string
        }
        Returns: undefined
      }
      _recon_finish_batch: {
        Args: { p_batch_id: string; p_ok: boolean; p_summary: Json }
        Returns: undefined
      }
      _recon_start_batch: {
        Args: {
          p_actor: string
          p_batch_type: string
          p_mode: string
          p_org_id: string
        }
        Returns: string
      }
      _record_commission_attribution_exception: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      _release_sale_reservations: {
        Args: {
          p_actor: string
          p_new_status?: string
          p_org_id: string
          p_sale_id: string
        }
        Returns: number
      }
      _reserve_inventory: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_client_txn_key: string
          p_expires_at: string
          p_location_id: string
          p_org_id: string
          p_qty: number
          p_sale_id: string
          p_sale_item_id: string
          p_variant_id: string
        }
        Returns: string
      }
      _resolve_employee_for_profile: {
        Args: { p_profile_id: string }
        Returns: string
      }
      _resolve_pos_salesperson: {
        Args: { p_branch_id: string; p_payload: Json }
        Returns: {
          employee_id: string
          profile_id: string
        }[]
      }
      _resolve_profile_for_employee: {
        Args: { p_employee_id: string }
        Returns: string
      }
      _reverse_commissions_for_exchange: {
        Args: { p_exchange_id: string }
        Returns: undefined
      }
      _reverse_courier_cod_accounting: {
        Args: { p_actor?: string; p_parcel_id: string; p_reason?: string }
        Returns: Json
      }
      _reverse_customer_sale_canonical_ledger: {
        Args: { p_actor: string; p_reason: string; p_sale_id: string }
        Returns: undefined
      }
      _reverse_journal_for_source: {
        Args: {
          p_actor: string
          p_branch_id: string
          p_memo: string
          p_org_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      _reverse_remaining_sale_commissions: {
        Args: {
          p_actor?: string
          p_reason?: string
          p_sale_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: number
      }
      _reverse_sale_commissions: {
        Args: { p_return_id: string; p_return_total: number; p_sale_id: string }
        Returns: undefined
      }
      _sale_category_summary: { Args: { p_sale_id: string }; Returns: Json }
      _saleable_location: {
        Args: { p_branch_id: string; p_org_id: string }
        Returns: string
      }
      _sales_history_match_ids: {
        Args: { p_filters: Json }
        Returns: {
          sale_id: string
        }[]
      }
      _sync_customer_ledger_totals: {
        Args: { p_customer_id?: string }
        Returns: undefined
      }
      _sync_role_permission_keys: {
        Args: {
          p_actor_id: string
          p_permission_keys: string[]
          p_role_id: string
        }
        Returns: undefined
      }
      _sync_supplier_ledger_totals: {
        Args: { p_supplier_id?: string }
        Returns: undefined
      }
      _undo_exchange_commission_effects: {
        Args: { p_actor: string; p_exchange_id: string }
        Returns: undefined
      }
      _user_can_view_inventory_cost: { Args: never; Returns: boolean }
      _validate_commission_tiers: { Args: { p_tiers: Json }; Returns: Json }
      _void_sale_financial_transactions: {
        Args: { p_actor: string; p_reason: string; p_sale_id: string }
        Returns: number
      }
      adjust_financial_account_balance: {
        Args: { p_account_id: string; p_delta: number }
        Returns: number
      }
      allocate_document_reference: {
        Args: { p_organization_id: string; p_pad?: number; p_prefix: string }
        Returns: string
      }
      allocate_internal_barcode: {
        Args: { p_product_id?: string; p_variant_id?: string }
        Returns: string
      }
      amend_staff_online_order: { Args: { payload: Json }; Returns: Json }
      apply_courier_webhook_parcel_status: {
        Args: {
          p_external_event_id?: string
          p_notes?: string
          p_parcel_id: string
          p_status: string
        }
        Returns: Json
      }
      apply_organization_reconciliation_backfill: {
        Args: { p_org_id: string }
        Returns: Json
      }
      approve_attendance_device: { Args: { payload: Json }; Returns: Json }
      approve_courier_return: {
        Args: { items: Json; request_id: string }
        Returns: Json
      }
      approve_employee_advance: {
        Args: { p_advance_id: string }
        Returns: Json
      }
      approve_online_order: { Args: { payload: Json }; Returns: Json }
      approve_payroll_run: { Args: { payload: Json }; Returns: Json }
      approve_purchase_return: { Args: { payload: Json }; Returns: Json }
      approve_sale_correction: {
        Args: { approval_id: string; corrected_payload: Json }
        Returns: Json
      }
      approve_sales_commission: {
        Args: { p_commission_id: string }
        Returns: Json
      }
      approve_sales_return: { Args: { payload: Json }; Returns: Json }
      assign_online_order: { Args: { payload: Json }; Returns: Json }
      assign_staff_target: { Args: { payload: Json }; Returns: Json }
      audit_commission_discrepancies: {
        Args: { p_limit?: number }
        Returns: Json
      }
      backfill_all_party_ledgers: { Args: never; Returns: Json }
      backfill_canonical_customer_collection_ledgers: {
        Args: never
        Returns: Json
      }
      backfill_canonical_customer_sale_ledgers: { Args: never; Returns: Json }
      backfill_canonical_supplier_payment_ledgers: {
        Args: never
        Returns: Json
      }
      backfill_canonical_supplier_purchase_ledgers: {
        Args: never
        Returns: Json
      }
      backfill_inventory_average_costs: { Args: never; Returns: number }
      backfill_inventory_receipt_sources: { Args: never; Returns: Json }
      backfill_party_opening_ledgers: { Args: never; Returns: Json }
      build_monthly_attendance_summary: {
        Args: { payload: Json }
        Returns: Json
      }
      bulk_approve_sales_commissions: {
        Args: { p_commission_ids: string[] }
        Returns: Json
      }
      calculate_payroll_run: { Args: { payload: Json }; Returns: Json }
      cancel_online_order: { Args: { payload: Json }; Returns: Json }
      cancel_product_exchange: { Args: { payload: Json }; Returns: Json }
      cancel_stock_transfer: {
        Args: { p_reason?: string; p_transfer_id: string }
        Returns: Json
      }
      close_business_day: { Args: { payload: Json }; Returns: string }
      collect_customer_due: { Args: { payload: Json }; Returns: Json }
      complete_accounting_setup: { Args: { payload: Json }; Returns: Json }
      complete_pos_sale: { Args: { payload: Json }; Returns: Json }
      complete_product_exchange: { Args: { payload: Json }; Returns: Json }
      complete_purchase: { Args: { payload: Json }; Returns: Json }
      complete_staff_follow_up: { Args: { payload: Json }; Returns: Json }
      create_attendance_challenge: { Args: { payload: Json }; Returns: Json }
      create_employee_advance: { Args: { payload: Json }; Returns: Json }
      create_expense: { Args: { payload: Json }; Returns: string }
      create_import_job: {
        Args: {
          p_entity_type: string
          p_filename?: string
          p_mode?: string
          p_total_rows?: number
        }
        Returns: string
      }
      create_income: { Args: { payload: Json }; Returns: string }
      create_opening_stock: { Args: { payload: Json }; Returns: Json }
      create_payroll_run: { Args: { payload: Json }; Returns: Json }
      create_product_with_variants: { Args: { payload: Json }; Returns: Json }
      create_role_with_permissions: {
        Args: {
          p_description: string
          p_name: string
          p_permission_keys: string[]
        }
        Returns: Json
      }
      create_staff_online_order: { Args: { payload: Json }; Returns: Json }
      create_stock_adjustment: { Args: { payload: Json }; Returns: Json }
      create_stock_transfer: { Args: { payload: Json }; Returns: Json }
      current_organization_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      deactivate_commission_rule: { Args: { p_rule_id: string }; Returns: Json }
      delete_held_sale: { Args: { p_held_sale_id: string }; Returns: Json }
      disburse_employee_advance: {
        Args: { p_advance_id: string }
        Returns: Json
      }
      dispatch_stock_transfer: { Args: { transfer_id: string }; Returns: Json }
      duplicate_product: { Args: { payload: Json }; Returns: Json }
      edit_sale: { Args: { payload: Json }; Returns: Json }
      execute_data_reset: { Args: { payload: Json }; Returns: Json }
      expire_online_reservations: {
        Args: { p_organization_id?: string }
        Returns: Json
      }
      export_inventory_stock: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_location_id?: string
          p_page?: number
          p_page_size?: number
          p_scope?: string
          p_search?: string
          p_stock_status?: string
        }
        Returns: Json
      }
      finalize_attendance_period: { Args: { payload: Json }; Returns: Json }
      finalize_import_job: {
        Args: { p_job_id: string; p_status?: string; p_summary?: Json }
        Returns: undefined
      }
      fulfil_online_order: { Args: { payload: Json }; Returns: Json }
      generate_expiry_alerts: { Args: { p_org_id?: string }; Returns: number }
      get_accounts_period_cash_flow: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_active_hero_slides: {
        Args: { p_organization_slug: string }
        Returns: Json
      }
      get_admin_user_detail: { Args: { p_user_id: string }; Returns: Json }
      get_courier_report: { Args: { payload?: Json }; Returns: Json }
      get_customer_ledger_statement: {
        Args: {
          p_branch_id?: string
          p_customer_id: string
          p_entry_types?: string[]
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_to?: string
        }
        Returns: Json
      }
      get_dashboard_overview: {
        Args: { p_branch_id?: string; p_date_from?: string; p_date_to?: string }
        Returns: Json
      }
      get_erp_reconciliation_summary: {
        Args: { p_branch_id?: string }
        Returns: Json
      }
      get_inventory_branch_summary: {
        Args: { p_include_non_saleable?: boolean }
        Returns: {
          branch_code: string
          branch_id: string
          branch_name: string
          is_head_office: boolean
          last_movement_at: string
          low_stock_count: number
          out_of_stock_count: number
          potential_gross_profit: number
          total_products: number
          total_stock_purchase_cost: number
          total_stock_quantity: number
          total_stock_value: number
          total_variants: number
        }[]
      }
      get_inventory_low_stock: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_location_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_direction?: string
          p_stock_status?: string
        }
        Returns: Json
      }
      get_inventory_stock_breakdown: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_location_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_direction?: string
          p_stock_status?: string
        }
        Returns: Json
      }
      get_inventory_valuation_summary: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_location_id?: string
          p_search?: string
          p_stock_status?: string
        }
        Returns: {
          last_movement_at: string
          low_stock_variants: number
          out_of_stock_variants: number
          potential_gross_profit: number
          total_products: number
          total_stock_purchase_cost: number
          total_stock_quantity: number
          total_stock_value: number
          total_variants: number
          valuation_fallback_count: number
        }[]
      }
      get_inventory_variant_breakdown: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_location_id?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_direction?: string
          p_stock_status?: string
        }
        Returns: Json
      }
      get_mobile_attendance_context: { Args: never; Returns: Json }
      get_moderator_dashboard_summary: {
        Args: { payload?: Json }
        Returns: Json
      }
      get_party_due_aging: { Args: { p_party?: string }; Returns: Json }
      get_pos_customer_summary: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      get_product_variant_summary: {
        Args: { p_branch_id?: string; p_product_id: string }
        Returns: Json
      }
      get_profit_loss_report: {
        Args: { p_branch_id?: string; p_from: string; p_to: string }
        Returns: Json
      }
      get_public_invoice_by_token: { Args: { p_token: string }; Returns: Json }
      get_reconciliation_report: { Args: { payload?: Json }; Returns: Json }
      get_sale_commission_audit: { Args: { p_sale_id: string }; Returns: Json }
      get_sale_returnable_items: { Args: { p_sale_id: string }; Returns: Json }
      get_sale_returnable_qty: {
        Args: { p_sale_item_id: string }
        Returns: number
      }
      get_staff_commission_summary: { Args: { payload?: Json }; Returns: Json }
      get_staff_dashboard_summary: { Args: { payload?: Json }; Returns: Json }
      get_storefront_fulfillment_context: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_supplier_directory_cards: {
        Args: {
          p_branch_id?: string
          p_due_max?: number
          p_due_min?: number
          p_due_only?: boolean
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_by?: string
          p_sort_dir?: string
          p_status?: string
        }
        Returns: Json
      }
      get_supplier_directory_summary: {
        Args: { p_branch_id?: string }
        Returns: Json
      }
      get_supplier_ledger_statement: {
        Args: {
          p_branch_id?: string
          p_entry_types?: string[]
          p_from?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_supplier_id: string
          p_to?: string
        }
        Returns: Json
      }
      get_supplier_stock_breakdown: {
        Args: {
          p_branch_id?: string
          p_include_non_saleable?: boolean
          p_level?: string
          p_supplier_id?: string
          p_supplier_unknown?: boolean
        }
        Returns: Json
      }
      get_supplier_stock_kpis: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_receipt_from?: string
          p_receipt_to?: string
          p_search?: string
          p_source_status?: string
          p_stock_status?: string
          p_supplier_id?: string
        }
        Returns: Json
      }
      get_supplier_stock_movements: {
        Args: {
          p_branch_id?: string
          p_page?: number
          p_page_size?: number
          p_supplier_id?: string
          p_supplier_unknown?: boolean
        }
        Returns: Json
      }
      get_supplier_stock_summary: {
        Args: {
          p_branch_id?: string
          p_brand_id?: string
          p_category_id?: string
          p_include_non_saleable?: boolean
          p_page?: number
          p_page_size?: number
          p_receipt_from?: string
          p_receipt_to?: string
          p_search?: string
          p_sort_by?: string
          p_sort_direction?: string
          p_source_status?: string
          p_stock_status?: string
          p_supplier_id?: string
        }
        Returns: Json
      }
      get_supplier_stock_velocity: {
        Args: { p_branch_id?: string; p_days?: number; p_supplier_id: string }
        Returns: Json
      }
      get_variant_branch_stock: {
        Args: { p_variant_id: string }
        Returns: Json
      }
      issue_attendance_branch_qr: { Args: { payload: Json }; Returns: Json }
      link_employee_profile: {
        Args: { p_employee_id: string; p_profile_id: string }
        Returns: Json
      }
      list_activity_feed: { Args: { payload?: Json }; Returns: Json }
      list_admin_roles: { Args: never; Returns: Json }
      list_admin_users: { Args: { payload?: Json }; Returns: Json }
      list_commission_rules: {
        Args: { p_branch_id?: string }
        Returns: {
          applies_to_sources: string[]
          base_metric: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          period_unit: string
          profile_id: string | null
          rate: number
          rule_type: string
          structure_mode: string
          subject_type: string
          tiers: Json
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "salesman_commission_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_customer_recent_orders: {
        Args: { p_customer_id: string; p_limit?: number }
        Returns: Json
      }
      list_my_assigned_customers: { Args: { payload?: Json }; Returns: Json }
      list_online_orders: { Args: { payload?: Json }; Returns: Json }
      list_products_with_inventory_summary: {
        Args: { payload?: Json }
        Returns: Json
      }
      list_staff_commission_entries: { Args: { payload?: Json }; Returns: Json }
      list_staff_follow_ups: { Args: { payload?: Json }; Returns: Json }
      list_staff_sales: { Args: { payload?: Json }; Returns: Json }
      list_staff_targets: { Args: { payload?: Json }; Returns: Json }
      list_top_customers:
        | { Args: { p_limit?: number; p_sort?: string }; Returns: Json }
        | { Args: { payload?: Json }; Returns: Json }
      lookup_customers_for_import: {
        Args: { p_barcodes?: string[]; p_phones?: string[] }
        Returns: Json
      }
      lookup_products_for_import: {
        Args: { p_barcodes?: string[]; p_skus?: string[] }
        Returns: Json
      }
      lookup_suppliers_for_import: {
        Args: { p_barcodes?: string[]; p_names?: string[] }
        Returns: Json
      }
      mark_import_job_row: {
        Args: {
          p_error?: string
          p_job_id: string
          p_result?: Json
          p_row_num: number
          p_status: string
        }
        Returns: undefined
      }
      mint_attendance_submit_attestation: {
        Args: {
          p_auth_user_id: string
          p_challenge_id: string
          p_device_id: string
          p_payload_hash: string
        }
        Returns: string
      }
      next_online_order_invoice: {
        Args: { p_organization_id: string }
        Returns: string
      }
      normalize_barcode: { Args: { p_code: string }; Returns: string }
      pay_payroll_items: { Args: { payload: Json }; Returns: Json }
      pay_sales_commission: { Args: { payload: Json }; Returns: Json }
      pay_supplier: { Args: { payload: Json }; Returns: Json }
      place_online_order: { Args: { payload: Json }; Returns: Json }
      pos_lookup_variant_by_barcode: {
        Args: { p_barcode: string; p_branch_id: string }
        Returns: Json
      }
      post_account_cash_movement: { Args: { payload: Json }; Returns: Json }
      post_manual_journal: { Args: { payload: Json }; Returns: Json }
      post_sale: { Args: { payload: Json }; Returns: Json }
      preview_data_reset: { Args: { payload?: Json }; Returns: Json }
      recalculate_employee_attendance_range: {
        Args: { payload: Json }
        Returns: Json
      }
      receive_stock_transfer:
        | { Args: { items: Json; transfer_id: string }; Returns: Json }
        | {
            Args: { finalize?: boolean; items: Json; transfer_id: string }
            Returns: Json
          }
      recon_opening_party_balances: { Args: { payload: Json }; Returns: Json }
      recon_opening_stock_ledger: { Args: { payload: Json }; Returns: Json }
      recon_rebuild_financial_running_balances: {
        Args: { payload: Json }
        Returns: Json
      }
      recon_repair_partial_sale_summaries: {
        Args: { payload: Json }
        Returns: Json
      }
      recon_supplier_financial_dry_run: {
        Args: { payload?: Json }
        Returns: Json
      }
      record_courier_cod_receivable: {
        Args: { p_parcel_id: string }
        Returns: Json
      }
      refresh_batch_status: { Args: { p_batch_id: string }; Returns: undefined }
      refresh_customer_rating: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      refresh_customer_ratings_batch: {
        Args: { p_customer_ids?: string[] }
        Returns: Json
      }
      refresh_supplier_rating: {
        Args: { p_supplier_id: string }
        Returns: Json
      }
      register_attendance_device: { Args: { payload: Json }; Returns: Json }
      reject_courier_return: {
        Args: { reason: string; request_id: string }
        Returns: Json
      }
      reject_payroll_run: { Args: { payload: Json }; Returns: Json }
      reject_sales_commission: {
        Args: { p_commission_id: string; p_reason?: string }
        Returns: Json
      }
      repair_supplier_opening_sign: { Args: { payload?: Json }; Returns: Json }
      repair_supplier_party_sync: { Args: { payload?: Json }; Returns: Json }
      request_attendance_correction: { Args: { payload: Json }; Returns: Json }
      request_sale_correction: {
        Args: { items: Json; reason: string; sale_id: string }
        Returns: Json
      }
      resolve_effective_price: {
        Args: {
          p_branch_id: string
          p_org_id: string
          p_product_id: string
          p_variant_id: string
        }
        Returns: number
      }
      resolve_staff_login_email: {
        Args: { p_identifier: string }
        Returns: string
      }
      reverse_courier_settlement: { Args: { payload: Json }; Returns: Json }
      review_attendance_correction: { Args: { payload: Json }; Returns: Json }
      run_erp_acceptance_report: { Args: never; Returns: Json }
      run_erp_production_reconciliation_report: { Args: never; Returns: Json }
      run_erp_qa_cod_delivery: { Args: never; Returns: Json }
      run_erp_qa_data_reset_rpc_match: { Args: never; Returns: Json }
      run_erp_qa_non_cod_delivery: { Args: never; Returns: Json }
      sale_attributed_staff_id: {
        Args: { p_sale: Database["public"]["Tables"]["sales"]["Row"] }
        Returns: string
      }
      sales_history_export: { Args: { p_filters?: Json }; Returns: Json }
      sales_history_kpis: { Args: { p_filters?: Json }; Returns: Json }
      sales_history_list: { Args: { p_filters?: Json }; Returns: Json }
      search_commission_employees: {
        Args: {
          p_branch_id?: string
          p_commission_only?: boolean
          p_query?: string
        }
        Returns: {
          branch_name: string
          commission_eligible: boolean
          designation: string
          employee_code: string
          full_name: string
          id: string
          profile_id: string
          profile_name: string
        }[]
      }
      search_commission_subjects: {
        Args: { p_branch_id?: string; p_kind?: string; p_query?: string }
        Returns: Json
      }
      seed_inventory_presence: { Args: { payload: Json }; Returns: Json }
      settle_courier_settlement: { Args: { payload: Json }; Returns: Json }
      soft_deleted: { Args: { p_deleted_at: string }; Returns: boolean }
      staff_line_contribution_total: {
        Args: {
          p_branch_id: string
          p_from: string
          p_org_id: string
          p_staff: string
          p_to: string
        }
        Returns: number
      }
      staff_matches_sale: {
        Args: {
          p_sale: Database["public"]["Tables"]["sales"]["Row"]
          p_staff: string
        }
        Returns: boolean
      }
      staff_matches_sale_id: {
        Args: { p_sale_id: string; p_staff: string }
        Returns: boolean
      }
      submit_mobile_attendance: { Args: { payload: Json }; Returns: Json }
      submit_payroll_for_review: { Args: { payload: Json }; Returns: Json }
      summarize_sales_commissions: {
        Args: {
          p_branch_id?: string
          p_employee_id?: string
          p_from?: string
          p_profile_id?: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      sync_purchase_financial_transactions: {
        Args: { p_purchase_id: string }
        Returns: number
      }
      track_online_order: { Args: { p_query: string }; Returns: Json }
      transfer_account_balance: { Args: { payload: Json }; Returns: string }
      transition_product_status: { Args: { payload: Json }; Returns: Json }
      update_admin_user: { Args: { payload: Json }; Returns: Json }
      update_courier_parcel_status: {
        Args: { p_notes?: string; p_parcel_id: string; p_status: string }
        Returns: Json
      }
      update_role_with_permissions: {
        Args: {
          p_description: string
          p_name: string
          p_permission_keys: string[]
          p_role_id: string
        }
        Returns: Json
      }
      upsert_commission_rule: { Args: { payload: Json }; Returns: Json }
      upsert_held_sale: { Args: { payload: Json }; Returns: Json }
      upsert_import_job_rows: {
        Args: { p_job_id: string; p_rows: Json }
        Returns: undefined
      }
      upsert_staff_follow_up: { Args: { payload: Json }; Returns: Json }
      user_has_branch_access: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { p_permission_key: string }
        Returns: boolean
      }
      void_financial_transaction: {
        Args: { reason: string; txn_id: string }
        Returns: string
      }
      void_purchase_return: {
        Args: { reason: string; return_id: string }
        Returns: Json
      }
      void_sale: { Args: { reason: string; sale_id: string }; Returns: Json }
      write_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_after_data?: Json
          p_before_data?: Json
          p_branch_id: string
          p_entity_id: string
          p_entity_type: string
          p_organization_id: string
          p_reason?: string
          p_request_meta?: Json
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      bucket_lifecycle_states: {
        Row: {
          bucket_id: string
          claim_id: string | null
          claim_until: string | null
          continuation: Json | null
          failure_count: number
          generation: string | null
          last_completed_at: string | null
          last_error: Json | null
          last_result: Json | null
          last_started_at: string | null
          last_success_at: string | null
          next_run_at: string | null
          updated_at: string
        }
        Insert: {
          bucket_id: string
          claim_id?: string | null
          claim_until?: string | null
          continuation?: Json | null
          failure_count?: number
          generation?: string | null
          last_completed_at?: string | null
          last_error?: Json | null
          last_result?: Json | null
          last_started_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          claim_id?: string | null
          claim_until?: string | null
          continuation?: Json | null
          failure_count?: number
          generation?: string | null
          last_completed_at?: string | null
          last_error?: Json | null
          last_result?: Json | null
          last_started_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_lifecycle_states_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: true
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          lifecycle_configuration: Json | null
          lifecycle_configuration_generation: string | null
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      lifecycle_abandoned_artifacts: {
        Row: {
          attempted_at: string
          bucket_id: string
          key: string
          name: string
          version: string | null
        }
        Insert: {
          attempted_at?: string
          bucket_id: string
          key: string
          name: string
          version?: string | null
        }
        Update: {
          attempted_at?: string
          bucket_id?: string
          key?: string
          name?: string
          version?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_lifecycle_objects: {
        Args: { object_ids: string[] }
        Returns: {
          id: string
          is_delete_marker: boolean
          metadata: Json
        }[]
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string }
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
          raw_prefix_param?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delete_markers?: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          next_token_archived_at?: string
          next_token_version?: string
          noncurrent_versions?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      operation: { Args: never; Returns: string }
      reconcile_lifecycle_state: {
        Args: { policy_changed: boolean; target_bucket_id: string }
        Returns: undefined
      }
      search: {
        Args: {
          bucketname: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          delete_markers?: string
          noncurrent_versions?: string
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
          p_start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
          start_after_archived_at?: string
          start_after_is_continuation?: boolean
          start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
