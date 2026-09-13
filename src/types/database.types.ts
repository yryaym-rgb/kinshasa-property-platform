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
          name: string;
          description: string | null;
          taux: number;
          commune: string | null;
          property_type: Database['public']['Enums']['property_type'] | null;
          min_amount: number | null;
          max_amount: number | null;
          active: boolean;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          taux: number;
          commune?: string | null;
          property_type?: Database['public']['Enums']['property_type'] | null;
          min_amount?: number | null;
          max_amount?: number | null;
          active?: boolean;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          taux?: number;
          commune?: string | null;
          property_type?: Database['public']['Enums']['property_type'] | null;
          min_amount?: number | null;
          max_amount?: number | null;
          active?: boolean;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
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
    };
    Enums: {
      user_role: 'bailleur' | 'locataire' | 'agence' | 'admin' | 'agent_fiscal' | 'gestionnaire';
      kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected';
      property_type: 'Appartement' | 'Studio' | 'Villa' | 'Bureau' | 'Magasin' | 'Entrepôt';
      property_status: 'disponible' | 'occupe' | 'maintenance' | 'inactif';
      contract_status: 'brouillon' | 'actif' | 'suspendu' | 'resilie' | 'expire';
      payment_method: 'Orange Money' | 'M-Pesa' | 'Airtel Money' | 'Bank' | 'Cash';
      payment_status: 'en_attente' | 'en_cours' | 'complete' | 'echoue' | 'rembourse';
      tax_status: 'calcule' | 'declare' | 'paye' | 'en_retard' | 'exonere';
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
