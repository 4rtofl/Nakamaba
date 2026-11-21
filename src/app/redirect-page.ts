import { escapeHtml } from './html.ts';
import { HttpError } from './http.ts';

const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

/** 移動先の URL を検査し、正規化した形で返す。http と https だけを通す */
export function parseRedirectUrl(value: unknown): string {
  const invalid = new HttpError(
    400,
    'invalid_redirect_url',
    '移動先には http:// か https:// で始まる URL を入れてください。',
  );
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) throw invalid;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw invalid;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw invalid;
  // 公開ページの HTML に書くので、誰でも読める
  if (url.username || url.password) {
    throw new HttpError(
      400,
      'invalid_redirect_url',
      'ユーザー名やパスワードを含む URL は使えません。',
    );
  }
  return url.href;
}

/** 空か無ければ fallback（ページ名）にする */
export function parseRedirectTitle(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'invalid_title', 'タイトルは文字列で入れてください。');
  }
  const title = value.replace(/\s+/g, ' ').trim();
  if (Array.from(title).length > MAX_TITLE_LENGTH) {
    throw new HttpError(400, 'invalid_title', `タイトルは ${MAX_TITLE_LENGTH} 文字までです。`);
  }
  return title || fallback;
}

/**
 * 開いた人を移動先へ送る index.html。location.replace で履歴に残さず、
 * JavaScript が動かなければ meta refresh で、それも動かなければリンクで移動する。
 */
export function renderRedirectPage(url: string, title: string): string {
  // URL の正規化で < はエスケープされるが、念のため </script> を書けないようにする
  const script = JSON.stringify(url).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<script>location.replace(${script});</script>
<meta http-equiv="refresh" content="0; url=${escapeHtml(url)}">
<style>:root { color-scheme: light dark; } body { margin: 0; padding: 48px 24px; font: 16px/1.6 -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; overflow-wrap: anywhere; }</style>
</head>
<body>
<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a> へ移動します。</p>
</body>
</html>
`;
}
