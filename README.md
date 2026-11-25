# WhaleLife 卸载按钮补丁

给「直接拷进 `plugins/` 的插件」加一个「删除」按钮。

不是插件，是一份宿主核心补丁。原因见下面「为什么不能做成插件」。

- 基线：日常版 `K:\WhaleLife\whalelife`，提交 `11049aa`
- 改三个文件：`core/runtime.ts`、`core/web.ts`、`core/ui/extensions.js`
- 规模：`+77 −11`

## 现状（打补丁之前）

WhaleLife 的插件有三种来源，界面上并不等价：

| 来源 | 卡片上的动作 |
|---|---|
| 商店安装 | 停用 / 重载 / **卸载** |
| 社区发行包安装 | 停用 / 重载 / **卸载** |
| 手搓、直接拷进 `plugins/` | 停用 / 重载 |

第三种没有删除入口，因为宿主两处都不认：

```text
core/runtime.ts:597        /api/plugin 只接受 stop / start / reload
core/ui/official-plugins.js  removeButton 只在商店记录或社区包记录里找得到条目时才渲染
```

想删只能手动：停用 → 删目录 → 重启宿主清残留记录。作者在 issue #44 里明确回了这是**故意不给**——手写的插件应当由人来管。

## 改了什么

**`core/runtime.ts`**

`action()` 多认一个 `uninstall`，并新增两个私有方法：

- `uninstallNow()`：先 `setEnabled(false)` → `stop()` → 从 records 移除 → 把 `data/` 挪到 `.artifacts/uninstalled-plugin-data/<id>-<时间戳>/` → 删目录
- `preserveData()`：`deleteData` 为真时连 `data/` 一起删
- 另加 `removeTree()`：Windows 上进程刚退出时目录可能还被占着，重试 8 次、间隔递增

拒绝的情形（写在代码里，不是提示）：

- 子插件（`record.parent` 存在）
- 目录不在 `plugins/` 之下（`relative()` 结果以 `..` 开头、或含盘符）
- 目录里没有 `plugin.yaml`
- 内置插件、ID 不存在

**`core/web.ts`**

`/api/plugin` 透传 `deleteData`，两个字符的改动。

**`core/ui/extensions.js`**

- 新增 `removable()`：只对「顶层、非内置、且没有商店／社区安装记录」的插件为真 —— 商店那种还走原来的卸载通道，不抢
- 卡片底部和详情页右上各多一个「删除」按钮
- 点击弹一次原生 `confirm`，写明会先停用、`data/` 会保留到 `.artifacts`

## 怎么打

```powershell
node apply.mjs --check                  # 只检查能不能打
node apply.mjs                          # 应用
node apply.mjs --root "D:\别的宿主"      # 指定目标
node apply.mjs --revert                 # 撤掉
```

`apply.mjs` 会先看 `core/runtime.ts` 里有没有 `uninstallNow`，有就跳过，所以重复跑没问题。

打完必须**重启宿主**：`core/runtime.ts` 是核心文件，不热重载。

## 验证

补丁本身（在从 `11049aa` 拉出的干净 worktree 里）：

```text
git apply --check -p1     exit 0
git apply -v              三个文件 cleanly
node --check extensions.js exit 0
三个文件与日常版当前状态  sha256 逐字节一致
```

运行时（拿真 `Runtime` 起一个临时根跑，14 条）：

```text
scan 加载两个 → uninstall fakeplug
  目录删了、另一个插件还在、data 已迁走且文件在
  records 移除、日志留「插件已卸载」
重复卸载 / 不存在 / 未知动作 → 各自被拒
deleteData=true → data 为 null、目录全清，旁边的没动
```

`tsc --noEmit` 对宿主全量 0 error。

## 未验证

- 真浏览器里点按钮的那一下（`confirm` 弹窗、卡片重排）只验了 HTML 和逻辑
- 删除「正在跑技能」的插件时会不会卡在 `stop()`（测试里插件是空闲的）
- Windows 之外没试过，`removeTree` 的重试是为 Windows 写的

## 为什么不能做成插件

卸载要删 `plugins/<id>` 目录，而插件自己就跑在那个目录里 —— Windows 上文件被占用删不掉，而且它删的是自己。另外它还得改 `runtime.ts` 的 records、让 `/api/plugin` 多认一个 action，那是宿主内部接口，插件拿不到。就算拿到了，删别的插件目录属于跨插件写，作者在 #9 里明确反对过。

所以形态只能是补丁。

## 维护

这是分叉的核心改动，**上游每次更新都会被盖回去**。合完上游先跑 `node apply.mjs --check`：

- 通过 → 打一遍
- 失败 → 说明行号变了，按 `patch/uninstall.patch` 的内容手工搬一次，再更新补丁

改动前的原件备份：`K:\WhaleLife\whalelife\.artifacts\uninstall-20261125-184819\`。

## 许可

MIT。宿主本体是 AGPL-3.0，这份补丁只改它，不改许可。
