# Shopify 黑五投票 + 每两小时秒杀 Demo：平台能力与实现边界

核验日期：2026-09-29。本文只使用 Shopify 官方帮助中心和 Developer Documentation；API 页面核验时的 latest 为 `2026-07`。以下默认采用较可运营的口径：**投票截止后锁定排名，每两小时轮到 1 个商品，该场放出 2 件**。

## 结论

这不是一个可靠的“纯主题功能”。**主题可以完成可交互 Demo；真实活动至少需要一个自建 App 后端，强校验还取决于 Shopify Plus 或可用的 App Store 公共应用。**

| 能力 | 纯主题 Demo | 生产实现 |
|---|---|---|
| 着陆页、商品卡、排行榜、预告/倒计时/进行中/售罄 | 可做；用 Page JSON template、Section、Liquid、JS，数据可写死或读取 Metaobject | 主题 App Extension + App Proxy 动态取状态；Metaobject 只保存适合公开展示的排期/汇总 |
| 匿名投票、每个 Cookie ID 一票 | 可用 `localStorage`/自建 Cookie 模拟 | App Proxy 接收匿名 token，App 数据库存原始票并唯一约束；Cookie 只能减少普通重复投票，不能防清 Cookie、无痕、换设备或脚本 |
| 登录后关联匿名身份 | 可在页面读取已登录 `customer` 状态 | Proxy 验签后可得到 `logged_in_customer_id`，再把浏览器提交的匿名 token 与 Customer ID 绑定 |
| 每两小时按排名放 2 件 | 只能模拟时钟和库存 | 后端定时任务/Flow 触发 App；通过 Admin API 幂等更新专用秒杀 SKU 库存 |
| 登录 + 预约 + 分享资格 | 可模拟步骤 UI | 预约/分享状态写入 Customer tag/metafield；结账强校验用 Cart and Checkout Validation Function |
| 秒杀价 | 页面可展示假价格 | 原生定时/自动折扣、特定客户/Customer Segment，或 Discount Function |
| 公平并发、结账锁库存、防机器人 | 不可保证 | 依赖 Shopify Checkout、服务端校验、限频；Plus 才有面向 flash sale 的额外 bot protection |

## 需要先修正的三个产品前提

