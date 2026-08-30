import { apiFactory } from "../node_modules/zca-js/dist/utils.js";
import { GroupMessage } from "../node_modules/zca-js/dist/models/index.js";

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
  if (Array.isArray(data)) return { groupMsgs: data, hasMore: false };
  if (Array.isArray(data?.messages) && !data.groupMsgs) data.groupMsgs = data.messages;
  return data ?? { groupMsgs: [], hasMore: false };
}

function appendUniqueMessages(target, seenIds, page, limit) {
  for (const message of page.groupMsgs || []) {
    if (target.length >= limit) break;
    const id = String(message.msgId ?? message.messageId ?? "");
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    target.push(message);
  }
}

export const getCommunityHistoryFactory = apiFactory()((api, ctx, utils) => {
  return async function getCommunityHistory(groupId, count = 50) {
    const base = api.zpwServiceMap?.group_cloud_message?.[0] || "https://tt-group-cm.chat.zalo.me";
    const serviceURL = utils.makeURL(`${base}/api/cm/getrecentv2`);
    const limit = Math.max(1, Number(count) || PAGE_SIZE);
    const messages = [];
    const seenIds = new Set();
    let cursor = 0;
    let lastPage = null;

    while (messages.length < limit) {
      const params = createCommunityParams(groupId, limit - messages.length, cursor, ctx.imei);
      const encrypted = utils.encodeAES(JSON.stringify(params));
      if (!encrypted) throw new Error("Failed to encrypt params for community history");
      const request = createCommunityRequest(encrypted);
      const response = await utils.request(utils.makeURL(serviceURL, request.query), request.options);
      lastPage = await utils.resolve(response, parseCommunityPage);
      appendUniqueMessages(messages, seenIds, lastPage, limit);
      const nextCursor = Number(lastPage?.lastMsgId);
      if (!lastPage?.hasMore || !nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return {
      ...(lastPage || {}),
      groupMsgs: messages.map((message) => new GroupMessage(ctx.uid, message)),
    };
  };
});
