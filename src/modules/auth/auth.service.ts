import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, inviteCodes, UserRole } from "../../db/schema";
import { logger } from "../../utils/logger";
import { accountTypeService } from "../account-type/account-type.service";

import { userService, toSafeUser, type SafeUser } from "./services/user.service";
import { tokenService } from "./services/token.service";
import { inviteService } from "./services/invite.service";
import { emailVerificationService } from "./services/email-verification.service";

// Re-export subservices and types
export type { SafeUser } from "./services/user.service";
export { toSafeUser, userService } from "./services/user.service";
export { tokenService, hashToken } from "./services/token.service";
export { inviteService, generateInviteCode } from "./services/invite.service";
export { emailVerificationService } from "./services/email-verification.service";

export class AuthService {
  /**
   * Register a new user with hashed password and valid one-time invite code.
   */
  public async register(payload: {
    name: string;
    email: string;
    password: string;
    inviteCode: string;
    role?: UserRole;
  }): Promise<SafeUser> {
    const normalizedCode = (payload.inviteCode || "").trim().toUpperCase();

    if (!normalizedCode) {
      const err: any = new Error("Invite code is required to register");
      err.status = 400;
      throw err;
    }

    // 1. Validate invite code
    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, normalizedCode))
      .limit(1);

    if (!invite) {
      const err: any = new Error("Invalid invite code");
      err.status = 400;
      throw err;
    }

    if (invite.usedAt) {
      const err: any = new Error("Invite code has already been used");
      err.status = 400;
      throw err;
    }

    if (new Date() > invite.expiresAt) {
      const err: any = new Error("Invite code has expired");
      err.status = 400;
      throw err;
    }

    const normalizedEmail = payload.email.toLowerCase().trim();

    // 2. Check if email already exists
    const existing = await userService.findByEmail(normalizedEmail);
    if (existing) {
      const err: any = new Error("Email is already registered");
      err.status = 409;
      throw err;
    }

    // 3. Hash password with Bun native bcrypt
    const passwordHash = await Bun.password.hash(payload.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    // 4. Atomically insert user and mark invite code as redeemed
    const newUser = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: payload.name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: payload.role || "user",
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          defaultCurrency: users.defaultCurrency,
          emailVerifiedAt: users.emailVerifiedAt,
        });

      await tx
        .update(inviteCodes)
        .set({
          usedAt: new Date(),
          usedBy: createdUser.id,
        })
        .where(eq(inviteCodes.id, invite.id));

      return createdUser;
    });

    // 5. Automatically provision initial account types for the new user from master templates
    try {
      await accountTypeService.seedUserAccountTypes(newUser.id);
    } catch (seedErr) {
      logger.error("Failed to seed user account types upon registration", seedErr);
    }

    logger.success("User registered with invite code successfully", {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      inviteCode: normalizedCode,
    });

    // Asynchronously dispatch verification email without blocking registration
    emailVerificationService.sendVerificationEmailForUser({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    }).catch((emailErr) => {
      logger.error("Failed to send verification email upon registration", emailErr);
    });

    return toSafeUser(newUser);
  }

  /**
   * Authenticate user credentials and return user profile.
   */
  public async login(payload: {
    email: string;
    password: string;
  }): Promise<SafeUser> {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // Query user by email
    const user = await userService.findByEmail(normalizedEmail);

    if (!user) {
      const err: any = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    // Verify password against stored hash
    const isMatch = await Bun.password.verify(payload.password, user.passwordHash);
    if (!isMatch) {
      const err: any = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    logger.info("User logged in successfully", {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return toSafeUser(user);
  }

  // Delegated user methods
  public findById = (id: string) => userService.findById(id);
  public updateDefaultCurrency = (userId: string, currencyCode: string) =>
    userService.updateDefaultCurrency(userId, currencyCode);

  // Delegated token methods
  public createRefreshToken = (userId: string) => tokenService.createRefreshToken(userId);
  public rotateRefreshToken = (rawToken: string) => tokenService.rotateRefreshToken(rawToken);
  public revokeRefreshToken = (rawToken: string) => tokenService.revokeRefreshToken(rawToken);
  public revokeAllUserTokens = (userId: string) => tokenService.revokeAllUserTokens(userId);

  // Delegated invite methods
  public createInviteCode = (adminUserId: string, expiresInDays = 7) =>
    inviteService.createInviteCode(adminUserId, expiresInDays);
  public listInviteCodes = () => inviteService.listInviteCodes();
  public revokeInviteCode = (inviteId: string) => inviteService.revokeInviteCode(inviteId);

  // Delegated email verification methods
  public createVerificationToken = (userId: string, expiresInHours = 24) =>
    emailVerificationService.createVerificationToken(userId, expiresInHours);
  public sendVerificationEmailForUser = (user: { id: string; email?: string; name?: string }) =>
    emailVerificationService.sendVerificationEmailForUser(user);
  public verifyEmail = (rawToken: string) => emailVerificationService.verifyEmail(rawToken);
  public resendVerificationEmail = (email: string) =>
    emailVerificationService.resendVerificationEmail(email);
}

export const authService = new AuthService();
