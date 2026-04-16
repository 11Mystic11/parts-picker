import { z } from "zod";

export const EMPLOYEE_ID_REGEX = /^[A-Z]{2,6}-\d{4}$/;

export const employeeIdSchema = z
  .string()
  .regex(EMPLOYEE_ID_REGEX, "Format: XXX-0000 (e.g. TYT-0042)")
  .nullable()
  .optional();
