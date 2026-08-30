# 09 � UI/UX: L�m sau c�ng, l�m �t m� d?p

> Nguy�n t?c: Logic v?ng r?i m?i kho�c �o. UI ? pha 5 kh�ng du?c l�m v? logic.

## Khi n�o l�m UI?

* Sau khi P0 logic (BIZ-001?003) d� Done + test xanh 100%
* Tru?c d� ch? l�m **wireframe low-fi** (Figma ho?c gi?y) d? l?y feedback � kh�ng code

## Quy tr�nh 4 bu?c cho 1 m�n h�nh

```
1. Wireframe (30p): ph�c layout b?ng khung x�m, kh�ng m�u
   ? User duy?t lu?ng

2. Tokens (30p): d?nh nghia colors, spacing, typography trong tailwind.config.ts
   ? D�ng shadcn/ui l�m base, kh�ng t? invent component

3. Implement (1 slice): 1 component = 1 TASK, colocate test
   ? V� d?: TASK-007 UI form r�t g?n � ch? render form + g?i POST /api/links d� c�

4. Verify (15p): screenshot before/after, check responsive (375px, 768px, 1280px), a11y (keyboard, contrast)
```

## Quy t?c cho AI khi gen UI

* M?i prompt ch? 1 component/screen, c� reference `src/components/ui/button.tsx:1` (shadcn pattern)
* Kh�ng d? AI t? ch?n m�u � dua tokens tru?c
* Kh�ng gen logic nghi?p v? trong UI � UI ch? g?i API d� c�, hi?n th? loading/error/success
* File =300 d�ng, t�ch `hooks/useCreateLink.ts` n?u logic d�i

## V� d? BeShort: Form r�t g?n

```tsx
// src/components/ShortenForm.tsx � Pha 5, sau khi POST /api/links d� c�
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShortenForm() {
  const [url, setUrl] = useState("");
  // ch? g?i API d� c�, kh�ng t? t?o slug ? FE
  const { mutate, data, isPending } = useCreateLink();
  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate({ url }); }}>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="D�n link d�i..." />
      <Button disabled={isPending}>R�t g?n</Button>
      {data && <a href={data.shortUrl}>{data.shortUrl}</a>}
    </form>
  );
}
```

## Checklist tru?c khi merge UI

- [ ] Logic cu v?n pass `npm test` (kh�ng v?)
- [ ] Screenshot 3 breakpoint
- [ ] Keyboard navigable, contrast =4.5:1
- [ ] Kh�ng th�m endpoint m?i trong PR UI

---
*H?c d? t? l�m UI: N?m 4 bu?c tr�n + d?c shadcn/ui docs � sau n�y kh�ng c?n file n�y v?n bi?t khi n�o t�ch component.*
