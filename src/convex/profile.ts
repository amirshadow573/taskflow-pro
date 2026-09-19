import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Update the signed-in user's display name. */
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("نام نمی‌تواند خالی باشد");
    await ctx.db.patch(userId, { name: trimmed });
  },
});
