/** C3 — Customer projects list. */

export type ProjectHealthWire = "on-track" | "at-risk" | "blocked";
export type ProjectPhaseWire =
    | "discovery"
    | "design"
    | "build"
    | "review"
    | "launch"
    | "maintenance";

export interface ICustomerProjectSummary {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    status: string;
    phase: ProjectPhaseWire;
    health: ProjectHealthWire;
    progress: number | null;
    coverImageUrl: string | null;
    updatedAt: string;
    nextMilestone: { title: string; dueAt: string | null } | null;
}

export interface ICustomerProjectIndex {
    projects: ICustomerProjectSummary[];
    page: number;
    perPage: number;
    total: number;
    phases: ProjectPhaseWire[];
}