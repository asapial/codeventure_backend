import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { settingsController } from "./settings.controller";
import {
    exportRequestSchema,
    inviteTeamSchema,
    memberIdParamSchema,
    patchOrganizationSchema,
    patchProfileSchema,
    sessionIdParamSchema,
    updateMemberSchema,
} from "./settings.validation";

const router = Router();

router.get("/", settingsController.get);
router.patch(
    "/profile",
    validateRequest(patchProfileSchema),
    settingsController.patchProfile,
);
router.patch(
    "/organization/:slug",
    validateRequest(patchOrganizationSchema),
    settingsController.patchOrganization,
);
router.post(
    "/organization/:slug/invitations",
    validateRequest(inviteTeamSchema),
    settingsController.inviteTeam,
);
router.patch(
    "/members/:id",
    validateRequest(updateMemberSchema),
    settingsController.updateMember,
);
router.delete(
    "/members/:id",
    validateRequest(memberIdParamSchema),
    settingsController.removeMember,
);
router.delete(
    "/sessions/:id",
    validateRequest(sessionIdParamSchema),
    settingsController.revokeSession,
);
router.post(
    "/data-exports",
    validateRequest(exportRequestSchema),
    settingsController.requestExport,
);

export const settingsRouter = router;