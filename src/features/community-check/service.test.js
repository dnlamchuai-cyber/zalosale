// Colocated test cho service.checkCommunity — chạy với `node src/features/community-check/service.test.js`
import { checkCommunity } from "./service.js";

async function run() {
  console.log("Test 1: filter cau giay -> 1");
  const mockFetch1 = async () => [
    [{ data: { content: "Phòng trọ Cầu Giấy 4tr5", ts: Date.now() } }],
    [{ data: { content: "Phòng Hà Đông", ts: Date.now() } }],
  ];
  const areas = [{ keywords: ["cau giay"], groupLink: "" }];
  const res1 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24", keyword: "cau giay" }, { api: {}, areas, fetchFn: mockFetch1 });
  console.log("  total:", res1.total, res1.total === 1 ? "PASS" : "FAIL", JSON.stringify(res1.posts[0]?.clean));

  console.log("Test 2: không filter -> 2");
  const mockFetch2 = async () => [
    [{ data: { content: "Tin 1", ts: Date.now() } }],
    [{ data: { content: "Tin 2", ts: Date.now() } }],
  ];
  const res2 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, { api: {}, areas: [], fetchFn: mockFetch2 });
  console.log("  total:", res2.total, res2.total === 2 ? "PASS" : "FAIL");

  console.log("Test 3: rỗng -> 0");
  const mockFetch3 = async () => [];
  const res3 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, { api: {}, fetchFn: mockFetch3 });
  console.log("  total:", res3.total, res3.total === 0 ? "PASS" : "FAIL");

  console.log("Done");
}

run().catch((e) => console.error(e));
