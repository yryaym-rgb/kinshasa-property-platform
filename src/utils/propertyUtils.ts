import type { Logement, Json } from '@/types/database.types';
import type { KinshasaCommune, PropertyStatus, PropertyType } from '@/types';
import { formatAddress, generatePropertyCode } from '@/lib/utils';

export interface PropertyMetadata {
  province?: string;
  ville?: string;
  numero?: string;
  immeuble?: string;
  appartement?: string;
  chambres?: number;
  sallesDeBain?: number;
  etage?: number;
  chargesMensuelles?: number;
  depotGarantie?: number;
  paymentDay?: number;
  amenities?: string[];
}

export interface PropertyDocumentFile {
  id: string;
  name: string;
  url: string;
  type: string;
  verified: boolean;
  uploadedAt: string;
}

export interface PropertyDocumentsPayload {
  metadata?: PropertyMetadata;
  uploads?: PropertyDocumentFile[];
}

export const PROPERTY_AMENITIES = [
  'Eau courante',
  'Électricité',
  'Climatisation',
  'Parking',
  'Sécurité 24/7',
  'Internet',
  'Générateur',
  'Forage',
  'Ascenseur',
  'Gardien',
  'Interphone',
  'Chauffe-eau',
] as const;

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  disponible: 'Disponible',
  occupe: 'En location',
  maintenance: 'En travaux',
  inactif: 'Archivé',
};

export const STATUS_FILTER_MAP: Record<string, PropertyStatus | 'all'> = {
  tous: 'all',
  'en-location': 'occupe',
  disponible: 'disponible',
  'en-travaux': 'maintenance',
};

export function parsePropertyDocuments(documents: Json | null): PropertyDocumentsPayload {
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) {
    return {};
  }
  const payload = documents as PropertyDocumentsPayload;
  return {
    metadata: payload.metadata ?? {},
    uploads: payload.uploads ?? [],
  };
}

export function buildPropertyDocuments(
  metadata: PropertyMetadata,
  uploads: PropertyDocumentFile[] = [],
): PropertyDocumentsPayload {
  return { metadata, uploads };
}

export function getPropertyMetadata(logement: Logement): PropertyMetadata {
  return parsePropertyDocuments(logement.documents).metadata ?? {};
}

export function getPropertyCoordinates(logement: Logement): { lat: number; lng: number } | null {
  if (!logement.coordinates || typeof logement.coordinates !== 'object' || Array.isArray(logement.coordinates)) {
    return null;
  }
  const coords = logement.coordinates as { lat?: number; lng?: number };
  if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return { lat: coords.lat, lng: coords.lng };
  }
  return null;
}

export function formatPropertyAddress(logement: Logement): string {
  const meta = getPropertyMetadata(logement);
  const numero = meta.numero ? `${meta.numero}, ` : '';
  const avenue = logement.avenue ? `Av. ${logement.avenue}` : logement.address;
  return `${numero}${avenue}, ${logement.commune}, Kinshasa`;
}

export function formatPropertyTypeLabel(type: PropertyType, rooms?: number | null): string {
  if (rooms) return `${type} ${rooms} pièces`;
  return type;
}

export function getPropertyDisplayTitle(logement: Logement): string {
  const meta = getPropertyMetadata(logement);
  if (meta.immeuble) return meta.immeuble;
  return formatPropertyTypeLabel(logement.type, logement.rooms);
}

export function getPropertyVerificationUrl(code: string): string {
  const base = import.meta.env.VITE_APP_URL ?? window.location.origin;
  return `${base}/verifier/${code}`;
}

export function previewPropertyCode(
  commune: KinshasaCommune,
  avenue?: string,
  parcelle?: string,
  type: PropertyType = 'Appartement',
): string {
  const typePrefix = type === 'Studio' ? 'STU' : type === 'Villa' ? 'VIL' : type === 'Bureau' ? 'BUR' : type === 'Magasin' ? 'MAG' : 'APP';
  return generatePropertyCode(commune, avenue, parcelle, typePrefix, 1);
}

export function buildFullAddress(logement: Logement): string {
  const meta = getPropertyMetadata(logement);
  return formatAddress({
    address: meta.numero ? `N° ${meta.numero}` : logement.address,
    avenue: logement.avenue,
    parcelle: logement.parcelle,
    quartier: logement.quartier,
    commune: logement.commune,
  });
}

export function mapStatusToFilter(status: PropertyStatus): string {
  switch (status) {
    case 'occupe':
      return 'en-location';
    case 'maintenance':
      return 'en-travaux';
    case 'inactif':
      return 'archive';
    default:
      return status;
  }
}
