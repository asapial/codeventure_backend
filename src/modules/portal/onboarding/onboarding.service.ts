import crypto from "node:crypto";
import status from "http-status";

import AppError from "../../../errorHelpers/AppError";
import { prisma } from "../../../lib/prisma";
import { envVars } from "../../../config/env";
import {
    resolvePrimaryOrg,
    requireCustomerOwner,
} from "../portal.policy";
import type {
    IOnboardingProfile,
    ITeamInvitation,
    ITeamInvitationInput,
} from "./onboarding.type";
import type { UpdateOnboardingBody } from "./onboarding.validation";

const HOURS_72_MS = 72 * 60 * 60 * 1000;

const hashToken = (raw: string): string =>
    crypto.createHash("sha256").update(raw).digest("hex");

const communicationWire = (
    wire: string,
): "email" | "phone" | "slack" | "teams" => {
    return wire === "phone" || wire === "slack" || wire === "teams"
        ? wire
        : "email";
};

const statusWire = (db: string): IOnboardingProfile["status"] => {
    if (db === "IN_PROGRESS") return "in-progress";
    if (db === "COMPLETED") return "completed";
    return "not-started";
};

/**
 * Resolve the user's onboarding profile — creating an empty row on first read
 * so the wizard can render without 404s.
 */
const getOnboarding = async (
    userId: string,
): Promise<IOnboardingProfile> => {
    const profile = await prisma.onboardingProfile.upsert({
        where: { userId },
        update: {},
        create: { userId, status: "NOT_STARTED", currentStep: 0 },
        select: {
            userId: true,
            status: true,
            currentStep: true,
            companyName: true,
            businessType: true,
            websiteUrl: true,
            billingAddress: true,
            primaryContact: true,
            timezone: true,
            locale: true,
            communication: true,
            completedAt: true,
        },
    });

    // Pull brand assets uploaded during the wizard.
    const assets = await prisma.fileAsset.findMany({
        where: { ownerId: userId, status: { in: ["READY", "PENDING", "SCANNING"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            fileName: true,
            secureUrl: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
        },
    });

    return {
        userId: profile.userId,
        status: statusWire(profile.status),
        currentStep: profile.currentStep,
        companyName: profile.companyName,
        businessType: profile.businessType,
        websiteUrl: profile.websiteUrl,
        billingAddress:
            (profile.billingAddress as IOnboardingProfile["billingAddress"]) ??
            null,
        primaryContact:
            (profile.primaryContact as IOnboardingProfile["primaryContact"]) ??
            null,
        brandAssets: assets.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            url: a.secureUrl ?? "",
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            status: a.status.toLowerCase() as IOnboardingProfile["brandAssets"][number]["status"],
        })),
        timezone: profile.timezone,
        locale: profile.locale,
        communication: communicationWire(profile.communication),
        completedAt: profile.completedAt?.toISOString() ?? null,
    };
};

const updateOnboarding = async (
    userId: string,
    patch: UpdateOnboardingBody,
): Promise<IOnboardingProfile> => {
    const next = await prisma.onboardingProfile.upsert({
        where: { userId },
        update: {
            ...(patch.companyName !== undefined ? { companyName: patch.companyName } : {}),
            ...(patch.businessType !== undefined ? { businessType: patch.businessType } : {}),
            ...(patch.websiteUrl !== undefined ? { websiteUrl: patch.websiteUrl } : {}),
            ...(patch.billingAddress !== undefined
                ? { billingAddress: patch.billingAddress as unknown as object }
                : {}),
            ...(patch.primaryContact !== undefined
                ? { primaryContact: patch.primaryContact as unknown as object }
                : {}),
            ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
            ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
            ...(patch.communication !== undefined
                ? { communication: patch.communication.toUpperCase() as "EMAIL" | "PHONE" | "SLACK" | "TEAMS" }
                : {}),
            ...(patch.complete === true
                ? { status: "COMPLETED", completedAt: new Date() }
                : { status: "IN_PROGRESS" }),
        },
        create: {
            userId,
            status: patch.complete ? "COMPLETED" : "IN_PROGRESS",
            currentStep: 0,
            companyName: patch.companyName,
            businessType: patch.businessType,
            websiteUrl: patch.websiteUrl,
            billingAddress: patch.billingAddress as unknown as object,
            primaryContact: patch.primaryContact as unknown as object,
            timezone: patch.timezone,
            locale: patch.locale,
            communication: (patch.communication ?? "email").toUpperCase() as "EMAIL" | "PHONE" | "SLACK" | "TEAMS",
            completedAt: patch.complete ? new Date() : null,
        },
        select: { userId: true },
    });

    return getOnboarding(next.userId);
};

/**
 * Issue a new invitation. Caller must be a customer owner in some org.
 * Token is raw-returned to the caller; the DB stores SHA-256(token).
 */
const invite = async (
    userId: string,
    input: ITeamInvitationInput,
): Promise<ITeamInvitation> => {
    const org = await resolvePrimaryOrg(userId);
    if (!org) {
        throw new AppError(
            status.FAILED_DEPENDENCY,
            "Create your workspace before inviting teammates.",
            { code: "WORKSPACE_REQUIRED" },
        );
    }
    await requireCustomerOwner(userId, org.id);

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + HOURS_72_MS);

    const created = await prisma.invitation.create({
        data: {
            email: input.email.toLowerCase(),
            organizationId: org.id,
            role: input.role.toUpperCase() as "OWNER" | "ADMIN" | "EDITOR" | "VIEWER",
            invitedById: userId,
            tokenHash: hashToken(rawToken),
            expiresAt,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
    });

    const inviteLink = `${envVars.FRONTEND_URL ?? "http://localhost:3000"}/invite/${rawToken}`;

    return {
        id: created.id,
        email: created.email,
        role: created.role.toLowerCase(),
        inviteLink,
        expiresAt: created.expiresAt.toISOString(),
    };
};

export const onboardingService = {
    getOnboarding,
    updateOnboarding,
    invite,
};
