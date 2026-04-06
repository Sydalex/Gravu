import type {
  SupportMessageAuthorRole,
  SupportTicketCategory,
  SupportTicketStatus,
} from "../../../backend/src/types";

export const supportCategories: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: "billing", label: "Billing" },
  { value: "bug", label: "Bug or broken flow" },
  { value: "account", label: "Account access" },
  { value: "marketplace", label: "Marketplace" },
  { value: "other", label: "Other" },
];

export function formatSupportTicketCategory(category: SupportTicketCategory) {
  return supportCategories.find((entry) => entry.value === category)?.label ?? category;
}

export function supportStatusLabel(status: SupportTicketStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  return "Open";
}

export function supportStatusClass(status: SupportTicketStatus) {
  if (status === "resolved") {
    return "border-[#d6e6dc] bg-[#eef7f1] text-[#4d7a61]";
  }
  if (status === "in_progress") {
    return "border-[#edcbbd] bg-[#fcf2ee] text-[#c96240]";
  }
  return "border-[#d9d8d3] bg-[#f5f3ee] text-[#6f695f]";
}

export function supportAuthorLabel(role: SupportMessageAuthorRole) {
  return role === "admin" ? "Gravu support" : "You";
}
