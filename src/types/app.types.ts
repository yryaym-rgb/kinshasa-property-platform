import type { ReactNode } from 'react';
import type { PROPERTY_TYPES, PAYMENT_PROVIDERS } from '@/config/app.config';
import type { KinshasaCommune } from '@/config/communes';
import type {
  User,
  Bailleur,
  Logement,
  Contrat,
  Paiement,
  Impot,
  Recu,
  Notification,
} from './database.types';

export type UserRole =
  | 'bailleur'
  | 'locataire'
  | 'agence'
  | 'admin'
  | 'agent_fiscal'
  | 'gestionnaire';

export type PaymentMethod = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentStatus = 'en_attente' | 'en_cours' | 'complete' | 'echoue' | 'rembourse';
export type ContractStatus =
  | 'brouillon'
  | 'en_attente_signature'
  | 'actif'
  | 'suspendu'
  | 'resilie'
  | 'expire';
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type PropertyStatus = 'disponible' | 'occupe' | 'maintenance' | 'inactif';
export type TaxStatus = 'calcule' | 'declare' | 'paye' | 'en_retard' | 'exonere';
export type ComplianceLevel = 'excellent' | 'good' | 'warning' | 'critical';
export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type { KinshasaCommune };

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthUser extends User {
  bailleur?: Bailleur | null;
}

export interface LoginFormData {
  phone: string;
  password?: string;
  rememberMe?: boolean;
}

export interface RegisterFormData {
  role: UserRole;
  phone: string;
  fullName: string;
  email?: string;
  commune?: KinshasaCommune;
  address?: string;
  password?: string;
}

export interface VerifyOTPFormData {
  phone: string;
  token: string;
}

export interface PropertyFormData {
  type: PropertyType;
  commune: KinshasaCommune;
  address: string;
  quartier?: string;
  avenue?: string;
  parcelle?: string;
  loyerMensuel: number;
  currency: 'CDF' | 'USD';
  rooms?: number;
  surfaceM2?: number;
  description?: string;
}

export interface ContractFormData {
  logementId: string;
  locataireId: string;
  dateDebut: string;
  dateFin?: string;
  loyerMensuel: number;
  depotGarantie?: number;
  currency: 'CDF' | 'USD';
  paymentDay: number;
}

export interface PaymentFormData {
  contratId: string;
  montant: number;
  currency: 'CDF' | 'USD';
  method: PaymentMethod;
  periode: string;
  provider?: string;
}

export interface UserProfileFormData {
  fullName: string;
  email?: string;
  commune?: KinshasaCommune;
  address?: string;
  avatarUrl?: string;
}

export interface NotificationItem extends Notification {
  icon?: string;
}

export interface DashboardKPI {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface FileUploadResult {
  url: string;
  path: string;
  name: string;
  size: number;
  type: string;
}

export type EntityWithRelations = {
  logement: Logement & { bailleur?: Bailleur };
  contrat: Contrat & { logement?: Logement; locataire?: User };
  paiement: Paiement & { contrat?: Contrat };
  impot: Impot & { contrat?: Contrat; paiement?: Paiement };
  recu: Recu & { paiement?: Paiement; contrat?: Contrat };
};
