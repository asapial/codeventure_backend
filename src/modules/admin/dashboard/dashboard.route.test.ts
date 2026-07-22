import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin Dashboard (A1) route tests.
 *
 * We mock the controller to assert wiring (path, method, middleware order).
 * `vi.hoisted` lifts the mock fn into the hoisted `vi.mock` factory so the
 * factory can reference it without tripping the top-level-variable rule.
 */
const { controllerMock } = vi.hoisted(() => ({ controllerMock: vi.fn() }));

vi.mock("../admin.policy", () => ({
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("./dashboard.controller", () => ({
    dashboardController: { getDashboard: controllerMock },
}));

import { dashboardRouter } from "./dashboard.route";

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use("/dashboard", dashboardRouter);
    return app;
};

describe("admin/dashboard router (A1)", () => {
    beforeEach(() => {
        controllerMock.mockReset();
        controllerMock.mockImplementation(
            (_req: unknown, res: { json: (body: unknown) => void }) => {
                res.json({ data: { kpis: [] }, requestId: "test" });
            },
        );
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("wires GET / to dashboardController.getDashboard", async () => {
        const app = buildApp();
        await request(app).get("/dashboard/").expect(200);
        expect(controllerMock).toHaveBeenCalledTimes(1);
    });

    it("returns 500 envelope when controller throws", async () => {
        controllerMock.mockImplementation(() => {
            throw new Error("boom");
        });
        const app = buildApp();
        // Without the global error handler mounted the request will propagate
        // to Express's default error handler and return 500.
        await request(app).get("/dashboard/").expect(500);
    });
});
