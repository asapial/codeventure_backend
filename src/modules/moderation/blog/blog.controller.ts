import { Request, Response } from "express";
import status from "http-status";

import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";
import type { IListBlogQuery } from "./blog.validation";
import { blogService } from "./blog.service";

const listBlog = catchAsync(async (req: Request, res: Response) => {
    const result = await blogService.listBlog({
        actorUserId: req.user.userId,
        query: req.query as unknown as IListBlogQuery,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Blog posts loaded.",
        data: result,
    });
});

const getBlogPost = catchAsync(async (req: Request, res: Response) => {
    const result = await blogService.getBlogPost({
        actorUserId: req.user.userId,
        postId: String(req.params.id ?? ""),
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Blog post loaded.",
        data: result,
    });
});

const decideBlogPost = catchAsync(async (req: Request, res: Response) => {
    const result = await blogService.decideBlogPost({
        actorUserId: req.user.userId,
        postId: String(req.params.id ?? ""),
        body: req.body,
    });
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: result.idempotentReplay
            ? "Decision replayed."
            : "Decision recorded.",
        data: result,
    });
});

export const blogController = {
    listBlog,
    getBlogPost,
    decideBlogPost,
};