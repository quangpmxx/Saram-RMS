import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Đánh dấu 1 route không cần đăng nhập (vd POST /login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
