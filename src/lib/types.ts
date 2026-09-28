/**
 * Shared domain types for FertiLedger ERP.
 * These types mirror the database schema and are used across
 * server actions, UI components, and forms.
 */

// ─── Enums (matching DB enum values) ──────────────────────────

export type PartyType = "CUSTOMER" | "SUPPLIER" | "CF_AGENT" | "BOTH";

export type GstStatus =
  | "REGULAR"
  | "COMPOSITION"
  | "UNREGISTERED"
  | "EXEMPT"
  | "SUSPENDED"
  | "CANCELLED";

export type ProductCategory =
  | "FERTILIZER"
  | "PESTICIDE"
  | "SEED"
  | "OTHER"
  | "MICRONUTRIENT"
  | "BIO_FERTILIZER"
  | "PLANT_GROWTH"
  | "WEEDICIDE"
  | "FUNGICIDE"
  | "INSECTICIDE"
  | "RODENTICIDE"
  | "ADJUVANT";

export type TaxStatus = "TAXABLE" | "EXEMPT" | "NIL_RATED" | "NON_GST";

export type LandCategory = "OWNER" | "TENANT" | "SHARECROPPER" | "OTHER";

export type KycStatus = "NOT_COLLECTED" | "PARTIAL" | "COMPLETE" | "VERIFIED";

export type LocationType =
  | "OWN"
  | "CF_DEPOT"
  | "QUARANTINE"
  | "VIRTUAL"
  | "BRANCH_WAREHOUSE"
  | "COMPANY_DEPOT"
  | "THIRD_PARTY"
  | "IN_TRANSIT"
  | "DAMAGED"
  | "EXPIRED"
  | "CUSTOMER_CONSIGNMENT";

export type LocationOwnership = "OWN" | "CF_AGENT" | "COMPANY" | "THIRD_PARTY" | "GOVERNMENT";

export type LicenceType =
  | "FERTILIZER"
  | "PESTICIDE"
  | "SEED"
  | "RETAIL"
  | "FERTILIZER_WHOLESALE"
  | "FERTILIZER_RETAIL"
  | "INSECTICIDE"
  | "STORAGE";

export type LicenceEntityType = "ORGANISATION" | "PARTY" | "BRANCH" | "LOCATION";

export type LicenceStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELLED"
  | "PENDING_RENEWAL";

export type LockType = "FINANCIAL" | "GST" | "FMS" | "BANK" | "STOCK";

// ─── Domain Models (matching DB table rows) ────────────────────

export interface Party {
  id: string;
  tenant_id: string;
  organisation_id: string;
  name: string;
  code: string | null;
  alias: string | null;
  party_type: PartyType;
  is_customer: boolean;
  is_supplier: boolean;
  is_cf_agent: boolean;
  is_transporter: boolean;
  is_wholesaler_licensed: boolean;
  is_retailer_licensed: boolean;
  is_institutional: boolean;
  gstin: string | null;
  gst_status: GstStatus;
  pan: string | null;
  state_code: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  state: string | null;
  pincode: string | null;
  credit_limit: number;
  credit_days: number;
  fms_dealer_id: string | null;
  fms_retailer_id: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  organisation_id: string;
  name: string;
  product_code: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: ProductCategory;
  subcategory: string | null;
  hsn_code: string;
  unit_of_measure: string;
  gst_rate: number;
  tax_status: TaxStatus;
  cess_rate: number;
  mrp: number | null;
  selling_price: number | null;
  purchase_price: number | null;
  min_selling_rate: number | null;
  pack_size: number | null;
  pack_uom: string | null;
  batch_required: boolean;
  expiry_required: boolean;
  reorder_level: number;
  licence_controlled: boolean;
  fms_product_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Farmer {
  id: string;
  tenant_id: string;
  organisation_id: string;
  farmer_code: string | null;
  first_name: string;
  last_name: string | null;
  father_spouse_name: string | null;
  phone: string | null;
  alt_phone: string | null;
  village: string | null;
  gram_panchayat: string | null;
  block_name: string | null;
  district: string | null;
  state: string | null;
  pin: string | null;
  land_category: LandCategory;
  cultivated_area_acres: number | null;
  primary_crop: string | null;
  aadhaar_last4: string | null;
  kyc_status: KycStatus;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  tenant_id: string;
  organisation_id: string;
  name: string;
  code: string | null;
  location_type: LocationType;
  ownership: LocationOwnership;
  address: string | null;
  state: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  capacity_sqft: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Licence {
  id: string;
  tenant_id: string;
  organisation_id: string;
  licence_number: string;
  licence_type: LicenceType;
  entity_type: LicenceEntityType;
  entity_id: string | null;
  valid_from: string;
  valid_to: string;
  issuing_authority: string | null;
  approved_categories: string[];
  status: LicenceStatus;
  renewal_reminder_days: number;
  is_active: boolean;
  created_at: string;
}

export interface TaxProfile {
  id: string;
  tenant_id: string;
  product_category: string | null;
  hsn_code: string;
  description: string | null;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  is_exempt: boolean;
  is_nil_rated: boolean;
  exemption_reason: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Display Label Maps ────────────────────────────────────────

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  FERTILIZER:     "Fertilizer",
  PESTICIDE:      "Pesticide",
  SEED:           "Seed",
  OTHER:          "Other",
  MICRONUTRIENT:  "Micronutrient",
  BIO_FERTILIZER: "Bio-Fertilizer",
  PLANT_GROWTH:   "Plant Growth",
  WEEDICIDE:      "Weedicide",
  FUNGICIDE:      "Fungicide",
  INSECTICIDE:    "Insecticide",
  RODENTICIDE:    "Rodenticide",
  ADJUVANT:       "Adjuvant",
};

export const PRODUCT_CATEGORY_BADGE: Record<ProductCategory, string> = {
  FERTILIZER:     "badge-success",
  PESTICIDE:      "badge-danger",
  SEED:           "badge-warning",
  OTHER:          "badge",
  MICRONUTRIENT:  "badge-info",
  BIO_FERTILIZER: "badge-success",
  PLANT_GROWTH:   "badge-success",
  WEEDICIDE:      "badge-danger",
  FUNGICIDE:      "badge-danger",
  INSECTICIDE:    "badge-danger",
  RODENTICIDE:    "badge-danger",
  ADJUVANT:       "badge",
};

export const GST_STATUS_LABELS: Record<GstStatus, string> = {
  REGULAR:       "Regular",
  COMPOSITION:   "Composition",
  UNREGISTERED:  "Unregistered",
  EXEMPT:        "Exempt",
  SUSPENDED:     "Suspended",
  CANCELLED:     "Cancelled",
};

export const KYC_STATUS_BADGE: Record<KycStatus, string> = {
  NOT_COLLECTED: "badge-danger",
  PARTIAL:       "badge-warning",
  COMPLETE:      "badge-info",
  VERIFIED:      "badge-success",
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  NOT_COLLECTED: "Not Collected",
  PARTIAL:       "Partial",
  COMPLETE:      "Complete",
  VERIFIED:      "Verified",
};

export const LICENCE_STATUS_BADGE: Record<LicenceStatus, string> = {
  ACTIVE:          "badge-success",
  EXPIRED:         "badge-danger",
  SUSPENDED:       "badge-warning",
  CANCELLED:       "badge",
  PENDING_RENEWAL: "badge-warning",
};
