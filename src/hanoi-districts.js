// Ai viết: Codex
// Tại sao: Chuẩn hóa tên quận cũ và phường thường xuất hiện trong tin cho thuê để định tuyến không cần ghi đủ tên quận.
// Link SPEC/PROMPT: yêu cầu nhận diện khu vực Hà Nội ngày 05/09/2026; nguồn đối chiếu Cổng TTĐT Hà Nội.

/**
 * Chỉ giữ địa danh cũ có thể gán an toàn cho một quận. Các tên trùng quận
 * (như Minh Khai, Quang Trung) không nằm ở đây để tránh chuyển tiếp nhầm.
 */
export const HANOI_DISTRICT_ALIASES = Object.freeze({
  "ba dinh": { label: "Ba Đình", aliases: ["Cống Vị", "Điện Biên", "Đội Cấn", "Giảng Võ", "Kim Mã", "Liễu Giai", "Ngọc Hà", "Ngọc Khánh", "Nguyễn Trung Trực", "Phúc Xá", "Quán Thánh", "Thành Công", "Trúc Bạch", "Vĩnh Phúc"] },
  "bac tu liem": { label: "Bắc Từ Liêm", aliases: ["Cổ Nhuế", "Đông Ngạc", "Đức Thắng", "Liên Mạc", "Phú Diễn", "Phúc Diễn", "Tây Tựu", "Thượng Cát", "Thụy Phương", "Xuân Đỉnh", "Xuân Tảo"] },
  "cau giay": { label: "Cầu Giấy", aliases: ["Dịch Vọng", "Dịch Vọng Hậu", "Mai Dịch", "Nghĩa Đô", "Nghĩa Tân", "Quan Hoa", "Trung Hòa", "Yên Hòa"] },
  "dong da": { label: "Đống Đa", aliases: ["Cát Linh", "Hàng Bột", "Khâm Thiên", "Khương Thượng", "Kim Liên", "Láng Hạ", "Láng Thượng", "Nam Đồng", "Ngã Tư Sở", "Ô Chợ Dừa", "Phương Liên", "Phương Mai", "Quốc Tử Giám", "Thịnh Quang", "Thổ Quan", "Trung Liệt", "Trung Phụng", "Trung Tự", "Văn Chương", "Văn Miếu"] },
  "ha dong": { label: "Hà Đông", aliases: ["Biên Giang", "Đồng Mai", "Dương Nội", "Hà Cầu", "Kiến Hưng", "La Khê", "Mộ Lao", "Phú La", "Phú Lãm", "Phú Lương", "Phúc La", "Vạn Phúc", "Văn Quán", "Yên Nghĩa", "Yết Kiêu"] },
  "hai ba trung": { label: "Hai Bà Trưng", aliases: ["Bạch Đằng", "Bách Khoa", "Bạch Mai", "Bùi Thị Xuân", "Cầu Dền", "Đống Mác", "Đồng Nhân", "Đồng Tâm", "Lê Đại Hành", "Ngô Thì Nhậm", "Nguyễn Du", "Phạm Đình Hổ", "Phố Huế", "Quỳnh Lôi", "Quỳnh Mai", "Thanh Lương", "Thanh Nhàn", "Trương Định", "Vĩnh Tuy"] },
  "hoai duc": { label: "Hoài Đức", aliases: ["An Khánh", "An Thượng", "Cát Quế", "Đắc Sở", "Di Trạch", "Đông La", "Đức Giang", "Đức Thượng", "Kim Chung", "La Phù", "Lại Yên", "Sơn Đồng", "Song Phương", "Tiền Yên", "Vân Canh", "Vân Côn", "Yên Sở"] },
  // Hòa Lạc là khu vực thuộc Thạch Thất, không phải quận; chỉ dùng chính tên khu vực để tránh gán nhầm cả huyện.
  "hoa lac": { label: "Hòa Lạc", aliases: ["Khu công nghệ cao Hòa Lạc"] },
  "hoan kiem": { label: "Hoàn Kiếm", aliases: ["Cửa Đông", "Cửa Nam", "Đồng Xuân", "Hàng Bạc", "Hàng Bài", "Hàng Bồ", "Hàng Bông", "Hàng Buồm", "Hàng Đào", "Hàng Gai", "Hàng Mã", "Hàng Trống", "Lý Thái Tổ", "Phan Chu Trinh", "Phúc Tân", "Tràng Tiền", "Trần Hưng Đạo"] },
  "hoang mai": { label: "Hoàng Mai", aliases: ["Đại Kim", "Định Công", "Giáp Bát", "Hoàng Liệt", "Hoàng Văn Thụ", "Lĩnh Nam", "Mai Động", "Tân Mai", "Thịnh Liệt", "Trần Phú", "Tương Mai", "Vĩnh Hưng", "Yên Sở"] },
  "long bien": { label: "Long Biên", aliases: ["Bồ Đề", "Cự Khối", "Đức Giang", "Gia Thụy", "Giang Biên", "Ngọc Lâm", "Ngọc Thụy", "Phúc Đồng", "Phúc Lợi", "Sài Đồng", "Thạch Bàn", "Thượng Thanh", "Việt Hưng"] },
  "nam tu liem": { label: "Nam Từ Liêm", aliases: ["Cầu Diễn", "Đại Mỗ", "Mễ Trì", "Mỹ Đình", "Phú Đô", "Phương Canh", "Tây Mỗ", "Trung Văn", "Xuân Phương"] },
  "tay ho": { label: "Tây Hồ", aliases: ["Bưởi", "Nhật Tân", "Phú Thượng", "Quảng An", "Thụy Khuê", "Tứ Liên", "Xuân La", "Yên Phụ"] },
  "thanh xuan": { label: "Thanh Xuân", aliases: ["Hạ Đình", "Khương Đình", "Khương Mai", "Khương Trung", "Kim Giang", "Nhân Chính", "Phương Liệt", "Thanh Xuân Bắc", "Thanh Xuân Nam", "Thanh Xuân Trung", "Thượng Đình"] },
});
