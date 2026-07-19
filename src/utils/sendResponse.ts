import { Response } from "express";

/**
 * Standard success envelope. Mirrors the wire shape the frontend `apiFetch`
 * helper consumes:
 *
 *   { success: true, message, data?, meta? }
 *
 * Optional `meta` is used by paginated list endpoints.
 */
interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface IResponseData<T> {
  status: number;
  success: true;
  message: string;
  data?: T;
  meta?: IPaginationMeta;
}

export const sendResponse = <T>(res: Response, responseData: IResponseData<T>) => {
  res.status(responseData.status).json({
    success: responseData.success,
    message: responseData.message,
    data: responseData.data,
    meta: responseData.meta,
  });
};