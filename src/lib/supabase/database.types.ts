export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after_json: Json | null;
          before_json: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
          occurred_at: string;
          restaurant_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after_json?: Json | null;
          before_json?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
          occurred_at?: string;
          restaurant_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_json?: Json | null;
          before_json?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          occurred_at?: string;
          restaurant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          icon_key: string | null;
          id: string;
          is_published: boolean;
          name: string;
          restaurant_id: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_published?: boolean;
          name: string;
          restaurant_id: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon_key?: string | null;
          id?: string;
          is_published?: boolean;
          name?: string;
          restaurant_id?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      category_translations: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          locale: string;
          name: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          locale: string;
          name?: string | null;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          locale?: string;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      image_deletions: {
        Row: {
          enqueued_at: string;
          key: string;
        };
        ComputedFields: never;
        Insert: {
          enqueued_at?: string;
          key: string;
        };
        Update: {
          enqueued_at?: string;
          key?: string;
        };
        Relationships: [];
      };
      item_tags: {
        Row: {
          created_at: string;
          item_id: string;
          tag_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          item_id: string;
          tag_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          item_id?: string;
          tag_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      item_translations: {
        Row: {
          availability_note: string | null;
          created_at: string;
          item_id: string;
          locale: string;
          long_description: string | null;
          name: string | null;
          short_description: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          availability_note?: string | null;
          created_at?: string;
          item_id: string;
          locale: string;
          long_description?: string | null;
          name?: string | null;
          short_description?: string | null;
          updated_at?: string;
        };
        Update: {
          availability_note?: string | null;
          created_at?: string;
          item_id?: string;
          locale?: string;
          long_description?: string | null;
          name?: string | null;
          short_description?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_translations_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_variants: {
        Row: {
          availability: Database["public"]["Enums"]["availability_state"];
          created_at: string;
          id: string;
          item_id: string;
          name: string;
          price_delta_cents: number;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          availability?: Database["public"]["Enums"]["availability_state"];
          created_at?: string;
          id?: string;
          item_id: string;
          name: string;
          price_delta_cents?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          availability?: Database["public"]["Enums"]["availability_state"];
          created_at?: string;
          id?: string;
          item_id?: string;
          name?: string;
          price_delta_cents?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_variants_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          availability: Database["public"]["Enums"]["availability_state"];
          availability_note: string | null;
          availability_until: string | null;
          calories: number | null;
          category_id: string;
          created_at: string;
          currency: string;
          hero_key: string | null;
          hero_lqip: string | null;
          icon_key: string | null;
          icon_lqip: string | null;
          id: string;
          is_featured: boolean;
          is_published: boolean;
          long_description: string | null;
          name: string;
          prep_minutes: number | null;
          price_cents: number;
          remaining_qty: number | null;
          restaurant_id: string;
          short_description: string | null;
          slug: string;
          sort_order: number;
          spice_level: number;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          availability?: Database["public"]["Enums"]["availability_state"];
          availability_note?: string | null;
          availability_until?: string | null;
          calories?: number | null;
          category_id: string;
          created_at?: string;
          currency?: string;
          hero_key?: string | null;
          hero_lqip?: string | null;
          icon_key?: string | null;
          icon_lqip?: string | null;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          long_description?: string | null;
          name: string;
          prep_minutes?: number | null;
          price_cents: number;
          remaining_qty?: number | null;
          restaurant_id: string;
          short_description?: string | null;
          slug: string;
          sort_order?: number;
          spice_level?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          availability?: Database["public"]["Enums"]["availability_state"];
          availability_note?: string | null;
          availability_until?: string | null;
          calories?: number | null;
          category_id?: string;
          created_at?: string;
          currency?: string;
          hero_key?: string | null;
          hero_lqip?: string | null;
          icon_key?: string | null;
          icon_lqip?: string | null;
          id?: string;
          is_featured?: boolean;
          is_published?: boolean;
          long_description?: string | null;
          name?: string;
          prep_minutes?: number | null;
          price_cents?: number;
          remaining_qty?: number | null;
          restaurant_id?: string;
          short_description?: string | null;
          slug?: string;
          sort_order?: number;
          spice_level?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "items_category_id_restaurant_id_fkey";
            columns: ["category_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "restaurant_id"];
          },
          {
            foreignKeyName: "items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean;
          restaurant_id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          restaurant_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          restaurant_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_codes: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          restaurant_id: string;
          slug: string;
          table_number: number | null;
          target_path: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          restaurant_id: string;
          slug: string;
          table_number?: number | null;
          target_path?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          restaurant_id?: string;
          slug?: string;
          table_number?: number | null;
          target_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_codes_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          address: string | null;
          banner_message: string | null;
          created_at: string;
          currency: string;
          default_locale: string;
          hours_json: NonNullable<Json>;
          id: string;
          is_published: boolean;
          locale: string;
          logo_key: string | null;
          name: string;
          persian_digits: string;
          phone: string | null;
          slug: string;
          theme_json: NonNullable<Json>;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          banner_message?: string | null;
          created_at?: string;
          currency?: string;
          default_locale?: string;
          hours_json?: NonNullable<Json>;
          id?: string;
          is_published?: boolean;
          locale?: string;
          logo_key?: string | null;
          name: string;
          persian_digits?: string;
          phone?: string | null;
          slug: string;
          theme_json?: NonNullable<Json>;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          banner_message?: string | null;
          created_at?: string;
          currency?: string;
          default_locale?: string;
          hours_json?: NonNullable<Json>;
          id?: string;
          is_published?: boolean;
          locale?: string;
          logo_key?: string | null;
          name?: string;
          persian_digits?: string;
          phone?: string | null;
          slug?: string;
          theme_json?: NonNullable<Json>;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scan_events: {
        Row: {
          id: number;
          is_bot: boolean;
          occurred_at: string;
          qr_code_id: string;
          ua_family: string | null;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          is_bot?: boolean;
          occurred_at?: string;
          qr_code_id: string;
          ua_family?: string | null;
        };
        Update: {
          id?: never;
          is_bot?: boolean;
          occurred_at?: string;
          qr_code_id?: string;
          ua_family?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scan_events_qr_code_id_fkey";
            columns: ["qr_code_id"];
            isOneToOne: false;
            referencedRelation: "qr_codes";
            referencedColumns: ["id"];
          },
        ];
      };
      tag_translations: {
        Row: {
          created_at: string;
          label: string | null;
          locale: string;
          tag_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          label?: string | null;
          locale: string;
          tag_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          label?: string | null;
          locale?: string;
          tag_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tag_translations_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          kind: Database["public"]["Enums"]["tag_kind"];
          label: string;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["tag_kind"];
          label: string;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["tag_kind"];
          label?: string;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      availability_rank: {
        Args: { p_state: Database["public"]["Enums"]["availability_state"] };
        Returns: number;
      };
      effective_availability: {
        Args: {
          p_state: Database["public"]["Enums"]["availability_state"];
          p_until: string;
        };
        Returns: Database["public"]["Enums"]["availability_state"];
      };
      expire_availability: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      health: { Args: Record<PropertyKey, never>; Returns: boolean };
      item_json: {
        Args: {
          p_item_slug: string;
          p_locale?: string;
          p_restaurant_slug: string;
        };
        Returns: Json;
      };
      menu_json: {
        Args: { p_locale?: string; p_restaurant_slug: string };
        Returns: Json;
      };
      record_scan: {
        Args: { p_is_bot?: boolean; p_slug: string; p_ua_family?: string };
        Returns: string;
      };
      reset_all_availability: {
        Args: { p_restaurant_id: string };
        Returns: number;
      };
      set_item_availability: {
        Args: {
          p_availability: Database["public"]["Enums"]["availability_state"];
          p_expected_updated_at?: string;
          p_item_id: string;
          p_note?: string;
          p_remaining_qty?: number;
          p_until?: string;
        };
        Returns: {
          availability: Database["public"]["Enums"]["availability_state"];
          availability_note: string;
          availability_until: string;
          id: string;
          remaining_qty: number;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      app_role: "owner" | "admin" | "staff";
      availability_state: "available" | "limited" | "unavailable";
      tag_kind: "dietary" | "feature" | "allergen";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "staff"],
      availability_state: ["available", "limited", "unavailable"],
      tag_kind: ["dietary", "feature", "allergen"],
    },
  },
} as const;
