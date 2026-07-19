import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import { projectDetailService } from "./project-detail.service";
import type {
    ActivityQuery,
    ApprovalRespondBody,
    ChangeRequestBody,
    CommentBody,
    FileUploadBody,
} from "./project-detail.validation";

const getDetail = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const result = await projectDetailService.getDetail(req.user.userId, slug);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Project detail retrieved.",
        data: result,
    });
});

const getActivity = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const query = req.query as unknown as ActivityQuery;
    const result = await projectDetailService.getActivity(
        req.user.userId,
        slug,
        query,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Project activity retrieved.",
        data: result,
    });
});

const postComment = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const body = req.body as CommentBody;
    const result = await projectDetailService.postComment(
        req.user.userId,
        slug,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Comment posted.",
        data: result,
    });
});

const uploadFile = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const body = req.body as FileUploadBody;
    const result = await projectDetailService.uploadFile(
        req.user.userId,
        slug,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "File uploaded.",
        data: result,
    });
});

const respondToApproval = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const body = req.body as ApprovalRespondBody;
    const result = await projectDetailService.respondToApproval(
        req.user.userId,
        id,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Approval recorded.",
        data: result,
    });
});

const submitChangeRequest = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const body = req.body as ChangeRequestBody;
    const result = await projectDetailService.submitChangeRequest(
        req.user.userId,
        slug,
        body,
    );
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Change request submitted.",
        data: result,
    });
});

export const projectDetailController = {
    getDetail,
    getActivity,
    postComment,
    uploadFile,
    respondToApproval,
    submitChangeRequest,
};