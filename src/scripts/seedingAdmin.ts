import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

type SeedIdentity = {
    email: string;
    password: string;
    name: string;
    role: "ADMIN" | "MODERATOR";
};

const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
};

const identities: SeedIdentity[] = [
    {
        email: required("SEED_ADMIN_EMAIL").toLowerCase(),
        password: required("SEED_ADMIN_PASSWORD"),
        name: "CodeVenture Admin",
        role: "ADMIN",
    },
    {
        email: required("SEED_MODERATOR_EMAIL").toLowerCase(),
        password: required("SEED_MODERATOR_PASSWORD"),
        name: "CodeVenture Moderator",
        role: "MODERATOR",
    },
];

for (const identity of identities) {
    const password = await hashPassword(identity.password);
    const isAdmin = identity.role === "ADMIN";

    await prisma.user.upsert({
        where: { email: identity.email },
        create: {
            id: randomUUID(),
            email: identity.email,
            name: identity.name,
            password,
            role: identity.role,
            accountRole: isAdmin ? "ADMIN" : "EDITOR",
            emailVerified: true,
            isActive: true,
            isDeleted: false,
            twoFactorEnabled: isAdmin,
            twoFactorMethod: isAdmin ? "EMAIL_OTP" : null,
            twoFactorEnrolledAt: isAdmin ? new Date() : null,
        },
        update: {
            name: identity.name,
            password,
            role: identity.role,
            accountRole: isAdmin ? "ADMIN" : "EDITOR",
            emailVerified: true,
            isActive: true,
            isDeleted: false,
            twoFactorEnabled: isAdmin,
            twoFactorMethod: isAdmin ? "EMAIL_OTP" : null,
            twoFactorEnrolledAt: isAdmin ? new Date() : null,
        },
    });

    console.log(`Seeded ${identity.role.toLowerCase()} account.`);
}

await prisma.$disconnect();
