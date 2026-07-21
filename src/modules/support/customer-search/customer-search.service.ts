/**
 * S4 — Customer search service.
 *
 * One endpoint that pages over `Organization` joined to
 * `OrganizationSupportProfile`. The free-text `q` searches both name and slug
 * via Prisma's `OR` operator; everything else is a `where` filter on the
 * profile row.
 */

import { Prisma, prisma } from "../../../lib/prisma";
import { toIso } from "../support.policy";
import type { CustomerSearchQuery } from "./customer-search.validation";
import type {
    ICustomerCard,
    ICustomerSearchResponse,
} from "./customer-search.type";

const buildWhere = (
    query: CustomerSearchQuery,
): Prisma.OrganizationWhereInput => {
    const where: Prisma.OrganizationWhereInput = {
        supportProfile: { isNot: null },
    };

    if (query.q) {
        const needle = query.q.trim();
        where.OR = [
            { name: { contains: needle, mode: "insensitive" } },
            { slug: { contains: needle, mode: "insensitive" } },
        ];
    }

    if (query.status || query.minHealth !== undefined || query.maxHealth !== undefined) {
        const profileWhere: Prisma.OrganizationSupportProfileWhereInput = {};
        if (query.status) {
            // "paused" and "churning" don't exist as DB enum values — they're
            // derived from healthScore/churnRisk at the wire layer. Filter
            // them at the DB level using their numeric signals.
            if (query.status === "active") {
                profileWhere.status = "ACTIVE";
            } else if (query.status === "at-risk") {
                profileWhere.status = "AT_RISK";
            } else if (query.status === "churning") {
                profileWhere.churnRisk = { gte: 70 };
            } else if (query.status === "paused") {
                profileWhere.healthScore = { lte: 25 };
            }
        }
        if (query.minHealth !== undefined || query.maxHealth !== undefined) {
            profileWhere.healthScore = {
                ...(query.minHealth !== undefined ? { gte: query.minHealth } : {}),
                ...(query.maxHealth !== undefined ? { lte: query.maxHealth } : {}),
            };
        }
        where.supportProfile = { is: profileWhere };
    }

    if (query.hasOpenTickets) {
        where.supportProfile = {
            ...(where.supportProfile as object | undefined),
            openTicketCount: { gt: 0 },
        };
    }
    if (query.hasOverdueInvoices) {
        where.supportProfile = {
            ...(where.supportProfile as object | undefined),
            overdueInvoiceCount: { gt: 0 },
        };
    }

    return where;
};

const orderBy = (
    sort: CustomerSearchQuery["sort"],
): Prisma.OrganizationOrderByWithRelationInput[] => {
    switch (sort) {
        case "health-asc":
            return [{ supportProfile: { healthScore: "asc" } }];
        case "health-desc":
            return [{ supportProfile: { healthScore: "desc" } }];
        case "name-asc":
            return [{ name: "asc" }];
        case "recent":
        default:
            return [{ updatedAt: "desc" }];
    }
};

const deriveWireStatus = (
    dbStatus: "ACTIVE" | "AT_RISK" | "CHURNING" | "DORMANT" | "CLOSED",
    healthScore: number,
    churnRisk: number,
): ICustomerCard["status"] => {
    // `paused` is a derived composite used only by the UI — it isn't a 1:1
    // enum value. `churning` short-circuits to the DB enum directly.
    if (dbStatus === "CHURNING" || churnRisk >= 70) return "churning";
    if (dbStatus === "AT_RISK" || healthScore < 60) return "at-risk";
    if (dbStatus === "DORMANT" || healthScore <= 25) return "paused";
    return "active";
};

const findPrimaryContact = async (
    organizationId: string,
): Promise<ICustomerCard["primaryContact"]> => {
    // "Primary" = first OWNER-role member, fall back to first member by joinedAt.
    const member = await prisma.organizationMember.findFirst({
        where: { organizationId },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: {
            user: {
                select: { id: true, name: true, email: true, isDeleted: true },
            },
        },
    });
    if (!member || member.user.isDeleted) return null;
    return {
        id: member.user.id,
        name: member.user.name ?? null,
        email: member.user.email,
    };
};

export const customerSearchService = {
    async search(
        _actorUserId: string,
        query: CustomerSearchQuery,
    ): Promise<ICustomerSearchResponse> {
        const where = buildWhere(query);
        const order = orderBy(query.sort);
        const skip = (query.page - 1) * query.pageSize;
        const take = query.pageSize;

        const [rows, total] = await prisma.$transaction([
            prisma.organization.findMany({
                where,
                orderBy: order,
                skip,
                take,
                include: {
                    supportProfile: {
                        include: {
                            lastTouchedBy: {
                                select: { id: true, name: true, email: true },
                            },
                        },
                    },
                },
            }),
            prisma.organization.count({ where }),
        ]);

        // Resolve the primary contact for the visible page only — not the
        // whole result set — to keep the per-request fan-out bounded.
        const primaryContactByOrg = new Map<string, ICustomerCard["primaryContact"]>();
        await Promise.all(
            rows.map(async (r) => {
                primaryContactByOrg.set(r.id, await findPrimaryContact(r.id));
            }),
        );

        const cards: ICustomerCard[] = rows.map((r) => {
            const profile = r.supportProfile;
            if (!profile) {
                // Should not happen given the `isNot: null` filter; type narrowing.
                throw new Error(`Organization ${r.id} missing support profile`);
            }
            return {
                organizationId: r.id,
                slug: r.slug,
                name: r.name,
                status: deriveWireStatus(
                    profile.status,
                    profile.healthScore,
                    profile.churnRisk,
                ),
                healthScore: profile.healthScore,
                churnRisk: profile.churnRisk,
                csatScore: profile.csatScore,
                openTicketCount: profile.openTicketCount,
                awaitingCustomerCount: profile.awaitingCustomerCount,
                overdueInvoiceCount: profile.overdueInvoiceCount,
                lastTouchedAt: toIso(profile.lastTouchedAt),
                lastTouchedBy: profile.lastTouchedBy
                    ? {
                          id: profile.lastTouchedBy.id,
                          name: profile.lastTouchedBy.name ?? null,
                          email: profile.lastTouchedBy.email,
                      }
                    : null,
                primaryContact: primaryContactByOrg.get(r.id) ?? null,
            };
        });

        return {
            rows: cards,
            total,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        };
    },
};