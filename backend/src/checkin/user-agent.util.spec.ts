import { parseUserAgent } from './user-agent.util';

describe('parseUserAgent', () => {
  it('1) Chrome trên Windows', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );
    expect(result.operatingSystem).toBe('Windows');
    expect(result.device).toBe('Máy tính');
    expect(result.browser).toBe('Chrome 126.0.0.0');
  });

  it('2) Safari trên iPhone', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );
    expect(result.operatingSystem).toBe('iOS');
    expect(result.device).toBe('iPhone');
    expect(result.browser).toBe('Safari 17.5');
  });

  it('3) Edge trên Windows — KHÔNG nhận nhầm thành Chrome (UA cũng chứa "Chrome")', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    );
    expect(result.browser).toBe('Edge 126.0.0.0');
  });

  it('4) Firefox trên macOS', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
    );
    expect(result.operatingSystem).toBe('macOS');
    expect(result.browser).toBe('Firefox 127.0');
  });

  it('5) Chrome trên Android (điện thoại)', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    );
    expect(result.operatingSystem).toBe('Android');
    expect(result.device).toBe('Điện thoại Android');
    expect(result.browser).toBe('Chrome 126.0.0.0');
  });

  it('6) iPad', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );
    expect(result.operatingSystem).toBe('iPadOS');
    expect(result.device).toBe('iPad');
  });

  it('7) Thiếu User-Agent -> "Không xác định"', () => {
    const result = parseUserAgent(undefined);
    expect(result.operatingSystem).toBe('Không xác định');
    expect(result.browser).toBe('Không xác định');
    expect(result.device).toBe('Máy tính');
  });
});
