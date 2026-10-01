import { desc, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../../db";
import { inviteCodes } from "../../../db/schema";
import { logger } from "../../../utils/logger";

/**
 * Generate human-friendly cryptographically random invite code: FIN-XXXX-XXXX
 */
export function generateInviteCode(): string {
  const part1 = randomBytes(2).toString("hex").toUpperCase();
  const part2 = randomBytes(2).toString("hex").toUpperCase();
  return `FIN-${part1}-${part2}`;
}

export class InviteService {
  /**
   * Generate a one-time registration invite code expiring in N days (default: 7).
   */
  public async createInviteCode(
    adminUserId: string,
    expiresInDays = 7
  ): Promise<{
    id: string;
    code: string;
    createdBy: string;
    usedBy: string | null;
    expiresAt: string;
    usedAt: string | null;
    deletedAt: string | null;
    createdAt: string;
  }> {
    const code = generateInviteCode();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    const [record] = await db
      .insert(inviteCodes)
      .values({
        code,
        createdBy: adminUserId,
        expiresAt,
      })
      .returning();

    logger.info("Admin generated new invite code", {
      adminUserId,
      code,
      expiresAt: record.expiresAt,
    });

    return {
      id: record.id,
      code: record.code,
      createdBy: record.createdBy,
      usedBy: record.usedBy,
      expiresAt: record.expiresAt.toISOString(),
      usedAt: record.usedAt ? record.usedAt.toISOString() : null,
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * List invite codes for admin review.
   * @param includeDeleted If true, returns all invite codes including soft-deleted ones.
   */
  public async listInviteCodes(includeDeleted = false) {
    const query = db.select().from(inviteCodes);

    const records = await (includeDeleted
      ? query.orderBy(desc(inviteCodes.createdAt))
      : query
          .where(isNull(inviteCodes.deletedAt))
          .orderBy(desc(inviteCodes.createdAt)));

    return records.map((r) => ({
      id: r.id,
      code: r.code,
      createdBy: r.createdBy,
      usedBy: r.usedBy,
      expiresAt: r.expiresAt.toISOString(),
      usedAt: r.usedAt ? r.usedAt.toISOString() : null,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Soft delete / revoke an active unused invite code.
   */
  public async revokeInviteCode(inviteId: string): Promise<void> {
    const [record] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, inviteId))
      .limit(1);

    if (!record) {
      const err: any = new Error("Invite code not found");
      err.status = 404;
      throw err;
    }

    if (record.deletedAt) {
      const err: any = new Error("Invite code has already been revoked");
      err.status = 400;
      throw err;
    }

    if (record.usedAt) {
      const err: any = new Error("Cannot revoke an already used invite code");
      err.status = 400;
      throw err;
    }

    await db
      .update(inviteCodes)
      .set({ deletedAt: new Date() })
      .where(eq(inviteCodes.id, inviteId));

    logger.info("Admin revoked invite code (soft deleted)", { inviteId });
  }
}

export const inviteService = new InviteService();
