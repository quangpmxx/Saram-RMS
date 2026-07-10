import { Injectable, Logger } from '@nestjs/common';

export interface ZaloMessagePayload {
  accountId: string;
  leadId: string | null;
  message: string;
}

/**
 * Mục 9.4, docs/10-system-design.md: "Tích hợp bên thứ 3: kênh gửi thông báo
 * Zalo (Zalo Notification Service hoặc tương đương) — là điểm tích hợp ngoài
 * duy nhất". `docs/11` (Mục 2.2, `accounts`) KHÔNG có cột lưu định danh Zalo
 * của nhân viên (số điện thoại/Zalo OA follower id...) — đây là khoảng trống
 * thật sự của thiết kế đã Design Freeze, không phải điều tự suy diễn thêm.
 * Vì vậy lớp này chỉ mô phỏng lời gọi gửi tin (log lại nội dung sẽ gửi),
 * KHÔNG tự thêm cột/API để tra định danh Zalo — khi công ty cung cấp thông
 * tin tích hợp thật (access token, cách map tài khoản ↔ Zalo), chỉ cần thay
 * nội dung method `send()` bên dưới, phần còn lại của hệ thống (hàng đợi,
 * worker, trạng thái pending/sent/failed) đã sẵn sàng, không cần đổi gì thêm.
 */
@Injectable()
export class ZaloClientService {
  private readonly logger = new Logger(ZaloClientService.name);

  send(payload: ZaloMessagePayload): Promise<void> {
    this.logger.log(
      `[Zalo mô phỏng] Gửi tới account=${payload.accountId} lead=${payload.leadId ?? '-'}: ${payload.message}`,
    );
    return Promise.resolve();
  }
}
