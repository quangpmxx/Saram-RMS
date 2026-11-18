import { getTexts } from "./texts";
import { LISTS, resolveList, type ListItem, type ListName } from "./lists";

/** Danh sách đã gộp (mục gốc + mục thêm, đúng thứ tự đã lưu). */
export async function getList(name: ListName): Promise<ListItem[]> {
  const texts = await getTexts();
  return resolveList(name, texts[`list.${name}`]);
}

/**
 * Thuộc tính đặt lên thẻ chứa danh sách để thanh sửa nhận ra ("Sửa danh sách").
 * data-list-items: mục + nhãn hiển thị (chữ đã sửa nếu có) cho bảng sửa.
 */
export async function listAttrs(name: ListName, items: ListItem[]) {
  const texts = await getTexts();
  const def = LISTS[name];
  const firstInline = def.fields.find((f) => f.inline);
  const rows = items.map((it) => ({
    ...it,
    _label: firstInline ? (texts[def.textKey(it.id, firstInline.key)] ?? it[firstInline.key]) : it.id,
  }));
  return { "data-list": name, "data-list-label": def.label, "data-list-items": JSON.stringify(rows) };
}
