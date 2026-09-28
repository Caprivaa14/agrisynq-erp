"use client";
// FarmersClient.tsx — interactive client component for Farmers master data.
// 3-section form: Personal, Location, Agriculture. Aadhaar last-4 only.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus, Search, X, Sprout, Pencil, Archive } from "lucide-react";
import {
  addFarmer,
  updateFarmer,
  archiveFarmer,
  type FarmerFormState,
} from "@/actions/farmers";
import { maskAadhaar } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────
type Farmer = {
  id: string;
  farmer_code: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  land_category: string;
  cultivated_area_acres: number | null;
  aadhaar_last4: string | null;
  kyc_status: string;
  is_active: boolean;
  created_at: string;
};

interface Props {
  initialData: Farmer[];
}

// ─── KYC Badge ─────────────────────────────────────────────────
function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NOT_COLLECTED: "badge badge-red",
    PARTIAL:       "badge badge-gold",
    COMPLETE:      "badge badge-memo",
    VERIFIED:      "badge badge-green",
  };
  const labels: Record<string, string> = {
    NOT_COLLECTED: "Not Collected",
    PARTIAL:       "Partial",
    COMPLETE:      "Complete",
    VERIFIED:      "Verified",
  };
  return <span className={map[status] ?? "badge badge-gray"}>{labels[status] ?? status}</span>;
}

// ─── Land Category Badge ────────────────────────────────────────
function LandBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    OWNER:       "badge badge-green",
    TENANT:      "badge badge-gold",
    SHARECROPPER:"badge badge-memo",
    OTHER:       "badge badge-gray",
  };
  return <span className={map[cat] ?? "badge badge-gray"}>{cat}</span>;
}

// ─── Submit Button ─────────────────────────────────────────────
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full" aria-busy={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────────
function Section({ title }: { title: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</span>
      <div className="flex-1 border-t border-surface-border" />
    </div>
  );
}

// ─── Slide-over Form ───────────────────────────────────────────
const INIT: FarmerFormState = {};

