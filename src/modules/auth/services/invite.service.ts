import { desc, eq } from "drizzle-orm";
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
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * List all invite codes for admin review.
   */
  public async listInviteCodes() {
    const records = await db
      .select()
      .from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt));

    return records.map((r) => ({
      id: r.id,
      code: r.code,
      createdBy: r.createdBy,
      usedBy: r.usedBy,
      expiresAt: r.expiresAt.toISOString(),
      usedAt: r.usedAt ? r.usedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Revoke an active unused invite code.
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

    if (record.usedAt) {
      const err: any = new Error("Cannot revoke an already used invite code");
      err.status = 400;
      throw err;
    }

    await db.delete(inviteCodes).where(eq(inviteCodes.id, inviteId));
    logger.info("Admin revoked invite code", { inviteId });
  }
}

export const inviteService = new InviteService();
