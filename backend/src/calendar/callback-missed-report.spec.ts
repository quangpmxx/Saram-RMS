import { missedReportMessage } from './callback-missed-report.service';

describe('missedReportMessage', () => {
  it('ghi tổng + từng Sale, kèm số lịch đã xoá', () => {
    expect(
      missedReportMessage([
        { name: 'Lê Minh Ánh', missed: 3, deleted: 1 },
        { name: 'Trần B', missed: 1, deleted: 0 },
      ]),
    ).toBe(
      'Hôm nay 4 lịch gọi lại chưa gọi: Lê Minh Ánh 3 (1 đã xoá) · Trần B 1',
    );
  });
});
