// Test cho route — chạy với `node src/features/community-check/route.test.js`
import { communityCheckRoute } from "./route.js";

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

async function run() {
  console.log("Test 1: body đúng → 200");
  // Mock api để fetchRecentMessages trả về 1 batch
  const mockApi = {
    getGroupChatHistory: async () => ({
      groupMsgs: [{ data: { content: "Phòng Cầu Giấy 4tr5", ts: Date.now() } }],
    }),
  };
  const req1 = { body: { groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, api: mockApi, areas: [{ keywords: ["cau giay"] }] };
  const res1 = mockRes();
  await communityCheckRoute(req1, res1);
  console.log("  status:", res1.statusCode, res1.statusCode === 200 ? "PASS" : "FAIL", JSON.stringify(res1.body).slice(0,100));

  console.log("Test 2: from sai → 400");
  const req2 = { body: { groupId: "8089152704833938973", from: "abc" }, api: mockApi, areas: [] };
  const res2 = mockRes();
  await communityCheckRoute(req2, res2);
  console.log("  status:", res2.statusCode, res2.statusCode === 400 ? "PASS" : "FAIL", JSON.stringify(res2.body).slice(0,100));

  console.log("Done");
}

run().catch((e) => console.error(e));
