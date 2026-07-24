# 业务模块速览

> 本文是 `apps/yishan-api/src/modules/` 下已落地的 **业务模块** 的速查手册。
>
> 配套阅读：
> - 新建模块的脚手架流程 → 根目录 `docs/module-onboarding.md`
> - 4 层分层、Repository / Service 写法、权限码、字段命名 → 本目录 `module-pattern.md`
>
> 读完本文你应该知道：每个模块暴露什么路由、有什么实体、用了什么权限码、seed 装了什么数据。

## 总览

| 模块 | `meta.id` | 路由 prefix | 实体数 | 表数 | 权限码数 |
|---|---|---|---|---|---|
| `demo` | `demo` | `/api/demo` | 1 | 1 | 0(参考模块) |
| `portal` | `portal` | `/api/portal` | 4 | 5 | 20 |
| `shop` | `shop` | `/api/shop` | 5 | 8 | 20 |

启用 / 停用的源头是 `sys_module.enabled`；首次 sync 用 `meta.enabled` 兜底，之后行内 `enabled` 永不被覆盖。dev-only 的 `/admin/system/module-management` 页面可以 toggle。

---

## portal — 门户

模块入口：`apps/yishan-api/src/modules/portal/`，prefix `/api/portal/v1`。

### 实体关系

```
portal_categories ──┐
                    │  N:M(经 portal_article_categories 桥接)
portal_articles ────┘
portal_articles ──(可选)── portal_templates (type = 0, 文章模板)
portal_pages ──────(可选)── portal_templates (type = 1, 页面模板)
```

5 张表都遵循基线字段（`creator_id / created_at / updater_id / updated_at / deleted_at / version`），命名以前缀 `portal_` 开头。

### 实体字段速览

| 表 | 关键字段 | 备注 |
|---|---|---|
| `portal_categories` | `name`, `slug`(unique), `parent_id`, `status`, `sort_order` | 树形分类，循环唯一索引 `(parent_id, name)` |
| `portal_articles` | `title`, `slug`(unique), `summary`, `content`(text), `cover_image`, `status`, `is_pinned`, `publish_time`, `attributes`(json), `tags`(json), `template_id` | 多对多映射 category；支持草稿/发布 |
| `portal_article_categories` | `article_id`, `category_id` | 桥接表 |
| `portal_pages` | `title`, `path`(unique), `content`, `status`, `attributes`(json), `template_id` | 静态页面 |
| `portal_templates` | `name`, `type`(0=文章 / 1=页面), `schema`(json), `config`(json), `is_system_default` | 一张表服务两类模板 |

### 路由清单

`portal` 把 4 类实体对外暴露 5 个标准动作 + 1 个特殊动作。

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/portal/v1/categories` | `portal:category:list` | 分类列表 |
| GET | `/api/portal/v1/categories/:id` | `portal:category:list` | 分类详情 |
| POST | `/api/portal/v1/categories` | `portal:category:create` | 新建分类 |
| PATCH | `/api/portal/v1/categories/:id` | `portal:category:update` | 更新分类 |
| DELETE | `/api/portal/v1/categories/:id` | `portal:category:delete` | 删除分类(软删) |
| GET | `/api/portal/v1/articles` | `portal:article:list` | 文章列表(支持 `keyword / status / categoryId / templateId` 过滤) |
| GET | `/api/portal/v1/articles/:id` | `portal:article:list` | 文章详情(含 `categoryIds`) |
| POST | `/api/portal/v1/articles` | `portal:article:create` | 新建文章 |
| PATCH | `/api/portal/v1/articles/:id` | `portal:article:update` | 更新文章(含 `categoryIds` 整集合替换) |
| DELETE | `/api/portal/v1/articles/:id` | `portal:article:delete` | 删除文章 |
| POST | `/api/portal/v1/articles/:id/publish` | `portal:article:publish` | 发布 / 下线 |
| GET / POST / PATCH / DELETE | `/api/portal/v1/pages` 系 | `portal:page:*` | 页面 CRUD |
| GET / POST / PATCH / DELETE | `/api/portal/v1/article-templates` 系 | `portal:article-template:*` | 文章模板(type=0) |
| GET / POST / PATCH / DELETE | `/api/portal/v1/page-templates` 系 | `portal:page-template:*` | 页面模板(type=1) |

`templates` 表用 `type` 字段区分两类模板，路由层做拆分。`ArticleListQuerySchema` 继承 `PaginationQuerySchema`（`page / pageSize`）。

### 权限码

集中在 `apps/yishan-api/src/modules/portal/permissions.ts`，模式：`<module>:<entity>:<action>`，按实体分 4-5 个动作。

```
portal:category:list / create / update / delete
portal:article:list / create / update / delete / publish
portal:page:list / create / update / delete
portal:article-template:list / create / update / delete
portal:page-template:list / create / update / delete
```

### Sample 数据

`seed.ts` 跑 `db:seed` 时会插入：

- 3 个分类：`news` / `notice` / `blog`
- 4 篇文章（含一篇《密码忘了怎么办？看这里》——把 sys_user 的密码改动路径写实，作为新人上手的查阅手册）
- 3 个页面：`/home` / `/about` / `/contact`
- 2 个模板：默认文章模板 / 默认页面模板

所有 sample 都按 `slug` / `path` 做幂等 upsert，重复 `db:seed` 不会重复插入。

---

## shop — 商城

模块入口：`apps/yishan-api/src/modules/shop/`，prefix `/api/shop/v1`。

### 实体关系

```
shop_categories
  └── shop_products (1:N)
         ├── shop_product_skus (1:N)
         │      └── shop_sku_attributes (N:M, attr + value)
         └── shop_orders 是另一根，独立
