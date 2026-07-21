/**
 * S6 — Knowledge Base HTTP handlers.
 *
 * One thin handler per knowledge-base action: list, get, create, update,
 * change status, archive, reply-to-feedback. Inputs are pre-validated by
 * `validateRequest`.
 */

import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import AppError from "../../../errorHelpers/AppError";
import { sendResponse } from "../../../utils/sendResponse";
import type {
    ArchiveArticleBody,
    ChangeArticleStatusBody,
    CreateArticleBody,
    KnowledgeListQuery,
    ReplyFeedbackBody,
    UpdateArticleBody,
} from "./knowledge.validation";
import { knowledgeService } from "./knowledge.service";

const requireParam = (value: string | string[] | undefined): string => {
    if (typeof value !== "string" || value.length === 0) {
        throw new AppError(status.BAD_REQUEST, "Missing required path parameter.");
    }
    return value;
};

const listArticles = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const query = req.query as unknown as KnowledgeListQuery;
    const result = await knowledgeService.listArticles(actorUserId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge base list fetched.",
        data: result,
    });
});

const getArticle = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const id = requireParam(req.params.id);
    const result = await knowledgeService.getArticle(actorUserId, id);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge article fetched.",
        data: result,
    });
});

const createArticle = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const body = req.body as CreateArticleBody;
    const result = await knowledgeService.createArticle(actorUserId, body);
    sendResponse(res, {
        status: status.CREATED,
        success: true,
        message: "Knowledge article created.",
        data: result,
    });
});

const updateArticle = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const id = requireParam(req.params.id);
    const body = req.body as UpdateArticleBody;
    const result = await knowledgeService.updateArticle(actorUserId, id, body);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge article updated.",
        data: result,
    });
});

const changeArticleStatus = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const id = requireParam(req.params.id);
    const body = req.body as ChangeArticleStatusBody;
    const result = await knowledgeService.changeArticleStatus(
        actorUserId,
        id,
        body,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge article status changed.",
        data: result,
    });
});

const archiveArticle = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const id = requireParam(req.params.id);
    const body = req.body as ArchiveArticleBody | undefined;
    const reason = body?.reason;
    const result = await knowledgeService.archiveArticle(
        actorUserId,
        id,
        reason,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Knowledge article archived.",
        data: result,
    });
});

const replyFeedback = catchAsync(async (req: Request, res: Response) => {
    const actorUserId = req.user.userId;
    const id = requireParam(req.params.id);
    const { feedbackId, reply } = req.body as ReplyFeedbackBody;
    const result = await knowledgeService.replyFeedback(
        actorUserId,
        id,
        feedbackId,
        reply,
    );
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Feedback reply sent.",
        data: result,
    });
});

export const knowledgeController = {
    listArticles,
    getArticle,
    createArticle,
    updateArticle,
    changeArticleStatus,
    archiveArticle,
    replyFeedback,
};