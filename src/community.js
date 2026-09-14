// AI: Codex | WHY: phân trang đến mốc ngày, có giới hạn và báo thiếu khi nguồn ngừng trả tin.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
import { apiFactory } from "../node_modules/zca-js/dist/utils.js";
import { GroupMessage } from "../node_modules/zca-js/dist/models/index.js";
import { collectCommunityHistory } from "./history-range.js";

const PAGE_SIZE = 50; // WHY: Community API giới hạn 50 tin mỗi trang

export function createCommunityParams(groupId, count, cursor, imei) {
  return {
    groupId: String(groupId).replace(/^g/, ""),
    globalMsgId: cursor,
    count: Math.min(PAGE_SIZE, count),
    msgIds: [],
    imei,
    src: 3,
  };
}

export function createCommunityRequest(encryptedParams) {
  return {
    query: { params: encryptedParams, nretry: 0 },
    options: { method: "GET" },
  };
}

function parseCommunityPage(result) {
  let data = result.data;
  if (typeof data === "string") data = JSON.parse(data);
  if (Array.isArray(data)) return { groupMsgs: data };
  if (Array.isArray(data?.messages) && !data.groupMsgs) data.groupMsgs = data.messages;
  return data ?? { groupMsgs: [] };
}

export const getCommunityHistoryFactory = apiFactory()((api, ctx, utils) => {
  return async function getCommunityHistory(groupId, count = 50, options = {}) {
    const base = api.zpwServiceMap?.group_cloud_message?.[0] || "https://tt-group-cm.chat.zalo.me";
    const serviceURL = utils.makeURL(`${base}/api/cm/getrecentv2`);
    const result = await collectCommunityHistory(async (cursor, remaining, signal) => {
      const params = createCommunityParams(groupId, remaining, cursor, ctx.imei);
      const encrypted = utils.encodeAES(JSON.stringify(params));
      if (!encrypted) throw new Error("Failed to encrypt params for community history");
      const request = createCommunityRequest(encrypted);
      const response = await utils.request(utils.makeURL(serviceURL, request.query), { ...request.options, signal });
      return utils.resolve(response, parseCommunityPage);
    }, { ...options, maxMessages: count });

    return {
      ...result,
      groupMsgs: result.groupMsgs.map((message) => new GroupMessage(ctx.uid, message)),
    };
  };
});
