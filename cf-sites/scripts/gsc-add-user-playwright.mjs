#!/usr/bin/env node
/**
 * GSC Add User RPA – 批量给所有站点的 Users 页添加 gsc-178 服务账号
 *
 * 使用（推荐，避免 Google 报「此浏览器可能不安全」）：
 *   1. 先完全退出 Chrome（所有窗口关掉）
 *   2. 执行：node scripts/gsc-add-user-playwright.mjs
 *   脚本会复用你本机 Chrome 的登录态，不再弹 Google 登录/不安全提示。
 *
 * 可选：LIMIT=2 只跑前 2 个站点试跑；GSC_CHROME_USER_DATA 指定 Chrome 配置目录。
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL = "gsc-178@poised-lens-472416-d2.iam.gserviceaccount.com";
const URLS_FILE = path.join(__dirname, "gsc-users-urls.txt");

const LIMIT = parseInt(process.env.LIMIT || "0", 10) || 9999;

// 使用本机 Chrome 配置目录 → 直接复用已登录的 Google 账号，避免「此浏览器可能不安全」
function getChromeUserDataDir() {
  if (process.env.GSC_USE_SCRIPT_PROFILE === "1")
    return path.join(__dirname, ".playwright-gsc-profile");
  if (process.env.GSC_CHROME_USER_DATA) return process.env.GSC_CHROME_USER_DATA;
  const home = process.env.HOME || process.env.USERPROFILE;
  if (process.platform === "darwin" && home)
    return path.join(home, "Library/Application Support/Google/Chrome");
  if (process.platform === "win32" && home)
    return path.join(home, "AppData/Local/Google/Chrome/User Data");
  return path.join(__dirname, ".playwright-gsc-profile");
}

const USER_DATA_DIR = getChromeUserDataDir();
const USE_SYSTEM_CHROME =
  (USER_DATA_DIR.includes("Chrome") || process.env.GSC_CHROME_USER_DATA) &&
  process.env.GSC_USE_SCRIPT_PROFILE !== "1";

function getUrls() {
  const text = fs.readFileSync(URLS_FILE, "utf8");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("https://"));
}

async function main() {
  const allUrls = getUrls();
  const urls = allUrls.slice(0, LIMIT);
  console.log("GSC Add User RPA – 本轮", urls.length, "个站点", LIMIT < allUrls.length ? `(LIMIT=${LIMIT})` : "");
  console.log("邮箱:", EMAIL);
  console.log("浏览器配置:", USER_DATA_DIR);
  if (USE_SYSTEM_CHROME) {
    console.log("(使用本机 Chrome 配置，请先完全退出 Chrome 再运行，否则会报错)");
  }
  console.log("");

  const launchOpts = {
    headless: false,
    viewport: null,
    acceptDownloads: true,
    args: ["--start-maximized"],
  };
  if (USE_SYSTEM_CHROME) {
    launchOpts.channel = "chrome";
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOpts);
  } catch (e) {
    const msg = (e.message || "").toLowerCase();
    if (USE_SYSTEM_CHROME && (msg.includes("user data") || msg.includes("singleton") || msg.includes("profile is already in use"))) {
      console.error("\n提示：Chrome 正在运行，配置目录被占用。请二选一：");
      console.error("  1) 完全退出 Chrome 后重新运行本脚本（推荐，直接复用登录）；");
      console.error("  2) 或设置环境变量使用脚本自带配置再运行：");
      console.error("     GSC_USE_SCRIPT_PROFILE=1 LIMIT=2 node scripts/gsc-add-user-playwright.mjs");
      console.error("     （会打开新配置的浏览器，需在页面里登录 Google，可能遇到「此浏览器可能不安全」）");
    }
    throw e;
  }

  const page = context.pages()[0] || (await context.newPage());

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const domain = url.match(/resource_id=https%3A%2F%2F([^%]+)/)?.[1] || url;
    process.stdout.write(`[${i + 1}/${urls.length}] ${domain} ... `);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1200);

      if (page.url().includes("accounts.google.com")) {
        if (i === 0) {
          console.log("\n需要先登录 Google。请在刚打开的浏览器窗口里登录，登录成功后按回车继续…");
          await new Promise((r) => process.stdin.once("data", r));
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
          await page.waitForTimeout(1200);
          if (page.url().includes("accounts.google.com")) {
            console.log("仍未进入 GSC，请确认登录后重试。");
            failed++;
            continue;
          }
        } else {
          console.log("未登录或会话过期，请重新运行脚本并登录。");
          failed++;
          await context.close();
          process.exit(1);
        }
      }

      const heading = await page
        .locator('heading[level="1"]')
        .filter({ hasText: "Users (" })
        .first()
        .textContent()
        .catch(() => null);
      if (heading && heading.includes("( 4 )")) {
        console.log("跳过(已有4用户)");
        skipped++;
        continue;
      }

      const addBtn = page.getByRole("button", { name: /Add user/i });
      await addBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      const emailInput = page.getByRole("textbox", {
        name: /Enter a valid Google account email/i,
      });
      await emailInput.fill(EMAIL);
      await page.waitForTimeout(200);

      await page.getByRole("button", { name: "Add" }).click();
      await page.waitForTimeout(1500);

      const dialogStill = await page.getByRole("heading", { name: "Add user" }).isVisible().catch(() => false);
      if (dialogStill) {
        const errText = await page.locator("[role=alert], .error, .message").first().textContent().catch(() => "");
        console.log("失败:", errText || "未知");
        failed++;
      } else {
        console.log("已添加");
        added++;
      }
    } catch (e) {
      console.log("错误:", e.message);
      failed++;
    }
  }

  console.log("");
  console.log("完成. 已添加:", added, "跳过:", skipped, "失败:", failed);
  await context.close();
}

main();
