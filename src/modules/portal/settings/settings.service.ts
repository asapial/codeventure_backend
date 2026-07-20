import crypto from "node:crypto";
import status from "http-status";
import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import {
    requireOrgBySlug,
    requireOrgMembership,
    resolvePrimaryOrg,
    toIso,
} from "../portal.policy";
import type {
    ICustomerSettings,
    IDataExportJob,
    IOrganizationSettings,
    IProfileSettings,
    ISessionInfo,
    ITeamInvitation,
    ITeamMember,
    TeamMemberStatusWire,
} from "./settings.type";
import type {
    ExportRequestBody,
    InviteTeamBody,
    PatchOrganizationBody,
    PatchProfileBody,
    UpdateMemberBody,
} from "./settings.validation";

/**
 * Schema realities drive a number of helper defaults — fields like
 * `phone`, `timezone`, `lastActiveAt`, `completedAt`, `device`, `isCurrent`
 * aren't materialized on the lean Prisma schema, so we synthesize
 * sensible placeholders that don't lock down the controller contract.
 */
const readImage = (u: { image: string | null }): string | null => u.image;

const inferDevice = (ua: string | null): string => {
    if (!ua) return "Unknown device";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown device";
};

const toWireExportStatus = (
    raw: string,
): IDataExportJob["status"] => {
    switch (raw) {
        case "RUNNING":
            return "running";
        case "READY":
            return "ready";
        case "FAILED":
            return "failed";
        case "EXPIRED":
            return "expired";
        default:
            return "queued";
    }
};

const buildProfile = async (userId: string): Promise<IProfileSettings> => {
    const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            jobTitle: true,
        },
    });
    if (!u) {
        throw new AppError(status.NOT_FOUND, "User not found.", {
            code: "USER_NOT_FOUND",
        });
    }
    return {
        userId: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: readImage(u),
        jobTitle: u.jobTitle ?? null,
        phone: null,
        timezone: "UTC",
        locale: "en",
    };
};

const buildOrganization = async (
    userId: string,
): Promise<IOrganizationSettings> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }
    const full = await prisma.organization.findUnique({
        where: { id: org.id },
        select: { id: true, slug: true, name: true },
    });
    if (!full) {
        throw new AppError(status.NOT_FOUND, "Organization not found.");
    }
    return {
        id: full.id,
        name: full.name,
        slug: full.slug,
        website: null,
        industry: null,
        addressLines: [],
        timezone: "UTC",
        logoUrl: null,
    };
};

const buildSession = (s: {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    updatedAt: Date;
    token: string;
}): ISessionInfo => {
    const location = s.ipAddress
        ? `IP ${s.ipAddress}`
        : "Unknown location";
    return {
        id: s.id,
        device: inferDevice(s.userAgent),
        location,
        ipAddress: s.ipAddress ?? "0.0.0.0",
        lastActiveAt: s.updatedAt.toISOString(),
        // `token` is what uniquely identifies "this device" — there's no
        // separate `isCurrent` flag. We treat the most recently-touched
        // row (sorted desc by updatedAt) as current; downstream callers
        // patch the boolean post-query.
        isCurrent: false,
    };
};

const getSettings = async (
    userId: string,
): Promise<ICustomerSettings> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }
    await requireOrgMembership(userId, org.id);

    const [profile, organization, memberships, sessions, exports, invitations] =
        await Promise.all([
            buildProfile(userId),
            buildOrganization(userId),
            prisma.organizationMember.findMany({
                where: { organizationId: org.id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                },
                orderBy: { joinedAt: "asc" },
            }),
            prisma.session.findMany({
                where: { userId },
                orderBy: { updatedAt: "desc" },
                take: 12,
                select: {
                    id: true,
                    ipAddress: true,
                    userAgent: true,
                    updatedAt: true,
                    token: true,
                },
            }),
            prisma.dataExportJob.findMany({
                where: { userId },
                orderBy: { requestedAt: "desc" },
                take: 6,
                select: {
                    id: true,
                    requestedAt: true,
                    readyAt: true,
                    expiresAt: true,
                    status: true,
                    storageKey: true,
                },
            }),
            prisma.invitation.findMany({
                where: {
                    organizationId: org.id,
                    acceptedAt: null,
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    invitedBy: { select: { name: true } },
                    createdAt: true,
                    expiresAt: true,
                    acceptedAt: true,
                },
            }),
        ]);

    const team: ITeamMember[] = memberships.map((m) => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        status: "active" as TeamMemberStatusWire, // schema doesn't track suspended/invited yet
        jobTitle: null,
        avatarUrl: readImage(m.user),
        lastActiveAt: null,
        invitedAt: null,
        joinedAt: toIso(m.joinedAt),
    }));

    const invitationWires: ITeamInvitation[] = invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedByName: inv.invitedBy.name,
        invitedAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    }));

    const sessionWires: ISessionInfo[] = sessions.map(buildSession);
    // Mark the first (newest) session as current since the schema doesn't
    // store an `isCurrent` flag and we sorted by recency.
    if (sessionWires.length > 0) sessionWires[0]!.isCurrent = true;

    const exportWires: IDataExportJob[] = exports.map((e) => ({
        id: e.id,
        requestedAt: e.requestedAt.toISOString(),
        // readyAt serves as "completed" — schema doesn't have a
        // dedicated completedAt column.
        completedAt: toIso(e.readyAt),
        status: toWireExportStatus(e.status),
        downloadUrl: e.storageKey ?? null,
        expiresAt: toIso(e.expiresAt),
    }));

    return {
        profile,
        organization,
        team,
        invitations: invitationWires,
        sessions: sessionWires,
        recentExports: exportWires,
    };
};

