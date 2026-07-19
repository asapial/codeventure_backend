/** Mirrors the frontend `ProjectStatus` union. */
export type ProjectStatus =
    | "draft"
    | "planning"
    | "in-progress"
    | "review"
    | "launched"
    | "paused"
    | "archived";

export type DeliverableStatus =
    | "pending"
    | "in-progress"
    | "review"
    | "complete"
    | "blocked";

export interface IProjectSummary {
    id: string;
    slug: string;
    name: string;
    status: ProjectStatus;
    package: string | null;
    progress: number | null;
    updatedAt: string;
    nextMilestone: { title: string; dueAt: string | null } | null;
    coverImageUrl: string | null;
}

export interface IProjectIndex {
    projects: IProjectSummary[];
    statuses: ProjectStatus[];
    total: number;
    page: number;
    perPage: number;
}

export interface IProjectTeamMember {
    name: string;
    role: string;
    avatarUrl: string | null;
}

export interface IDeliverable {
    id: string;
    title: string;
    description?: string;
    status: DeliverableStatus;
    dueAt: string | null;
}

export interface IActivityEvent {
    id: string;
    at: string;
    title: string;
    description: string | null;
    href: string | null;
}

export interface IProjectDetail extends IProjectSummary {
    description: string;
    startDate: string | null;
    launchDate: string | null;
    team: IProjectTeamMember[];
    deliverables: IDeliverable[];
    activity: IActivityEvent[];
}
