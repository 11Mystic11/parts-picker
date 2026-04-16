/**
 * Seed: GM + Ford OEM maintenance schedules, parts catalog, labor operations, and OTPR rules.
 * Run: npm run db:seed
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── GM Maintenance Schedules ─────────────────────────────────────────────────
const gmSchedules = [
  {
    mileageInterval: 5000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
    ],
  },
  {
    mileageInterval: 15000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "gm-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Inspect and replace cabin air filter", isRequired: false },
    ],
  },
  {
    mileageInterval: 30000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "gm-engine-filter", name: "Engine Air Filter", category: "Engine", description: "Inspect and replace engine air filter", isRequired: true },
      { id: "gm-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Replace cabin air filter", isRequired: true },
      { id: "gm-fuel-filter", name: "Fuel Filter Inspection", category: "Fuel", description: "Inspect fuel filter and replace if needed", isRequired: false },
    ],
  },
  {
    mileageInterval: 45000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "gm-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Inspect and replace cabin air filter", isRequired: false },
    ],
  },
  {
    mileageInterval: 60000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "gm-spark-plugs", name: "Spark Plug Replacement", category: "Engine", description: "Replace all spark plugs", isRequired: true },
      { id: "gm-coolant-flush", name: "Engine Coolant Flush", category: "Cooling", description: "Drain and refill engine coolant", isRequired: true },
      { id: "gm-engine-filter", name: "Engine Air Filter", category: "Engine", description: "Replace engine air filter", isRequired: true },
      { id: "gm-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Replace cabin air filter", isRequired: true },
      { id: "gm-trans-service", name: "Automatic Transmission Service", category: "Transmission", description: "Drain and refill transmission fluid, replace filter if applicable", isRequired: false },
    ],
  },
  {
    mileageInterval: 90000,
    services: [
      { id: "gm-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "gm-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "gm-spark-plugs", name: "Spark Plug Replacement", category: "Engine", description: "Replace all spark plugs", isRequired: true },
      { id: "gm-engine-filter", name: "Engine Air Filter", category: "Engine", description: "Replace engine air filter", isRequired: true },
      { id: "gm-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Replace cabin air filter", isRequired: true },
    ],
  },
];

// ─── Ford Maintenance Schedules ───────────────────────────────────────────────
const fordSchedules = [
  {
    mileageInterval: 7500,
    services: [
      { id: "ford-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter (Motorcraft)", isRequired: true },
      { id: "ford-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
    ],
  },
  {
    mileageInterval: 15000,
    services: [
      { id: "ford-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "ford-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "ford-cabin-filter", name: "Cabin Air Filter Inspection", category: "HVAC", description: "Inspect cabin air filter", isRequired: false },
    ],
  },
  {
    mileageInterval: 30000,
    services: [
      { id: "ford-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "ford-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "ford-engine-filter", name: "Engine Air Filter", category: "Engine", description: "Replace engine air filter", isRequired: true },
      { id: "ford-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Replace cabin air filter", isRequired: true },
    ],
  },
  {
    mileageInterval: 60000,
    services: [
      { id: "ford-oil-change", name: "Engine Oil & Filter Change", category: "Engine", description: "Drain and replace engine oil and filter", isRequired: true },
      { id: "ford-tire-rotation", name: "Tire Rotation", category: "Tires", description: "Rotate all four tires", isRequired: true },
      { id: "ford-spark-plugs", name: "Spark Plug Replacement", category: "Engine", description: "Replace all spark plugs (Motorcraft)", isRequired: true },
      { id: "ford-coolant-flush", name: "Engine Coolant Flush", category: "Cooling", description: "Drain and refill engine coolant", isRequired: true },
      { id: "ford-engine-filter", name: "Engine Air Filter", category: "Engine", description: "Replace engine air filter", isRequired: true },
      { id: "ford-cabin-filter", name: "Cabin Air Filter", category: "HVAC", description: "Replace cabin air filter", isRequired: true },
      { id: "ford-trans-service", name: "Transmission Fluid Change", category: "Transmission", description: "Drain and refill transmission fluid", isRequired: false },
    ],
  },
];

// ─── Parts Catalog ─────────────────────────────────────────────────────────────
const gmParts = [
  // Oil & Filter
  {
    partNumber: "19419306",
    name: "ACDelco Oil Filter",
    description: "ACDelco Professional Engine Oil Filter",
    defaultCost: 8.50,
    conditions: "{}",
    serviceIds: JSON.stringify(["gm-oil-change"]),
    quantityRule: "1",
  },
  {
    partNumber: "19301368",
    name: "ACDelco Drain Plug Gasket",
    description: "Engine oil drain plug gasket — replace with every oil change",
    defaultCost: 1.50,
    conditions: "{}",
    serviceIds: JSON.stringify(["gm-oil-change"]),
    quantityRule: "1",
  },
  {
    partNumber: "19355484",
    name: "Dexos 0W-20 Synthetic Oil (1 qt)",
    description: "ACDelco GM OE dexos1 Gen 2 Full Synthetic 0W-20 motor oil",
    defaultCost: 9.00,
    conditions: JSON.stringify({ engines: ["2.0L Turbo", "1.5L Turbo", "2.5L", "1.3L Turbo"] }),
    serviceIds: JSON.stringify(["gm-oil-change"]),
    quantityRule: "5",
  },
  {
    partNumber: "19355485",
    name: "Dexos 5W-30 Synthetic Oil (1 qt)",
    description: "ACDelco GM OE dexos1 Gen 2 Full Synthetic 5W-30 motor oil",
    defaultCost: 8.50,
    conditions: JSON.stringify({ engines: ["3.6L V6", "5.3L V8", "6.2L V8", "6.6L V8 Diesel"] }),
    serviceIds: JSON.stringify(["gm-oil-change"]),
    quantityRule: "6",
  },
  // Air Filters
  {
    partNumber: "23274282",
    name: "ACDelco Engine Air Filter",
    description: "ACDelco GM OE engine air filter",
    defaultCost: 18.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["gm-engine-filter"]),
    quantityRule: "1",
  },
  {
    partNumber: "84463529",
    name: "ACDelco Cabin Air Filter",
    description: "ACDelco GM OE cabin air filter",
    defaultCost: 22.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["gm-cabin-filter"]),
    quantityRule: "1",
  },
  // Spark Plugs
  {
    partNumber: "41-162",
    name: "ACDelco Iridium Spark Plug",
    description: "ACDelco Professional Iridium Spark Plug",
    defaultCost: 12.00,
    conditions: JSON.stringify({ engines: ["3.6L V6", "2.0L Turbo", "1.5L Turbo", "2.5L"] }),
    serviceIds: JSON.stringify(["gm-spark-plugs"]),
    quantityRule: "4",
  },
  {
    partNumber: "41-163",
    name: "ACDelco Iridium Spark Plug (V8)",
    description: "ACDelco Professional Iridium Spark Plug for V8 engines",
    defaultCost: 14.00,
    conditions: JSON.stringify({ engines: ["5.3L V8", "6.2L V8"] }),
    serviceIds: JSON.stringify(["gm-spark-plugs"]),
    quantityRule: "8",
  },
  // Coolant
  {
    partNumber: "19260477",
    name: "Dex-Cool Extended Life Coolant (1 gal)",
    description: "ACDelco GM OE Dex-Cool antifreeze/coolant",
    defaultCost: 21.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["gm-coolant-flush"]),
    quantityRule: "2",
  },
];

const fordParts = [
  // Oil & Filter
  {
    partNumber: "FL820S",
    name: "Motorcraft Oil Filter",
    description: "Motorcraft Engine Oil Filter",
    defaultCost: 9.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["ford-oil-change"]),
    quantityRule: "1",
  },
  {
    partNumber: "W701083-S300",
    name: "Ford Drain Plug Gasket",
    description: "Engine drain plug gasket — replace with every oil change",
    defaultCost: 1.25,
    conditions: "{}",
    serviceIds: JSON.stringify(["ford-oil-change"]),
    quantityRule: "1",
  },
  {
    partNumber: "XO-5W20-QSP",
    name: "Motorcraft 5W-20 Synthetic Blend Oil (1 qt)",
    description: "Motorcraft Full Synthetic Motor Oil 5W-20",
    defaultCost: 9.50,
    conditions: JSON.stringify({ engines: ["2.3L EcoBoost", "2.5L", "1.5L EcoBoost", "1.6L EcoBoost"] }),
    serviceIds: JSON.stringify(["ford-oil-change"]),
    quantityRule: "5",
  },
  {
    partNumber: "XO-5W30-QSP",
    name: "Motorcraft 5W-30 Synthetic Blend Oil (1 qt)",
    description: "Motorcraft Full Synthetic Motor Oil 5W-30",
    defaultCost: 9.50,
    conditions: JSON.stringify({ engines: ["5.0L V8", "6.2L V8", "6.7L Power Stroke Diesel", "3.5L EcoBoost V6"] }),
    serviceIds: JSON.stringify(["ford-oil-change"]),
    quantityRule: "6",
  },
  // Air Filters
  {
    partNumber: "FA1890",
    name: "Motorcraft Engine Air Filter",
    description: "Motorcraft Engine Air Filter",
    defaultCost: 20.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["ford-engine-filter"]),
    quantityRule: "1",
  },
  {
    partNumber: "FP62",
    name: "Motorcraft Cabin Air Filter",
    description: "Motorcraft Cabin Air Filter",
    defaultCost: 24.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["ford-cabin-filter"]),
    quantityRule: "1",
  },
  // Spark Plugs
  {
    partNumber: "SP-534",
    name: "Motorcraft Spark Plug (4-cyl/6-cyl)",
    description: "Motorcraft Iridium Spark Plug",
    defaultCost: 13.00,
    conditions: JSON.stringify({ engines: ["2.3L EcoBoost", "2.5L", "2.7L EcoBoost V6", "3.5L EcoBoost V6"] }),
    serviceIds: JSON.stringify(["ford-spark-plugs"]),
    quantityRule: "4",
  },
  {
    partNumber: "SP-537",
    name: "Motorcraft Spark Plug (V8)",
    description: "Motorcraft Iridium Spark Plug for V8 engines",
    defaultCost: 15.00,
    conditions: JSON.stringify({ engines: ["5.0L V8", "6.2L V8"] }),
    serviceIds: JSON.stringify(["ford-spark-plugs"]),
    quantityRule: "8",
  },
  // Coolant
  {
    partNumber: "VC-7-B",
    name: "Motorcraft Gold Engine Coolant (1 gal)",
    description: "Motorcraft Gold Prediluted Engine Coolant",
    defaultCost: 22.00,
    conditions: "{}",
    serviceIds: JSON.stringify(["ford-coolant-flush"]),
    quantityRule: "2",
  },
];

// ─── Labor Operations ─────────────────────────────────────────────────────────
const gmLaborOps = [
  { opCode: "GM-001", name: "Oil & Filter Change", flatRateHours: 0.4, serviceIds: ["gm-oil-change"] },
  { opCode: "GM-002", name: "Tire Rotation", flatRateHours: 0.4, serviceIds: ["gm-tire-rotation"] },
  { opCode: "GM-003", name: "Engine Air Filter Replacement", flatRateHours: 0.3, serviceIds: ["gm-engine-filter"] },
  { opCode: "GM-004", name: "Cabin Air Filter Replacement", flatRateHours: 0.3, serviceIds: ["gm-cabin-filter"] },
  { opCode: "GM-005", name: "Spark Plug Replacement (4-cyl/6-cyl)", flatRateHours: 1.5, serviceIds: ["gm-spark-plugs"], conditions: { engines: ["2.0L Turbo", "1.5L Turbo", "2.5L", "3.6L V6"] } },
  { opCode: "GM-006", name: "Spark Plug Replacement (V8)", flatRateHours: 2.5, serviceIds: ["gm-spark-plugs"], conditions: { engines: ["5.3L V8", "6.2L V8"] } },
  { opCode: "GM-007", name: "Engine Coolant Flush", flatRateHours: 1.0, serviceIds: ["gm-coolant-flush"] },
  { opCode: "GM-008", name: "Automatic Transmission Service", flatRateHours: 1.5, serviceIds: ["gm-trans-service"] },
  { opCode: "GM-009", name: "Fuel Filter Inspection", flatRateHours: 0.3, serviceIds: ["gm-fuel-filter"] },
];

const fordLaborOps = [
  { opCode: "FD-001", name: "Oil & Filter Change", flatRateHours: 0.4, serviceIds: ["ford-oil-change"] },
  { opCode: "FD-002", name: "Tire Rotation", flatRateHours: 0.4, serviceIds: ["ford-tire-rotation"] },
  { opCode: "FD-003", name: "Engine Air Filter Replacement", flatRateHours: 0.3, serviceIds: ["ford-engine-filter"] },
  { opCode: "FD-004", name: "Cabin Air Filter Replacement", flatRateHours: 0.3, serviceIds: ["ford-cabin-filter"] },
  { opCode: "FD-005", name: "Spark Plug Replacement (4-cyl/6-cyl)", flatRateHours: 1.5, serviceIds: ["ford-spark-plugs"], conditions: { engines: ["2.3L EcoBoost", "2.5L", "2.7L EcoBoost V6", "3.5L EcoBoost V6"] } },
  { opCode: "FD-006", name: "Spark Plug Replacement (V8)", flatRateHours: 2.5, serviceIds: ["ford-spark-plugs"], conditions: { engines: ["5.0L V8", "6.2L V8"] } },
  { opCode: "FD-007", name: "Engine Coolant Flush", flatRateHours: 1.0, serviceIds: ["ford-coolant-flush"] },
  { opCode: "FD-008", name: "Transmission Fluid Change", flatRateHours: 1.5, serviceIds: ["ford-trans-service"] },
];

// ─── OTPR Rules ────────────────────────────────────────────────────────────────
const otprRules = [
  {
    oem: "GM",
    name: "Brake Fluid Flush",
    description: "Brake fluid absorbs moisture over time — recommended every 2 years or 36k miles",
    serviceCategory: "Brakes",
    mileageThreshold: 36000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
  },
  {
    oem: "GM",
    name: "Power Steering Fluid Flush",
    description: "Replace power steering fluid to prevent pump wear",
    serviceCategory: "Steering",
    mileageThreshold: 50000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
  },
  {
    oem: "GM",
    name: "Differential Fluid Service",
    description: "Rear differential fluid service for AWD/4WD vehicles",
    serviceCategory: "Drivetrain",
    mileageThreshold: 60000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
    conditions: JSON.stringify({ drivetrains: ["AWD", "4WD", "RWD"] }),
  },
  {
    oem: "GM",
    name: "Transfer Case Service",
    description: "Transfer case fluid replacement for 4WD vehicles",
    serviceCategory: "Drivetrain",
    mileageThreshold: 60000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
    conditions: JSON.stringify({ drivetrains: ["4WD"] }),
  },
  {
    oem: "Ford",
    name: "Brake Fluid Flush",
    description: "Brake fluid replacement — recommended every 36k miles or 3 years",
    serviceCategory: "Brakes",
    mileageThreshold: 36000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
  },
  {
    oem: "Ford",
    name: "Differential Fluid Service",
    description: "Rear differential fluid for RWD/4WD vehicles",
    serviceCategory: "Drivetrain",
    mileageThreshold: 60000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
    conditions: JSON.stringify({ drivetrains: ["4WD", "AWD", "RWD"] }),
  },
  {
    oem: "Ford",
    name: "Transfer Case Service",
    description: "Transfer case fluid for 4WD Super Duty and F-150",
    serviceCategory: "Drivetrain",
    mileageThreshold: 60000,
    partNumbers: JSON.stringify([]),
    urgencyTier: "suggested",
    conditions: JSON.stringify({ drivetrains: ["4WD"] }),
  },
];

async function main() {
  console.log("Seeding database...");

  // GM maintenance schedules
  for (const schedule of gmSchedules) {
    await prisma.maintenanceSchedule.upsert({
      where: { oem_mileageInterval_version: { oem: "GM", mileageInterval: schedule.mileageInterval, version: 1 } },
      update: { serviceDefinitions: JSON.stringify(schedule.services) },
      create: {
        oem: "GM",
        mileageInterval: schedule.mileageInterval,
        serviceDefinitions: JSON.stringify(schedule.services),
      },
    });
  }
  console.log(`Seeded ${gmSchedules.length} GM maintenance schedules.`);

  // Ford maintenance schedules
  for (const schedule of fordSchedules) {
    await prisma.maintenanceSchedule.upsert({
      where: { oem_mileageInterval_version: { oem: "Ford", mileageInterval: schedule.mileageInterval, version: 1 } },
      update: { serviceDefinitions: JSON.stringify(schedule.services) },
      create: {
        oem: "Ford",
        mileageInterval: schedule.mileageInterval,
        serviceDefinitions: JSON.stringify(schedule.services),
      },
    });
  }
  console.log(`Seeded ${fordSchedules.length} Ford maintenance schedules.`);

  // GM parts
  for (const part of gmParts) {
    await prisma.partsCatalog.upsert({
      where: { oem_partNumber_version: { oem: "GM", partNumber: part.partNumber, version: 1 } },
      update: part,
      create: { oem: "GM", ...part },
    });
  }
  console.log(`Seeded ${gmParts.length} GM parts.`);

  // Ford parts
  for (const part of fordParts) {
    await prisma.partsCatalog.upsert({
      where: { oem_partNumber_version: { oem: "Ford", partNumber: part.partNumber, version: 1 } },
      update: part,
      create: { oem: "Ford", ...part },
    });
  }
  console.log(`Seeded ${fordParts.length} Ford parts.`);

  // GM labor ops
  for (const op of gmLaborOps) {
    const { conditions, ...rest } = op as any;
    await prisma.laborOperation.upsert({
      where: { oem_opCode_version: { oem: "GM", opCode: op.opCode, version: 1 } },
      update: {
        ...rest,
        serviceIds: JSON.stringify(op.serviceIds),
        conditions: conditions ? JSON.stringify(conditions) : "{}",
      },
      create: {
        oem: "GM",
        ...rest,
        serviceIds: JSON.stringify(op.serviceIds),
        conditions: conditions ? JSON.stringify(conditions) : "{}",
      },
    });
  }
  console.log(`Seeded ${gmLaborOps.length} GM labor operations.`);

  // Ford labor ops
  for (const op of fordLaborOps) {
    const { conditions, ...rest } = op as any;
    await prisma.laborOperation.upsert({
      where: { oem_opCode_version: { oem: "Ford", opCode: op.opCode, version: 1 } },
      update: {
        ...rest,
        serviceIds: JSON.stringify(op.serviceIds),
        conditions: conditions ? JSON.stringify(conditions) : "{}",
      },
      create: {
        oem: "Ford",
        ...rest,
        serviceIds: JSON.stringify(op.serviceIds),
        conditions: conditions ? JSON.stringify(conditions) : "{}",
      },
    });
  }
  console.log(`Seeded ${fordLaborOps.length} Ford labor operations.`);

  // OTPR rules
  for (const rule of otprRules) {
    const existing = await prisma.oTPRRule.findFirst({
      where: { oem: rule.oem, name: rule.name },
    });
    if (!existing) {
      await prisma.oTPRRule.create({
        data: {
          ...rule,
          conditions: (rule as any).conditions ?? "{}",
        },
      });
    }
  }
  console.log(`Seeded ${otprRules.length} OTPR rules.`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
