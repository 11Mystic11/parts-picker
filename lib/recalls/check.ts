// [FEATURE: recall_check]
// NHTSA Safety Recall lookup — free public API, no key required.
// Caches result on the RepairOrder for 7 days to avoid hammering the API.

export interface RecallCampaign {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
}

export async function fetchRecallsByVin(vin: string): Promise<RecallCampaign[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${encodeURIComponent(vin)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`NHTSA API error: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}
