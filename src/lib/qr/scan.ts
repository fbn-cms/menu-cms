// Anonymous scan logging (spec §4 /t/[slug]): only a coarse browser family and a bot flag.
// No IP, no full user agent, no cookies.

const BOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|headless|curl|wget|python|node-fetch|go-http|java\/|lighthouse/i;

export const isBot = (ua: string | null) => !ua || BOT.test(ua);

/** "iOS Safari", "Android Chrome", … at most 40 characters. */
export function uaFamily(ua: string | null): string | null {
  if (!ua) return null;
  const os = /iphone|ipad|ipod/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os x/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Other";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /samsungbrowser/i.test(ua)
      ? "Samsung Internet"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /chrome|crios/i.test(ua)
          ? "Chrome"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";
  return `${os} ${browser}`.slice(0, 40);
}
