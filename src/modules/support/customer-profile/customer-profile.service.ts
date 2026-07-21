/**
 * S5 — Customer Profile service.
 *
 * Three read endpoints + two mutations:
 *   - getProfile(): fans out org + profile + members + recent tickets + activity
 *   - flagProfile(): flips AccountStatus, writes a CUSTOMER_FLAGGED audit event,
 *                    updates the profile's `lastTouched*` fields
 *   - addNote():     appends a CustomerActivityLog row ("AGENT_NOTE")
 *
 * Members are ordered by role priority then joinedAt so the S5 page can show
 * a stable "primary contact" without re-sorting client-side.
 */

import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { Prisma, prisma } from "../../../lib/prisma";
import {
    recordAuditEvent,
    requireSupportAgent,
    toIso,
    toWireAccountStatus,
    toWireTicketPriority,
    toWireTicketStatus,
} from "../support.policy";
import type {
    OrganizationIdParam,
    ProfileFlagBody,
    ProfileNoteBody,
} from "./customer-profile.validation";
import type {
    ICustomerActivityEntry,
    ICustomerProfile,
    ICustomerProfileMember,
    ICustomerTicketRow,
    IProfileFlagResult,
    IProfileNoteResult,
} from "./customer-profile.type";

const ROLE_WIRE: Record<string, ICustomerProfileMember["role"]> = {
    OWNER: "owner",
    ADMIN: "admin",
    EDITOR: "editor",
    VIEWER: "viewer",
};

const loadOrganization = async (
    id: string,
): Promise<
    Prisma.OrganizationGetPayload<{
        include: {
            supportProfile: {
                include: {
                    lastTouchedBy: {
                        select: { id: true; name: true; email: true };
                    };
                };
            };
        };
    }>
> => {
    const org = await prisma.organization.findUnique({
        where: { id },
        include: {
            supportProfile: {
                include: {
                    lastTouchedBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            },
        },
    });
    if (!org) {
        throw new AppError(status.NOT_FOUND, "Organization not found.");
    }
    return org;
};

const loadMembers = async (
    organizationId: string,
): Promise<ICustomerProfileMember[]> => {
    const rows = await prisma.organizationMember.findMany({
        where: { organizationId, user: { isDeleted: false } },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: {
            user: {
                select: { id: true, name: true, email: true },
            },
        },
    });
    return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        role: ROLE_WIRE[r.role] ?? "viewer",
        name: r.user.name ?? null,
        email: r.user.email,
        joinedAt: r.joinedAt.toISOString(),
        isPrimary: r.role === "OWNER",
    }));
};

const loadRecentTickets = async (
    organizationId: string,
    limit = 15,
): Promise<ICustomerTicketRow[]> => {
    const rows = await prisma.supportTicket.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
            requester: { select: { id: true, name: true, email: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id,
        ticketNumber: r.ticketNumber,
        subject: r.subject,
        status: toWireTicketStatus(r.status),
        priority: toWireTicketPriority(r.priority),
        updatedAt: r.updatedAt.toISOString(),
        resolvedAt: toIso(r.resolvedAt),
        requester: {
            id: r.requester.id,
            name: r.requester.name ?? null,
            email: r.requester.email,
        },
    }));
};

const loadActivity = async (
    organizationId: string,
    limit = 30,
): Promise<ICustomerActivityEntry[]> => {
    const rows = await prisma.customerActivityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            actor: { select: { id: true, name: true, email: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        href: r.href,
        actor: r.actor
            ? { id: r.actor.id, name: r.actor.name ?? null, email: r.actor.email }
            : null,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata ?? null,
    }));
};

const requireProfile = <T extends object>(org: {
    supportProfile: T | null;
}): T => {
    if (!org.supportProfile) {
        throw new AppError(
            status.NOT_FOUND,
            "Customer profile has not been initialised.",
        );
    }
    return org.supportProfile;
};

