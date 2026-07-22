/**
 * Staff-side Moderation Console — mounted under `/api/v1/moderation`.
 *
 * Routes:
 *   M1 /dashboard          KPI dashboard + queue overview
 *   M2 /reviews            Unified review queue across all content types
 *   M3 /blog               Blog post review (list + detail + decision)
 *   M4 /portfolio          Portfolio case study review (list + detail + decision)
 *   M5 /testimonials       Testimonial review (list + detail + decision)
 *   M6 /media              Media library review (list + detail + decision)
 *   M7 /audit              Read-only moderation audit timeline
 *
 * Authentication: every endpoint requires a valid JWT access token AND a
 * system role of `MODERATOR` or `ADMIN` (enforced via `checkAuth(...)`).
 */

import { Router } from "express";

import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../prisma/generated/prisma/enums";

import { dashboardRouter } from "./dashboard/dashboard.route";
import { reviewsRouter } from "./reviews/reviews.route";
import { blogRouter } from "./blog/blog.route";
import { portfolioRouter } from "./portfolio/portfolio.route";
import { testimonialsRouter } from "./testimonials/testimonials.route";
import { mediaRouter } from "./media/media.route";
import { auditRouter } from "./audit/audit.route";

const router = Router();

router.use(checkAuth(Role.MODERATOR, Role.ADMIN));

router.use("/dashboard", dashboardRouter); // M1
router.use("/reviews", reviewsRouter); // M2
router.use("/blog", blogRouter); // M3
router.use("/portfolio", portfolioRouter); // M4
router.use("/testimonials", testimonialsRouter); // M5
router.use("/media", mediaRouter); // M6
router.use("/audit", auditRouter); // M7

export const moderationRouter = router;