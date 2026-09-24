import { t } from "elysia";

export const RegisterBodyModel = t.Object({
  name: t.String({
    minLength: 2,
    maxLength: 100,
    description: "Full name",
  }),
  email: t.String({
    format: "email",
    description: "Email address",
  }),
  password: t.String({
    minLength: 6,
    maxLength: 128,
    description: "Password",
  }),
  inviteCode: t.String({
    minLength: 4,
    maxLength: 32,
    description: "Invite code",
  }),
});

export const LoginBodyModel = t.Object({
  email: t.String({
    format: "email",
    description: "Email address",
  }),
  password: t.String({
    minLength: 1,
    description: "Password",
  }),
});

export const UserRoleModel = t.Union([t.Literal("admin"), t.Literal("user")], {
  description: "User role",
});

export const UserModel = t.Object({
  id: t.String({ description: "User ID" }),
  name: t.String({ description: "Full name" }),
  email: t.String({ description: "Email address" }),
  role: UserRoleModel,
  defaultCurrency: t.String({ description: "Base currency code" }),
  emailVerified: t.Boolean({ description: "Email verified status" }),
  emailVerifiedAt: t.Nullable(t.String({ description: "Email verified timestamp" })),
});

export const UpdateCurrencyBodyModel = t.Object({
  currency: t.String({
    minLength: 2,
    maxLength: 10,
    description: "Currency code",
  }),
});

export const UpdateCurrencyResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});

export const InviteCodeModel = t.Object({
  id: t.String({ description: "Invite ID" }),
  code: t.String({ description: "Invite code" }),
  createdBy: t.String({ description: "Creator user ID" }),
  usedBy: t.Nullable(t.String({ description: "Redeemer user ID" })),
  expiresAt: t.String({ description: "Expiration timestamp" }),
  usedAt: t.Nullable(t.String({ description: "Usage timestamp" })),
  createdAt: t.String({ description: "Creation timestamp" }),
});

export const CreateInviteBodyModel = t.Optional(
  t.Object({
    expiresInDays: t.Optional(
      t.Numeric({
        default: 7,
        minimum: 1,
        maximum: 30,
        description: "Expires in days",
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
    description: "Verification token",
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
    description: "Email address",
  }),
});

export const ResendVerificationResponseModel = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
  error: t.Optional(t.String()),
});

