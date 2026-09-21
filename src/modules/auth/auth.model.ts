import { t } from "elysia";

export const RegisterBodyModel = t.Object({
  name: t.String({
    minLength: 2,
    maxLength: 100,
    description: "Full name of the user",
  }),
  email: t.String({
    format: "email",
    description: "Valid email address",
  }),
  password: t.String({
    minLength: 6,
    maxLength: 128,
    description: "Password (min 6 characters)",
  }),
  inviteCode: t.String({
    minLength: 4,
    maxLength: 32,
    description: "One-time registration invite code issued by an administrator",
  }),
});

export const LoginBodyModel = t.Object({
  email: t.String({
    format: "email",
    description: "User registered email",
  }),
  password: t.String({
    minLength: 1,
    description: "User password",
  }),
});

export const UserRoleModel = t.Union([t.Literal("admin"), t.Literal("user")], {
  description: "User role ('admin' or 'user')",
});

export const UserModel = t.Object({
  id: t.String({ description: "User unique ID" }),
  name: t.String({ description: "User full name" }),
  email: t.String({ description: "User email address" }),
  role: UserRoleModel,
  defaultCurrency: t.String({ description: "User's preferred base currency code (default: 'IDR')" }),
  emailVerified: t.Boolean({ description: "Whether the user's email is verified" }),
  emailVerifiedAt: t.Nullable(t.String({ description: "Timestamp when email was verified (ISO string)" })),
});

export const UpdateCurrencyBodyModel = t.Object({
  currency: t.String({
    minLength: 2,
    maxLength: 10,
    description: "New default currency code (e.g. 'IDR', 'USD', 'EUR')",
  }),
});

export const UpdateCurrencyResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});

export const InviteCodeModel = t.Object({
  id: t.String({ description: "Unique invite ID" }),
  code: t.String({ description: "One-time signup code" }),
  createdBy: t.String({ description: "Admin user ID who created the invite" }),
  usedBy: t.Nullable(t.String({ description: "User ID who used the invite" })),
  expiresAt: t.String({ description: "Expiration timestamp (ISO string)" }),
  usedAt: t.Nullable(t.String({ description: "Usage timestamp (ISO string)" })),
  createdAt: t.String({ description: "Creation timestamp (ISO string)" }),
});

export const CreateInviteBodyModel = t.Optional(
  t.Object({
    expiresInDays: t.Optional(
      t.Numeric({
        default: 7,
        minimum: 1,
        maximum: 30,
        description: "Number of days until the code expires (default: 7)",
      })
    ),
  })
);

export const CreateInviteResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(InviteCodeModel),
  error: t.Optional(t.String()),
});

export const ListInvitesResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(t.Array(InviteCodeModel)),
  error: t.Optional(t.String()),
});

export const RevokeInviteResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

export const AuthResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});

export const RegisterResponseModel = AuthResponseModel;

export const RefreshTokenResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

export const LogoutResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

export const MeResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});

export const VerifyEmailBodyModel = t.Object({
  token: t.String({
    minLength: 1,
    description: "Verification token received in the verification email",
  }),
});

export const VerifyEmailResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});

export const ResendVerificationBodyModel = t.Object({
  email: t.String({
    format: "email",
    description: "Registered email address to resend verification email to",
  }),
});

export const ResendVerificationResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

