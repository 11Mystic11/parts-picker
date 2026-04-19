"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PartRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roId: string;
  onSubmitted?: () => void;
}

export function PartRequestDialog({ open, onOpenChange, roId, onSubmitted }: PartRequestDialogProps) {
  const [partDescription, setPartDescription] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPartDescription("");
    setPartNumber("");
    setQuantity("1");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partDescription.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ro/${roId}/part-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partDescription: partDescription.trim(),
          partNumber: partNumber.trim() || null,
          quantity: parseInt(quantity) || 1,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Part</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Part description <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Front brake pads"
              value={partDescription}
              onChange={(e) => setPartDescription(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Part number</Label>
              <Input
                placeholder="e.g. ATE-500157"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              placeholder="Any additional info for the advisor"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !partDescription.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
