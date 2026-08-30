# Adaptive Knowledge Tracking

Learning must support delivery, not interrupt it. Track concepts by state and teach only what the current task needs.

| State | Meaning | Agent behavior |
| --- | --- | --- |
| `new` | User has not encountered the concept | Explain simply with a project example |
| `learning` | User has seen it but needs practice | Ask one short question or give a tiny exercise |
| `known` | User can explain and apply it | Repeat briefly at spaced intervals; add only new complexity |
| `needs-review` | User applied it incorrectly or context changed significantly | Correct the misconception before risky implementation |

Mark a concept `known` when the user can explain it, identify it in the code path, or apply it in a small schema, test, prompt, or code change. An acknowledgement is enough to continue, but not enough to claim mastery.

```text
new + low risk -> explain briefly, then continue
new + high risk -> explain and confirm before implementation
learning -> one retrieval question or tiny exercise
known + same context -> brief spaced reminder, not a full lecture
known + harder context -> explain only the new trade-off
needs-review -> pause if the misunderstanding can cause a bug/security issue
```

After each task, report delivery first and learning second. Timebox routine learning to 5-15 minutes. Repeat important terms briefly across later tasks, then connect them to the new context. Never skip tests, security, review, or approval because the user knows the topic.
