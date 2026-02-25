import { z } from "zod";

const weakPasskeys = new Set(["000000", "111111", "123456"]);
const contactNumberRegex = /^[0-9+\-\s()]{7,20}$/;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const moneySchema = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Hourly rate must have at most 2 decimals")
  .transform((v) => Number(v))
  .refine((v) => v > 0, "Hourly rate must be greater than 0")
  .refine((v) => v <= 100000, "Hourly rate exceeds allowed maximum");

export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email().optional().or(z.literal("")),
  contactNumber: z
    .string()
    .trim()
    .min(1, "Contact number is required")
    .refine((v) => contactNumberRegex.test(v), "Contact number must be 7-20 characters and contain valid phone symbols"),
  roleId: z.string().min(1, "Role is required"),
  hourlyRate: moneySchema,
  passkey: z
    .string()
    .regex(/^\d{6}$/, "Passkey must be exactly 6 digits")
    .refine((v) => !weakPasskeys.has(v), "Passkey is too common"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ passkey: true }).extend({
  employeeId: z.string().trim().min(1).optional(),
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2, "Role name is required"),
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional(),
});

export const passkeyResetSchema = z.object({
  tempPasskey: z.string().regex(/^\d{6}$/),
});

export const attendanceActionSchema = z.object({
  employeeId: z.string().min(1),
  passkey: z.string().regex(/^\d{6}$/),
  qrSlot: z.coerce.number().int().nonnegative(),
  qrSig: z.string().regex(/^[a-f0-9]{64}$/i),
  photoDataUrl: z.string().startsWith("data:image/").optional(),
});

export const attendancePasskeyVerifySchema = z.object({
  employeeId: z.string().min(1),
  passkey: z.string().regex(/^\d{6}$/),
  qrSlot: z.coerce.number().int().nonnegative(),
  qrSig: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const attendanceEditSchema = z.object({
  timeIn: z.string().datetime(),
  timeOut: z.string().datetime().nullable().optional(),
  editReason: z.string().min(3),
});

export const attendanceCorrectionReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().trim().optional(),
});

export const payrollComputeSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

export const payrollAdjustmentInputSchema = z.object({
  employeeId: z.string(),
  amount: z.coerce.number(),
  reason: z.string().min(2),
});

export const payrollComputeBodySchema = z.object({
  adjustments: z.array(payrollAdjustmentInputSchema).optional().default([]),
});

export const payrollFinalizeSchema = z.object({
  payrollRunId: z.string(),
});
