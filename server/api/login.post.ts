import { z } from "zod";
import { v4 as uuid } from "uuid";

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

const bodySchema = z.object({
  username: z.string(), // .max(16).regex(/[a-zA-Z0-9]+/)
  password: z.string(), // .min(8)
});

export default defineEventHandler(async event => {
  const { username, password } = await readValidatedBody(event, bodySchema.parse);

  if (USERS[username].password === password) {
    // set the user session in the cookie
    // this server util is auto-imported by the auth-utils module
    await setUserSession(event, {
      user: {
        name: username,
        id: USERS[username].id,
      },
    });
    return {};
  }
  throw createError({
    statusCode: 401,
    message: "Bad credentials",
  });
});