1. **Cookie ID 不是唯一用户。**它只适合做“轻量去重”，不能宣称一人一票。匿名票必须接受可绕过，并增加服务端 rate limit、异常票审计、IP/设备信号哈希化和最终人工冻结排名。使用持久化的非必要 Cookie 前，应根据地区与商店配置检查 consent；Shopify 提供浏览器端 Customer Privacy API，并明确提示未经同意收集数据可能不合规。[Customer Privacy API](https://shopify.dev/docs/api/customer-privacy)
2. **“分享成功”通常不能作为可验证事实。**Shopify 官方只说明主题/页面可提供社媒分享按钮和分享链接，并没有外部平台发布成功回执这一原生资格信号。[Posting on social media](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/social-media-marketing) 推荐二选一：把规则写成“点击分享按钮即完成”；或改成可验证的“专属邀请链接带来 1 个有效访问/预约”。不要把打开系统分享面板描述成已经发布成功。
3. **普通购物车没有 5 分钟库存锁。**Shopify 会在 checkout 各步骤复核库存，但官方说明库存只在顾客提交支付信息时才 hold。[Shopify Checkout](https://help.shopify.com/en/manual/checkout-settings/checkout-upgrade) Draft order 可以显式 reserve 库存并设置过期时间，但那是另一套草稿订单流程，不是普通 Add to cart。[Create draft orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/create-orders/create-draft) 因此 Demo 不应承诺“点到即锁 5 分钟”；若必须锁定，需要专门设计 Draft Order/预约订单流程并评估支付体验。

## 推荐 Shopify 架构

```text
Online Store 2.0 Page / Theme App Block
  ├─ Liquid：商品、客户登录态、公开排期
  ├─ JS：倒计时、投票与资格步骤 UI
  └─ /apps/bf-event/*（App Proxy）
       └─ 自建 App
          ├─ DB：匿名 token、原始票、冻结榜单、资格动作、slot 状态
          ├─ Scheduler：每 2 小时开启/关闭 slot
          ├─ Admin API：库存、客户 tag/metafield、折扣、公开 Metaobject
          └─ Webhook/订单回查：消费资格、审计重复购买
Shopify Checkout
  └─ Validation/Discount Function：不可绕过的资格、数量与折扣规则
```

### 1. 页面与内容模型

- 页面用独立 Page JSON template 和可配置 sections；如打包成应用，优先 Theme App Extension。Theme App Extension 可注入 app blocks、CSS、JS，并由商家在主题编辑器配置，不必直接改主题文件。[Theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- 建议 Metaobject `bf_campaign` 与 `bf_slot` 保存公开字段：活动时区、投票截止时间、product reference、rank、vote_count（汇总值）、starts_at、ends_at、release_qty、display_status。Metaobjects 可作为具有 storefront visibility 的动态数据源；写入需后端用 `write_metaobjects` 调 Admin API。[Dynamic data sources](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources)、[metaobjectUpdate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metaobjectUpdate)
- **原始票、IP/风控信号、资格流水不要放 Metaobject**；它们属于 App 私有数据库。主题展示的票数和状态是派生数据，不是权威交易记录。
- 前端状态不要只信浏览器时间。App 状态接口返回 `server_now`、当前 slot、下一 slot、库存可售状态；页面据此渲染 `upcoming / countdown / live / sold_out / ended`，并短轮询刷新。

### 2. 匿名投票与登录关联

- 首次访问由前端保存一个随机、不可枚举的匿名 token；投票经 App Proxy POST 到后端，数据库以 `(campaign_id, anonymous_token)` 建唯一约束。一票是“一次选择”，若允许改单则更新同一行，而不是新增票。
- App Proxy 会给转发请求附加 `shop`、`timestamp`、签名，以及已登录时的 `logged_in_customer_id`；后端必须验证 HMAC。官方同时说明 Proxy 会剥离请求 `Cookie` 和响应 `Set-Cookie`，所以匿名 token 需要由前端显式放入请求体，不能期待后端自动收到浏览器 Cookie。[Authenticate app proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies)
- 登录后可把该 token 与 Shopify Customer ID 关联。Liquid 的全局 `customer` 只在用户已登录时存在；新 Customer Accounts 默认使用邮箱一次性 6 位验证码，主题可用 `/customer_authentication/login?return_to=...` 把用户带回活动页。[Liquid customer](https://shopify.dev/docs/api/liquid/objects/customer)、[Customer accounts](https://help.shopify.com/en/manual/customers/customer-accounts/new-customer-accounts)、[Sign-in redirects](https://shopify.dev/docs/storefronts/themes/sign-in)
- 关联只用于连续体验；**不要把匿名投票强行并入账号级“一人一票”承诺**，因为同一账号登录前可能在多个设备产生多票，仍需明确合并规则。

### 3. 排名、排期和两件库存

- 投票结束时冻结榜单，处理并列规则（建议：有效票相同则按后台预设 priority，再按 product ID 稳定排序），生成不可变 slot。不要在活动进行中按实时票数换商品，否则预告和预约会失真。
- Shopify 原生 Future publishing 能按日期发布整个 product，但不能为 individual variant 设置 future publish；Shopify Flow 有 Scheduled time trigger，可按计划重复运行，最短 10 分钟。[Future publishing](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/future-publishing)、[Flow Scheduled time](https://help.shopify.com/en/manual/shopify-flow/reference/triggers/scheduled-time) 这些能力可辅助固定排期，但“根据冻结榜单生成 slot + 精确放 2 件 + 回写状态”仍建议由 App scheduler 统一负责。
- 每个 slot 使用**独立的秒杀专用商品或 variant**，并优先使用专用 location，避免与日常可售库存、ERP/3PL 同步互相覆盖。Shopify 官方对 flash sale 也建议预告商品与真正销售商品分开，因为只在主题隐藏 Add to cart 不能阻止购买。[Flash sales](https://help.shopify.com/en/manual/promoting-marketing/sales/flash-sales)
- 可把秒杀商品设为 `UNLISTED` 以避开 Shopify 搜索、Collection、推荐和 Shopify Catalog，但它仍可通过直接 URL、ID、handle 或引用访问并购买，所以 **Unlisted 不是访问控制**。[Unlisted products](https://shopify.dev/docs/apps/build/product-merchandising/unlisted-products)
- App 若确实是该专用库存的唯一 truth source，可用 `inventorySetQuantities` 把 available 设为 2，并带 compare-and-set 与 idempotency key；官方警告只有 source-of-truth 系统才应这样做。否则用增量 `inventoryAdjustQuantities`，同样带幂等键并妥善处理上场剩余库存。[inventorySetQuantities](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorysetquantities)、[inventoryAdjustQuantities](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventoryAdjustQuantities)
- Shopify 会在订单建立后减少 available、增加 committed；库存跟踪本身负责最终的两件售出上限。[Inventory management apps](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps) 页面“剩 1 件”只能是提示，不应作为成交依据。

### 4. 登录、预约、分享与折扣资格

- 预约动作建议只对已登录客户开放：后端给 Customer 写 `bf2026_reserved` tag 或 customer metafield，并在 App DB 记录时间和 campaign。Shopify Forms 也能嵌入 landing page、在提交后加 customer tag 或写 customer metafield，适合“通知预约”；但它本身不等于当前访客已登录或已经满足秒杀资格。[Shopify Forms](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/forms-app/create)、[Forms fields](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/forms-app/settings/all-forms)
- 分享动作必须在规则中明确是 `share_clicked` 还是 `qualified_referral`；只在按钮回调后由 App 记录。不能仅凭客户端传来的布尔值授予高价值资格而不做签名、CSRF/重放与频率控制。
- 原生 automatic/code discount 支持指定 Customer Segment 或 specific customers、指定商品、开始/结束时间；自动折扣在符合条件时作用于 cart/checkout。[Discount eligibility](https://help.shopify.com/en/manual/discounts/managing-discounts)、[Automatic discounts](https://help.shopify.com/en/manual/discounts/discount-methods/automatic-discounts) 这适合让已打 tag 的预约客户获得秒杀价。
- 如果需要“未登录、未预约、未完成分享动作、数量 >1、已抢过的账号一律不能结账”，只靠隐藏按钮或折扣不够。Cart and Checkout Validation Function 在 Shopify 服务器执行，可阻断 cart/checkout，并覆盖 Shop Pay、PayPal、Google Pay、Apple Pay 等 express checkout；Function 输入可读 buyer customer tags/metafields。[Validation Function](https://shopify.dev/docs/api/functions/latest/cart-and-checkout-validation)
- 计划约束：任何套餐可使用包含 Functions 的 App Store 公共应用；**只有 Shopify Plus 店铺能使用含 Shopify Functions 的 custom app**。[Functions availability](https://shopify.dev/docs/apps/build/functions) 非 Plus 若坚持自建 App，只能做较弱方案（专用库存 + 客户定向折扣 + 下单后审计/取消），不能声称具备同等级的 checkout 强制资格校验。

## 库存并发和 Bot Protection

- “两个库存”应交给 Shopify inventory/checkout 做最终仲裁；App 不应自己先返回“抢到”再异步下单。页面加入购物车不代表锁定，用户可能在 checkout 被告知售罄。[Shopify Checkout](https://help.shopify.com/en/manual/checkout-settings/checkout-upgrade)
- Shopify 提供每个 variant 的 maximum quantity per cart，可限制单笔加购数量，但它不是“每个账号整个活动只能成功一次”。后者仍需 Function + 已购标记/订单查询，或订单后风控。[Add-to-cart limit](https://help.shopify.com/en/manual/checkout-settings/add-to-cart-limit)
- hCaptcha 默认用于所有 Shopify 店铺的部分表单/账号防滥用；面向 flash-sale checkout 的额外 Bot protection 仅 Plus，可保护全部或最多 500 个产品，但一次只能排 1 个 event，最长 60 分钟。[Bots](https://help.shopify.com/en/manual/intro-to-shopify/bots/dealing-with-bots)、[Plus bot protection](https://help.shopify.com/en/manual/checkout-settings/bot-protection) 因而多天、每 2 小时一场不能假设 Shopify 原生一次配置后全程覆盖，需确认实际运营排程与风险承受度。

## Demo 建议边界

本轮 Demo 可以真实完成：响应式活动页、候选商品投票、Cookie/localStorage 轻量一票、榜单、预告/倒计时/live/sold-out 状态演示、登录回跳、预约/分享步骤 UI、假库存和状态切换。

Demo 不应宣称已经完成：防刷投票、跨设备一人一票、真实两件库存并发、5 分钟锁库存、外部社媒“分享成功”验证、不可绕过的 checkout 资格、Plus bot protection。

### 发布到 GitHub Pages 时的准确口径

GitHub Pages 是静态托管，因此可以发布一个高保真的**前端业务流程模拟**：候选商品、投票排序、浏览器本地一票、登录/预约/分享的演示状态、倒计时以及预告/live/售罄切换都可在浏览器内运行。为了便于评审，还可以提供“时间加速/状态切换/重置演示数据”控件。

但静态 Demo 不能直接拥有 Shopify Admin API 密钥，也没有可信数据库、scheduler、App Proxy、Shopify Customer session、真实 inventory/discount/checkout Function。若从 GitHub Pages 直接跳 Shopify 商品或 checkout，那个跳转只证明链接有效，**不证明资格、两件库存或投票排名已经与 Shopify 打通**。页面必须清楚标注 `Interactive prototype — inventory, login and checkout are simulated`，并把真实结账按钮命名为“查看 Shopify 接入流程”或保持禁用，避免误导。

从静态 Demo 升级到真实 Shopify 时，视觉组件可以迁移为 Shopify theme section/theme app block，但以下部分必须重做为服务端能力：投票 API 与唯一约束、Customer 绑定、冻结榜单、两小时 scheduler、库存 mutation、资格写入、checkout validation、订单回写与风控。不要把 GitHub Pages 代码原样塞进主题后就视为生产上线。

进入生产前还需确认：

1. 当前 Shopify 套餐是否 Plus；若不是，是否接受安装公共 App，或接受较弱的下单后审计方案。
2. “分享”按点击完成，还是必须有 1 个有效邀请访问/预约。
3. 一人限购口径是每场 1 件，还是整个黑五活动 1 件；身份键是 Customer ID 还是还要叠加邮箱、手机号、地址/支付风险信号。
4. 未售出的 slot 库存是立即回收、顺延到下一场，还是转常规销售。
5. 秒杀价用独立专用 SKU 价格，还是定向折扣；若用折扣，要明确与站内其他优惠能否叠加。
