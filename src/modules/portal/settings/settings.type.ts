/** C10 — Customer settings, profile, org, team, sessions, data exports. */

export type DataExportStatusWire =
    | "queued"
    | "running"
    | "ready"
    | "expired"
    | "failed";

export type TeamMemberStatusWire = "invited" | "active" | "suspended";

export interface IProfileSettings {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    jobTitle: string | null;
    phone: string | null;
    timezone: string;
    locale: string;
}

export interface IOrganizationSettings {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    industry: string | null;
    addressLines: string[];
    timezone: string;
    logoUrl: string | null;
}

export interface ITeamMember {
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
    status: TeamMemberStatusWire;
    jobTitle: string | null;
    avatarUrl: string | null;
    lastActiveAt: string | null;
    invitedAt: string | null;
    joinedAt: string | null;
}

export interface ITeamInvitation {
    id: string;
    email: string;
    role: ITeamMember["role"];
    invitedByName: string;
    invitedAt: string;
    expiresAt: string;
    acceptedAt: string | null;
}

export interface ISessionInfo {
    id: string;
    device: string;
    location: string;
    ipAddress: string;
    lastActiveAt: string;
    isCurrent: boolean;
}

export interface IDataExportJob {
    id: string;
    requestedAt: string;
    completedAt: string | null;
    status: DataExportStatusWire;
    downloadUrl: string | null;
    expiresAt: string | null;
}

export interface ICustomerSettings {
    profile: IProfileSettings;
    organization: IOrganizationSettings;
    team: ITeamMember[];
    invitations: ITeamInvitation[];
    sessions: ISessionInfo[];
    recentExports: IDataExportJob[];
}