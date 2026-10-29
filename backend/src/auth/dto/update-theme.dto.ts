import { IsIn } from 'class-validator';

export const UI_THEMES = ['light', 'dark'] as const;
export type UiTheme = (typeof UI_THEMES)[number];

/** PUT /me/theme — mọi vai trò tự chọn giao diện Sáng/Tối cho chính mình. */
export class UpdateThemeDto {
  @IsIn(UI_THEMES, { message: 'Giao diện không hợp lệ' })
  theme: UiTheme;
}
