import { AiAssistantService, costOf } from './ai-assistant.service';

/** Trần ngân sách AI mỗi tháng (2026-11-25): tính chi phí từ số token + trạng thái chặn. */
describe('Trợ lý AI — ngân sách tháng', () => {
  const service = Object.create(
    AiAssistantService.prototype,
  ) as AiAssistantService;
  const month = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

  it('phần lặp lại (cached) tính rẻ hơn hẳn phần mới', () => {
    const fresh = costOf({
      model: 'gemini-flash-lite-latest',
      prompt: 10_000,
      cached: 0,
      output: 100,
    });
    const cached = costOf({
      model: 'gemini-flash-lite-latest',
      prompt: 10_000,
      cached: 9_000,
      output: 100,
    });
    expect(cached).toBeLessThan(fresh / 3);
  });

  it('giọng đọc (tts) đắt hơn chữ', () => {
    const u = { prompt: 100, cached: 0, output: 1000 };
    expect(
      costOf({ ...u, model: 'gemini-3.1-flash-tts-preview' }),
    ).toBeGreaterThan(costOf({ ...u, model: 'gemini-flash-lite-latest' }));
  });

  it('chưa đặt ngân sách → không bao giờ chặn', () => {
    const s = service.budgetState({
      monthlyBudgetUsd: null,
      costMonth: month,
      costUsd: 999,
    });
    expect(s.exhausted).toBe(false);
    expect(s.voiceOff).toBe(false);
  });

  it('85% → tắt giọng, 100% → khoá hỏi', () => {
    const at = (costUsd: number) =>
      service.budgetState({ monthlyBudgetUsd: 10, costMonth: month, costUsd });
    expect(at(5)).toMatchObject({ voiceOff: false, exhausted: false });
    expect(at(8.6)).toMatchObject({ voiceOff: true, exhausted: false });
    expect(at(10)).toMatchObject({ voiceOff: true, exhausted: true });
  });

  it('số của tháng trước không tính sang tháng này', () => {
    const s = service.budgetState({
      monthlyBudgetUsd: 10,
      costMonth: '2000-01',
      costUsd: 50,
    });
    expect(s.used).toBe(0);
    expect(s.exhausted).toBe(false);
  });
});
