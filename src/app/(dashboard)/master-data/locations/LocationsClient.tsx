"use client";
// LocationsClient.tsx — interactive client component for Locations master data.
// All 11 location types, 5 ownership types, slide-over form, archive.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Plus, Search, X, Warehouse, Pencil, Archive } from "lucide-react";
import {
  addLocation,
  updateLocation,
  archiveLocation,
  type LocationFormState,
} from "@/actions/locations";

// ─── Types ─────────────────────────────────────────────────────
type Location = {
  id: string;
  name: string;
  code: string | null;
  location_type: string;
  ownership: string;
  state: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  capacity_sqft: number | null;
  is_active: boolean;
  created_at: string;
};

interface Props {
  initialData: Location[];
}

// ─── Constants ─────────────────────────────────────────────────
const LOCATION_TYPES = [
  "OWN", "CF_DEPOT", "QUARANTINE", "VIRTUAL", "BRANCH_WAREHOUSE",
  "COMPANY_DEPOT", "THIRD_PARTY", "IN_TRANSIT", "DAMAGED", "EXPIRED", "CUSTOMER_CONSIGNMENT",
] as const;

const TYPE_COLORS: Record<string, string> = {
  OWN:                   "badge badge-green",
  CF_DEPOT:              "badge badge-navy",
  QUARANTINE:            "badge badge-red",
  VIRTUAL:               "badge badge-gray",
  BRANCH_WAREHOUSE:      "badge badge-green",
  COMPANY_DEPOT:         "badge badge-navy",
  THIRD_PARTY:           "badge badge-gold",
  IN_TRANSIT:            "badge badge-memo",
  DAMAGED:               "badge badge-red",
  EXPIRED:               "badge badge-red",
  CUSTOMER_CONSIGNMENT:  "badge badge-memo",
};

const OWNERSHIP_COLORS: Record<string, string> = {
  OWN:         "badge badge-green",
  CF_AGENT:    "badge badge-navy",
  COMPANY:     "badge badge-memo",
  THIRD_PARTY: "badge badge-gold",
  GOVERNMENT:  "badge badge-gray",
};

// ─── Submit Button ─────────────────────────────────────────────
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full" aria-busy={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

// ─── Slide-over Form ───────────────────────────────────────────
const INIT: LocationFormState = {};