function FarmerSlideOver({
  isOpen,
  editItem,
  onClose,
}: {
  isOpen: boolean;
  editItem: Farmer | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const boundAction = editItem ? updateFarmer.bind(null, editItem.id) : addFarmer;
  const [state, formAction] = useFormState(boundAction, INIT);

  useEffect(() => {
    if (state.success) {
      toast.success(editItem ? "Farmer updated" : "Farmer added");
      router.refresh();
      onClose();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  const fe = state.fieldErrors ?? {};

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden="true" />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label={editItem ? "Edit Farmer" : "Add Farmer"}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {editItem ? "Edit Farmer" : "Add Farmer"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-subtle text-ink-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form action={formAction} className="space-y-4">

            {/* ── Section 1: Personal ── */}
            <Section title="Personal Information" />

            <div>
              <label className="form-label" htmlFor="fm-first_name">
                First Name <span className="text-danger-600">*</span>
              </label>
              <input
                id="fm-first_name"
                name="first_name"
                defaultValue={editItem?.first_name ?? ""}
                className="input w-full"
                required
                placeholder="Rajesh"
              />
              {fe.first_name && <p className="form-error">{fe.first_name[0]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="fm-last_name">Last Name</label>
                <input id="fm-last_name" name="last_name" defaultValue={editItem?.last_name ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-father">Father / Spouse Name</label>
                <input id="fm-father" name="father_spouse_name" className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-phone">Phone</label>
                <input
                  id="fm-phone"
                  name="phone"
                  defaultValue={editItem?.phone ?? ""}
                  className="input w-full"
                  placeholder="9876543210"
                  maxLength={10}
                />
                {fe.phone && <p className="form-error">{fe.phone[0]}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="fm-alt_phone">Alt Phone</label>
                <input id="fm-alt_phone" name="alt_phone" className="input w-full" />
              </div>
            </div>

            {/* ── Section 2: Location ── */}
            <Section title="Location" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="fm-village">Village</label>
                <input id="fm-village" name="village" defaultValue={editItem?.village ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-gp">Gram Panchayat</label>
                <input id="fm-gp" name="gram_panchayat" className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-block">Block</label>
                <input id="fm-block" name="block_name" className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-district">District</label>
                <input id="fm-district" name="district" defaultValue={editItem?.district ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-state">State</label>
                <input id="fm-state" name="state" defaultValue={editItem?.state ?? ""} className="input w-full" placeholder="Maharashtra" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-pin">PIN Code</label>
                <input id="fm-pin" name="pin" className="input w-full" maxLength={6} />
              </div>
            </div>

            {/* ── Section 3: Agriculture ── */}
            <Section title="Agriculture Details" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="fm-land_cat">Land Category</label>
                <select
                  id="fm-land_cat"
                  name="land_category"
                  defaultValue={editItem?.land_category ?? "OWNER"}
                  className="input w-full"
                >
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                  <option value="SHARECROPPER">Sharecropper</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="fm-area">Cultivated Area (acres)</label>
                <input
                  id="fm-area"
                  name="cultivated_area_acres"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={editItem?.cultivated_area_acres ?? ""}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-crop">Primary Crop</label>
                <input id="fm-crop" name="primary_crop" className="input w-full" placeholder="Wheat" />
              </div>
              <div>
                <label className="form-label" htmlFor="fm-season">Primary Season</label>
                <input id="fm-season" name="primary_season" className="input w-full" placeholder="Rabi" />
              </div>
              <div className="col-span-2">
                <label className="form-label" htmlFor="fm-reg_no">Farmer Registration No.</label>
                <input id="fm-reg_no" name="farmer_registration_no" className="input w-full font-mono" />
              </div>

              {/* Aadhaar last 4 */}
              <div className="col-span-2">
                <label className="form-label" htmlFor="fm-aadhaar">
                  Aadhaar Last 4 Digits
                </label>
                <input
                  id="fm-aadhaar"
                  name="aadhaar_last4"
                  defaultValue={editItem?.aadhaar_last4 ?? ""}
                  className="input w-full font-mono"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="e.g. 4321"
                />
                <p className="form-hint">
                  Enter only the last 4 digits — full Aadhaar is never stored.
                </p>
                {fe.aadhaar_last4 && <p className="form-error">{fe.aadhaar_last4[0]}</p>}
              </div>

              {/* KYC */}
              <div>
                <label className="form-label" htmlFor="fm-kyc">KYC Status</label>
                <select
                  id="fm-kyc"
                  name="kyc_status"
                  defaultValue={editItem?.kyc_status ?? "NOT_COLLECTED"}
                  className="input w-full"
                >
                  <option value="NOT_COLLECTED">Not Collected</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="VERIFIED">Verified</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="fm-consent">Consent Date</label>
                <input id="fm-consent" name="consent_date" type="date" className="input w-full" />
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton label={editItem ? "Update Farmer" : "Add Farmer"} />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Main Client Component ─────────────────────────────────────
export default function FarmersClient({ initialData }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<Farmer | null>(null);

  const openAdd = useCallback(() => { setEditItem(null); setIsOpen(true); }, []);
  const openEdit = useCallback((f: Farmer) => { setEditItem(f); setIsOpen(true); }, []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive farmer "${name}"? Statutory records are retained.`)) return;
    const res = await archiveFarmer(id);
    if (res.success) { toast.success("Farmer archived"); router.refresh(); }
    else toast.error(res.error ?? "Failed");
  };

  const filtered = initialData.filter(
    (f) =>
      `${f.first_name} ${f.last_name ?? ""}`.toLowerCase().includes(search.toLowerCase()) ||
      f.farmer_code.toLowerCase().includes(search.toLowerCase()) ||
      (f.phone ?? "").includes(search) ||
      (f.village ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Farmers</h1>
          <p className="page-subtitle">Registered farmer profiles, KYC and land records</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Farmer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, phone or village…"
          className="w-full pl-9 pr-4 py-2 bg-white border border-surface-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500/20 focus:border-leaf-500 placeholder:text-ink-faint shadow-sm"
          aria-label="Search farmers"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Land</th>
                <th className="text-right">Area (ac)</th>
                <th>Aadhaar</th>
                <th>KYC</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Sprout className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                    <p className="text-sm font-medium text-ink">
                      {search ? "No farmers match your search" : "No farmers registered yet"}
                    </p>
                    {!search && (
                      <button onClick={openAdd} className="mt-3 text-xs text-leaf-600 hover:underline">
                        Add your first farmer
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id}>
                    <td className="font-mono text-xs text-ink-muted">{f.farmer_code}</td>
                    <td>
                      <div className="font-medium text-ink">
                        {f.first_name} {f.last_name ?? ""}
                      </div>
                    </td>
                    <td className="text-ink-muted">{f.phone ?? "—"}</td>
                    <td>
                      <div className="text-sm text-ink">{f.village ?? "—"}</div>
                      <div className="text-xs text-ink-muted">
                        {[f.district, f.state].filter(Boolean).join(" › ")}
                      </div>
                    </td>
                    <td>
                      <LandBadge cat={f.land_category} />
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {f.cultivated_area_acres != null ? f.cultivated_area_acres.toFixed(2) : "—"}
                    </td>
                    <td className="font-mono text-xs text-ink-muted">
                      {f.aadhaar_last4 ? maskAadhaar(f.aadhaar_last4) : "—"}
                    </td>
                    <td>
                      <KycBadge status={f.kyc_status} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          className="p-1.5 rounded hover:bg-surface-subtle text-ink-muted hover:text-ink transition-colors"
                          aria-label={`Edit ${f.first_name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(f.id, `${f.first_name} ${f.last_name ?? ""}`)}
                          className="p-1.5 rounded hover:bg-danger-50 text-ink-muted hover:text-danger-600 transition-colors"
                          aria-label={`Archive ${f.first_name}`}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-surface-border px-4 py-3 text-xs text-ink-muted">
            {filtered.length} of {initialData.length} farmers
          </div>
        )}
      </div>

      <FarmerSlideOver isOpen={isOpen} editItem={editItem} onClose={closePanel} />
    </div>
  );
}
