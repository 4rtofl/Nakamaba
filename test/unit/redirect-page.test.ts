import { describe, expect, it } from 'vitest';
import { HttpError } from '../../src/app/http.ts';
import {
  parseRedirectTitle,
  parseRedirectUrl,
  renderRedirectPage,
} from '../../src/app/redirect-page.ts';

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    return (error as HttpError).code;
  }
  throw new Error('失敗するはずの処理が成功しました');
}

describe('parseRedirectUrl', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['  http://example.com/a?b=1#c  ', 'http://example.com/a?b=1#c'],
    ['https://例え.jp/パス', 'https://xn--r8jz45g.jp/%E3%83%91%E3%82%B9'],
  ])('%s を正規化して通す', (input, expected) => {
    expect(parseRedirectUrl(input)).toBe(expected);
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['相対パス', '/other-page/'],
    ['スキーム無し', 'example.com'],
    ['空', ''],
    ['文字列でない', 1],
    ['無い', undefined],
    ['2000 文字を超える', `https://example.com/${'a'.repeat(2000)}`],
    ['ユーザー名とパスワードつき', 'https://user:secret@example.com/'],
  ])('%s は 400 にする', (_label, input) => {
    expect(codeOf(() => parseRedirectUrl(input))).toBe('invalid_redirect_url');
  });
});

describe('parseRedirectTitle', () => {
  it('空か無ければページ名にする', () => {
    expect(parseRedirectTitle(undefined, 'jump')).toBe('jump');
    expect(parseRedirectTitle('   ', 'jump')).toBe('jump');
  });

  it('空白をまとめて 1 行にする', () => {
    expect(parseRedirectTitle(' 友人の\n ブログ ', 'jump')).toBe('友人の ブログ');
  });

  it('200 文字までは通し、超えたら 400 にする', () => {
    expect(parseRedirectTitle('あ'.repeat(200), 'jump')).toHaveLength(200);
    expect(codeOf(() => parseRedirectTitle('あ'.repeat(201), 'jump'))).toBe('invalid_title');
  });

  it('文字列でなければ 400 にする', () => {
    expect(codeOf(() => parseRedirectTitle(1, 'jump'))).toBe('invalid_title');
  });
});

describe('renderRedirectPage', () => {
  it('location.replace と meta refresh とリンクで移動先を指す', () => {
    const html = renderRedirectPage('https://example.com/a?b=1&c=2', 'ブログ');
    expect(html).toContain('<script>location.replace("https://example.com/a?b=1&c=2");</script>');
    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=https://example.com/a?b=1&amp;c=2">',
    );
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2">');
    expect(html).toContain('<title>ブログ</title>');
  });

  it('タイトルと URL の HTML を実行させない', () => {
    const html = renderRedirectPage('https://e.com/"></script><script>x()</script>', '<b>t</b>');
    expect(html).toContain('<title>&lt;b&gt;t&lt;/b&gt;</title>');
    expect(html).not.toContain('<script>x()');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