shop_attributes
  └── shop_attribute_values (1:N)
shop_orders ──shop_order_items (1:N)
```

8 张表都遵循基线字段。价格字段统一 `decimal(10, 2)`。

### 实体字段速览

| 表 | 关键字段 | 备注 |
|---|---|---|
| `shop_categories` | `name`, `parent_id`, `cover_image`, `icon`, `sort_order`, `status` | 树形分类 |
| `shop_attributes` | `name`, `type`, `sort_order`, `status` | 规格属性(type 表示规格 / 参数) |
| `shop_attribute_values` | `attribute_id`, `value`, `image`, `sort_order` | 属性的可选值 |
| `shop_products` | `category_id`, `name`, `subtitle`, `cover_image`, `images`(json), `price`, `cost_price`, `stock`, `unit`, `weight`, `is_hot`, `is_new`, `click_count` | 商品 SPU |
| `shop_product_skus` | `product_id`, `sku_code`(unique), `sku_name`, `price`, `cost_price`, `stock`, `weight`, `cover_image` | 商品 SKU |
| `shop_sku_attributes` | `sku_id`, `attribute_id`, `value_id` | SKU 的属性组合 |
| `shop_orders` | `order_no`(unique), `user_id`, `total_amount`, `freight_amount`, `discount_amount`, `pay_amount`, `pay_status`, `pay_time`, `pay_method`, `pay_transaction_id`, `order_status`, `express_company`, `express_no`, `deliver_time`, `receive_time`, `cancel_reason`, `remark` | 订单主表 |
| `shop_order_items` | `order_id`, `product_id`, `sku_id`, `sku_name`, `cover_image`, `product_name`, `price`, `quantity`, `subtotal` | 订单明细 |

### 路由清单

| 实体 | 5 个标准动作 |
|---|---|
| `categories` | `GET /api/shop/v1/categories` 等 — 权限：`shop:category:*` |
| `attributes` | `GET /api/shop/v1/attributes` 等 — 权限：`shop:attribute:*` |
| `products` | `GET /api/shop/v1/products` 等 — 权限：`shop:product:*` |
| `skus` | `GET /api/shop/v1/skus` 等 — 权限：`shop:sku:*` |
| `orders` | `GET /api/shop/v1/orders` 等 — 权限：`shop:order:*` |

每个实体都是 `list / create / update / delete` 四件套的数组驱动注册，与 portal 同一套模板。

### 权限码

20 个，4 个动作 × 5 个实体。

```
shop:category:list / create / update / delete
shop:attribute:list / create / update / delete
shop:product:list / create / update / delete
shop:sku:list / create / update / delete
shop:order:list / create / update / delete
```

### Sample 数据

`shop/seed.ts` 只 upsert 菜单 + 权限码绑定，**不带业务 sample**（订单、商品涉及价格与库存，留给测试层用 factory 生成）。

---

## 调用对照

数据流：

```
前端 src/modules/<id>/pages/...
  → @/services/generated/<module>.ts (openapi 生成)
  → /api/<id>/v1/...
  → routes/v1/index.ts (RouteDecl[] + createRouteRegistrar)
  → services/*.service.ts (constructor db 注入)
  → repositories/*.repository.ts (静态方法, 唯一接 drizzleDb)
  → db/schema.ts (Drizzle table)
```

每一层只能向下调用，不能反向或跨层：

- `repositories/` 是模块内**唯一**能 `import drizzleDb / @/db` 的层
- `services/` 只能依赖 `repositories/`
- `routes/v1/index.ts` 只能依赖 `services/`
- 不能跨模块 join 本模块表以外的表（跨模块数据走 HTTP / Core extension）

字段命名约定（**所有 sql_* 核心表以外**的新表都按此规则）：

| 列 | 类型 | 含义 |
|---|---|---|
| `id` | `int AUTO_INCREMENT PK` | 主键 |
| `creator_id` | `int` | 创建者 user id |
| `created_at` | `datetime DEFAULT CURRENT_TIMESTAMP(0)` | 创建时间 |
| `updater_id` | `int` | 更新者 user id |
| `updated_at` | `datetime DEFAULT CURRENT_TIMESTAMP(0)` | 更新时间 |
| `deleted_at` | `datetime NULL` | 软删时间(`null` 表示未删) |
| `version` | `int DEFAULT 1` | 乐观锁版本号 |
| `status` | `tinyint DEFAULT 1` | 业务状态(0=禁用, 1=启用) |

详细分层与代码模板见 `module-pattern.md`。
