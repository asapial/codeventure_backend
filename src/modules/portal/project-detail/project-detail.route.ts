import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { projectDetailController } from "./project-detail.controller";
import {
    activityQuerySchema,
    approvalRespondSchema,
    changeRequestSchema,
    commentSchema,
    fileUploadSchema,
    slugParamSchema,
} from "./project-detail.validation";

const router = Router();

router.get("/:slug", validateRequest(slugParamSchema), projectDetailController.getDetail);
router.get(
    "/:slug/activity",
    validateRequest({ ...slugParamSchema.shape, ...activityQuerySchema.shape }),
    projectDetailController.getActivity,
);
router.post(
    "/:slug/comments",
    validateRequest({ ...slugParamSchema.shape, ...commentSchema.shape }),
    projectDetailController.postComment,
);
router.post(
    "/:slug/files",
    validateRequest({ ...slugParamSchema.shape, ...fileUploadSchema.shape }),
    projectDetailController.uploadFile,
);
router.post(
    "/approvals/:id/respond",
    validateRequest(approvalRespondSchema),
    projectDetailController.respondToApproval,
);
router.post(
    "/:slug/change-requests",
    validateRequest({ ...slugParamSchema.shape, ...changeRequestSchema.shape }),
    projectDetailController.submitChangeRequest,
);

export const projectDetailRouter = router;