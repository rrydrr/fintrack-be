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
});

export const RegisterResponseDataModel = t.Object({
  token: t.String({ description: "JWT access token" }),
  email: t.String({ description: "Registered email address" }),
});

export const RegisterResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(RegisterResponseDataModel),
  error: t.Optional(t.String()),
});

export const AuthResponseDataModel = t.Object({
  token: t.String({ description: "JWT access token" }),
  email: t.String({ description: "User email address" }),
});

export const AuthResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(AuthResponseDataModel),
  error: t.Optional(t.String()),
});

export const MeResponseModel = t.Object({
  success: t.Boolean(),
  data: t.Optional(UserModel),
  error: t.Optional(t.String()),
});
