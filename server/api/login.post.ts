import { v4 as uuid } from "uuid";
import { userSchema } from "~/utils/schema";

declare module "#auth-utils" {
  interface User {
    name: string;
    id: string;
  }
}

export const USERS: Record<string, { password: string; id: string }> = {
  admin: { password: "123", id: "admin-1" },
  user: { password: "123", id: "user-2" },
  bot1: { password: uuid(), id: "bot-1" },
};

export default defineEventHandler(async event => {
  const { username, password } = await readValidatedBody(event, userSchema.parse);

  if (USERS[username]?.password !== password) {
    throw createError({ statusCode: 401, message: "Bad credentials" });
  }

  await setUserSession(event, { user: { name: username, id: USERS[username].id } });
  return {};
});