export const customerProfileService = {
    async getProfile(
        actorUserId: string,
        param: OrganizationIdParam,
    ): Promise<ICustomerProfile> {
        await requireSupportAgent(actorUserId);

        const org = await loadOrganization(param.id);
        const profile = requireProfile(org);

        const [members, recentTickets, activity] = await Promise.all([
            loadMembers(org.id),
            loadRecentTickets(org.id),
            loadActivity(org.id),
        ]);

        return {
            organization: {
                id: org.id,
                slug: org.slug,
                name: org.name,
                createdAt: toIso(org.createdAt) ?? "",
                updatedAt: toIso(org.updatedAt) ?? "",
            },
            status: toWireAccountStatus(profile.status),
            healthScore: profile.healthScore,
            churnRisk: profile.churnRisk,
            csatScore: profile.csatScore,
            avgFirstResponseMin: profile.avgFirstResponseMin,
            avgResolutionMin: profile.avgResolutionMin,
            counts: {
                open: profile.openTicketCount,
                awaitingCustomer: profile.awaitingCustomerCount,
                resolved: 0, // computed live in the ticket timeline below if needed
                overdueInvoices: profile.overdueInvoiceCount,
                members: members.length,
            },
            lastTouchedBy: profile.lastTouchedBy
                ? {
                      id: profile.lastTouchedBy.id,
                      name: profile.lastTouchedBy.name ?? null,
                      email: profile.lastTouchedBy.email,
                  }
                : null,
            lastTouchedAt: toIso(profile.lastTouchedAt),
            members,
            recentTickets,
            activity,
        };
    },

    async flagProfile(
        actorUserId: string,
        param: OrganizationIdParam,
        body: ProfileFlagBody,
    ): Promise<IProfileFlagResult> {
        const agent = await requireSupportAgent(actorUserId);

        if (
            body.status !== "active" &&
            (!body.reason || body.reason.trim().length === 0)
        ) {
            throw new AppError(
                status.BAD_REQUEST,
                "A reason is required when flagging an account away from active.",
                { code: "FLAG_REASON_REQUIRED" },
            );
        }

        const dbStatus: Record<ProfileFlagBody["status"], string> = {
            active: "ACTIVE",
            "at-risk": "AT_RISK",
            churning: "CHURNING",
            dormant: "DORMANT",
            closed: "CLOSED",
        };

        const updated = await prisma.organizationSupportProfile.update({
            where: { organizationId: param.id },
            data: {
                status: dbStatus[body.status] as never,
                lastTouchedById: agent.id,
                lastTouchedAt: new Date(),
            },
            include: {
                lastTouchedBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        await prisma.customerActivityLog.create({
            data: {
                organizationId: param.id,
                actorId: agent.id,
                kind: "ACCOUNT_FLAGGED",
                title: `Account flagged as ${body.status}`,
                description: body.reason ?? null,
                href: null,
                metadata: { previousStatus: null, newStatus: body.status } as never,
            },
        });

        await recordAuditEvent({
            actorId: agent.id,
            kind: "CUSTOMER_FLAGGED",
            targetRef: `organization:${param.id}`,
            organizationId: param.id,
            afterJson: { status: body.status, reason: body.reason ?? null },
            customerVisible: false,
        });

        return {
            organizationId: param.id,
            status: toWireAccountStatus(updated.status),
            healthScore: updated.healthScore,
            churnRisk: updated.churnRisk,
            lastTouchedAt:
                updated.lastTouchedAt?.toISOString() ?? new Date().toISOString(),
            lastTouchedBy: updated.lastTouchedBy
                ? {
                      id: updated.lastTouchedBy.id,
                      name: updated.lastTouchedBy.name ?? null,
                      email: updated.lastTouchedBy.email,
                  }
                : null,
        };
    },

    async addNote(
        actorUserId: string,
        param: OrganizationIdParam,
        body: ProfileNoteBody,
    ): Promise<IProfileNoteResult> {
        const agent = await requireSupportAgent(actorUserId);
        // Ensure the org exists; throws 404 otherwise.
        await loadOrganization(param.id);

        const created = await prisma.customerActivityLog.create({
            data: {
                organizationId: param.id,
                actorId: agent.id,
                kind: "AGENT_NOTE",
                title: body.title,
                description: body.description ?? null,
                href: body.href ?? null,
            },
            include: {
                actor: { select: { id: true, name: true, email: true } },
            },
        });

        return {
            activity: {
                id: created.id,
                kind: created.kind,
                title: created.title,
                description: created.description,
                href: created.href,
                actor: created.actor
                    ? {
                          id: created.actor.id,
                          name: created.actor.name ?? null,
                          email: created.actor.email,
                      }
                    : null,
                createdAt: created.createdAt.toISOString(),
                metadata: created.metadata ?? null,
            },
        };
    },
};