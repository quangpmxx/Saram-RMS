/** Đánh dấu máy này đã đăng nhập để sửa nội dung (chỉ để hiện thanh sửa; quyền thật kiểm ở CRM). */
export const EDITOR_FLAG = "dv-editor";

export function readEditorFlag(): boolean {
  try {
    return localStorage.getItem(EDITOR_FLAG) === "1";
  } catch {
    return false;
  }
}

export function writeEditorFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(EDITOR_FLAG, "1");
    else localStorage.removeItem(EDITOR_FLAG);
  } catch {
    /* trình duyệt chặn bộ nhớ — bỏ qua */
  }
}

/** Người đang đăng nhập có quyền sửa (module "website" mức edit)? null = chưa đăng nhập. */
export async function checkCanEdit(): Promise<boolean | null> {
  const res = await fetch("/api/module-permission/me", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) return false;
  const map = (await res.json()) as Record<string, string>;
  return map.website === "edit";
}

/** Lỗi trả về từ CRM → câu dễ hiểu. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    /* không phải JSON */
  }
  return fallback;
}
