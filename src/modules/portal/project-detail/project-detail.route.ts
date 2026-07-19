import { Router } from "express";
import { z } from "zod";
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

// Merge helper: wrap two `z.object({...})` schemas that each describe the
// `params`/`body`/`query` request envelope into a single validation schema.
const merge = (a: z.ZodObject<any>, b: z.ZodObject<any>) =>
    a.merge(b) as unknown as z.ZodObject<any>;

router.get(
    "/:slug",
    validateRequest(slugParamSchema),
    projectDetailController.getDetail,
);
router.get(
    "/:slug/activity",
    validateRequest(merge(slugParamSchema, activityQuerySchema)),
    projectDetailController.getActivity,
);
router.post(
    "/:slug/comments",
    validateRequest(merge(slugParamSchema, commentSchema)),
    projectDetailController.postComment,
);
router.post(
    "/:slug/files",
    validateRequest(merge(slugParamSchema, fileUploadSchema)),
    projectDetailController.uploadFile,
);
router.post(
    "/approvals/:id/respond",
    validateRequest(approvalRespondSchema),
    projectDetailController.respondToApproval,
);
router.post(
    "/:slug/change-requests",
    validateRequest(merge(slugParamSchema, changeRequestSchema)),
    projectDetailController.submitChangeRequest,
);

export const projectDetailRouter = router;