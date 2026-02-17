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
      admin_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      circularity_reports: {
        Row: {
          average_reuses: number
          circularity_score: number
          co2_saved_kg: number
          comments: Json | null
          created_at: string
          id: string
          merchant_id: string | null
          packages_reused: number
          period_end: string
          period_start: string
          plastic_saved_kg: number
          total_packages: number
        }
        Insert: {
          average_reuses?: number
          circularity_score?: number
          co2_saved_kg?: number
          comments?: Json | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          packages_reused?: number
          period_end: string
          period_start: string
          plastic_saved_kg?: number
          total_packages?: number
        }
        Update: {
          average_reuses?: number
          circularity_score?: number
          co2_saved_kg?: number
          comments?: Json | null
          created_at?: string
          id?: string
          merchant_id?: string | null
          packages_reused?: number
          period_end?: string
          period_start?: string
          plastic_saved_kg?: number
          total_packages?: number
        }
        Relationships: [
          {
            foreignKeyName: "circularity_reports_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          opt_in: boolean | null
          phone: string | null
          province: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          opt_in?: boolean | null
          phone?: string | null
          province?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          opt_in?: boolean | null
          phone?: string | null
          province?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      imported_customers: {
        Row: {
          created_at: string
          email: string | null
          external_id: string
          id: string
          name: string | null
          shopify_created_at: string | null
          shopify_customer_id: string | null
          telephone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_id: string
          id?: string
          name?: string | null
          shopify_created_at?: string | null
          shopify_customer_id?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          external_id?: string
          id?: string
          name?: string | null
          shopify_created_at?: string | null
          shopify_customer_id?: string | null
          telephone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      imported_orders: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          customer_id: string | null
          destination: Json | null
          external_id: string
          hidden: boolean
          id: string
          name: string | null
          opt_in: boolean | null
          payment_status: string | null
          province: string | null
          shopify_created_at: string | null
          shopify_order_id: string | null
          store_id: string | null
          total_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          destination?: Json | null
          external_id: string
          hidden?: boolean
          id?: string
          name?: string | null
          opt_in?: boolean | null
          payment_status?: string | null
          province?: string | null
          shopify_created_at?: string | null
          shopify_order_id?: string | null
          store_id?: string | null
          total_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          destination?: Json | null
          external_id?: string
          hidden?: boolean
          id?: string
          name?: string | null
          opt_in?: boolean | null
          payment_status?: string | null
          province?: string | null
          shopify_created_at?: string | null
          shopify_order_id?: string | null
          store_id?: string | null
          total_price?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          description: string | null
          id: string
          insight_type: string
          merchant_id: string | null
          metadata: Json | null
          period_end: string | null
          period_start: string | null
          title: string
          trend: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          insight_type: string
          merchant_id?: string | null
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          title: string
          trend?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          insight_type?: string
          merchant_id?: string | null
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          title?: string
          trend?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      label_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          label_count: number
          merchant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          label_count?: number
          merchant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          label_count?: number
          merchant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_groups_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          created_at: string
          current_order_id: string | null
          group_id: string | null
          id: string
          label_id: string
          merchant_id: string | null
          previous_uses: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_order_id?: string | null
          group_id?: string | null
          id?: string
          label_id: string
          merchant_id?: string | null
          previous_uses?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_order_id?: string | null
          group_id?: string | null
          id?: string
          label_id?: string
          merchant_id?: string | null
          previous_uses?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "label_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          created_at: string
          drop_off_locations: Json | null
          id: string
          instructions: Json | null
          is_active: boolean | null
          logo_url: string | null
          merchant_id: string
          primary_color: string | null
          rewards_enabled: boolean | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          drop_off_locations?: Json | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          logo_url?: string | null
          merchant_id: string
          primary_color?: string | null
          rewards_enabled?: boolean | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          drop_off_locations?: Json | null
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          logo_url?: string | null
          merchant_id?: string
          primary_color?: string | null
          rewards_enabled?: boolean | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_title: string
          quantity: number
          sku: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price?: number
          product_id?: string | null
          product_title: string
          quantity?: number
          sku?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_title?: string
          quantity?: number
          sku?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          landing_page_config: Json | null
          name: string
          return_rate: number
          shopify_domain: string
          status: string
          total_opt_ins: number
          total_packages: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          landing_page_config?: Json | null
          name: string
          return_rate?: number
          shopify_domain: string
          status?: string
          total_opt_ins?: number
          total_packages?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          landing_page_config?: Json | null
          name?: string
          return_rate?: number
          shopify_domain?: string
          status?: string
          total_opt_ins?: number
          total_packages?: number
          updated_at?: string
        }
        Relationships: []
      }
      mintsoft_asn: {
        Row: {
          asn_status: string | null
          booked_in_date: string | null
          estimated_delivery: string | null
          id: string
          last_updated: string | null
          packaging_id: string | null
          po_reference: string | null
          product_name: string | null
          synced_at: string
        }
        Insert: {
          asn_status?: string | null
          booked_in_date?: string | null
          estimated_delivery?: string | null
          id?: string
          last_updated?: string | null
          packaging_id?: string | null
          po_reference?: string | null
          product_name?: string | null
          synced_at?: string
        }
        Update: {
          asn_status?: string | null
          booked_in_date?: string | null
          estimated_delivery?: string | null
          id?: string
          last_updated?: string | null
          packaging_id?: string | null
          po_reference?: string | null
          product_name?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      mintsoft_returns: {
        Row: {
          id: string
          product_code: string | null
          qty_returned: number
          reason: string | null
          reference: string | null
          return_date: string | null
          return_id: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          product_code?: string | null
          qty_returned?: number
          reason?: string | null
          reference?: string | null
          return_date?: string | null
          return_id?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          product_code?: string | null
          qty_returned?: number
          reason?: string | null
          reference?: string | null
          return_date?: string | null
          return_id?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_id: string
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          order_number: string
          store_id: string
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_id: string
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          order_number: string
          store_id: string
          total_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_id?: string
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          order_number?: string
          store_id?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_sequences: {
        Row: {
          created_at: string
          id: string
          last_serial: string
          month_code: string
          prefix: string
          updated_at: string
          year_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_serial?: string
          month_code: string
          prefix: string
          updated_at?: string
          year_code: string
        }
        Update: {
          created_at?: string
          id?: string
          last_serial?: string
          month_code?: string
          prefix?: string
          updated_at?: string
          year_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      returns: {
        Row: {
          condition: string
          id: string
          inspected_at: string | null
          label_id: string | null
          merchant_id: string | null
          previous_uses: number
          returned_at: string
          status: string
        }
        Insert: {
          condition?: string
          id?: string
          inspected_at?: string | null
          label_id?: string | null
          merchant_id?: string | null
          previous_uses?: number
          returned_at?: string
          status?: string
        }
        Update: {
          condition?: string
          id?: string
          inspected_at?: string | null
          label_id?: string | null
          merchant_id?: string | null
          previous_uses?: number
          returned_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_events: {
        Row: {
          event_type: string
          id: string
          label_id: string | null
          latitude: number | null
          location: string | null
          longitude: number | null
          merchant_id: string | null
          scanned_at: string
        }
        Insert: {
          event_type: string
          id?: string
          label_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          merchant_id?: string | null
          scanned_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          label_id?: string | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          merchant_id?: string | null
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_events_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          destination: string | null
          id: string
          label_id: string | null
          merchant_id: string | null
          order_id: string
          shipped_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          destination?: string | null
          id?: string
          label_id?: string | null
          merchant_id?: string | null
          order_id: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          destination?: string | null
          id?: string
          label_id?: string | null
          merchant_id?: string | null
          order_id?: string
          shipped_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          available: number
          created_at: string
          damaged: number
          id: string
          in_use: number
          location: string
          merchant_id: string | null
          returned: number
          updated_at: string
        }
        Insert: {
          available?: number
          created_at?: string
          damaged?: number
          id?: string
          in_use?: number
          location: string
          merchant_id?: string | null
          returned?: number
          updated_at?: string
        }
        Update: {
          available?: number
          created_at?: string
          damaged?: number
          id?: string
          in_use?: number
          location?: string
          merchant_id?: string | null
          returned?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_pack_sequences: { Args: never; Returns: undefined }
      get_city_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          city: string
          country: string
          opt_in_count: number
          province: string
          total_orders: number
          total_revenue: number
        }[]
      }
      get_complete_summary_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          avg_opt_in_value: number
          avg_opt_out_value: number
          opt_in_rate: number
          total_opt_ins: number
          total_opt_outs: number
          total_orders: number
          value_difference: number
        }[]
      }
      get_country_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          country: string
          opt_in_count: number
          total_orders: number
          total_revenue: number
        }[]
      }
      get_customer_order_stats: {
        Args: { customer_ids: string[] }
        Returns: {
          customer_id: string
          order_count: number
          total_spent: number
        }[]
      }
      get_next_pack_serials: {
        Args: {
          p_count: number
          p_month_code: string
          p_prefix: string
          p_year_code: string
        }
        Returns: string
      }
      get_order_value_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          opt_in_count: number
          price_range: string
          total_orders: number
        }[]
      }
      get_province_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          opt_in_count: number
          province: string
          total_orders: number
          total_revenue: number
        }[]
      }
      get_store_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          opt_in_count: number
          store_id: string
          total_orders: number
          total_revenue: number
        }[]
      }
      get_temporal_stats: {
        Args: { date_from?: string; date_to?: string; store_filter?: string[] }
        Returns: {
          day_of_week: number
          month_year: string
          opt_in_count: number
          total_orders: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_invited_email: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "super_admin"
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
      app_role: ["admin", "super_admin"],
    },
  },
} as const
