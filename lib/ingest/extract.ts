import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";

export type ExtractedService = {
  description: string;
  partNumber?: string;
  quantity?: number;
  unitPrice?: number;
  laborHours?: number;
};

export type ExtractedData = {
  documentType: "repair_order" | "estimate" | "oem_menu" | "invoice" | "unknown";
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  services: ExtractedService[];
  totals: {
    parts?: number;
    labor?: number;
    tax?: number;
    total?: number;
  };
  confidence: "high" | "medium" | "low";
  rawNotes?: string;
};

const SYSTEM_PROMPT = `You are a document parser for an automotive repair shop system.
Extract structured data from the uploaded document (image or PDF).
Return ONLY valid JSON — no markdown, no explanation, just the JSON object.`;

const USER_PROMPT = `Analyze this automotive document and return a JSON object with exactly this shape:

{
  "documentType": "repair_order" | "estimate" | "oem_menu" | "invoice" | "unknown",
  "vin": string | null,
  "year": number | null,
  "make": string | null,
  "model": string | null,
  "mileage": number | null,
  "services": [
    {
      "description": string,
      "partNumber": string | null,
      "quantity": number | null,
      "unitPrice": number | null,
      "laborHours": number | null
    }
  ],
  "totals": {
    "parts": number | null,
    "labor": number | null,
    "tax": number | null,
    "total": number | null
  },
  "confidence": "high" | "medium" | "low",
  "rawNotes": string | null
}

Rules:
- documentType: "repair_order" if it's a completed or in-progress RO; "estimate" if it's a quote; "oem_menu" if it's an OEM service/price menu; "invoice" if it's a final invoice; "unknown" otherwise
- VIN must be exactly 17 alphanumeric characters or null
- mileage is the vehicle's odometer reading (integer)
- services: list every line item including parts, labor operations, and fees
- totals: dollar amounts (use null if not shown)
- confidence: "high" if VIN + ≥3 services found clearly; "medium" if partial data; "low" if little useful data extracted
- rawNotes: any relevant text that didn't fit the structured fields (vehicle notes, customer complaints, etc.)
- All numeric values must be numbers (not strings). Null for missing values.`;

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number];

function isAllowedImageType(mime: string): mime is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime);
}

export async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedData> {
  const client = new Anthropic();

  let contentBlock: ContentBlockParam;

  if (mimeType === "application/pdf") {
    contentBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: fileBuffer.toString("base64"),
      },
    } as ContentBlockParam;
  } else if (isAllowedImageType(mimeType)) {
    contentBlock = {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: fileBuffer.toString("base64"),
      },
    };
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const content: ContentBlockParam[] = [contentBlock, { type: "text", text: USER_PROMPT }];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as ExtractedData;

    // Normalize nulls → undefined for optional fields
    return {
      documentType: parsed.documentType ?? "unknown",
      vin: parsed.vin ?? undefined,
      year: parsed.year ?? undefined,
      make: parsed.make ?? undefined,
      model: parsed.model ?? undefined,
      mileage: parsed.mileage ?? undefined,
      services: Array.isArray(parsed.services) ? parsed.services : [],
      totals: parsed.totals ?? {},
      confidence: parsed.confidence ?? "low",
      rawNotes: parsed.rawNotes ?? undefined,
    };
  } catch {
    // Return a minimal valid object on parse failure
    return {
      documentType: "unknown",
      services: [],
      totals: {},
      confidence: "low",
      rawNotes: rawText.slice(0, 500),
    };
  }
}
