import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapTestApp } from './utils/bootstrap-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET) health-check không cần đăng nhập', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          status: 'ok',
          phase: 'Phase 0 — Nền tảng hệ thống & Tài khoản',
        });
      });
  });
});
