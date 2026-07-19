import { randomBytes, createHash } from "node:crypto";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/password";
import type {
    RegisterInput,
    AcceptInvitationInput,
} from "./auth-register.validation";
import type { IRegisterResult } from "./auth-register.type";
import { fromWireSignupSource, fromWireAccountRole } from "./auth-register.type";

const sha256 = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

/**
 * Idempotently create a customer record (User + CustomerProfile).
 *
 * - If a deleted/inactive account exists for this email, block.
 * - Otherwise create the User with the given password hash, the
 *   CustomerProfile with names + signup source + terms acceptance,
 *   and (if `inviteToken` is present) attach the user to the matching
 *   organization via OrganizationMember.
 */
export const register = async (
    input: RegisterInput,
): Promise<IRegisterResult> => {
    const existing = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, isActive: true, isDeleted: true },
    });
    if (existing && !existing.isDeleted) {
        throw new AppError(
            status.CONFLICT,
            "An account with this email already exists.",
            { code: "EMAIL_TAKEN", fieldErrors: { email: ["Email is already in use."] } },
        );
    }

    const hashed = await hashPassword(input.password);

    // Resolve the optional invitation token up-front so we can attach the
    // user to the right organization inside the same transaction.
    let invitation: { id: string; organizationId: string; role: string; expiresAt: Date; acceptedAt: Date | null } | null = null;
    if (input.inviteToken) {
        const tokenHash = sha256(input.inviteToken);
        invitation = await prisma.invitation.findUnique({
            where: { tokenHash },
            select: {
                id: true,
                organizationId: true,
                role: true,
                expiresAt: true,
                acceptedAt: true,
            },
        });
        if (
            !invitation ||
            invitation.acceptedAt ||
            invitation.expiresAt.getTime() < Date.now()
        ) {
            throw new AppError(
                status.BAD_REQUEST,
                "This invitation link is invalid or has expired.",
                { code: "INVITATION_INVALID" },
            );
        }
    }

    // Resolve optional referral source.
    const referralSource = input.referralCode
        ? await prisma.referralSource.findUnique({
              where: { code: input.referralCode },
              select: { id: true },
          })
        : null;

    const userId = randomBytes(16).toString("hex");
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        const user = existing
            ? await tx.user.update({
                  where: { id: existing.id },
                  data: {
                      password: hashed,
                      isActive: true,
                      isDeleted: false,
                      name: `${input.firstName} ${input.lastName}`.trim(),
                  },
                  select: { id: true },
              })
            : await tx.user.create({
                  data: {
                      id: userId,
                      email: input.email,
                      name: `${input.firstName} ${input.lastName}`.trim(),
                      password: hashed,
                  },
                  select: { id: true },
              });

        const userPk = user.id;

        await tx.customerProfile.upsert({
            where: { userId: userPk },
            create: {
                userId: userPk,
                firstName: input.firstName,
                lastName: input.lastName,
                signupSource: fromWireSignupSource(input.signupSource ?? "direct"),
                referralCode: input.referralCode,
                referralSourceId: referralSource?.id,
                termsAcceptedAt: now,
                privacyAcceptedAt: now,
                marketingOptIn: input.marketingOptIn ?? false,
                organizationId: invitation?.organizationId ?? null,
            },
            update: {
                firstName: input.firstName,
                lastName: input.lastName,
                signupSource: fromWireSignupSource(input.signupSource ?? "direct"),
                referralCode: input.referralCode,
                referralSourceId: referralSource?.id,
                termsAcceptedAt: now,
                privacyAcceptedAt: now,
                marketingOptIn: input.marketingOptIn ?? false,
                organizationId: invitation?.organizationId ?? null,
            },
        });

        if (invitation) {
            await tx.organizationMember.upsert({
                where: {
                    userId_organizationId: {
                        userId: userPk,
                        organizationId: invitation.organizationId,
                    },
                },
                create: {
                    userId: userPk,
                    organizationId: invitation.organizationId,
                    role: fromWireAccountRole(invitation.role),
                },
                update: {},
            });
            await tx.invitation.update({
                where: { id: invitation.id },
                data: { acceptedAt: now, acceptedByUserId: userPk },
            });
        }

        if (referralSource) {
            await tx.referralSource.update({
                where: { id: referralSource.id },
                data: { attributionCount: { increment: 1 } },
            });
        }

        // We always require email verification before the account is "live"
        // for sensitive actions. The verify-email module will flip the bit.
        await tx.notification.create({
            data: {
                userId: userPk,
                kind: "WELCOME",
                title: "Welcome to CodeVenture",
                body: "Verify your email to unlock all features.",
                href: "/verify-email",
            },
        });
    });

    return {
        userId: existing?.id ?? userId,
        email: input.email,
        requiresEmailVerification: true,
    };
};

/**
 * Accept a pending invitation token. Creates a new user when none exists
 * for the invited email, or attaches an existing user to the org.
 */
export const acceptInvitation = async (
    input: AcceptInvitationInput,
): Promise<IRegisterResult> => {
    const tokenHash = sha256(input.token);
    const invitation = await prisma.invitation.findUnique({
        where: { tokenHash },
        include: { organization: { select: { id: true, name: true } } },
    });

    if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt.getTime() < Date.now()
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            "This invitation link is invalid or has expired.",
            { code: "INVITATION_INVALID" },
        );
    }

    const hashed = await hashPassword(input.password);
    const existing = await prisma.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
    });

    const userId = existing?.id ?? randomBytes(16).toString("hex");
    const now = new Date();

    await prisma.$transaction(async (tx) => {
        const userPk = existing
            ? existing.id
            : (
                  await tx.user.create({
                      data: {
                          id: userId,
                          email: invitation.email,
                          name: `${input.firstName} ${input.lastName}`.trim(),
                          password: hashed,
                      },
                      select: { id: true },
                  })
              ).id;

        if (existing) {
            // Existing user: just ensure password is set + names are fresh.
            await tx.user.update({
                where: { id: userPk },
                data: {
                    password: hashed,
                    name: `${input.firstName} ${input.lastName}`.trim(),
                },
            });
        }

        await tx.customerProfile.upsert({
            where: { userId: userPk },
            create: {
                userId: userPk,
                firstName: input.firstName,
                lastName: input.lastName,
                signupSource: "REFERRAL",
                termsAcceptedAt: now,
                privacyAcceptedAt: now,
                organizationId: invitation.organizationId,
            },
            update: {
                firstName: input.firstName,
                lastName: input.lastName,
                organizationId: invitation.organizationId,
            },
        });

        await tx.organizationMember.upsert({
            where: {
                userId_organizationId: {
                    userId: userPk,
                    organizationId: invitation.organizationId,
                },
            },
            create: {
                userId: userPk,
                organizationId: invitation.organizationId,
                role: fromWireAccountRole(invitation.role),
            },
            update: {},
        });

        await tx.invitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: now, acceptedByUserId: userPk },
        });

        await tx.notification.create({
            data: {
                userId: userPk,
                kind: "INVITATION_ACCEPTED",
                title: `You're now a member of ${invitation.organization.name}`,
                body: "Head to your dashboard to start exploring.",
                href: "/account",
            },
        });
    });

    return {
        userId,
        email: invitation.email,
        requiresEmailVerification: true,
    };
};