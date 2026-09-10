import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, UserRole } from "../../db/schema";
import { logger } from "../../utils/logger";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export class AuthService {
  /**
   * Register a new user with hashed password.
   */
  public async register(payload: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<SafeUser> {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      const err: any = new Error("Email is already registered");
      err.status = 409;
      throw err;
    }

    // Hash password with Bun native bcrypt
    const passwordHash = await Bun.password.hash(payload.password, {
      algorithm: "bcrypt",
      cost: 10,
    });

    // Insert user into PostgreSQL
    const [newUser] = await db
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
      });

    logger.success("User registered successfully", {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return newUser;
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
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

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

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Find user profile by unique ID.
   */
  public async findById(id: string): Promise<SafeUser> {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }

    return user;
  }
}

export const authService = new AuthService();
