import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { projectsService } from "./projects.service";
import type { ProjectListQuery } from "./projects.validation";

const list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as unknown as ProjectListQuery;
    const result = await projectsService.list(req.user.userId, query);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Projects retrieved successfully.",
        data: result,
    });
});

const getBySlug = catchAsync(async (req: Request, res: Response) => {
    const { slug } = req.params as { slug: string };
    const result = await projectsService.getBySlug(req.user.userId, slug);
    sendResponse(res, {
        status: status.OK,
        success: true,
        message: "Project retrieved successfully.",
        data: result,
    });
});

export const projectsController = { list, getBySlug };
