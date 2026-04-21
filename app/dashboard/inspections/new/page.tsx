"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ClipboardList, Loader2, Car, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface LotVehicle {
  id: string;
  year: number | null;
  make: string;
  model: string;
  stockNumber: string | null;
  status: string;
}

interface Member {
  id: string;
  name: string | null;
  role: string;
  employeeId: string | null;
}

function NewInspectionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledLotVehicleId = searchParams.get("lotVehicleId") ?? "";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [lotVehicles, setLotVehicles] = useState<LotVehicle[]>([]);
  const [techs, setTechs] = useState<Member[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [vehicleMode, setVehicleMode] = useState<"vin" | "lot">(prefilledLotVehicleId ? "lot" : "vin");
  const [vin, setVin] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [lotVehicleId, setLotVehicleId] = useState(prefilledLotVehicleId);
  const [assignedTechId, setAssignedTechId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inspection-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});

    fetch("/api/lot-vehicles")
      .then((r) => r.json())
      .then((d) => setLotVehicles((d.vehicles ?? []).filter((v: LotVehicle) => v.status !== "sold")))
      .catch((err) => console.error("[inspections/new] failed to fetch lot vehicles:", err));

    fetch("/api/rooftop/members")
      .then((r) => r.json())
      .then((d) => {
        const techList: Member[] = (d.members ?? []).filter(
          (m: Member) => m.role === "technician" || m.role === "advisor" || m.role === "manager"
        );
        setTechs(techList);
      })
      .catch(() => {});
  }, []);

  async function decodeVin() {
    if (!vin.trim() || vin.length < 6) return;
    setVinDecoding(true);
    try {
      const res = await fetch(`/api/maintenance?vin=${encodeURIComponent(vin.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const v = data.vehicle ?? {};
        if (v.year || v.make || v.model) {
          setVehicleLabel([v.year, v.make, v.model, v.trim].filter(Boolean).join(" "));
        }
      }
    } catch {
      // ignore
    } finally {
      setVinDecoding(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!templateId) { setError("Select an inspection template"); return; }
    if (vehicleMode === "vin" && !vin.trim() && !vehicleLabel.trim()) {
      setError("Enter a VIN or vehicle description"); return;
    }
    if (vehicleMode === "lot" && !lotVehicleId) {
      setError("Select a lot vehicle"); return;
    }

    setSaving(true);
    const body: Record<string, unknown> = { templateId };

    if (assignedTechId) body.techId = assignedTechId;

    if (vehicleMode === "vin") {
      body.vin = vin.trim() || null;
      body.vehicleLabel = vehicleLabel.trim() || null;
    } else {
      body.lotVehicleId = lotVehicleId;
      const lv = lotVehicles.find((v) => v.id === lotVehicleId);
      if (lv) {
        body.vehicleLabel = [lv.year, lv.make, lv.model].filter(Boolean).join(" ") || null;
        body.vin = null;
      }
    }

    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/inspections/${data.inspection.id}`);
    } else {
      setError(data.error ?? "Failed to create inspection");
      setSaving(false);
    }
  }

  const selectedLotVehicle = lotVehicles.find((v) => v.id === lotVehicleId);

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <Link href="/dashboard/inspections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Inspections
      </Link>

      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">New Inspection</h1>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Template */}
        <div className="space-y-1.5">
          <Label>Inspection Template <span className="text-destructive">*</span></Label>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates found.{" "}
              <Link href="/dashboard/admin/inspection-templates" className="text-primary hover:underline">
                Create one first
              </Link>
            </p>
          ) : (
            <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.description && <span className="text-muted-foreground"> — {t.description}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Assign to Tech */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            Assign to Tech
          </Label>
          {techs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Assigned to you by default.</p>
          ) : (
            <Select value={assignedTechId} onValueChange={(v) => setAssignedTechId(!v || v === "self" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to self (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Assign to self (default)</SelectItem>
                {techs.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name ?? "Unnamed"}
                    {t.employeeId && <span className="text-muted-foreground"> · #{t.employeeId}</span>}
                    <span className="text-muted-foreground ml-1 capitalize">({t.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Vehicle mode toggle */}
        <div className="space-y-1.5">
          <Label>Vehicle</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVehicleMode("vin")}
              className={[
                "flex-1 px-3 py-2 text-sm rounded-md border transition-colors",
                vehicleMode === "vin"
                  ? "border-primary bg-primary/5 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Customer / VIN
            </button>
            <button
              type="button"
              onClick={() => setVehicleMode("lot")}
              className={[
                "flex-1 px-3 py-2 text-sm rounded-md border transition-colors",
                vehicleMode === "lot"
                  ? "border-primary bg-primary/5 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Lot Vehicle
            </button>
          </div>
        </div>

        {vehicleMode === "vin" ? (
          <>
            <div className="space-y-1.5">
              <Label>VIN</Label>
              <div className="flex gap-2">
                <Input
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  onBlur={decodeVin}
                  placeholder="17-character VIN"
                  className="font-mono"
                  maxLength={17}
                />
                {vinDecoding && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Description</Label>
              <Input
                value={vehicleLabel}
                onChange={(e) => setVehicleLabel(e.target.value)}
                placeholder="e.g. 2019 Ford F-150 XLT"
              />
              <p className="text-xs text-muted-foreground">Auto-filled from VIN decode, or enter manually.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label>Lot Vehicle <span className="text-destructive">*</span></Label>
            {lotVehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No lot vehicles.{" "}
                <Link href="/dashboard/lot-vehicles/new" className="text-primary hover:underline">
                  Add one first
                </Link>
              </p>
            ) : (
              <>
                <Select value={lotVehicleId} onValueChange={(v) => setLotVehicleId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lot vehicle…" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotVehicles.map((lv) => (
                      <SelectItem key={lv.id} value={lv.id}>
                        {[lv.year, lv.make, lv.model].filter(Boolean).join(" ")}
                        {lv.stockNumber && ` · #${lv.stockNumber}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLotVehicle && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Car className="h-3.5 w-3.5" />
                    {[selectedLotVehicle.year, selectedLotVehicle.make, selectedLotVehicle.model].filter(Boolean).join(" ")}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || !templateId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Start Inspection
          </Button>
          <Link href="/dashboard/inspections">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewInspectionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading…</div>}>
      <NewInspectionInner />
    </Suspense>
  );
}
