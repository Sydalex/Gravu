import { Hono } from "hono";
import type { auth } from "../auth";
import { deleteUserAccount } from "../services/deleteUser";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const accountRouter = new Hono<{ Variables: Variables }>();

accountRouter.delete("/me", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  try {
    const deleted = await deleteUserAccount(user.id);

    if (!deleted) {
      return c.json({ error: { message: "Account not found", code: "NOT_FOUND" } }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    return c.json(
      { error: { message, code: "DELETE_ACCOUNT_ERROR" } },
      500
    );
  }
});
