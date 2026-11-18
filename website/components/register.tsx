import { getList } from "@/lib/lists-server";
import { getTexts } from "@/lib/texts";
import { LISTS } from "@/lib/lists";
import { RegisterFormClient } from "./register-form";

/** Form đăng ký — ô "Khu vực muốn làm" lấy theo danh sách KCN đã sửa ở chế độ sửa. */
export async function RegisterForm({ kind = "worker", jobTitle }: { kind?: "worker" | "business"; jobTitle?: string }) {
  const [areas, texts] = await Promise.all([getList("areas"), getTexts()]);
  const areaOptions = areas.map((a) => texts[LISTS.areas.textKey(a.id, "name")] ?? a.name);
  return <RegisterFormClient kind={kind} areaOptions={areaOptions} jobTitle={jobTitle} />;
}
