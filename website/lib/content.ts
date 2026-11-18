/**
 * Nội dung tạm của trang web công ty — lấy từ hồ sơ năng lực SARAM VINA (slide).
 * Bước 2 sẽ chuyển các mục có thể thay đổi (việc làm, tin tức, số liệu, liên hệ)
 * sang trang quản trị "Website" trong CRM. Chỗ ghi "Đang cập nhật" = chờ anh xác nhận.
 */

export const company = {
  shortName: "SARAM VINA",
  legalName: "Công ty TNHH TM DV SARAM VINA",
  since: 2016,
  area: "Bắc Ninh & Bắc Giang",
  brandName: "SARAM VINA - ĐẠI VIỆT",
  hotline: "0971242250",
  hotlineDisplay: "0971 242 250",
  zalo: "0971242250",
  email: "media@saramvn.com", // user ghi "media.saramvn.com" — chờ xác nhận
  address: "537W+CVH, Đ. Chu Mẫu, Nam Sơn, Bắc Ninh",
  taxCode: "0109756355",
  facebook: "",
};

export const nav = [
  { href: "/", label: "Trang chủ" },
  { href: "/viec-lam", label: "Việc làm" },
  { href: "/nguoi-lao-dong", label: "Người lao động" },
  { href: "/doanh-nghiep", label: "Doanh nghiệp" },
  { href: "/ve-chung-toi", label: "Về Đại Việt" },
  { href: "/tin-tuc", label: "Tin tức" },
  { href: "/lien-he", label: "Liên hệ" },
];

export type PartnerKey = "foxconn" | "goertek" | "luxshare" | "biel" | "lens";
export type Partner = { key: PartnerKey; name: string; note: string; logo: string };

/** Khách hàng chiến lược. logo: file trong public/logos (để trống thì hiện tên). */
export const partners: Partner[] = [
  { key: "foxconn", name: "FOXCONN", note: "Tập đoàn Hồng Hải", logo: "/logos/foxconn.svg" },
  { key: "goertek", name: "GOERTEK", note: "Điện tử âm thanh", logo: "/logos/goertek.png" },
  { key: "luxshare", name: "LUXSHARE ICT", note: "Thiết bị thông minh", logo: "/logos/luxshare.svg" },
  { key: "biel", name: "BIEL CRYSTAL", note: "Kính quang học", logo: "/logos/biel.png" },
  { key: "lens", name: "LENS TECHNOLOGY", note: "Kính & linh kiện", logo: "/logos/lens.png" },
];

export function partnerOf(key: PartnerKey): Partner {
  return partners.find((p) => p.key === key)!;
}

export const stats = [
  { value: new Date().getFullYear() - 2016, suffix: "+ năm", label: "Cung ứng nhân lực cho KCN", note: "Hoạt động từ năm 2016" },
  { value: 4, suffix: "+ khu", label: "Ký túc xá sát KCN", note: "Quang Châu, Quế Võ, Nam Sơn – Hạp Lĩnh, VSIP" },
  { value: 320, suffix: " chỗ", label: "KTX Nam Sơn – Hạp Lĩnh", note: "Tòa 3 tầng độc lập" },
  { value: 0, suffix: " đồng", label: "Mượn xe điện đi làm", note: "Miễn phí 100%, bảo dưỡng trọn gói" },
];

export const worries = [
  {
    key: "o",
    title: "Chỗ ở",
    worry: "Phòng trọ đắt, chật, thiếu an ninh.",
    answer: "Ký túc xá sát nhà máy, phòng 18–25m², khép kín, có điều hòa.",
  },
  {
    key: "di-lai",
    title: "Đi lại",
    worry: "Không có xe, khó đi theo ca kíp.",
    answer: "Cho mượn xe điện miễn phí, 2 người 1 xe, Đại Việt lo bảo dưỡng.",
  },
  {
    key: "ho-so",
    title: "Hồ sơ",
    worry: "Ngại công chứng, chụp ảnh, tốn tiền giấy tờ.",
    answer: "Chỉ cần CCCD. Vỏ hồ sơ, ảnh thẻ, photo giấy tờ đều miễn phí.",
  },
  {
    key: "thu-nhap",
    title: "Thu nhập",
    worry: "Lo làm nhiều mà nhận về không xứng.",
    answer: "Phụ cấp thêm 30.000–70.000đ mỗi công, tùy đơn hàng.",
  },
];

