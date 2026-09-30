import { Elysia, t } from "elysia";
import {
  CreateInviteBodyModel,
  CreateInviteResponseModel,
  ListInvitesResponseModel,
  RevokeInviteResponseModel,
} from "../auth.model";
import { inviteService } from "../services/invite.service";
import { authPlugin } from "../auth.guard";

/**
 * Admin invite code management controller.
 * Mounted at /auth/invites.
 */
export const inviteController = new Elysia({ prefix: "/invites" })
  .use(authPlugin)
  .post(
    "/",
    async ({ body, user }) => {
      const expiresInDays = body?.expiresInDays ? Number(body.expiresInDays) : 7;
      const invite = await inviteService.createInviteCode(user.id, expiresInDays);
      return {
        success: true,
        data: invite,
      };
    },
    {
      roles: ["admin"],
      body: CreateInviteBodyModel,
      response: CreateInviteResponseModel,
      detail: {
        summary: "Create invite code",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .get(
    "/",
    async () => {
      const invites = await inviteService.listInviteCodes();
      return {
        success: true,
        data: invites,
      };
    },
    {
      roles: ["admin"],
      response: ListInvitesResponseModel,
      detail: {
        summary: "List invite codes",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  )
  .delete(
    "/:id",
    async ({ params }) => {
      await inviteService.revokeInviteCode(params.id);
      return {
        success: true,
        message: "Invite code revoked successfully",
      };
    },
    {
      roles: ["admin"],
      params: t.Object({
        id: t.String({ description: "Invite unique ID" }),
      }),
      response: RevokeInviteResponseModel,
      detail: {
        summary: "Revoke invite code",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
      },
    }
  );