function LocationSlideOver({
  isOpen,
  editItem,
  onClose,
}: {
  isOpen: boolean;
  editItem: Location | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const boundAction = editItem ? updateLocation.bind(null, editItem.id) : addLocation;
  const [state, formAction] = useFormState(boundAction, INIT);

  useEffect(() => {
    if (state.success) {
      toast.success(editItem ? "Location updated" : "Location added");
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
        aria-label={editItem ? "Edit Location" : "Add Location"}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <h2 className="text-base font-semibold text-ink">
            {editItem ? "Edit Location" : "Add Location"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-subtle text-ink-muted" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form action={formAction} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="loc-name">
                Name <span className="text-danger-600">*</span>
              </label>
              <input
                id="loc-name"
                name="name"
                defaultValue={editItem?.name ?? ""}
                className="input w-full"
                required
                placeholder="e.g. Nagpur Main Warehouse"
              />
              {fe.name && <p className="form-error">{fe.name[0]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="loc-code">Code</label>
                <input id="loc-code" name="code" defaultValue={editItem?.code ?? ""} className="input w-full" placeholder="NGP-WH-01" />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-type">
                  Location Type <span className="text-danger-600">*</span>
                </label>
                <select
                  id="loc-type"
                  name="location_type"
                  defaultValue={editItem?.location_type ?? "OWN"}
                  className="input w-full"
                  required
                >
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
                {fe.location_type && <p className="form-error">{fe.location_type[0]}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="loc-ownership">Ownership</label>
                <select
                  id="loc-ownership"
                  name="ownership"
                  defaultValue={editItem?.ownership ?? "OWN"}
                  className="input w-full"
                >
                  <option value="OWN">Own</option>
                  <option value="CF_AGENT">C&F Agent</option>
                  <option value="COMPANY">Company</option>
                  <option value="THIRD_PARTY">Third Party</option>
                  <option value="GOVERNMENT">Government</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="loc-state">State</label>
                <input id="loc-state" name="state" defaultValue={editItem?.state ?? ""} className="input w-full" placeholder="Maharashtra" />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="loc-address">Address</label>
              <textarea id="loc-address" name="address" rows={2} className="input w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label" htmlFor="loc-pincode">Pincode</label>
                <input id="loc-pincode" name="pincode" className="input w-full" maxLength={6} />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-gst_state">GST State</label>
                <input id="loc-gst_state" name="gst_state" className="input w-full" placeholder="27" maxLength={2} />
              </div>
              <div className="col-span-2">
                <label className="form-label" htmlFor="loc-gstin">GSTIN of Location</label>
                <input id="loc-gstin" name="gstin_of_location" className="input w-full font-mono" placeholder="27AAAAA0000A1Z5" />
              </div>
              <div className="col-span-2">
                <label className="form-label" htmlFor="loc-licence">Licence No.</label>
                <input id="loc-licence" name="licence_no" className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-contact">Contact Person</label>
                <input id="loc-contact" name="contact_person" defaultValue={editItem?.contact_person ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-phone">Contact Phone</label>
                <input id="loc-phone" name="contact_phone" defaultValue={editItem?.contact_phone ?? ""} className="input w-full" />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-capacity">Capacity (sq. ft.)</label>
                <input
                  id="loc-capacity"
                  name="capacity_sqft"
                  type="number"
                  min={0}
                  defaultValue={editItem?.capacity_sqft ?? ""}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="loc-freq">Stock Confirm Freq (days)</label>
                <input
                  id="loc-freq"
                  name="stock_confirmation_freq_days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={30}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton label={editItem ? "Update Location" : "Add Location"} />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Main Client Component ─────────────────────────────────────
export default function LocationsClient({ initialData }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<Location | null>(null);

  const openAdd = useCallback(() => { setEditItem(null); setIsOpen(true); }, []);
  const openEdit = useCallback((l: Location) => { setEditItem(l); setIsOpen(true); }, []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive location "${name}"?`)) return;
    const res = await archiveLocation(id);
    if (res.success) { toast.success("Location archived"); router.refresh(); }
    else toast.error(res.error ?? "Failed");
  };

  const filtered = initialData.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.state ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Warehouses, depots, godowns and virtual stock locations</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Location
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code or state…"
          className="w-full pl-9 pr-4 py-2 bg-white border border-surface-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500/20 focus:border-leaf-500 placeholder:text-ink-faint shadow-sm"
          aria-label="Search locations"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Ownership</th>
                <th>State</th>
                <th>Contact</th>
                <th className="text-right">Capacity (sqft)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Warehouse className="mx-auto mb-3 h-10 w-10 text-ink-faint" />
                    <p className="text-sm font-medium text-ink">
                      {search ? "No locations match your search" : "No locations yet"}
                    </p>
                    {!search && (
                      <button onClick={openAdd} className="mt-3 text-xs text-leaf-600 hover:underline">
                        Add your first location
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs text-ink-muted">{l.code ?? "—"}</td>
                    <td className="font-medium text-ink">{l.name}</td>
                    <td>
                      <span className={TYPE_COLORS[l.location_type] ?? "badge badge-gray"}>
                        {l.location_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <span className={OWNERSHIP_COLORS[l.ownership] ?? "badge badge-gray"}>
                        {l.ownership.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="text-ink-muted">{l.state ?? "—"}</td>
                    <td>
                      <div className="text-sm text-ink">{l.contact_person ?? "—"}</div>
                      {l.contact_phone && (
                        <div className="text-xs text-ink-muted">{l.contact_phone}</div>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-ink-muted">
                      {l.capacity_sqft != null ? l.capacity_sqft.toLocaleString("en-IN") : "—"}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(l)}
                          className="p-1.5 rounded hover:bg-surface-subtle text-ink-muted hover:text-ink transition-colors"
                          aria-label={`Edit ${l.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(l.id, l.name)}
                          className="p-1.5 rounded hover:bg-danger-50 text-ink-muted hover:text-danger-600 transition-colors"
                          aria-label={`Archive ${l.name}`}
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
            {filtered.length} of {initialData.length} locations
          </div>
        )}
      </div>

      <LocationSlideOver isOpen={isOpen} editItem={editItem} onClose={closePanel} />
    </div>
  );
}
