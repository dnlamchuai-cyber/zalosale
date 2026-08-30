#!/usr/bin/env node
/**
 * MCP Server: vibe-coding — 1 server cho mọi IDE/agent
 * Tools: vibe_biz, vibe_spec, vibe_prompt, vibe_review, vibe_handover
 * Xem docs/19_PLUGIN_MCP.md:1
 * Chạy: npm run build && node dist/index.js  (stdio transport)
 * Consent: moi tool can external phai tra NEED_CONSENT — xem docs/12_BAO_MAT.md:1
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  { name: "vibe-coding-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// --- Tool schemas (map workflow 5 pha) ---
const tools = [
  {
    name: "vibe_biz",
    description:
      "Pha 2 lay-yeu-cau: tu idea mo ho -> hoi Socratic 5 Whys -> sinh BIZ-xxx.md. Doc docs/02_BUSINESS/_TEMPLATE.md",
    inputSchema: {
      type: "object",
      properties: {
        idea: { type: "string", description: "Y tuong feature, vd: rut gon link cho Guest" },
        projectRoot: { type: "string", description: "Duong dan repo, vd: C:/BeShort" },
      },
      required: ["idea"],
    },
  },
  {
    name: "vibe_spec",
    description:
      "Pha 2 type-first: tu BIZ -> sinh SPEC-xxx.md (zod + Prisma + API contract). Doc docs/03_SPEC/_TEMPLATE.md",
    inputSchema: {
      type: "object",
      properties: {
        bizPath: { type: "string", description: "Path BIZ-xxx.md, vd: docs/02_BUSINESS/BIZ-001.md" },
      },
      required: ["bizPath"],
    },
  },
  {
    name: "vibe_prompt",
    description:
      "Pha 3 tao-prompt: tu SPEC -> sinh PROMPT 6 khoi (context/yeu cau/files/vi du/rang buoc/verify). Doc docs/04_PROMPTS/_TEMPLATE.md + 15_HOC_VIBE.md:2",
    inputSchema: {
      type: "object",
      properties: {
        specPath: { type: "string" },
        taskName: { type: "string", description: "Ten slice, vd: POST /api/links" },
      },
      required: ["specPath", "taskName"],
    },
  },
  {
    name: "vibe_review",
    description:
      "Pha 4 review 5-axis (correctness/readability/architecture/security/performance). Doc docs/06_REVIEW/_TEMPLATE.md:1 + 14_CODE_READING_GUIDE.md:7",
    inputSchema: {
      type: "object",
      properties: {
        prPath: { type: "string", description: "Path PR hoac file can review" },
      },
      required: ["prPath"],
    },
  },
  {
    name: "vibe_hoctap",
    description:
      "Hoc tap: giai thich tinh hoa vua lam (code + kien truc + prompt + nghiep vu + bao mat). Go sau moi TASK Done — hoc 20+21+16",
    inputSchema: {
      type: "object",
      properties: {
        taskPath: { type: "string", description: "Path TASK-xxx.md, vd: docs/05_TASKS/TASK-002.md" },
      },
      required: [],
    },
  },
  {
    name: "vibe_handover",
    description:
      "Pha 5 handover: checklist 12_HANDOVER + 17_GIT_VERSIONING + 18_PRIVACY_CONSENT. Tra NEED_CONSENT neu can GitHub/API",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", description: "Tag, vd: v0.1.0" },
        githubUrl: { type: "string", description: "Can consent truoc khi dung — neu chua co thi dung mock" },
      },
      required: ["version"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Doc PROJECT_CONTEXT truoc moi tool — thieu thi bao MISSING_REQUIREMENT
  // (Thuc te doc file o day; stub tra huong dan de agent hoi user dien)
  const needContext = (msg: string) => ({
    content: [
      {
        type: "text",
        text: `MISSING_REQUIREMENT: ${msg}\n→ Dien docs/_meta/PROJECT_CONTEXT.md truoc (xem docs/01_TECH_STACK.md:1)`,
      },
    ],
  });

  switch (name) {
    case "vibe_biz": {
      const { idea } = z.object({ idea: z.string().min(1) }).parse(args);
      return {
        content: [
          {
            type: "text",
            text: `vibe_biz: idea="${idea}"\n→ Ho Socratic 5 Whys (actor? input/output? BR? edge case? thanh cong do bang gi?)\n→ Sinh docs/02_BUSINESS/BIZ-xxx.md tu _TEMPLATE.md\n→ Sinh docs/03_SPEC/SPEC-xxx.md (type-first)\n→ Cho user duyet truoc khi code.\nTip: Neu can GitHub/API de lay context, tra NEED_CONSENT va hoi user truoc (12_BAO_MAT.md:1).`,
          },
        ],
      };
    }
    case "vibe_spec": {
      const { bizPath } = z.object({ bizPath: z.string() }).parse(args);
      return {
        content: [
          {
            type: "text",
            text: `vibe_spec: biz=${bizPath}\n→ Doc BIZ → sinh SPEC voi zod + Prisma + API contract\n→ Giai thich khi nao dung POST vs GET (11_KIEN_TRUC.md:3)\n→ Cho user duyet.`,
          },
        ],
      };
    }
    case "vibe_prompt": {
      const { specPath, taskName } = z
        .object({ specPath: z.string(), taskName: z.string() })
        .parse(args);
      return {
        content: [
          {
            type: "text",
            text: `vibe_prompt: spec=${specPath} task=${taskName}\n→ Sinh docs/04_PROMPTS/PROMPT-xxx.md 6 khoi (15_HOC_VIBE.md:2)\n→ Checklist <2000 dong, co vi du I/O, header 3 Biet (14_CODE_READING_GUIDE.md:2)\n→ User duyet prompt truoc khi giao AI code.`,
          },
        ],
      };
    }
    case "vibe_review": {
      const { prPath } = z.object({ prPath: z.string() }).parse(args);
      return {
        content: [
          {
            type: "text",
            text: `vibe_review: ${prPath}\n→ Chay 5-axis (06_REVIEW/_TEMPLATE.md:1) + check header 3 Biet + S1-S8 (12_HANDOVER) + consent (18_PRIVACY)\n→ Findings: Critical/Important/Nit + goi y cai thien.`,
          },
        ],
      };
    }
    case "vibe_hoctap": {
      const { taskPath } = z.object({ taskPath: z.string().optional() }).parse(args);
      return {
        content: [
          {
            type: "text",
            text: `vibe_hoctap: ${taskPath ?? "TASK gan nhat"}\n→ 5 tinh hoa:\n1. Code (20:2): ham 1 viec, ten ro, early return, DRY/YAGNI\n2. Kien truc (21:1): feature folder, tach bien Route->Service->DB\n3. Prompt (16:2): 6 khoi, tai sao du 6 khoi\n4. Nghiep vu (BIZ/SPEC): BR nao, tai sao\n5. Bao mat (12 S1-S8 + 18): zod, hash IP, rate-limit, consent\n→ Hoi ban 1 cau de ban tra loi la hoc (hoc-tap skill).`,
          },
        ],
      };
    }
    case "vibe_handover": {
      const { version, githubUrl } = z
        .object({ version: z.string(), githubUrl: z.string().optional() })
        .parse(args);
      if (!githubUrl) {
        return {
          content: [
            {
              type: "text",
              text: `NEED_CONSENT: Can GitHub URL de push tag ${version}?\n→ Hoi user: "Ban cho link GitHub repo de minh push tag ${version}? Dan URL hoac noi 'chua co' de dung mock (chi commit local)."\n→ Khong tu doan URL (12_BAO_MAT.md:1)`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `vibe_handover: version=${version} github=${githubUrl}\n→ Checklist 12_HANDOVER + 17_GIT_VERSIONING (tag + push) + 18_PRIVACY (khong lo secret)\n→ Bao cao san sang ban giao.`,
          },
        ],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("vibe-coding-mcp 0.1.0 running (stdio) — tools: vibe_biz/spec/prompt/review/handover");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
