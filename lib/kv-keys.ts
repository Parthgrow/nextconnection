export function contactKey(userId: string, contactId: string): string {
  return `nextconnection:user:${userId}:contact:${contactId}`;
}

export function contactIndexKey(userId: string): string {
  return `nextconnection:user:${userId}:contact_ids`;
}

export function deadlineKey(userId: string): string {
  return `nextconnection:user:${userId}:deadline`;
}
