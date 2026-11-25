#!/usr/bin/env node
/**
 * WhaleLife 卸载按钮补丁 —— 应用脚本
 *
 * 用法：
 *   node apply.mjs                 应用到默认宿主（K:\WhaleLife\whalelife）
 *   node apply.mjs --root <目录>    指定宿主目录
 *   node apply.mjs --check         只检查，不写文件
 *   node apply.mjs --revert        反向撤掉（git apply -R）
 *
 * 幂等：已经打过就跳过，退出码 0。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PATCH = join(HERE, "patch", "uninstall.patch");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const root = value("--root", "K:\\WhaleLife\\whalelife");
const checkOnly = flag("--check");
const revert = flag("--revert");

const TARGETS = ["core/runtime.ts", "core/web.ts", "core/ui/extensions.js"];
const MARK = "uninstallNow";

function die(msg) {
  console.error("[失败] " + msg);
  process.exit(1);
}

if (!existsSync(join(root, "core", "runtime.ts"))) die("找不到 " + join(root, "core", "runtime.ts") + "，--root 指错了？");
if (!existsSync(PATCH)) die("找不到补丁文件 " + PATCH);

const runtime = readFileSync(join(root, "core", "runtime.ts"), "utf8");
const applied = runtime.includes(MARK);

if (revert) {
  if (!applied) {
    console.log("[跳过] 没检测到补丁，不用撤。");
    process.exit(0);
  }
  const r = spawnSync("git", ["apply", "-R", "-p1", PATCH], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) die("反向应用失败：\n" + (r.stderr || r.stdout || ""));
  console.log("[完成] 已撤掉补丁（重启宿主后恢复旧行为）。");
  process.exit(0);
}

if (applied) {
  console.log(checkOnly
    ? "[已应用] core/runtime.ts 里有 " + MARK + "，补丁已经打过。"
    : "[跳过] 已经打过了（core/runtime.ts 里有 " + MARK + "）。");
  process.exit(0);
}

const chk = spawnSync("git", ["apply", "--check", "-p1", PATCH], { cwd: root, encoding: "utf8" });
if (chk.status !== 0) {
  console.error("[失败] 补丁打不上，宿主代码可能已经不是补丁基线。");
  console.error(chk.stderr || chk.stdout || "");
  console.error("基线见 patch/BASELINE.md；如果是上游新版，行号会变，不能直接套。");
  process.exit(1);
}

if (checkOnly) {
  console.log("[通过] 三个文件都能干净应用：" + TARGETS.join("、"));
  process.exit(0);
}

const r = spawnSync("git", ["apply", "-v", "-p1", PATCH], { cwd: root, encoding: "utf8" });
if (r.status !== 0) die("应用失败：\n" + (r.stderr || r.stdout || ""));

const after = readFileSync(join(root, "core", "runtime.ts"), "utf8").includes(MARK);
if (!after) die("命令返回成功，但回读 runtime.ts 里没有标记 —— 不算成功。");

console.log("[完成] 已应用。改动文件：");
for (const f of TARGETS) console.log("  " + f);
console.log("重启宿主后生效：/api/plugin 会接受 action=uninstall，插件卡片右下角出现「删除」。");
