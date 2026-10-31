import {
  DATA_NOTIFICATION_TYPES,
  dataNotificationCutoff,
} from './notification-groups';

describe('notification-groups', () => {
  it('nhóm Data gồm đúng các loại liên quan data (đổi danh sách này phải đổi cả frontend/lib/notification-groups.ts)', () => {
    expect([...DATA_NOTIFICATION_TYPES].sort()).toEqual(
      [
        'callback_reminder',
        'care_assigned',
        'care_stop_decided',
        'care_stop_requested',
        'interview_reminder',
        'lead_assigned',
        'manual_callback_reminder',
        'new_data_uploaded',
      ].sort(),
    );
  });

  it('nhóm Khác KHÔNG chứa các loại: Đưa đón, tin nhắn Admin, đơn nghỉ, phản ánh, cảnh báo Sale', () => {
    const other = [
      'admin_message',
      'shuttle_update',
      'leave_request_pending_leader',
      'leave_request_pending_admin',
      'leave_request_decided',
      'anonymous_feedback_created',
      'sale_no_shuttle_reminder',
    ];
    for (const type of other) {
      expect(DATA_NOTIFICATION_TYPES).not.toContain(type);
    }
  });

  describe('dataNotificationCutoff — mốc hết hạn là 00:00 hôm nay theo giờ Việt Nam', () => {
    it('giữa ngày (08:00 VN 01/11) → mốc 00:00 01/11 VN', () => {
      expect(
        dataNotificationCutoff(new Date('2026-11-01T01:00:00.000Z')),
      ).toEqual(new Date('2026-10-31T17:00:00.000Z'));
    });

    it('sát nửa đêm (23:59:59 VN 01/11) → vẫn là mốc của ngày 01/11', () => {
      expect(
        dataNotificationCutoff(new Date('2026-11-01T16:59:59.000Z')),
      ).toEqual(new Date('2026-10-31T17:00:00.000Z'));
    });

    it('đúng nửa đêm (00:00 VN 02/11) → sang ngày mới, mốc dời sang 00:00 02/11 VN', () => {
      expect(
        dataNotificationCutoff(new Date('2026-11-01T17:00:00.000Z')),
      ).toEqual(new Date('2026-11-01T17:00:00.000Z'));
    });

    it('tại thời điểm UTC đã sang ngày mới nhưng giờ VN còn cùng ngày: dùng ngày theo giờ VN, không theo UTC', () => {
      // 20:00 UTC 01/11 = 03:00 VN 02/11 → mốc phải là 00:00 02/11 VN (17:00 UTC 01/11).
      expect(
        dataNotificationCutoff(new Date('2026-11-01T20:00:00.000Z')),
      ).toEqual(new Date('2026-11-01T17:00:00.000Z'));
    });
  });
});