const patchProfile = async (
    userId: string,
    body: PatchProfileBody,
): Promise<IProfileSettings> => {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle;
    // phone / timezone / locale / avatarUrl are not on the `User` model —
    // they are accepted on the wire but persisted as `image` if present.
    if (body.avatarUrl !== undefined) data.image = body.avatarUrl;
    if (Object.keys(data).length === 0) return buildProfile(userId);

    await prisma.user.update({
        where: { id: userId },
        data,
    });
    return buildProfile(userId);
};

const patchOrganization = async (
    userId: string,
    body: PatchOrganizationBody,
    slug: string,
): Promise<IOrganizationSettings> => {
    const { orgId } = await requireOrgBySlug(userId, slug);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    // website / industry / addressLines / timezone / logoUrl are not
    // on the Organization model — accepted on wire but not persisted.
    if (Object.keys(data).length > 0) {
        await prisma.organization.update({
            where: { id: orgId },
            data,
        });
    }
    return buildOrganization(userId);
};

const inviteTeamMember = async (
    userId: string,
    orgSlug: string,
    body: InviteTeamBody,
): Promise<ITeamInvitation> => {
    const { orgId } = await requireOrgBySlug(userId, orgSlug);

    const inviter = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    // Raw token never persists; we store SHA-256 only.
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    // 72h window — matches the schema's permissioned invitation flow.
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 72);

    const created = await prisma.invitation.create({
        data: {
            organizationId: orgId,
            email: body.email,
            role: body.role,
            // `jobTitle` lives on `User` not `Invitation`. Will only
            // be attached to the actual user when they accept.
            invitedById: userId,
            tokenHash,
            expiresAt,
        },
        select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
        },
    });

    return {
        id: created.id,
        email: created.email,
        role: created.role,
        invitedByName: inviter?.name ?? "Unknown",
        invitedAt: created.createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        acceptedAt: created.acceptedAt?.toISOString() ?? null,
    };
};

const updateMember = async (
    userId: string,
    memberId: string,
    body: UpdateMemberBody,
): Promise<ITeamMember> => {
    const member = await prisma.organizationMember.findUnique({
        where: { id: memberId },
        select: {
            id: true,
            organizationId: true,
            role: true,
            joinedAt: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
        },
    });
    if (!member) {
        throw new AppError(status.NOT_FOUND, "Member not found.", {
            code: "MEMBER_NOT_FOUND",
        });
    }
    await requireOrgMembership(userId, member.organizationId);

    if (body.role !== undefined) {
        await prisma.organizationMember.update({
            where: { id: memberId },
            data: { role: body.role },
        });
    }

    return {
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        role: body.role ?? member.role,
        status: "active",
        jobTitle: null,
        avatarUrl: readImage(member.user),
        lastActiveAt: null,
        invitedAt: null,
        joinedAt: toIso(member.joinedAt),
    };
};

const removeMember = async (
    userId: string,
    memberId: string,
): Promise<void> => {
    const member = await prisma.organizationMember.findUnique({
        where: { id: memberId },
    });
    if (!member) {
        throw new AppError(status.NOT_FOUND, "Member not found.", {
            code: "MEMBER_NOT_FOUND",
        });
    }
    await requireOrgMembership(userId, member.organizationId);
    if (member.userId === userId) {
        throw new AppError(
            status.BAD_REQUEST,
            "Owners cannot remove themselves.",
            { code: "CANNOT_REMOVE_OWNER" },
        );
    }
    await prisma.organizationMember.delete({ where: { id: memberId } });
};

const revokeSession = async (
    userId: string,
    sessionId: string,
): Promise<void> => {
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, updatedAt: true, token: true },
    });
    if (!session || session.userId !== userId) {
        throw new AppError(status.NOT_FOUND, "Session not found.", {
            code: "SESSION_NOT_FOUND",
        });
    }
    // We can't easily tell "the current one" without metadata — block
    // revoking the row whose `updatedAt` is the most recent AND
    // that matches the current `Authorization` cookie. The middleware
    // can't reliably tell us which token belongs to the current request,
    // so we conservatively block revoking the most recent session.
    const mostRecent = await prisma.session.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
    });
    if (mostRecent && mostRecent.id === sessionId) {
        throw new AppError(
            status.BAD_REQUEST,
            "Cannot revoke the current session from this endpoint.",
            { code: "CANNOT_REVOKE_CURRENT_SESSION" },
        );
    }
    await prisma.session.delete({ where: { id: sessionId } });
};

const requestExport = async (
    userId: string,
    body: ExportRequestBody,
): Promise<IDataExportJob> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(status.FORBIDDEN, "No organization.", {
            code: "NO_ORG",
        });
    }
    await requireOrgMembership(userId, org.id);

    // `sections` and `delivery` aren't on the schema — they exist as
    // wire-level concepts; we accept them but only persist `status`
    // and the userId. A worker can extend `DataExportJob` with those
    // columns later without breaking this controller contract.
    const created = await prisma.dataExportJob.create({
        data: {
            userId,
            status: "QUEUED",
        },
        select: {
            id: true,
            requestedAt: true,
            readyAt: true,
            expiresAt: true,
            status: true,
        },
    });

    void body; // sections/delivery captured upstream for the worker.

    return {
        id: created.id,
        requestedAt: created.requestedAt.toISOString(),
        completedAt: toIso(created.readyAt),
        status: toWireExportStatus(created.status),
        downloadUrl: null,
        expiresAt: toIso(created.expiresAt),
    };
};

export const settingsService = {
    getSettings,
    patchProfile,
    patchOrganization,
    inviteTeamMember,
    updateMember,
    removeMember,
    revokeSession,
    requestExport,
};