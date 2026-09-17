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
      users: {
        Row: {
          id: string;
          phone: string;
          email: string | null;
          full_name: string;
          role: Database['public']['Enums']['user_role'];
          commune: string | null;
          address: string | null;
          avatar_url: string | null;
          kyc_status: Database['public']['Enums']['kyc_status'];
          kyc_documents: Json | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone: string;
          email?: string | null;
          full_name: string;
          role?: Database['public']['Enums']['user_role'];
          commune?: string | null;
          address?: string | null;
          avatar_url?: string | null;
          kyc_status?: Database['public']['Enums']['kyc_status'];
          kyc_documents?: Json | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          email?: string | null;
          full_name?: string;
          role?: Database['public']['Enums']['user_role'];
          commune?: string | null;
          address?: string | null;
          avatar_url?: string | null;
          kyc_status?: Database['public']['Enums']['kyc_status'];
          kyc_documents?: Json | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bailleurs: {
        Row: {
          id: string;
          user_id: string;
          business_name: string | null;
          tax_id: string | null;
          registration_number: string | null;
          compliance_score: number;
          compliance_level: Database['public']['Enums']['compliance_level'];
          bank_account: string | null;
          mobile_money_number: string | null;
          verified_at: string | null;
          solde_disponible: number;
          total_encaisse: number;
          total_impots_dus: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name?: string | null;
          tax_id?: string | null;
          registration_number?: string | null;
          compliance_score?: number;
          compliance_level?: Database['public']['Enums']['compliance_level'];
          bank_account?: string | null;
          mobile_money_number?: string | null;
          verified_at?: string | null;
          solde_disponible?: number;
          total_encaisse?: number;
          total_impots_dus?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string | null;
          tax_id?: string | null;
          registration_number?: string | null;
          compliance_score?: number;
          compliance_level?: Database['public']['Enums']['compliance_level'];
          bank_account?: string | null;
          mobile_money_number?: string | null;
          verified_at?: string | null;
          solde_disponible?: number;
          total_encaisse?: number;
          total_impots_dus?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bailleurs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      logements: {
        Row: {
          id: string;
          bailleur_id: string;
          code: string;
          type: Database['public']['Enums']['property_type'];
          status: Database['public']['Enums']['property_status'];
          commune: string;
          address: string;
          quartier: string | null;
          avenue: string | null;
          parcelle: string | null;
          loyer_mensuel: number;
          currency: string;
          rooms: number | null;
          surface_m2: number | null;
          coordinates: Json | null;
          photos: string[] | null;
          documents: Json | null;
          description: string | null;
          is_occupied: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bailleur_id: string;
          code?: string;
          type: Database['public']['Enums']['property_type'];
          status?: Database['public']['Enums']['property_status'];
          commune: string;
          address: string;
          quartier?: string | null;
          avenue?: string | null;
          parcelle?: string | null;
          loyer_mensuel: number;
          currency?: string;
          rooms?: number | null;
          surface_m2?: number | null;
          coordinates?: Json | null;
          photos?: string[] | null;
          documents?: Json | null;
          description?: string | null;
          is_occupied?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bailleur_id?: string;
          code?: string;
          type?: Database['public']['Enums']['property_type'];
          status?: Database['public']['Enums']['property_status'];
          commune?: string;
          address?: string;
          quartier?: string | null;
          avenue?: string | null;
          parcelle?: string | null;
          loyer_mensuel?: number;
          currency?: string;
          rooms?: number | null;
          surface_m2?: number | null;
          coordinates?: Json | null;
          photos?: string[] | null;
          documents?: Json | null;
          description?: string | null;
          is_occupied?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'logements_bailleur_id_fkey';
            columns: ['bailleur_id'];
            isOneToOne: false;
            referencedRelation: 'bailleurs';
            referencedColumns: ['id'];
          },
        ];
      };
      contrats: {
        Row: {
          id: string;
          code: string;
          logement_id: string;
          bailleur_id: string;
          locataire_id: string;
          status: Database['public']['Enums']['contract_status'];
          date_debut: string;
          date_fin: string | null;
          loyer_mensuel: number;
          depot_garantie: number | null;
          currency: string;
          payment_day: number;
          terms: Json | null;
          signed_at: string | null;
          terminated_at: string | null;
          metadata: Json;
          notes_internes: string | null;
          signature_token: string | null;
          signed_by_bailleur_at: string | null;
          signed_by_locataire_at: string | null;
          pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code?: string;
          logement_id: string;
          bailleur_id: string;
          locataire_id: string;
          status?: Database['public']['Enums']['contract_status'];
          date_debut: string;
          date_fin?: string | null;
          loyer_mensuel: number;
          depot_garantie?: number | null;
          currency?: string;
          payment_day?: number;
          terms?: Json | null;
          signed_at?: string | null;
          terminated_at?: string | null;
          metadata?: Json;
          notes_internes?: string | null;
          signature_token?: string | null;
          signed_by_bailleur_at?: string | null;
          signed_by_locataire_at?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          logement_id?: string;
          bailleur_id?: string;
          locataire_id?: string;
          status?: Database['public']['Enums']['contract_status'];
          date_debut?: string;
          date_fin?: string | null;
          loyer_mensuel?: number;
          depot_garantie?: number | null;
          currency?: string;
          payment_day?: number;
          terms?: Json | null;
          signed_at?: string | null;
          terminated_at?: string | null;
          metadata?: Json;
          notes_internes?: string | null;
          signature_token?: string | null;
          signed_by_bailleur_at?: string | null;
          signed_by_locataire_at?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contrats_logement_id_fkey';
            columns: ['logement_id'];
            isOneToOne: false;
            referencedRelation: 'logements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contrats_bailleur_id_fkey';
            columns: ['bailleur_id'];
            isOneToOne: false;
            referencedRelation: 'bailleurs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contrats_locataire_id_fkey';
            columns: ['locataire_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      paiements: {
        Row: {
          id: string;
          reference: string;
          contrat_id: string;
          montant: number;
          currency: string;
          method: Database['public']['Enums']['payment_method'];
          status: Database['public']['Enums']['payment_status'];
          provider: string | null;
          provider_transaction_id: string | null;
          periode: string;
          paid_at: string | null;
          metadata: Json | null;
          idempotency_key: string | null;
          failure_reason: string | null;
          provider_metadata: Json | null;
          tax_calculation: Json | null;
          notifications_sent: boolean;
          state: string;
          previous_state: string | null;
          state_changed_at: string;
          attempt_count: number;
          last_attempt_at: string | null;
          last_verified_at: string | null;
          expires_at: string | null;
          client_ip: string | null;
          user_agent: string | null;
          initiated_by: string | null;
          pipeline: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          contrat_id: string;
          montant: number;
          currency?: string;
          method: Database['public']['Enums']['payment_method'];
          status?: Database['public']['Enums']['payment_status'];
          provider?: string | null;
          provider_transaction_id?: string | null;
          periode: string;
          paid_at?: string | null;
          metadata?: Json | null;
          idempotency_key?: string | null;
          failure_reason?: string | null;
          provider_metadata?: Json | null;
          tax_calculation?: Json | null;
          notifications_sent?: boolean;
          state?: string;
          previous_state?: string | null;
          state_changed_at?: string;
          attempt_count?: number;
          last_attempt_at?: string | null;
          last_verified_at?: string | null;
          expires_at?: string | null;
          client_ip?: string | null;
          user_agent?: string | null;
          initiated_by?: string | null;
          pipeline?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference?: string;
          contrat_id?: string;
          montant?: number;
          currency?: string;
          method?: Database['public']['Enums']['payment_method'];
          status?: Database['public']['Enums']['payment_status'];
          provider?: string | null;
          provider_transaction_id?: string | null;
          periode?: string;
          paid_at?: string | null;
          metadata?: Json | null;
          idempotency_key?: string | null;
          failure_reason?: string | null;
          provider_metadata?: Json | null;
          tax_calculation?: Json | null;
          notifications_sent?: boolean;
          state?: string;
          previous_state?: string | null;
          state_changed_at?: string;
          attempt_count?: number;
          last_attempt_at?: string | null;
          last_verified_at?: string | null;
          expires_at?: string | null;
          client_ip?: string | null;
          user_agent?: string | null;
          initiated_by?: string | null;
          pipeline?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'paiements_contrat_id_fkey';
            columns: ['contrat_id'];
            isOneToOne: false;
            referencedRelation: 'contrats';
            referencedColumns: ['id'];
          },
        ];
      };
      impots: {
        Row: {
          id: string;
          paiement_id: string | null;
          contrat_id: string;
          montant: number;
          taux: number;
          status: Database['public']['Enums']['tax_status'];
          periode: string;
          calculated_at: string;
          paid_at: string | null;
          regle_fiscale_id: string | null;
          bailleur_id: string | null;
          calcul_fiscal_id: string | null;
          base_imposable: number | null;
          commune: string | null;
          type_logement: string | null;
          reference_legale: string | null;
          detail_calcul: Json | null;
          date_echeance: string | null;
          regles_appliquees: string[] | null;
          recalcule_at: string | null;
          montant_precedent: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paiement_id?: string | null;
          contrat_id: string;
          montant: number;
          taux: number;
          status?: Database['public']['Enums']['tax_status'];
          periode: string;
          calculated_at?: string;
          paid_at?: string | null;
          regle_fiscale_id?: string | null;
          bailleur_id?: string | null;
          calcul_fiscal_id?: string | null;
          base_imposable?: number | null;
          commune?: string | null;
          type_logement?: string | null;
          reference_legale?: string | null;
          detail_calcul?: Json | null;
          date_echeance?: string | null;
          regles_appliquees?: string[] | null;
          recalcule_at?: string | null;
          montant_precedent?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paiement_id?: string | null;
          contrat_id?: string;
          montant?: number;
          taux?: number;
          status?: Database['public']['Enums']['tax_status'];
          periode?: string;
          calculated_at?: string;
          paid_at?: string | null;
          regle_fiscale_id?: string | null;
          bailleur_id?: string | null;
          calcul_fiscal_id?: string | null;
          base_imposable?: number | null;
          commune?: string | null;
          type_logement?: string | null;
          reference_legale?: string | null;
          detail_calcul?: Json | null;
          date_echeance?: string | null;
          regles_appliquees?: string[] | null;
          recalcule_at?: string | null;
          montant_precedent?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'impots_paiement_id_fkey';
            columns: ['paiement_id'];
            isOneToOne: false;
            referencedRelation: 'paiements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'impots_contrat_id_fkey';
            columns: ['contrat_id'];
            isOneToOne: false;
            referencedRelation: 'contrats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'impots_regle_fiscale_id_fkey';
            columns: ['regle_fiscale_id'];
            isOneToOne: false;
            referencedRelation: 'regles_fiscales';
            referencedColumns: ['id'];
          },
        ];
      };
      recus: {
        Row: {
          id: string;
          code: string;
          paiement_id: string;
          contrat_id: string;
          montant: number;
          currency: string;
          issued_at: string;
          pdf_url: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code?: string;
          paiement_id: string;
          contrat_id: string;
          montant: number;
          currency?: string;
          issued_at?: string;
          pdf_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          paiement_id?: string;
          contrat_id?: string;
          montant?: number;
          currency?: string;
          issued_at?: string;
          pdf_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recus_paiement_id_fkey';
            columns: ['paiement_id'];
            isOneToOne: false;
            referencedRelation: 'paiements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recus_contrat_id_fkey';
            columns: ['contrat_id'];
            isOneToOne: false;
            referencedRelation: 'contrats';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          read: boolean;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: string;
          read?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: string;
          read?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      regles_fiscales: {
        Row: {
          id: string;
          nom: string;
          description: string | null;
          taux: number;
          commune: string[] | null;
          type_logement: string[] | null;
          type_contribuable: string[] | null;
          tranche_min: number | null;
          tranche_max: number | null;
          type_taux: string;
          montant_fixe: number | null;
          mode_application: string;
          exonere: boolean;
          motif_exoneration: string | null;
          priorite: number;
          reference_legale: string;
          article_loi: string | null;
          version: number;
          is_active: boolean;
          date_debut: string;
          date_fin: string | null;
          created_by: string | null;
          validated_by: string | null;
          validated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          description?: string | null;
          taux: number;
          commune?: string[] | null;
          type_logement?: string[] | null;
          type_contribuable?: string[] | null;
          tranche_min?: number | null;
          tranche_max?: number | null;
          type_taux?: string;
          montant_fixe?: number | null;
          mode_application?: string;
          exonere?: boolean;
          motif_exoneration?: string | null;
          priorite?: number;
          reference_legale: string;
          article_loi?: string | null;
          version?: number;
          is_active?: boolean;
          date_debut?: string;
          date_fin?: string | null;
          created_by?: string | null;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          description?: string | null;
          taux?: number;
          commune?: string[] | null;
          type_logement?: string[] | null;
          type_contribuable?: string[] | null;
          tranche_min?: number | null;
          tranche_max?: number | null;
          type_taux?: string;
          montant_fixe?: number | null;
          mode_application?: string;
          exonere?: boolean;
          motif_exoneration?: string | null;
          priorite?: number;
          reference_legale?: string;
          article_loi?: string | null;
          version?: number;
          is_active?: boolean;
          date_debut?: string;
          date_fin?: string | null;
          created_by?: string | null;
          validated_by?: string | null;
          validated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_providers: {
        Row: {
          id: string;
          provider_key: string;
          display_name: string;
          icon_url: string | null;
          subtext: string | null;
          is_active: boolean;
          is_sandbox: boolean;
          supports_partial: boolean;
          supports_refund: boolean;
          requires_phone: boolean;
          min_amount: number;
          max_amount: number;
          processing_time: string | null;
          fee_percentage: number;
          fee_fixed: number;
          refund_window_days: number;
          sort_order: number;
          config: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_key: string;
          display_name: string;
          icon_url?: string | null;
          subtext?: string | null;
          is_active?: boolean;
          is_sandbox?: boolean;
          supports_partial?: boolean;
          supports_refund?: boolean;
          requires_phone?: boolean;
          min_amount?: number;
          max_amount?: number;
          processing_time?: string | null;
          fee_percentage?: number;
          fee_fixed?: number;
          refund_window_days?: number;
          sort_order?: number;
          config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_key?: string;
          display_name?: string;
          icon_url?: string | null;
          subtext?: string | null;
          is_active?: boolean;
          is_sandbox?: boolean;
          supports_partial?: boolean;
          supports_refund?: boolean;
          requires_phone?: boolean;
          min_amount?: number;
          max_amount?: number;
          processing_time?: string | null;
          fee_percentage?: number;
          fee_fixed?: number;
          refund_window_days?: number;
          sort_order?: number;
          config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_state_history: {
        Row: {
          id: string;
          paiement_id: string;
          from_state: string | null;
          to_state: string;
          event: string;
          reason: string | null;
          actor: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paiement_id: string;
          from_state?: string | null;
          to_state: string;
          event: string;
          reason?: string | null;
          actor?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          paiement_id?: string;
          from_state?: string | null;
          to_state?: string;
          event?: string;
          reason?: string | null;
          actor?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_state_history_paiement_id_fkey';
            columns: ['paiement_id'];
            isOneToOne: false;
            referencedRelation: 'paiements';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_webhooks: {
        Row: {
          id: string;
          provider: string;
          event_type: string;
          provider_event_id: string | null;
          provider_transaction_id: string | null;
          paiement_id: string | null;
          payload: Json;
          headers: Json | null;
          signature_valid: boolean | null;
          processed: boolean;
          processed_at: string | null;
          processing_error: string | null;
          processing_attempts: number;
          source_ip: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          event_type: string;
          provider_event_id?: string | null;
          provider_transaction_id?: string | null;
          paiement_id?: string | null;
          payload: Json;
          headers?: Json | null;
          signature_valid?: boolean | null;
          processed?: boolean;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_attempts?: number;
          source_ip?: string | null;
          received_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_type?: string;
          provider_event_id?: string | null;
          provider_transaction_id?: string | null;
          paiement_id?: string | null;
          payload?: Json;
          headers?: Json | null;
          signature_valid?: boolean | null;
          processed?: boolean;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_attempts?: number;
          source_ip?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      payment_pipeline_jobs: {
        Row: {
          id: string;
          paiement_id: string;
          step: string;
          status: string;
          attempts: number;
          max_attempts: number;
          next_run_at: string;
          last_error: string | null;
          context: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paiement_id: string;
          step: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          next_run_at?: string;
          last_error?: string | null;
          context?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paiement_id?: string;
          step?: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          next_run_at?: string;
          last_error?: string | null;
          context?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          paiement_id: string | null;
          account_type: string;
          account_id: string | null;
          direction: string;
          amount: number;
          currency: string;
          description: string | null;
          reversal_of: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paiement_id?: string | null;
          account_type: string;
          account_id?: string | null;
          direction: string;
          amount: number;
          currency?: string;
          description?: string | null;
          reversal_of?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          paiement_id?: string | null;
          account_type?: string;
          account_id?: string | null;
          direction?: string;
          amount?: number;
          currency?: string;
          description?: string | null;
          reversal_of?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      calculs_fiscaux: {
        Row: {
          id: string;
          paiement_id: string | null;
          bailleur_id: string | null;
          contrat_id: string | null;
          impot_id: string | null;
          type_calcul: string;
          regles_appliquees: string[];
          base_imposable: number;
          montant_impot: number;
          taux_effectif: number | null;
          exonere: boolean;
          input: Json | null;
          detail_calcul: Json | null;
          reference_legale: string | null;
          calculation_version: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paiement_id?: string | null;
          bailleur_id?: string | null;
          contrat_id?: string | null;
          impot_id?: string | null;
          type_calcul?: string;
          regles_appliquees?: string[];
          base_imposable: number;
          montant_impot: number;
          taux_effectif?: number | null;
          exonere?: boolean;
          input?: Json | null;
          detail_calcul?: Json | null;
          reference_legale?: string | null;
          calculation_version?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          paiement_id?: string | null;
          bailleur_id?: string | null;
          contrat_id?: string | null;
          impot_id?: string | null;
          type_calcul?: string;
          regles_appliquees?: string[];
          base_imposable?: number;
          montant_impot?: number;
          taux_effectif?: number | null;
          exonere?: boolean;
          input?: Json | null;
          detail_calcul?: Json | null;
          reference_legale?: string | null;
          calculation_version?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      regles_fiscales_historique: {
        Row: {
          id: string;
          regle_id: string;
          operation: string;
          ancienne: Json | null;
          nouvelle: Json | null;
          modifie_par: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          regle_id: string;
          operation: string;
          ancienne?: Json | null;
          nouvelle?: Json | null;
          modifie_par?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          regle_id?: string;
          operation?: string;
          ancienne?: Json | null;
          nouvelle?: Json | null;
          modifie_par?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      recalculs_fiscaux: {
        Row: {
          id: string;
          lance_par: string | null;
          motif: string;
          filtres: Json;
          dry_run: boolean;
          status: string;
          nb_examines: number;
          nb_modifies: number;
          delta_total: number;
          rapport: Json | null;
          erreur: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          lance_par?: string | null;
          motif: string;
          filtres?: Json;
          dry_run?: boolean;
          status?: string;
          nb_examines?: number;
          nb_modifies?: number;
          delta_total?: number;
          rapport?: Json | null;
          erreur?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          lance_par?: string | null;
          motif?: string;
          filtres?: Json;
          dry_run?: boolean;
          status?: string;
          nb_examines?: number;
          nb_modifies?: number;
          delta_total?: number;
          rapport?: Json | null;
          erreur?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      anomalies_fiscales: {
        Row: {
          id: string;
          type: string;
          severite: string;
          titre: string;
          description: string | null;
          bailleur_id: string | null;
          logement_id: string | null;
          contrat_id: string | null;
          paiement_id: string | null;
          signaux: Json;
          action_suggeree: string | null;
          statut: string;
          traite_par: string | null;
          traite_at: string | null;
          commentaire: string | null;
          empreinte: string;
          detected_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          severite: string;
          titre: string;
          description?: string | null;
          bailleur_id?: string | null;
          logement_id?: string | null;
          contrat_id?: string | null;
          paiement_id?: string | null;
          signaux?: Json;
          action_suggeree?: string | null;
          statut?: string;
          traite_par?: string | null;
          traite_at?: string | null;
          commentaire?: string | null;
          empreinte: string;
          detected_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          severite?: string;
          titre?: string;
          description?: string | null;
          bailleur_id?: string | null;
          logement_id?: string | null;
          contrat_id?: string | null;
          paiement_id?: string | null;
          signaux?: Json;
          action_suggeree?: string | null;
          statut?: string;
          traite_par?: string | null;
          traite_at?: string | null;
          commentaire?: string | null;
          empreinte?: string;
          detected_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      communes: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      calculate_tax_for_payment: {
        Args: { payment_id: string };
        Returns: number;
      };
      check_compliance_score: {
        Args: { bailleur_id: string };
        Returns: number;
      };
      cancel_own_payment: {
        Args: { p_paiement_id: string; p_reason?: string | null };
        Returns: Database['public']['Tables']['paiements']['Row'];
      };
      expire_stale_payments: {
        Args: Record<string, never>;
        Returns: number;
      };
      regles_fiscales_applicables: {
        Args: {
          p_type_logement: string;
          p_commune: string;
          p_montant: number;
          p_type_contribuable?: string | null;
          p_date?: string;
        };
        Returns: Database['public']['Tables']['regles_fiscales']['Row'][];
      };
      get_bailleur_tax_summary: {
        Args: { p_bailleur_id: string; p_periode_prefix?: string | null };
        Returns: Json;
      };
      get_compliance_breakdown: {
        Args: { p_bailleur_id: string };
        Returns: Json;
      };
      get_fiscal_dashboard: {
        Args: { p_from: string; p_to: string };
        Returns: Json;
      };
      get_fiscal_monthly_series: {
        Args: { p_months?: number };
        Returns: {
          month: string;
          impots: number;
          loyers: number;
          paiements: number;
          nouveaux_contrats: number;
        }[];
      };
      detect_fiscal_anomalies: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_overdue_taxes: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      user_role: 'bailleur' | 'locataire' | 'agence' | 'admin' | 'agent_fiscal' | 'gestionnaire';
      kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected';
      property_type: 'Appartement' | 'Studio' | 'Villa' | 'Bureau' | 'Magasin' | 'Entrepôt';
      property_status: 'disponible' | 'occupe' | 'maintenance' | 'inactif';
      contract_status:
        | 'brouillon'
        | 'en_attente_signature'
        | 'actif'
        | 'suspendu'
        | 'resilie'
        | 'expire';
      payment_method: 'Orange Money' | 'M-Pesa' | 'Airtel Money' | 'Bank' | 'Cash';
      payment_status: 'en_attente' | 'en_cours' | 'complete' | 'echoue' | 'rembourse';
      tax_status: 'calcule' | 'declare' | 'paye' | 'en_retard' | 'exonere' | 'annule';
      compliance_level: 'excellent' | 'good' | 'warning' | 'critical';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type User = Tables<'users'>;
export type Bailleur = Tables<'bailleurs'>;
export type Logement = Tables<'logements'>;
export type Contrat = Tables<'contrats'>;
export type Paiement = Tables<'paiements'>;
export type Impot = Tables<'impots'>;
export type Recu = Tables<'recus'>;
export type Notification = Tables<'notifications'>;
export type AuditLog = Tables<'audit_logs'>;
export type RegleFiscale = Tables<'regles_fiscales'>;
export type PaymentProvider = Tables<'payment_providers'>;
export type PaymentStateHistory = Tables<'payment_state_history'>;
export type PaymentWebhook = Tables<'payment_webhooks'>;
export type LedgerEntry = Tables<'ledger_entries'>;
export type CalculFiscal = Tables<'calculs_fiscaux'>;
export type AnomalieFiscale = Tables<'anomalies_fiscales'>;
export type RecalculFiscal = Tables<'recalculs_fiscaux'>;
