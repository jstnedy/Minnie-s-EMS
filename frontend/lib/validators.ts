import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const employeeCreateSchema = z.object({
  employeeId: z.string().min(3),
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  contactNumber: z.string().optional(),
  role: z.enum(["ADMIN", "SUPERVISOR", "EMPLOYEE"]),
  hourlyRate: z.coerce.number().positive(),
  passkey: z.string().regex(/^\d{6}$/),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ passkey: true });

export const passkeyResetSchema = z.object({
  tempPasskey: z.string().regex(/^\d{6}$/),
});

export const attendanceActionSchema = z.object({
  employeeId: z.string().min(1),
  passkey: z.string().regex(/^\d{6}$/),
});

export const attendanceEditSchema = z.object({
  timeIn: z.string().datetime(),
  timeOut: z.string().datetime().nullable().optional(),
  editReason: z.string().min(3),
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
