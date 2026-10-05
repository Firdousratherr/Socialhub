import type { AdminPermissionKey } from "@/lib/admin-permissions";

export const MODERATOR_PERMISSION_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  permissions: AdminPermissionKey[];
}> = [
  {
    id: "content",
    label: "Content moderator",
    description: "Review and moderate posts and comments.",
    permissions: ["USERS_VIEW", "CONTENT_VIEW", "CONTENT_MODERATE"],
  },
  {
    id: "safety",
    label: "Safety & reports",
    description: "Handle reports, user safety, and verification workflows.",
    permissions: ["USERS_VIEW", "CONTENT_VIEW", "REPORTS_MANAGE", "VERIFICATION_MANAGE", "USERS_SECURITY", "CASES_MANAGE", "ENFORCEMENT_MANAGE", "RISK_VIEW"],
  },
  {
    id: "community",
    label: "Community moderator",
    description: "Manage people, content, requests, and platform communications.",
    permissions: [
      "USERS_VIEW",
      "CONTENT_VIEW",
      "CONTENT_MODERATE",
      "REPORTS_MANAGE",
      "VERIFICATION_MANAGE",
      "ANNOUNCEMENTS",
      "PRIVACY_OPERATIONS",
    ],
  },
  {
    id: "operations",
    label: "Full operations moderator",
    description: "Broad moderator operations without administrator-only account management.",
    permissions: [
      "USERS_VIEW",
      "USERS_EDIT",
      "USERS_SECURITY",
      "USERS_BULK",
      "CONTENT_VIEW",
      "CONTENT_MODERATE",
      "CONTENT_METRICS",
      "MESSAGES_VIEW",
      "REPORTS_MANAGE",
      "VERIFICATION_MANAGE",
      "ANALYTICS_VIEW",
      "AUDIT_VIEW",
      "STORAGE_VIEW",
      "PRIVACY_OPERATIONS",
      "CASES_MANAGE",
      "ENFORCEMENT_MANAGE",
      "RISK_VIEW",
    ],
  },
];
