"use client";

import { Suspense, lazy } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { lookupOEM, type VehicleData } from "@/lib/vin/normalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Car,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  Info,
  PenLine,
  Wrench,
  Package,
  ScanBarcode,
} from "lucide-react";
import dynamic from "next/dynamic";

const BarcodeScanner = dynamic(
  () => import("@/components/scanner/barcode-scanner").then((m) => ({ default: m.BarcodeScanner })),
  { ssr: false }
);

// ─── Types ───────────────────────────────────────────────────────────────────

type PricedLineItem = {
  type: "part" | "labor" | "fee" | "tax";
  source: "recommended" | "manual";
  serviceId?: string;
  partNumber?: string;
  laborOpCode?: string;
  description: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalPrice: number;
};

type ROEstimate = {
  lineItems: PricedLineItem[];
  partsSubtotal: number;
  laborSubtotal: number;
  shopSupplyFee: number;
  taxAmount: number;
  total: number;
};

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  isRequired: boolean;
};

type ScheduleGroup = {
  mileageInterval: number;
  services: ServiceItem[];
  tier: "required" | "recommended";
};

type OTPRItem = {
  id: string;
  name: string;
  description: string | null;
  serviceCategory: string;
  mileageThreshold: number;
  urgencyTier: string;
};

type OTPRResult = {
  urgent: OTPRItem[];
  suggested: OTPRItem[];
  informational: OTPRItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMileage(n: number) {
  return n.toLocaleString();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ServiceCard({
  service,
  checked,
  onToggle,
}: {
  service: ServiceItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left p-4 rounded-lg border-2 transition-colors min-h-[3.5rem]",
        checked
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:border-primary/50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">
          {checked ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm">{service.name}</span>
            {service.category && (
              <span className="text-xs text-muted-foreground bg-surface px-2 py-0.5 rounded">
                {service.category}
              </span>
            )}
          </div>
          {service.description && (
            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function OTPRSection({
  title,
  items,
  icon: Icon,
  colorClass,
  borderClass,
  checked,
  onToggle,
}: {
  title: string;
  items: OTPRItem[];
  icon: React.ElementType;
  colorClass: string;
  borderClass: string;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  return (
    <div className={`border-2 ${borderClass} rounded-lg overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 ${colorClass} text-left`}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-xs opacity-75">({items.length})</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-transparent">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border-2 transition-colors",
                checked.has(item.id)
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-primary">
                  {checked.has(item.id) ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{item.name}</span>
                    <span className="text-xs text-muted-foreground bg-surface px-2 py-0.5 rounded">
                      {item.serviceCategory}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      due at {formatMileage(item.mileageThreshold)} mi
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function NewROPageInner() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const router = useRouter();

  // Block technicians from accessing this page
  useEffect(() => {
    if ((session?.user as any)?.role === "technician") {
      router.replace("/dashboard/tech");
    }
  }, [session, router]);

  // Phase A — VIN entry
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState("");
  const [showVinScanner, setShowVinScanner] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);

  // Manual entry fallback (shown when NHTSA is unreachable)
  const [showManual, setShowManual] = useState(false);
  const [manualYear, setManualYear] = useState("");
  const [manualMake, setManualMake] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualEngine, setManualEngine] = useState("");
  const [manualDrivetrain, setManualDrivetrain] = useState("");

  // Pre-fill VIN + mileage from ?vin= ?mileage= (set by Document Ingest)
  useEffect(() => {
    const preVin = searchParams.get("vin");
    const preMileage = searchParams.get("mileage");
    if (preVin && preVin.length === 17) {
      setVin(preVin.toUpperCase());
      // Auto-trigger decode after a short delay so the field renders first
      setTimeout(() => {
        const trimmed = preVin.trim().toUpperCase();
        setVinLoading(true);
        setVinError("");
        fetch("/api/vin/decode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vin: trimmed }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.vehicle) setVehicle(data.vehicle);
            else setVinError("Could not decode pre-filled VIN.");
          })
          .catch(() => setVinError("VIN decoder unreachable."))
          .finally(() => setVinLoading(false));
      }, 150);
    }
    if (preMileage) {
      setMileage(preMileage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase B — Mileage + recommendations
  const [mileage, setMileage] = useState("");
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState("");
  const [required, setRequired] = useState<ScheduleGroup[]>([]);
  const [recommended, setRecommended] = useState<ScheduleGroup[]>([]);
  const [otpr, setOtpr] = useState<OTPRResult | null>(null);

  // Selection state
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [selectedOtpr, setSelectedOtpr] = useState<Set<string>>(new Set());

  // Phase C — RO estimate
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [estimate, setEstimate] = useState<ROEstimate | null>(null);

  // Phase D — Save as draft
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── VIN decode ────────────────────────────────────────────────────────────
  async function handleVinLookup() {
    const trimmed = vin.trim().toUpperCase();
    if (trimmed.length !== 17) {
      setVinError("VIN must be exactly 17 characters");
      return;
    }

    setVinLoading(true);
    setVinError("");
    setVehicle(null);
    setRequired([]);
    setRecommended([]);
    setOtpr(null);
    setSelectedServices(new Set());
    setSelectedOtpr(new Set());

    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVinError("VIN decoder unreachable. Enter vehicle details manually below.");
        setShowManual(true);
      } else {
        setVehicle(data.vehicle);
      }
    } catch {
      setVinError("VIN decoder unreachable. Enter vehicle details manually below.");
      setShowManual(true);
    } finally {
      setVinLoading(false);
    }
  }

  async function handleManualEntry() {
    const year = parseInt(manualYear, 10);
    if (!vin.trim() || vin.trim().length !== 17) {
      setVinError("VIN must be exactly 17 characters");
      return;
    }
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
      setVinError("Enter a valid model year (e.g. 2021)");
      return;
    }
    if (!manualMake.trim() || !manualModel.trim()) {
      setVinError("Make and Model are required");
      return;
    }
    const trimmed = vin.trim().toUpperCase();
    const make = manualMake.trim();
    const v: VehicleData = {
      vin: trimmed,
      make,
      model: manualModel.trim(),
      year,
      engine: manualEngine.trim() || null,
      drivetrain: manualDrivetrain || null,
      trim: null,
      oem: lookupOEM(make),
    };
    setVinError("");
    // Save to cache — must succeed before recommendations can run
    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVinError(data.error ?? "Failed to save vehicle — check your session");
        return;
      }
      setVehicle(data.vehicle ?? v);
    } catch {
      setVinError("Network error saving vehicle — try refreshing the page");
      return;
    }
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  async function handleGetRecommendations() {
    const miles = parseInt(mileage.replace(/,/g, ""), 10);
    if (isNaN(miles) || miles < 0) {
      setRecsError("Enter a valid mileage");
      return;
    }
    if (!vehicle) return;

    setRecsLoading(true);
    setRecsError("");
    setRequired([]);
    setRecommended([]);
    setOtpr(null);
    setSelectedServices(new Set());
    setSelectedOtpr(new Set());

    try {
      const params = new URLSearchParams({
        vin: vehicle.vin,
        mileage: String(miles),
      });
      const res = await fetch(`/api/maintenance/recommendations?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setRecsError(data.error ?? "Failed to load recommendations");
      } else {
        setRequired(data.required ?? []);
        setRecommended(data.recommended ?? []);
        setOtpr(data.otpr ?? { urgent: [], suggested: [], informational: [] });

        // Pre-check all required services
        const preChecked = new Set<string>();
        for (const group of data.required ?? []) {
          for (const s of group.services) {
            preChecked.add(s.id);
          }
        }
        setSelectedServices(preChecked);
      }
    } catch {
      setRecsError("Network error — check your connection");
    } finally {
      setRecsLoading(false);
    }
  }

  // ── Build RO estimate ─────────────────────────────────────────────────────
  async function handleBuildRO() {
    if (!vehicle) return;
    const allSelected = Array.from(selectedServices);
    if (allSelected.length === 0) {
      setCalcError("Select at least one service to continue");
      return;
    }

    setCalcLoading(true);
    setCalcError("");
    setEstimate(null);

    try {
      const res = await fetch("/api/ro/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: vehicle.vin, selectedServiceIds: allSelected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCalcError(data.error ?? "Failed to build estimate");
      } else {
        setEstimate(data as ROEstimate);
        // Scroll to estimate section
        setTimeout(() => {
          document.getElementById("ro-estimate")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch {
      setCalcError("Network error — check your connection");
    } finally {
      setCalcLoading(false);
    }
  }

  // ── Save draft RO to DB ───────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!vehicle || !estimate) return;
    const miles = parseInt(mileage.replace(/,/g, ""), 10);
    if (isNaN(miles)) return;

    setSaveLoading(true);
    setSaveError("");

    try {
      const res = await fetch("/api/ro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: vehicle.vin,
          mileage: miles,
          selectedServiceIds: Array.from(selectedServices),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save RO");
      } else {
        router.push(`/dashboard/ro/${data.ro.id}`);
      }
    } catch {
      setSaveError("Network error — try again");
    } finally {
      setSaveLoading(false);
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleOtpr(id: string) {
    setSelectedOtpr((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSelected = selectedServices.size + selectedOtpr.size;
  const hasRecommendations =
    required.length > 0 ||
    recommended.length > 0 ||
    otpr !== null;

  // Step indicator: 1=VIN, 2=Mileage, 3=Services, 4=Estimate
  const currentStep = !vehicle ? 1 : !hasRecommendations ? 2 : !estimate ? 3 : 4;
  const STEPS = ["Vehicle", "Mileage", "Services", "Estimate"];

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-1">New Repair Order</h1>
      <p className="text-muted-foreground mb-6">VIN decode, service selection, and RO creation.</p>

      {/* Step indicator */}
      <div className="flex items-center mb-8 overflow-x-auto pb-1">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < currentStep;
          const active = n === currentStep;
          return (
            <div key={n} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                      ? "border-2 border-blue-600 text-primary bg-transparent"
                      : "border-2 border-border text-muted-foreground/40 bg-transparent"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : n}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/40"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-14px]",
                    n < currentStep ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Phase A: VIN Entry ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          1 — Vehicle Identification
        </h2>

        <div className="flex gap-3">
          <Input
            placeholder="Enter 17-character VIN"
            value={vin}
            onChange={(e) => {
              setVin(e.target.value.toUpperCase());
              setVinError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleVinLookup()}
            maxLength={17}
            className="font-mono tracking-widest text-base"
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-shrink-0 px-3"
            onClick={() => setShowVinScanner(true)}
            title="Scan VIN barcode"
          >
            <ScanBarcode className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleVinLookup}
            disabled={vinLoading || vin.trim().length !== 17}
            size="lg"
            className="flex-shrink-0"
          >
            {vinLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Car className="h-4 w-4 mr-2" />
            )}
            Look Up
          </Button>
        </div>

        {showVinScanner && (
          <BarcodeScanner
            hint="Scan the VIN barcode on the driver door jamb"
            onScan={(result) => {
              const cleaned = result.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase().slice(0, 17);
              setVin(cleaned);
              setVinError("");
              setShowVinScanner(false);
            }}
            onClose={() => setShowVinScanner(false)}
          />
        )}
        {!vehicle && !showManual && (
          <button
            type="button"
            onClick={() => { setShowManual(true); setVinError(""); }}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground underline"
          >
            Can&apos;t reach VIN decoder? Enter manually
          </button>
        )}

        {vinError && <p className="text-sm text-red-600 mt-2">{vinError}</p>}

        {/* Manual entry fallback */}
        {showManual && !vehicle && (
          <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Manual Vehicle Entry</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Year *</label>
                <Input
                  placeholder="2021"
                  value={manualYear}
                  onChange={(e) => setManualYear(e.target.value)}
                  maxLength={4}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Make *</label>
                <Input
                  placeholder="Chevrolet"
                  value={manualMake}
                  onChange={(e) => setManualMake(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Model *</label>
                <Input
                  placeholder="Silverado 1500"
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Engine</label>
                <Input
                  placeholder="5.3L V8"
                  value={manualEngine}
                  onChange={(e) => setManualEngine(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Drivetrain</label>
                <select
                  value={manualDrivetrain}
                  onChange={(e) => setManualDrivetrain(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— optional —</option>
                  <option value="FWD">FWD</option>
                  <option value="RWD">RWD</option>
                  <option value="AWD">AWD</option>
                  <option value="4WD">4WD</option>
                </select>
              </div>
            </div>
            <Button className="mt-3" onClick={handleManualEntry}>
              Confirm Vehicle
            </Button>
          </div>
        )}

        {vehicle && (
          <div className="mt-4 p-4 bg-card border border-border rounded-lg flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.trim && (
                  <span className="font-normal text-muted-foreground"> — {vehicle.trim}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {[vehicle.engine, vehicle.drivetrain].filter(Boolean).join(" / ")}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{vehicle.vin}</p>
            </div>
            {vehicle.oem && (
              <Badge variant="secondary" className="flex-shrink-0">
                {vehicle.oem}
              </Badge>
            )}
          </div>
        )}
      </section>

      {/* ── Phase B: Mileage + Recommendations ────────────────────────────── */}
      {vehicle && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            2 — Current Mileage
          </h2>

          <div className="flex gap-3">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 35000"
              value={mileage}
              onChange={(e) => {
                setMileage(e.target.value);
                setRecsError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleGetRecommendations()}
              className="max-w-xs"
            />
            <Button
              onClick={handleGetRecommendations}
              disabled={recsLoading || !mileage.trim()}
              size="lg"
              variant="outline"
            >
              {recsLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Get Recommendations
            </Button>
          </div>

          {recsError && <p className="text-sm text-red-600 mt-2">{recsError}</p>}
        </section>
      )}

      {/* ── Recommendations ────────────────────────────────────────────────── */}
      {hasRecommendations && (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            3 — Service Selection
          </h2>

          {/* Required maintenance */}
          {required.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Required Maintenance</span>
                <span className="text-xs text-muted-foreground">pre-selected</span>
              </div>
              <div className="space-y-4">
                {required.map((group) => (
                  <div
                    key={group.mileageInterval}
                    className="border-2 border-blue-200 rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20">
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        {formatMileage(group.mileageInterval)}-Mile Service
                      </span>
                    </div>
                    <div className="p-3 space-y-2 bg-transparent">
                      {group.services.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          checked={selectedServices.has(s.id)}
                          onToggle={() => toggleService(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended maintenance */}
          {recommended.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                <span className="text-sm font-semibold text-foreground">Upcoming Maintenance</span>
                <span className="text-xs text-muted-foreground">optional add-ons</span>
              </div>
              <div className="space-y-4">
                {recommended.map((group) => (
                  <div
                    key={group.mileageInterval}
                    className="border-2 border-border rounded-lg overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-surface flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {formatMileage(group.mileageInterval)}-Mile Service
                      </span>
                      <span className="text-xs text-muted-foreground">(coming up)</span>
                    </div>
                    <div className="p-3 space-y-2 bg-transparent">
                      {group.services.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          checked={selectedServices.has(s.id)}
                          onToggle={() => toggleService(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OTPR upsells */}
          {otpr &&
            (otpr.urgent.length > 0 ||
              otpr.suggested.length > 0 ||
              otpr.informational.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-foreground">
                    One-Time Recommendations
                  </span>
                  <span className="text-xs text-muted-foreground">mileage-triggered upsells</span>
                </div>
                <div className="space-y-3">
                  <OTPRSection
                    title="Urgent"
                    items={otpr.urgent}
                    icon={AlertTriangle}
                    colorClass="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300"
                    borderClass="border-red-300 dark:border-red-800"
                    checked={selectedOtpr}
                    onToggle={toggleOtpr}
                  />
                  <OTPRSection
                    title="Suggested"
                    items={otpr.suggested}
                    icon={Clock}
                    colorClass="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
                    borderClass="border-amber-300 dark:border-amber-700"
                    checked={selectedOtpr}
                    onToggle={toggleOtpr}
                  />
                  <OTPRSection
                    title="Informational"
                    items={otpr.informational}
                    icon={Info}
                    colorClass="bg-surface text-foreground"
                    borderClass="border-border"
                    checked={selectedOtpr}
                    onToggle={toggleOtpr}
                  />
                </div>
              </div>
            )}

          {/* Empty state */}
          {required.length === 0 &&
            recommended.length === 0 &&
            otpr &&
            otpr.urgent.length === 0 &&
            otpr.suggested.length === 0 &&
            otpr.informational.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No scheduled maintenance found</p>
                <p className="text-sm mt-1">
                  No OEM schedule data for this vehicle at{" "}
                  {formatMileage(parseInt(mileage.replace(/,/g, ""), 10))} miles.
                </p>
              </div>
            )}

          {/* Continue footer */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {totalSelected} service{totalSelected !== 1 ? "s" : ""} selected
            </p>
            <Button
              onClick={handleBuildRO}
              disabled={calcLoading || selectedServices.size === 0}
              className="w-full sm:w-auto"
            >
              {calcLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Build Estimate
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {calcError && <p className="text-sm text-red-600 mt-2">{calcError}</p>}
        </section>
      )}

      {/* ── Phase C: Pricing Estimate ──────────────────────────────────────── */}
      {estimate && (
        <section id="ro-estimate" className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            4 — Estimate Preview
          </h2>

          {/* Parts */}
          {estimate.lineItems.filter((li) => li.type === "part").length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-surface flex items-center gap-2 border-b border-border">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Parts</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Part</th>
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Unit</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.lineItems
                    .filter((li) => li.type === "part")
                    .map((li, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground leading-snug">{li.description}</div>
                          {li.partNumber && (
                            <div className="text-xs text-muted-foreground font-mono">#{li.partNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{li.quantity}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          ${li.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">
                          ${li.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-foreground text-right">
                      Parts subtotal
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      ${estimate.partsSubtotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Labor */}
          {estimate.lineItems.filter((li) => li.type === "labor").length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-surface flex items-center gap-2 border-b border-border">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Labor</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Operation</th>
                    <th className="text-right px-4 py-2 font-medium">Hrs</th>
                    <th className="text-right px-4 py-2 font-medium">Rate</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.lineItems
                    .filter((li) => li.type === "labor")
                    .map((li, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
                        <td className="px-4 py-2">
                          <div className="font-medium text-foreground">{li.description}</div>
                          {li.laborOpCode && (
                            <div className="text-xs text-muted-foreground font-mono">{li.laborOpCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {li.quantity.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          ${li.unitPrice.toFixed(2)}/hr
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-foreground">
                          ${li.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-foreground text-right">
                      Labor subtotal
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">
                      ${estimate.laborSubtotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Totals summary */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="divide-y divide-border">
              <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>Parts subtotal</span>
                <span>${estimate.partsSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                <span>Labor subtotal</span>
                <span>${estimate.laborSubtotal.toFixed(2)}</span>
              </div>
              {estimate.shopSupplyFee > 0 && (
                <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>Shop Supply Fee</span>
                  <span>${estimate.shopSupplyFee.toFixed(2)}</span>
                </div>
              )}
              {estimate.taxAmount > 0 && (
                <div className="flex justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>Sales Tax</span>
                  <span>${estimate.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 font-bold text-foreground bg-surface">
                <span>Total</span>
                <span className="text-lg">${estimate.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Save as Draft */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <Button onClick={handleSaveDraft} disabled={saveLoading}>
              {saveLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save as Draft
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function NewROPage() {
  return (
    <Suspense>
      <NewROPageInner />
    </Suspense>
  );
}
