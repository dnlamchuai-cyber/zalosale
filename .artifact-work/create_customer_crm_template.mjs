import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/crm-khach-hang-2026-09-12";
const outputPath = `${outputDir}/CRM-khach-hang-zaloSALE.xlsx`;
const previewPath = ".artifact-work/crm-khach-hang-preview.png";
const font = "Arial";
const darkBlue = "#1F4E78";
const paleBlue = "#D9EAF7";
const inputFill = "#FFF2CC";
const border = "#D9E2F3";

const statuses = [
  "Mới",
  "Đang tư vấn",
  "Đã hẹn xem",
  "Đang giữ chỗ",
  "Cần chăm sóc",
  "Đã thuê",
  "Chưa phù hợp",
];

const workbook = Workbook.create();
const customers = workbook.worksheets.add("Khách hàng");
const templates = workbook.worksheets.add("Mẫu nhóm sale");

for (const sheet of [customers, templates]) {
  sheet.showGridLines = false;
  sheet.getRange("A1:Q220").format.font = { name: font, size: 10, color: "#1F2937" };
  sheet.getRange("A1:Q220").format.verticalAlignment = "center";
}

customers.tabColor = darkBlue;
customers.getRange("A2").values = [["Bảng tổng hợp khách hàng"]];
customers.getRange("A2").format.font = { name: font, size: 15, bold: true, color: darkBlue };
customers.getRange("A3").values = [["Nhập một dòng cho mỗi nhu cầu phòng. Dùng ngày chăm sóc tiếp để theo dõi khách cần liên hệ."]];
customers.getRange("A3").format.font = { name: font, size: 10, italic: true, color: "#4B5563" };

customers.getRange("A5:H5").values = [["Tổng khách", "", "Cần chăm sóc", "", "Đang tư vấn", "", "Đã hẹn xem", ""]];
customers.getRange("A5:H5").format = {
  fill: paleBlue,
  font: { name: font, bold: true, color: darkBlue },
  horizontalAlignment: "center",
};
customers.getRange("A5:H5").format.borders = { preset: "outside", style: "thin", color: border };
customers.getRange("A6:H6").formulas = [[
  '=COUNTIF($B$9:$B$207,"<>")',
  "",
  '=COUNTIF($H$8:$H$207,"Cần chăm sóc")',
  "",
  '=COUNTIF($H$8:$H$207,"Đang tư vấn")',
  "",
  '=COUNTIF($H$8:$H$207,"Đã hẹn xem")',
  "",
]];
customers.getRange("A6:H6").format = {
  font: { name: font, size: 13, bold: true, color: darkBlue },
  horizontalAlignment: "center",
};
customers.getRange("A5:H6").format.borders = { preset: "outside", style: "thin", color: border };

