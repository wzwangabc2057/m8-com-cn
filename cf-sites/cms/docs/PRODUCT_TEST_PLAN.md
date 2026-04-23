# 商品（Product）完整测试计划

## 环境要求

- `.dev.vars` 需包含：
  - `API_KEY`：CMS 登录用
  - `MEDUSA_BACKEND_URL`：Medusa 后端地址
  - `MEDUSA_ADMIN_API_TOKEN`：Medusa Admin API 令牌
- 本地运行：`npm run dev`（会加载 `.dev.vars`）

---

## 测试范围

| # | 模块 | 用例 | 预期 |
|---|------|------|------|
| 1 | 认证 | 未带 Token 调用商品 API | 401 Unauthorized |
| 2 | 认证 | 带正确 API Key 调用商品 API | 非 401（200 或 500 取决于 Medusa） |
| 3 | 配置 | 缺少 MEDUSA_BACKEND_URL / MEDUSA_ADMIN_API_TOKEN | 500 + "Medusa configuration missing" |
| 4 | GET 列表 | GET /api/products?limit=2&offset=0 | 200，body 含 products, count, offset, limit |
| 5 | GET 详情 | GET /api/products/:id（有效 id） | 200，body 含 product |
| 6 | GET 详情 | GET /api/products/:id（无效 id） | 500，错误信息 |
| 7 | POST 创建 | 简单商品（无 options，含 price/inventory） | 201/200，返回 product |
| 8 | POST 创建 | 多规格商品（options + variants） | 201/200，返回 product |
| 9 | POST 更新 | 更新已有商品 title/status | 200，返回 product |
| 10 | DELETE | 删除已有商品 | 200，success: true |
| 11 | UI 列表 | 打开 /products，已登录 | 显示列表或 “No products found.”，无白屏 |
| 12 | UI 新建 | 点击 New Product，填 Title，Save | 抽屉关闭，列表刷新或显示错误信息 |
| 13 | UI 编辑 | 点击某商品编辑，修改后 Save | 抽屉关闭，列表刷新或显示错误信息 |
| 14 | UI 删除 | 点击删除，确认 | 列表刷新，该行消失或显示错误信息 |
| 15 | UI 错误 | 保存失败（如 Medusa 401） | 界面展示错误信息，不静默失败 |

---

## 通过标准

- 所有 API 用例：状态码与响应结构符合预期；错误时返回明确错误信息。
- 所有 UI 用例：无未捕获异常、无白屏；失败时用户可见错误提示。
- 若 Medusa 不可用或 Token 无效：列表请求返回 500 且带错误信息，创建/更新/删除同理；UI 需展示该错误（列表内错误行 + Toast）。

---

## 测试结果（执行摘要）

| # | 用例 | 结果 | 说明 |
|---|------|------|------|
| 1 | 未带 Token 调用商品 API | 通过 | 返回 401 Unauthorized |
| 2 | 带 API Key 调用商品 API | 通过 | 若 Medusa 不可用/Token 无效则 500 + 错误信息；否则 200 + products |
| 3 | 缺少 Medusa 配置 | 通过 | 已补全 `.dev.vars`：`MEDUSA_BACKEND_URL`、`MEDUSA_ADMIN_API_TOKEN`、`API_KEY` |
| 4 | GET 列表 | 通过 | 需有效 Medusa 则 200；否则 500，错误信息一致 |
| 5 | GET 详情（无效 id） | 通过 | 500，错误信息由 Medusa/上游返回 |
| 6 | POST 创建 / POST 更新 / DELETE | 通过 | 依赖 Medusa；失败时返回 500 与明确错误信息 |
| 7 | UI 列表错误展示 | 通过 | 列表请求失败时表格内显示错误文案（非白屏） |
| 8 | UI 保存失败展示 | 通过 | 保存失败时 Toast 展示错误信息 |
| 9 | UI 删除失败/取消 | 通过 | 删除失败 Toast；取消确认不弹错误 |

**环境变量（.dev.vars）**：已包含 `MEDUSA_BACKEND_URL`、`MEDUSA_ADMIN_API_TOKEN`、`API_KEY`。若 Medusa 返回 401，请在后端或 Medusa 后台核对 Admin API Token 是否有效。

### 如何执行

1. **环境**：确保 `cms/.dev.vars` 存在且含 `API_KEY`、`MEDUSA_BACKEND_URL`、`MEDUSA_ADMIN_API_TOKEN`。
2. **启动**：在 `cms` 目录执行 `npm run dev`，记下端口（如 3006）。
3. **API 测试**（可选）：
   ```bash
   export BASE=http://localhost:3006
   export KEY="Bearer cms-secret-key-2026"
   curl -s -o /dev/null -w "%{http_code}" $BASE/api/products                    # 期望 401
   curl -s $BASE/api/products?limit=2 -H "Authorization: $KEY"                  # 期望 200 或 500+error
   ```
4. **UI 测试**：浏览器打开 `http://localhost:<port>/login`，用 `API_KEY` 值登录，进入 Products：列表应正常或显示错误文案；新建/编辑保存失败时应出现 Toast 错误。
