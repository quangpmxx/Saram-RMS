import { revalidatePath, revalidateTag } from "next/cache";
import { TEXTS_TAG } from "@/lib/texts";

/**
 * Gọi sau khi lưu chữ ở chế độ sửa: bỏ bản cache để mọi người thấy chữ mới ngay.
 * Không cần quyền — chỉ làm trang tải lại dữ liệu, không đổi dữ liệu.
 */
export async function POST() {
  revalidateTag(TEXTS_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