export const dorms = [
  {
    name: "KTX Nam Sơn – Hạp Lĩnh",
    capacity: "300–320 lao động",
    images: ["/images/ktx-nam-son-1.png", "/images/ktx-nam-son-2.png"],
    points: [
      "Tòa 3 tầng độc lập, sân rộng thoáng gió",
      "Điều hòa, quạt trần, giường sắt chắc chắn",
      "Khu vệ sinh khép kín từng phòng",
    ],
  },
  {
    name: "KTX VSIP – nhà phố hiện đại",
    capacity: "Khu shophouse trung tâm",
    images: ["/images/ktx-vsip-1.png", "/images/ktx-vsip-2.png"],
    points: [
      "Mặt tiền nhà phố, vỉa hè rộng, khu dân cư văn minh",
      "Trần thạch cao, sàn gạch vân đá, rèm chắn sáng",
      "Ban công kính lớn, phòng sáng và thoáng",
    ],
  },
];

export const areas = [
  { name: "Quế Võ", province: "Bắc Ninh" },
  { name: "Nam Sơn – Hạp Lĩnh", province: "Bắc Ninh" },
  { name: "VSIP Bắc Ninh", province: "Bắc Ninh" },
  { name: "Quang Châu", province: "Bắc Giang" },
];

export const workerSteps = [
  { title: "Gọi hoặc nhắn Zalo", text: "Cho Đại Việt biết khu vực muốn làm, ca làm và nhu cầu chỗ ở." },
  { title: "Chọn việc phù hợp", text: "Được tư vấn rõ lương, phụ cấp, ca làm trước khi quyết định." },
  { title: "Mang CCCD đi nhận việc", text: "Đại Việt lo hồ sơ, ảnh thẻ, đưa đi phỏng vấn và sắp xếp chỗ ở." },
];

export const businessSteps = [
  { title: "Gửi nhu cầu", text: "Số lượng, vị trí, ca làm và thời gian cần người." },
  { title: "Chốt phương án", text: "Thống nhất tiêu chuẩn tuyển, chính sách hỗ trợ và tiến độ bàn giao." },
  { title: "Bàn giao & theo dõi", text: "Đưa lao động vào làm, quản lý chỗ ở, đi lại và theo sát chuyên cần." },
];

export const businessValues = [
  { title: "Đủ quân số, đúng tiến độ", text: "Nguồn lao động sẵn có, bổ sung nhanh khi nhà máy tăng đơn." },
  { title: "Chuyên cần 26–28 công", text: "Phụ cấp theo ngày công giúp người lao động đi làm đều đặn." },
  { title: "Giảm nhảy việc", text: "Có chỗ ở, có xe, thu nhập rõ ràng — lao động yên tâm gắn bó." },
  { title: "An ninh trật tự", text: "Ký túc xá có người quản lý, nắm rõ từng lao động." },
];

/** Việc làm MẪU (lương tự đặt để xem giao diện) — bước 2 lấy từ trang quản trị (nối Đơn hàng trong CRM). salary: triệu/tháng. */
export const sampleJobs: {
  slug: string;
  title: string;
  partner: PartnerKey;
  area: string;
  salary: string;
  urgent: boolean;
}[] = [
  { slug: "cong-nhan-goertek-bac-ninh", title: "Công nhân tại Goertek (Bắc Ninh)", partner: "goertek", area: "Bắc Ninh", salary: "13 - 16", urgent: true },
  { slug: "cong-nhan-foxconn-bac-giang", title: "Công nhân sản xuất tại Foxconn Bắc Giang", partner: "foxconn", area: "Bắc Giang", salary: "12 - 15", urgent: true },
  { slug: "cong-nhan-luxshare-ict", title: "Công nhân lắp ráp tại Luxshare ICT", partner: "luxshare", area: "Bắc Ninh, Bắc Giang", salary: "12 - 15", urgent: true },
  { slug: "cong-nhan-biel-crystal-bac-ninh", title: "Công nhân tại Biel Crystal Bắc Ninh", partner: "biel", area: "Bắc Ninh", salary: "12 - 15", urgent: false },
  { slug: "cong-nhan-lens-technology", title: "Công nhân kiểm tra kính tại Lens Technology", partner: "lens", area: "Bắc Ninh", salary: "11 - 14", urgent: false },
  { slug: "cong-nhan-van-hanh-may-goertek", title: "Công nhân vận hành máy tại Goertek", partner: "goertek", area: "Bắc Ninh", salary: "13 - 15", urgent: false },
];
