# 移动端表单与列表 设计规范

适用范围：`apps/demo/app`（Taro 4 + React 18，小程序 / H5 / App）。
本文是**强约束**：新增或改造任何表单 / 详情 / 列表页都必须遵循，不得自行发明排布。

配套组件（两个家族视觉上已收敛，优先用 `management` 那套）：

| 组件 | 路径 | 适用 |
|---|---|---|
| `FormField` / `TextField` / `SegmentField` / `FormSection` / `FormSubmitBar` | `components/management/FormLayout.tsx` | **新增代码一律用这套** |
| `FormField`（`type: input/textarea/switch/picker`） | `components/molecules/FormField/FormField.tsx` | 存量页面，已按本规范改造 |

---

## 1. 表单行：label 在左，取值在右

**永远不要把 label 放在输入框上方。** 上下堆叠会把表单撑成两倍高度，移动端首屏能看到的字段数减半。

```
用户名             张三
真实姓名                李四
手机号 *          13800136721
```

- label：固定宽度 `76px`，`flex-shrink: 0`，左对齐，`--color-text-secondary`
- 控件：`flex: 1; min-width: 0`，**右对齐**
- 行高：`min-height: var(--list-item-height-sm)`（48px），行间距用 token，不要写死

**例外：多行文本（textarea）保持左对齐**，右对齐的多行文本无法阅读。

### 1.1 枚举字段（状态 / 性别）用 Picker，不用分段控件

状态、性别这类**单选枚举**一律做成 picker 行：默认只显示文案，右侧带 `›`，点击唤起原生选择器。

```tsx
<Picker mode="selector" range={options} value={Number(code)} onChange={...}>
  <View className={styles.pickerValue}>
    <Text>{options[Number(code)]}</Text>
    <LineIcon name="chevronRight" size={16} color="#C9CDD4" />
  </View>
</Picker>
```

**不要用分段控件（SegmentField）**——它会把整行撑成一个通栏的胶囊组，和周围的行不在同一个视觉层级上；也不用 `Taro.showActionSheet`——多一层弹窗，且丢失了「当前值是什么」的上下文。

### 1.2 Taro `Picker` 必须显式撑满

H5 下 `Picker` 渲染成一个独立 `div`，不是 flex 子项，内部的 `flex: 1` 不参与布局。必须给 `Picker` 本身加类：

```scss
.picker {
  flex: 1;
  min-width: 0;
  display: block;
}
.pickerValue {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}
```

不写这个，取值不会贴到行尾（曾经踩过）。

---

## 2. 必填：红色星号在 label 之前

```
* 手机号          13800136721
```

- 用 `::before { content: '*' }` 或前置 `<Text>`，**不要**用 `::after`
- label 列只有 76px，星号放后面会被挤掉、放前面才看得见
- 必填集合必须**与校验函数一致**，不允许两处各写一份。以 `edit/model.ts` 的 `validateUserForm` 为准：当前只有 `phone` 必填；`birthDate` 是「填了才校验格式」，**不是必填**

---

## 3. 禁用：整行弱化，不要灰底块，不要说明行

```
用户名             wanglei_demo     ← label 与值同为 tertiary
```

- **禁止**给禁用输入框加灰色底块 —— 它会让这一行看起来像另一种控件，比不禁用还显眼
- **禁止**在行下方加「创建后不可修改」这类说明行 —— 它把行高撑大一截，整张表单明显变长
- 做法：label 与取值**同时**用 `--color-text-tertiary`，加 `cursor: not-allowed`
- 行高与普通行保持一致，靠颜色区分即可

---

## 4. 有 placeholder 就不加 tip

**placeholder 已经说明了格式或语义，就不要再加一行 tip/hint/note。** 两处说同一件事是噪音。

| 场景 | 写法 |
|---|---|
| 密码编辑态「留空不修改」 | `placeholder="留空则不修改"`，不加 note |
| 密码新建态格式要求 | `placeholder="请输入初始密码"`，**不加** note |
| 手机号必填 | label 前加 `*`，不加 tip |

只有在 placeholder **放不下**或需要常驻可见（如密码强度规则）时才用 `note`，且一行只允许一条。

---

## 5. 分组：灰色小标题 + 无圆角贴边白底

**禁止白卡。** 每个分组一张带圆角和阴影的白卡，是 PC 布局直接搬过来的痕迹。

```
页面底色（--color-bg-base）
────────────────────────────
基础信息              ← 13px tertiary，浮在底色上
────────────────────────────
用户名            张三   ← 无圆角、全出血白底
────────────────────────────
```

- 分组容器：**不加横向 padding、不加圆角、不加阴影**
- 横向内边距（`var(--space-4)`）由**各行自带**，这样同一套行组件（`OrganizationPicker` 等）能在不同容器里复用
- 标题：`--font-size-13`、`--color-text-tertiary`、`--font-weight-regular`

---

## 6. 跳转型控件带 `›`

点击后进入另一个页面/选择器的控件，右侧一律有箭头，传达「可跳转」：

- 日期选择
- 部门 / 角色等组织关系行（`OrganizationPicker`）
- 任何 `LinkRow`

复用已有的 `LineIcon name="chevronRight"`，不要引入新图标。

**纯展示行不要给箭头** —— 详情页的组织关系只读展示，不带箭头也不可点击，避免让用户误以为能改。

---

## 7. 错误与说明

- 错误文字：`--color-danger`、`--font-size-12`、**右对齐**
- 同一次渲染中 `error` 优先于 `note`，两者不同时显示
- 禁用态下不显示错误

---

## 8. 其它约定

- **分段控件**（`SegmentField`）右对齐、宽度自适应内容，不要通栏拉满；3 个以内选项优先用分段控件而不是 ActionSheet
- **枚举取值**：后端码值与文案必须一一对应（数组下标即 value），详情页展示文案、提交码值，不要直接渲染码值
- **留空即不修改**：编辑态的可选字段（如密码），空值**不进 update payload**（`if (password) payload.password = password`），不要发空串
- 所有颜色/间距/圆角一律 `var(--token)`，禁止写死值

---

## 快速自查

改完表单页，对照检查：

- [ ] 没有任何一处 label 在控件上方
- [ ] 必填星号在 label 前面，且必填集合 = 校验函数里的必填集合
- [ ] 禁用行没有灰底块、没有多余说明行，行高和普通行一致
- [ ] 有 placeholder 的字段下面没有 tip
- [ ] 分组不是白卡，标题是灰色小标题浮在页面底色上
- [ ] 可跳转的行都有 `›`，纯展示行没有
- [ ] 状态/性别是 picker 行（文案 + ›），不是分段控件
- [ ] 日期 Picker 撑满了整行（`.picker { flex: 1 }`）
- [ ] textarea 左对齐，其余控件右对齐