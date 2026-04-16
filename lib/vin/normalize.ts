// Pure normalization functions — no Node.js deps, safe to import in browser

export type VehicleData = {
  vin: string;
  make: string;
  model: string;
  year: number;
  engine: string | null;
  drivetrain: string | null;
  trim: string | null;
  oem: string | null;
};

type NHTSAResult = {
  Variable: string;
  Value: string | null;
};

const OEM_MAP: Record<string, string> = {
  CHEVROLET: "GM",
  CHEVY: "GM",
  GMC: "GM",
  BUICK: "GM",
  CADILLAC: "GM",
  FORD: "Ford",
  LINCOLN: "Ford",
  TOYOTA: "Toyota",
  LEXUS: "Toyota",
  HONDA: "Honda",
  ACURA: "Honda",
  DODGE: "Stellantis",
  CHRYSLER: "Stellantis",
  JEEP: "Stellantis",
  RAM: "Stellantis",
  BMW: "BMW",
  MINI: "BMW",
  MERCEDES: "Mercedes",
  "MERCEDES-BENZ": "Mercedes",
  VOLKSWAGEN: "Volkswagen",
  VW: "Volkswagen",
  AUDI: "Volkswagen",
  NISSAN: "Nissan",
  INFINITI: "Nissan",
  HYUNDAI: "Hyundai",
  KIA: "Hyundai",
  SUBARU: "Subaru",
  MAZDA: "Mazda",
  VOLVO: "Volvo",
};

const DRIVETRAIN_MAP: Record<string, string> = {
  "all-wheel drive": "AWD",
  awd: "AWD",
  "4x4/4-wheel drive": "4WD",
  "four-wheel drive": "4WD",
  "4wd": "4WD",
  "front-wheel drive": "FWD",
  fwd: "FWD",
  "rear-wheel drive": "RWD",
  rwd: "RWD",
};

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeDrivetrain(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(DRIVETRAIN_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

function buildEngineString(
  displacement: string | null,
  config: string | null,
  cylinders: string | null
): string | null {
  if (!displacement) return null;
  const disp = parseFloat(displacement);
  if (isNaN(disp)) return null;
  const dispStr = `${disp.toFixed(1)}L`;
  if (!config && !cylinders) return dispStr;
  const configLetter = config ? config.trim()[0].toUpperCase() : "";
  const cylStr = cylinders ? cylinders.trim() : "";
  if (configLetter && cylStr) return `${dispStr} ${configLetter}${cylStr}`;
  if (configLetter) return `${dispStr} ${configLetter}`;
  return `${dispStr} ${cylStr}-cyl`;
}

export function lookupOEM(make: string): string | null {
  return OEM_MAP[make.toUpperCase().trim()] ?? null;
}

// Normalize the flat-object format returned by DecodeVinValues endpoint
export function normalizeDecodeVinValues(vin: string, v: Record<string, string | null>): VehicleData {
  function get(key: string): string | null {
    const val = v[key] ?? null;
    if (!val || val === "Not Applicable" || val === "0") return null;
    return val;
  }

  const make = get("Make");
  const model = get("Model");
  const yearRaw = get("ModelYear");
  const year = yearRaw ? parseInt(yearRaw, 10) : 0;

  if (!make || year === 0) {
    throw new Error(`Invalid or unrecognized VIN: ${vin}`);
  }

  return {
    vin,
    make: titleCase(make),
    model: model ?? "",
    year,
    engine: buildEngineString(
      get("DisplacementL"),
      get("EngineConfiguration"),
      get("EngineCylinders")
    ),
    drivetrain: normalizeDrivetrain(get("DriveType")),
    trim: get("Trim"),
    oem: OEM_MAP[make.toUpperCase()] ?? null,
  };
}

export function normalizeNHTSA(vin: string, results: NHTSAResult[]): VehicleData {
  function get(variable: string): string | null {
    const found = results.find((r) => r.Variable === variable);
    const val = found?.Value ?? null;
    if (!val || val === "Not Applicable" || val === "0") return null;
    return val;
  }

  const make = get("Make");
  const model = get("Model");
  const yearRaw = get("Model Year");
  const year = yearRaw ? parseInt(yearRaw, 10) : 0;

  if (!make || year === 0) {
    throw new Error(`Invalid or unrecognized VIN: ${vin}`);
  }

  return {
    vin,
    make: titleCase(make),
    model: model ?? "",
    year,
    engine: buildEngineString(
      get("Displacement (L)"),
      get("Engine Configuration"),
      get("Engine Number of Cylinders")
    ),
    drivetrain: normalizeDrivetrain(get("Drive Type")),
    trim: get("Trim"),
    oem: OEM_MAP[make.toUpperCase()] ?? null,
  };
}
