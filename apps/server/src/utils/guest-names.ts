const ADJECTIVES = [
  '快乐的',
  '神秘的',
  '勇敢的',
  '可爱的',
  '机智的',
  '悠闲的',
  '闪亮的',
  '温柔的',
  '活泼的',
  '安静的',
];

const NOUNS = [
  '熊猫',
  '狐狸',
  '小猫',
  '企鹅',
  '兔子',
  '海豚',
  '松鼠',
  '小鹿',
  '考拉',
  '仓鼠',
  '浣熊',
  '海鸥',
];

export function generateGuestDisplayName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${suffix}`;
}
