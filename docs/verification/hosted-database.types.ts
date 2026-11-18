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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          id: string
          is_active: boolean
          max_selections: number
          min_selections: number
          name: string
          restaurant_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          restaurant_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          addon_group_id: string
          id: string
          is_available: boolean
          name: string
          price_minor: number
          restaurant_id: string
        }
        Insert: {
          addon_group_id: string
          id?: string
          is_available?: boolean
          name: string
          price_minor?: number
          restaurant_id: string
        }
        Update: {
          addon_group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price_minor?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_restaurant_id_addon_group_id_fkey"
            columns: ["restaurant_id", "addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line: string
          area: string
          city: string
          created_at: string
          customer_id: string
          id: string
          instructions: string | null
          is_default: boolean
          label: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          address_line: string
          area: string
          city: string
          created_at?: string
          customer_id: string
          id?: string
          instructions?: string | null
          is_default?: boolean
          label: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          area?: string
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          instructions?: string | null
          is_default?: boolean
          label?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_restaurant_id_customer_id_fkey"
            columns: ["restaurant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_addons: {
        Row: {
          addon_id: string
          addon_name: string
          id: string
          order_id: string
          order_item_id: string
          quantity: number
          restaurant_id: string
          unit_price_minor: number
        }
        Insert: {
          addon_id: string
          addon_name: string
          id?: string
          order_id: string
          order_item_id: string
          quantity?: number
          restaurant_id: string
          unit_price_minor: number
        }
        Update: {
          addon_id?: string
          addon_name?: string
          id?: string
          order_id?: string
          order_item_id?: string
          quantity?: number
          restaurant_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_addons_restaurant_id_addon_id_fkey"
            columns: ["restaurant_id", "addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "order_item_addons_restaurant_id_order_id_order_item_id_fkey"
            columns: ["restaurant_id", "order_id", "order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["restaurant_id", "order_id", "id"]
          },
        ]
      }
      order_items: {
        Row: {
          addons_total_minor: number
          allergens: string[]
          created_at: string
          id: string
          line_total_minor: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          restaurant_id: string
          unit_price_minor: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          addons_total_minor?: number
          allergens?: string[]
          created_at?: string
          id?: string
          line_total_minor: number
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          restaurant_id: string
          unit_price_minor: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          addons_total_minor?: number
          allergens?: string[]
          created_at?: string
          id?: string
          line_total_minor?: number
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          restaurant_id?: string
          unit_price_minor?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_restaurant_id_order_id_fkey"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_product_id_fkey"
            columns: ["restaurant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_product_id_variant_id_fkey"
            columns: ["restaurant_id", "product_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["restaurant_id", "product_id", "id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          created_at: string
          id: string
          order_id: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_restaurant_id_order_id_fkey"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          currency: string
          customer_id: string | null
          delivery_address: Json | null
          delivery_fee_minor: number
          delivery_zone_id: string | null
          id: string
          method: Database["public"]["Enums"]["fulfilment_method"]
          notes: string
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          reference: string
          rejection_reason: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          tax_minor: number
          tax_rate_bps: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at?: string
          currency: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_fee_minor?: number
          delivery_zone_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["fulfilment_method"]
          notes?: string
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          reference?: string
          rejection_reason?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor: number
          tax_minor?: number
          tax_rate_bps?: number
          total_minor: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_fee_minor?: number
          delivery_zone_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["fulfilment_method"]
          notes?: string
          payment_method?: Database["public"]["Enums"]["cash_payment_method"]
          reference?: string
          rejection_reason?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor?: number
          tax_minor?: number
          tax_rate_bps?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_customer_id_fkey"
            columns: ["restaurant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_delivery_zone_id_fkey"
            columns: ["restaurant_id", "delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["cash_payment_method"]
          order_id: string
          paid_at: string | null
          recorded_by: string | null
          refunded_at: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          id?: string
          method: Database["public"]["Enums"]["cash_payment_method"]
          order_id: string
          paid_at?: string | null
          recorded_by?: string | null
          refunded_at?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["cash_payment_method"]
          order_id?: string
          paid_at?: string | null
          recorded_by?: string | null
          refunded_at?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_restaurant_id_order_id_fkey"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      product_addon_groups: {
        Row: {
          addon_group_id: string
          product_id: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          addon_group_id: string
          product_id: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          addon_group_id?: string
          product_id?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_restaurant_id_addon_group_id_fkey"
            columns: ["restaurant_id", "addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "product_addon_groups_restaurant_id_product_id_fkey"
            columns: ["restaurant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          object_path: string
          product_id: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          object_path: string
          product_id: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          object_path?: string
          product_id?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_restaurant_id_product_id_fkey"
            columns: ["restaurant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          price_minor: number
          product_id: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          price_minor: number
          product_id: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          price_minor?: number
          product_id?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_restaurant_id_product_id_fkey"
            columns: ["restaurant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          allergens: string[]
          base_price_minor: number
          category_id: string
          created_at: string
          description: string
          dietary_labels: string[]
          id: string
          is_active: boolean
          is_available: boolean
          is_featured: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          base_price_minor: number
          category_id: string
          created_at?: string
          description?: string
          dietary_labels?: string[]
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_featured?: boolean
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          base_price_minor?: number
          category_id?: string
          created_at?: string
          description?: string
          dietary_labels?: string[]
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_featured?: boolean
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_restaurant_id_category_id_fkey"
            columns: ["restaurant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_customers: {
        Row: {
          contact_email: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          address: Json
          contact_email: string | null
          contact_phone: string | null
          delivery_enabled: boolean
          delivery_fee_minor: number
          maintenance_message: string
          minimum_delivery_minor: number
          opening_hours: Json
          reopening_at: string | null
          restaurant_id: string
          tax_rate_bps: number
          updated_at: string
          website_mode: Database["public"]["Enums"]["website_mode"]
        }
        Insert: {
          address?: Json
          contact_email?: string | null
          contact_phone?: string | null
          delivery_enabled?: boolean
          delivery_fee_minor?: number
          maintenance_message?: string
          minimum_delivery_minor?: number
          opening_hours?: Json
          reopening_at?: string | null
          restaurant_id: string
          tax_rate_bps?: number
          updated_at?: string
          website_mode?: Database["public"]["Enums"]["website_mode"]
        }
        Update: {
          address?: Json
          contact_email?: string | null
          contact_phone?: string | null
          delivery_enabled?: boolean
          delivery_fee_minor?: number
          maintenance_message?: string
          minimum_delivery_minor?: number
          opening_hours?: Json
          reopening_at?: string | null
          restaurant_id?: string
          tax_rate_bps?: number
          updated_at?: string
          website_mode?: Database["public"]["Enums"]["website_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_published: boolean
          is_sample: boolean
          name: string
          owner_user_id: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_published?: boolean
          is_sample?: boolean
          name: string
          owner_user_id?: string | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_published?: boolean
          is_sample?: boolean
          name?: string
          owner_user_id?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          restaurant_id: string
          role_id: string
        }
        Insert: {
          permission_key: string
          restaurant_id: string
          role_id: string
        }
        Update: {
          permission_key?: string
          restaurant_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_restaurant_id_role_id_fkey"
            columns: ["restaurant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          restaurant_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          restaurant_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          restaurant_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          restaurant_id: string
          revoked_at: string | null
          role_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          restaurant_id: string
          revoked_at?: string | null
          role_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          restaurant_id?: string
          revoked_at?: string | null
          role_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_restaurant_id_role_id_fkey"
            columns: ["restaurant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      staff_memberships: {
        Row: {
          contact_email: string | null
          created_at: string
          display_name: string
          id: string
          restaurant_id: string
          role_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          display_name?: string
          id?: string
          restaurant_id: string
          role_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          display_name?: string
          id?: string
          restaurant_id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_memberships_restaurant_id_role_id_fkey"
            columns: ["restaurant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          content_type: string
          created_at: string
          filename: string
          id: string
          message_id: string
          object_path: string
          restaurant_id: string
          size_bytes: number
          status: Database["public"]["Enums"]["attachment_status"]
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          filename: string
          id?: string
          message_id: string
          object_path: string
          restaurant_id: string
          size_bytes: number
          status?: Database["public"]["Enums"]["attachment_status"]
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          object_path?: string
          restaurant_id?: string
          size_bytes?: number
          status?: Database["public"]["Enums"]["attachment_status"]
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_restaurant_id_ticket_id_message_id_fkey"
            columns: ["restaurant_id", "ticket_id", "message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["restaurant_id", "ticket_id", "id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_type: Database["public"]["Enums"]["message_author"]
          author_user_id: string | null
          body: string
          client_nonce: string | null
          created_at: string
          id: string
          is_internal: boolean
          restaurant_id: string
          ticket_id: string
        }
        Insert: {
          author_type: Database["public"]["Enums"]["message_author"]
          author_user_id?: string | null
          body: string
          client_nonce?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          restaurant_id: string
          ticket_id: string
        }
        Update: {
          author_type?: Database["public"]["Enums"]["message_author"]
          author_user_id?: string | null
          body?: string
          client_nonce?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          restaurant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_restaurant_id_ticket_id_fkey"
            columns: ["restaurant_id", "ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          contact_email: string
          contact_name: string
          created_at: string
          customer_id: string | null
          id: string
          order_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reference: string
          restaurant_id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          contact_email: string
          contact_name: string
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reference?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          contact_email?: string
          contact_name?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reference?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_restaurant_id_assigned_to_fkey"
            columns: ["restaurant_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_memberships"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "support_tickets_restaurant_id_customer_id_fkey"
            columns: ["restaurant_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["restaurant_id", "id"]
          },
          {
            foreignKeyName: "support_tickets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_restaurant_id_order_id_fkey"
            columns: ["restaurant_id", "order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["restaurant_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invitation: { Args: { p_token: string }; Returns: string }
      bootstrap_restaurant_owner: {
        Args: { p_owner: string; p_restaurant: string }
        Returns: undefined
      }
      create_staff_invitation: {
        Args: {
          p_email: string
          p_restaurant: string
          p_role: string
          p_token_hash: string
        }
        Returns: string
      }
      create_support_ticket: {
        Args: {
          p_input: Json
          p_order_token: string
          p_restaurant: string
          p_token: string
        }
        Returns: Json
      }
      current_staff_access: { Args: { p_restaurant: string }; Returns: Json }
      manage_staff_member: {
        Args: {
          p_member: string
          p_restaurant: string
          p_role: string
          p_status: Database["public"]["Enums"]["membership_status"]
        }
        Returns: undefined
      }
      place_customer_order: {
        Args: {
          p_checkout: Json
          p_expected_total: number
          p_items: Json
          p_restaurant: string
          p_token: string
        }
        Returns: Json
      }
      platform_schema_version: { Args: never; Returns: number }
      quote_cart: {
        Args: {
          p_items: Json
          p_method: string
          p_restaurant: string
          p_zone: string
        }
        Returns: Json
      }
      read_order_capability: {
        Args: { p_reference: string; p_restaurant: string; p_token: string }
        Returns: Json
      }
      read_support_ticket: {
        Args: {
          p_page: number
          p_reference: string
          p_restaurant: string
          p_token: string
        }
        Returns: Json
      }
      reply_support_ticket: {
        Args: {
          p_body: string
          p_internal: boolean
          p_nonce: string
          p_reference: string
          p_restaurant: string
          p_token: string
        }
        Returns: string
      }
      resolve_guest_access: {
        Args: { p_kind: string; p_reference: string; p_token: string }
        Returns: {
          resource_id: string
          restaurant_id: string
        }[]
      }
      restaurant_activity_log: {
        Args: {
          p_action: string
          p_actor: string
          p_entity: string
          p_from: string
          p_page: number
          p_restaurant: string
          p_to: string
        }
        Returns: Json
      }
      restaurant_sales_report: {
        Args: { p_from: string; p_restaurant: string; p_to: string }
        Returns: Json
      }
      revoke_staff_invitation: {
        Args: { p_invitation: string; p_restaurant: string }
        Returns: undefined
      }
      save_custom_role: {
        Args: {
          p_name: string
          p_permissions: string[]
          p_restaurant: string
          p_role: string
          p_slug: string
        }
        Returns: string
      }
      save_customer_address: {
        Args: {
          p_address: string
          p_area: string
          p_city: string
          p_default: boolean
          p_instructions: string
          p_label: string
          p_line: string
          p_restaurant: string
        }
        Returns: string
      }
      save_customer_profile: {
        Args: { p_name: string; p_phone: string; p_restaurant: string }
        Returns: string
      }
      save_menu_variant: {
        Args: {
          p_active: boolean
          p_default: boolean
          p_name: string
          p_price: number
          p_product: string
          p_restaurant: string
          p_sort: number
          p_variant: string
        }
        Returns: string
      }
      save_website_mode: {
        Args: {
          expected: string
          message: string
          mode: Database["public"]["Enums"]["website_mode"]
          reopening: string
          tenant: string
        }
        Returns: undefined
      }
      support_assignees: { Args: { p_restaurant: string }; Returns: Json }
      support_attachment: {
        Args: {
          p_attachment: string
          p_file: Json
          p_message: string
          p_restaurant: string
          p_ticket: string
          p_token: string
        }
        Returns: Json
      }
    }
    Enums: {
      attachment_status: "pending" | "ready" | "rejected"
      cash_payment_method: "cash_on_delivery" | "pay_at_pickup"
      fulfilment_method: "delivery" | "pickup"
      membership_status: "active" | "invited" | "suspended"
      message_author: "customer" | "staff" | "system"
      order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "ready"
        | "completed"
        | "rejected"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refund_due" | "refunded"
      ticket_category:
        | "order_problem"
        | "cancellation"
        | "complaint"
        | "delivery"
        | "general"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "escalated"
        | "resolved"
        | "closed"
      website_mode: "normal" | "orders_paused" | "maintenance"
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
  public: {
    Enums: {
      attachment_status: ["pending", "ready", "rejected"],
      cash_payment_method: ["cash_on_delivery", "pay_at_pickup"],
      fulfilment_method: ["delivery", "pickup"],
      membership_status: ["active", "invited", "suspended"],
      message_author: ["customer", "staff", "system"],
      order_status: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "completed",
        "rejected",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refund_due", "refunded"],
      ticket_category: [
        "order_problem",
        "cancellation",
        "complaint",
        "delivery",
        "general",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "escalated",
        "resolved",
        "closed",
      ],
      website_mode: ["normal", "orders_paused", "maintenance"],
    },
  },
} as const
