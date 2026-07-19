/** Wire-shapes for C2 onboarding. */
export interface IBrandAsset {
    id: string;
    fileName: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    status: "pending" | "ready" | "scanning" | "infected" | "archived";
}

export interface IOnboardingProfile {
    userId: string;
    status: "not-started" | "in-progress" | "completed";
    currentStep: number;
    companyName: string | null;
    businessType: string | null;
    websiteUrl: string | null;
    billingAddress: IBillingAddress | null;
    primaryContact: IPrimaryContact | null;
    brandAssets: IBrandAsset[];
    timezone: string | null;
    locale: string | null;
    communication: "email" | "phone" | "slack" | "teams";
    completedAt: string | null;
}

export interface IBillingAddress {
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
}

export interface IPrimaryContact {
    name: string;
    email: string;
    phone?: string;
}

export interface ITeamInvitationInput {
    email: string;
    role: "owner" | "admin" | "editor" | "viewer";
}

export interface ITeamInvitation {
    id: string;
    email: string;
    role: string;
    inviteLink: string;
    expiresAt: string;
}
