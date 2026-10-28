import { z } from "zod";

/** Entra “Type” column on the User table. */
export const directoryObjectTypeSchema = z.enum(["User"]);

/** Entra “User type” column. */
export const userTypeSchema = z.enum(["Member", "Guest"]);

/** One row from the User table (Name, Type, Email, User type, Object id, Device id). */
export const userSchema = z.object({
  name: z.string().min(1),
  type: directoryObjectTypeSchema,
  email: z.email(),
  userType: userTypeSchema,
  objectId: z.uuid(),
  deviceId: z.uuid().nullable(),
});

export const userTableSchema = z.array(userSchema);

export const employeeAssignmentSchema = z.object({
  name: z.string(),
  email: z.union([z.email(), z.literal("")]),
});

export type DirectoryObjectType = z.infer<typeof directoryObjectTypeSchema>;
export type UserType = z.infer<typeof userTypeSchema>;
export type User = z.infer<typeof userSchema>;
export type EmployeeAssignment = z.infer<typeof employeeAssignmentSchema>;
