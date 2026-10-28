import rawUsers from "./users.json";
import { userTableSchema, type User } from "../schema/user";

export const users: User[] = userTableSchema.parse(rawUsers);

export function findUsers(query: string): User[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter(
    (user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
  );
}
