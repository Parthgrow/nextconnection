export const STATUS_OPTIONS = ["Wishlist", "Applied", "Interviewing", "Offer", "Rejected"];

export type Contact = {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedDate: string;
  contactName: string;
  contactEmail: string;
  link: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  isDream100: boolean;
  createdAt: number;
};
