import express from "express"; import request from "supertest"; import { describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ list: vi.fn((_q, r) => r.json({ data: [] })), get: vi.fn((_q, r) => r.json({ data: {} })), create: vi.fn((_q, r) => r.status(201).json({ data: {} })), update: vi.fn((_q, r) => r.json({ data: {} })), job: vi.fn((_q, r) => r.status(202).json({ jobRef: "j" })) }));
vi.mock("../admin.policy", () => ({ requireAdmin: (_q: unknown, _r: unknown, n: () => void) => n(), requirePermission: () => (_q: unknown, _r: unknown, n: () => void) => n(), requireStepUp: () => (_q: unknown, _r: unknown, n: () => void) => n() }));
vi.mock("../admin.handlers", () => ({ createAdminHandlers: () => ({ list: calls.list, get: calls.get, create: () => calls.create, update: () => calls.update, job: () => calls.job }) }));
import { leadsRouter } from "./leads.route";
const app = express(); app.use(express.json()); app.use("/leads", leadsRouter);
describe("A2 lead routes", () => {
  it("uses exact list/create methods", async () => { await request(app).get("/leads").expect(200); await request(app).post("/leads").send({ title: "Lead" }).expect(201); expect(calls.list).toHaveBeenCalled(); });
  it("uses PATCH for assign and bulk", async () => { await request(app).patch("/leads/00000000-0000-4000-8000-000000000001/assign").send({}).expect(200); await request(app).patch("/leads/bulk").send({}).expect(202); });
  it("supports A3 detail actions", async () => { const id = "00000000-0000-4000-8000-000000000001"; await request(app).get(`/leads/${id}`).expect(200); await request(app).patch(`/leads/${id}`).send({ version: 1 }).expect(200); await request(app).post(`/leads/${id}/convert`).send({ version: 1 }).expect(200); });
});
