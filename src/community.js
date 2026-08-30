import { apiFactory } from "../node_modules/zca-js/dist/utils.js";
import { GroupMessage } from "../node_modules/zca-js/dist/models/index.js";

export const getCommunityHistoryFactory = apiFactory()((api, ctx, utils) => {
  return async function getCommunityHistory(groupId, count = 50) {
    const base = api.zpwServiceMap?.group_cloud_message?.[0] || "https://tt-group-cm.chat.zalo.me";
    const serviceURL = utils.makeURL(`${base}/api/cm/getrecentv2`);
    const params = { grid: String(groupId), count: Number(count) };
    const encryptedParams = utils.encodeAES(JSON.stringify(params));
    if (!encryptedParams) throw new Error("Failed to encrypt params for community history");
    const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), { method: "GET" });
    return utils.resolve(response, (result) => {
      let data = result.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch {}
      }
      // Chuẩn hoá về {groupMsgs: []} để dùng chung với group/history
      if (data && Array.isArray(data.groupMsgs)) {
        for (let i = 0; i < data.groupMsgs.length; i++) data.groupMsgs[i] = new GroupMessage(ctx.uid, data.groupMsgs[i]);
        return data;
      }
      if (data && Array.isArray(data.messages)) {
        const msgs = data.messages.map((m) => new GroupMessage(ctx.uid, m));
        return { groupMsgs: msgs };
      }
      if (Array.isArray(data)) {
        return { groupMsgs: data.map((m) => new GroupMessage(ctx.uid, m)) };
      }
      return data;
    });
  };
});
