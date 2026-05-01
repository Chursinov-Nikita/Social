export const getLinks = (tr: {
  feed: string;
  chat: string;
  reels: string;
  friends: string;
  notifications: string;
  about: string;
}) => [
  { href: "/", label: tr.feed },
  { href: "/components/chat", label: tr.chat },
  { href: "/components/reels", label: tr.reels },
  { href: "/components/friends", label: tr.friends },
  { href: "/components/notifications", label: tr.notifications },
  { href: "/components/about", label: tr.about },
];
