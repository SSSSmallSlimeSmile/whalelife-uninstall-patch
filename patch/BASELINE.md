# 补丁基线

- 宿主目录：`K:\WhaleLife\whalelife`（日常版，本地分叉）
- 提交：`11049aa` `feat(ui): 导航轨宽度与刻度位置加过渡，换批时淡入`
- 生成方式：`git diff HEAD -- core/runtime.ts core/web.ts core/ui/extensions.js`
- 行尾：补丁文件本身是 LF、无 BOM（目标文件是 CRLF，`git apply` 能对上）
- 规模：`+77 −11`

## 为什么基线是这个提交

这三处改动从来没进过 git，只活在磁盘上。`11049aa` 是它们的父提交，所以补丁相对它生成，能干净应用。

## 上游情况

上游 `iinukami/whalelife` 没有这段代码（`runtime.ts:597` 那行白名单在上游一样存在，但没有 `uninstall`）。**这份补丁不能直接套在上游树上**：会话记录、`permission.ts`、`runtime.ts` 的上下文都跟我们分叉不一致。要给上游用得重写一份，而不是这里直接 apply。

## 上游更新之后

合完上游，先 `node apply.mjs --check`：

- `[通过]` → 直接 `node apply.mjs`
- `[失败]` → 行号或上下文变了，按 `patch/uninstall.patch` 里的三段改动手工搬一次，再把新补丁重新生成一遍（`git diff HEAD -- 这三个文件`），提交到这个仓库