const customerHeaders = [[
  "Mã khách",
  "Tên khách",
  "SĐT",
  "Mã phòng",
  "Địa chỉ phòng",
  "Nhóm nguồn",
  "Nhóm sale",
  "Trạng thái chăm sóc",
  "Ngày/giờ xem",
  "Chăm sóc tiếp",
  "Ghi chú",
  "Cập nhật lúc",
]];
customers.getRange("A8:L8").values = customerHeaders;
customers.getRange("A8:L8").format = {
  fill: darkBlue,
  font: { name: font, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  wrapText: true,
};
customers.getRange("A8:L8").format.borders = { preset: "all", style: "thin", color: "#FFFFFF" };
customers.getRange("A9:L207").format.borders = { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" };
customers.getRange("A9:L207").format.rowHeight = 21;
customers.getRange("A9:L207").format.fill = inputFill;
customers.getRange("A9:A207").format.fill = "#F3F4F6";
customers.getRange("A9:A207").format.font = { name: font, color: "#6B7280" };

customers.getRange("H9:H207").dataValidation = { rule: { type: "list", values: statuses } };
customers.getRange("G9:G207").dataValidation = { rule: { type: "list", formula1: "'Mẫu nhóm sale'!$A$8:$A$27" } };
customers.getRange("I9:J207").format.numberFormat = "dd/mm/yyyy hh:mm";
customers.getRange("L9:L207").format.numberFormat = "dd/mm/yyyy hh:mm";
customers.getRange("H9:H207").conditionalFormats.add("containsText", {
  text: "Cần chăm sóc",
  format: { fill: "#FDE68A", font: { bold: true, color: "#92400E" } },
});
customers.getRange("H9:H207").conditionalFormats.add("containsText", {
  text: "Đang tư vấn",
  format: { fill: "#BFDBFE", font: { color: "#1D4ED8" } },
});
customers.getRange("H9:H207").conditionalFormats.add("containsText", {
  text: "Đang giữ chỗ",
  format: { fill: "#FED7AA", font: { bold: true, color: "#9A3412" } },
});
customers.getRange("H9:H207").conditionalFormats.add("containsText", {
  text: "Đã thuê",
  format: { fill: "#BBF7D0", font: { color: "#166534" } },
});

const customerWidths = [12, 20, 15, 13, 32, 22, 18, 20, 18, 18, 30, 18];
customerWidths.forEach((width, index) => {
  customers.getRangeByIndexes(0, index, 208, 1).format.columnWidth = width;
});
customers.freezePanes.freezeRows(8);
customers.freezePanes.freezeColumns(2);

templates.tabColor = "#5B9BD5";
templates.getRange("A2").values = [["Mẫu bắn khách theo nhóm sale"]];
templates.getRange("A2").format.font = { name: font, size: 15, bold: true, color: darkBlue };
templates.getRange("A3").values = [["Sửa tên nhóm hoặc nội dung mẫu. Khi bắn khách, thay các biến trong ngoặc kép bằng dữ liệu thực."]];
templates.getRange("A3").format.font = { name: font, size: 10, italic: true, color: "#4B5563" };

templates.getRange("A6:C6").values = [["Nhóm sale", "Mẫu bắn khách", "Ghi chú"]];
templates.getRange("A6:C6").format = {
  fill: darkBlue,
  font: { name: font, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
templates.getRange("A6:C6").format.borders = { preset: "all", style: "thin", color: "#FFFFFF" };
templates.getRange("A8:C27").format.fill = inputFill;
templates.getRange("A8:C27").format.borders = { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" };
templates.getRange("A8:C27").format.verticalAlignment = "top";
templates.getRange("B8:B27").format.wrapText = true;
templates.getRange("A8:C27").format.rowHeight = 36;
templates.getRange("A8:C8").values = [[
  "N HOME",
  "💥 N HOME 💥\n👉 Mã phòng(nếu có): {{roomCode}}\n👉 Địa chỉ phòng: {{address}}\n👉 Giá phòng: {{price}}\n👉 Ngày/giờ xem phòng: {{viewingTime}}\n👉 Tên khách (FB/Zalo): {{customerName}}\n👉 SĐT khách: {{customerPhone}}",
  "Mẫu có thể sửa cho riêng nhóm này.",
]];
templates.getRange("A8:C8").format.rowHeight = 122;

templates.getRange("E6:E6").values = [["Trạng thái chăm sóc"]];
templates.getRange("E6:E6").format = {
  fill: darkBlue,
  font: { name: font, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
templates.getRange("E7:E13").values = statuses.map((status) => [status]);
templates.getRange("E7:E13").format.borders = { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" };

templates.getRange("G6:H6").values = [["Biến", "Ý nghĩa"]];
templates.getRange("G6:H6").format = {
  fill: darkBlue,
  font: { name: font, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
templates.getRange("G7:H12").values = [
  ["{{roomCode}}", "Mã phòng"],
  ["{{address}}", "Địa chỉ phòng"],
  ["{{price}}", "Giá phòng"],
  ["{{viewingTime}}", "Ngày/giờ xem"],
  ["{{customerName}}", "Tên khách"],
  ["{{customerPhone}}", "Số điện thoại khách"],
];
templates.getRange("G7:H12").format.borders = { preset: "insideHorizontal", style: "thin", color: "#E5E7EB" };
templates.getRange("A1:A30").format.columnWidth = 18;
templates.getRange("B1:B30").format.columnWidth = 54;
templates.getRange("C1:C30").format.columnWidth = 26;
templates.getRange("D1:D30").format.columnWidth = 3;
templates.getRange("E1:E30").format.columnWidth = 21;
templates.getRange("F1:F30").format.columnWidth = 3;
templates.getRange("G1:G30").format.columnWidth = 20;
templates.getRange("H1:H30").format.columnWidth = 22;
templates.freezePanes.freezeRows(6);

workbook.recalculate();

const customerCheck = await workbook.inspect({
  kind: "table",
  range: "Khách hàng!A2:L12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 12,
});
console.log(customerCheck.ndjson);
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(formulaErrors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "Khách hàng",
  range: "A1:L22",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
