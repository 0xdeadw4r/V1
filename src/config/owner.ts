export const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '';

export function isBotOwner(userId: string): boolean {
  return BOT_OWNER_ID !== '' && userId === BOT_OWNER_ID;
}
