import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { status: string; phase: string } {
    return { status: 'ok', phase: 'Phase 0 — Nền tảng hệ thống & Tài khoản' };
  }
}
