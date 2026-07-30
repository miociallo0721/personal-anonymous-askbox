export type SpamAssessment = {
  score: number;
  reasons: string[];
  action: "accept" | "mark-spam" | "discard";
};

const adPatterns = [
  /兼职|刷单|返利|代购|博彩|赌场|贷款|办证|开发票|投资群|稳赚|加群/iu,
  /free\s*money|crypto\s*(profit|signal)|guaranteed\s*income|casino|betting/iu,
  /副業|稼げる|投資グループ|必ず儲かる/iu,
];
const contactPattern = /(微信|vx|v信|qq|telegram|tg|line|whatsapp)\s*[:：号]?\s*[@a-z0-9_-]{4,}/giu;
const urlPattern = /(?:https?:\/\/|www\.)[^\s]+/giu;

export function assessSpam(content: string, exactDuplicate = false): SpamAssessment {
  let score = 0;
  const reasons: string[] = [];
  const links = content.match(urlPattern) ?? [];

  if (/^(?:https?:\/\/|www\.)\S+$/iu.test(content.trim())) {
    score += 25;
    reasons.push("纯链接");
  } else if (links.length >= 3) {
    score += Math.min(45, 15 + links.length * 8);
    reasons.push("多个链接");
  } else if (links.length === 2) {
    score += 18;
    reasons.push("包含两个链接");
  }

  const adMatches = adPatterns.filter((pattern) => pattern.test(content)).length;
  if (adMatches) {
    score += 24 + (adMatches - 1) * 12;
    reasons.push("广告用语");
  }

  const contacts = content.match(contactPattern) ?? [];
  if (contacts.length >= 3) {
    score += 38;
    reasons.push("联系方式轰炸");
  } else if (contacts.length > 0) {
    score += 12;
    reasons.push("包含联系方式");
  }

  if (/(.)\1{19,}/su.test(content) || /(.{2,8})\1{9,}/su.test(content)) {
    score += 35;
    reasons.push("大量重复字符");
  }

  const meaningful = content.replace(/[\s\p{P}\p{S}]/gu, "");
  if (meaningful.length >= 30 && new Set([...meaningful]).size <= 3) {
    score += 30;
    reasons.push("字符变化极少");
  }

  if (exactDuplicate) {
    score += 45;
    reasons.push("短时间重复提交");
  }

  score = Math.min(score, 100);
  const action = score >= 80 ? "discard" : score >= 45 ? "mark-spam" : "accept";
  return { score, reasons, action };
}
