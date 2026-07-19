/** C4 — Customer project detail, activity, comments, files, approvals. */

export type ApprovalKindWire =
    | "design"
    | "copy"
    | "scope-change"
    | "launch"
    | "general";

export type ApprovalStatusWire =
    | "pending"
    | "approved"
    | "changes-requested"
    | "rejected";

export type ChangeRequestStatusWire = "open" | "accepted" | "declined";

export type CommentVisibilityWire = "all" | "customer" | "internal";

export type ActivityKindWire =
    | "project-updated"
    | "deliverable-completed"
    | "approval-requested"
    | "approval-responded"
    | "comment-posted"
    | "file-uploaded"
    | "milestone-completed"
    | "change-request-submitted";

export interface ICustomerProjectMember {
    userId: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
}

export interface ICustomerProjectMilestone {
    id: string;
    title: string;
    description: string | null;
    dueAt: string | null;
    completedAt: string | null;
    orderIndex: number;
}

export interface ICustomerApprovalRequest {
    id: string;
    kind: ApprovalKindWire;
    title: string;
    description: string | null;
    status: ApprovalStatusWire;
    requestedByName: string;
    requestedAt: string;
    respondedByName: string | null;
    respondedAt: string | null;
    responseNote: string | null;
    attachments: { id: string; name: string; url: string }[];
}

export interface ICustomerChangeRequest {
    id: string;
    title: string;
    description: string;
    status: ChangeRequestStatusWire;
    submittedByName: string;
    submittedAt: string;
    respondedAt: string | null;
    respondedByName: string | null;
    responseNote: string | null;
}

export interface ICustomerProjectFile {
    id: string;
    name: string;
    mimeType: string | null;
    size: number | null;
    url: string;
    uploadedByName: string;
    uploadedAt: string;
}

export interface ICustomerProjectComment {
    id: string;
    body: string;
    visibility: CommentVisibilityWire;
    authorName: string;
    authorAvatarUrl: string | null;
    createdAt: string;
    replies: ICustomerProjectComment[];
}

export interface ICustomerProjectDetail {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    status: string;
    phase: string;
    health: "on-track" | "at-risk" | "blocked";
    progress: number | null;
    coverImageUrl: string | null;
    startedAt: string | null;
    estimatedDeliveryAt: string | null;
    nextMilestone: { title: string; dueAt: string | null } | null;
    team: ICustomerProjectMember[];
    milestones: ICustomerProjectMilestone[];
    pendingApprovals: number;
}

export interface ICustomerProjectActivityEntry {
    id: string;
    kind: ActivityKindWire;
    title: string;
    description: string | null;
    actorName: string | null;
    occurredAt: string;
    referenceId: string | null;
}

export interface ICustomerProjectActivity {
    projectId: string;
    entries: ICustomerProjectActivityEntry[];
    page: number;
    perPage: number;
    total: number;
}