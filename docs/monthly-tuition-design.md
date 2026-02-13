# 月度学费与训练计划模块 — 设计方案

## 一、目标

- 每月为每个 swimmer 自动计算**下月学费**和**下月训练计划**（日期 + 时间 + 地点）。
- 学费 = 当月实际训练次数 × 每次小时数 × 单价（$/hour）；单价按 group 默认，可单独为某 swimmer 改写。
- 训练计划格式示例：
  ```
  01/11 7-8PM Mary Wayte Pool
  01/18 7-8PM Mary Wayte Pool
  01/25 7-8PM Mary Wayte Pool
  ```
- 支持「当月无训练日」（泳池关闭/冲突），在计算和排期时排除这些日期。

---

## 二、业务规则摘要

| Group              | 每周训练天数 | 最少选几天 | 默认 $/hour | 选“最少天数”时的 $/hour |
|--------------------|-------------|-----------|-------------|-------------------------|
| Bronze Performance | 2           | 2         | $60         | —                       |
| Silver Beginner    | 3           | 2         | $50         | $60（选 2 天时）        |
| Silver Performance| 4           | 3         | $45         | —                       |
| Gold               | —           | —         | $42         | —                       |

- 每个 swimmer 可单独设置 **rate/hour 覆盖**。
- 每个 swimmer 有自己的**训练星期几**（如 Bronze 周一+周五；Silver Beginner 每人不同：周一+周三、周一+周五、周三+周五等）。
- 每个 swimmer（或按 group 默认）有**时间段**（如 7–8PM）和**地点**（如 Mary Wayte Pool）。
- **无训练日**：管理员为某月勾选「这些日期没有训练」，计算和排期时排除。

---

## 三、数据模型

### 3.1 Level/Group 配置（新建）

存储每个 level 的计费与频次规则，便于以后改价格或规则。

- **集合**: `tuition_level_config`（或单文档 `tuition_config` 内嵌 levels）
- **字段建议**:
  - `level`: string — 与现有 `Swimmer.level` 一致，如 "Bronze Performance", "Silver Beginner"
  - `defaultRatePerHour`: number — 默认 $/hour
  - `daysPerWeek`: number — 该组标准每周几天（2/3/4）
  - `minDaysPerWeek`: number — 最少选几天（如 Silver Beginner=2, Silver Performance=3）
  - `reducedRatePerHour`: number | null — 当 swimmer 只选 min 天时的 $/hour（如 Silver Beginner 选 2 天用 $60）
  - `defaultTimeSlot`: string — 默认时间段，如 "7-8PM"
  - `defaultLocation`: string — 默认地点，如 "Mary Wayte Pool"

说明：若某 level 没有配置，可代码里给默认值或从现有常量读。

### 3.2 Swimmer 扩展（现有 `swimmers` 集合）

在现有 swimmer 文档上增加可选字段（不破坏现有逻辑）：

- **trainingWeekdays**: number[] — 训练日（0=Sun, 1=Mon, …, 6=Sat），如 `[1, 5]` 表示周一、周五
- **trainingTimeSlot**: string | null — 覆盖该 swimmer 的时间段，如 "7-8PM"
- **trainingLocation**: string | null — 覆盖该 swimmer 的地点，如 "Mary Wayte Pool"
- **ratePerHourOverride**: number | null — 覆盖 $/hour（优先于 level 配置）

若未填，则用 level 的 default 或从 level 规则推断（例如 Bronze 固定周一+周五可由 level 默认，Silver Beginner 必须每人设置）。

### 3.3 月度「无训练日」配置（新建）

用于排除泳池关闭、冲突等日期。

- **集合**: `tuition_month_config`（或单文档按 month 为 key）
- **字段建议**:
  - `month`: string — "YYYY-MM"，如 "2026-02"
  - `noTrainingDates`: string[] — 无训练日期，如 ["2026-02-14", "2026-02-21"]

同一月可多次更新（例如后续又知道一天关闭，再补一条日期）。

---

## 四、计算逻辑

### 4.1 某月「可训练日期」按星期几分组

- 输入：月份 `YYYY-MM`、无训练日列表 `noTrainingDates`。
- 生成该月所有日期，按星期几分组：
  - `datesByWeekday[weekday]` = 该月所有为 weekday 的日期，且不在 `noTrainingDates` 中。
- 例如 2026-02：周一为 [2, 9, 16, 23]，若 2/14 关闭则周一为 [2, 9, 16, 23]（2/14 是周六），周五为 [6, 13, 20, 27]。

### 4.2 每个 Swimmer 的当月训练次数与单价

- 取 swimmer 的 `trainingWeekdays`（若无则按 level 默认或跳过/标为需配置）。
- **当月训练次数** = 对每个 `d in trainingWeekdays`，累加 `datesByWeekday[d].length`。
- **小时/次**：固定 1 小时（或以后从 level/swimmer 读）。
- **单价**：
  - 若有 `ratePerHourOverride` → 用该值；
  - 否则用 level 的 `defaultRatePerHour` 或 `reducedRatePerHour`：
    - 若 level 有 `minDaysPerWeek` 且 swimmer 选的 `trainingWeekdays.length === minDaysPerWeek`，且 `reducedRatePerHour != null`，用 `reducedRatePerHour`；
    - 否则用 `defaultRatePerHour`。
- **学费** = 训练次数 × 1（小时） × 单价。

### 4.3 每个 Swimmer 的「下月训练计划」列表

- 对 swimmer 的每个 `trainingWeekdays`，取 `datesByWeekday[weekday]` 的日期列表。
- 合并去重、按日期排序，得到该月所有训练日。
- 每条记录格式：`MM/DD timeSlot location`，例如 "01/11 7-8PM Mary Wayte Pool"。
- 时间与地点：优先用 swimmer 的 `trainingTimeSlot` / `trainingLocation`，否则用 level 的 default。

---

## 五、Admin 功能与页面结构

### 5.1 菜单位置

- Admin 下新增：**Monthly Tuition**（或「月度学费」），入口如 `/admin/monthly-tuition`。

### 5.2 子功能划分

1. **Level 配置**（可选先做）
   - 页面：`/admin/monthly-tuition/levels` 或嵌在「月度学费」页的 Tab。
   - 表格：Level 名称、defaultRatePerHour、daysPerWeek、minDaysPerWeek、reducedRatePerHour、defaultTimeSlot、defaultLocation；支持编辑保存。
   - 可与现有 `SWIMMER_LEVELS` 同步，只维护「有收费规则的」levels。

2. **Swimmer 训练与费率覆盖**
   - 方式 A：在现有「Swimmers」列表/编辑页增加「训练星期几、时间段、地点、费率覆盖」字段。
   - 方式 B：在「月度学费」页提供「按 swimmer 配置」子页，列表展示 swimmer + level，可批量编辑 trainingWeekdays、timeSlot、location、rateOverride。
   - 建议至少支持：trainingWeekdays（必）、timeSlot、location、ratePerHourOverride（可选）。

3. **当月无训练日**
   - 页面：在「月度学费」主流程中，选择月份后，展示该月日历或日期列表，可勾选/取消「无训练」；保存到 `tuition_month_config`。
   - 或简单版：一个「No training dates」多选日期控件（按该月日期列表勾选），保存为 `noTrainingDates`。

4. **下月学费与训练计划（主页面）**
   - 选择月份（默认「下个月」）。
   - 点击「计算」或自动计算：
     - 表格列：Swimmer、Level、训练星期几、当月训练次数、$/hour、学费、操作（查看训练计划）。
   - 支持导出 CSV（Swimmer, Level, Sessions, Rate, Tuition）。
   - 每个 swimmer 可展开或弹窗显示「当月训练计划」列表，格式：
     ```
     01/11 7-8PM Mary Wayte Pool
     01/18 7-8PM Mary Wayte Pool
     01/25 7-8PM Mary Wayte Pool
     ```
   - 可与现有「发学费邮件」流程衔接：从本页带出计算好的 amount + 生成的 practiceText（训练计划文本），跳转或复制到现有 Tuition 发邮件页。

### 5.3 与现有 Tuition 邮件的关系

- 现有 `/admin/tuition`：手动选 swimmer、填 months、practiceText、dueDate、amount 后发邮件。
- 新模块产出：**推荐 amount**、**推荐 practiceText**（由「训练计划」列表格式化成多行文本）。
- 流程建议：在「月度学费」页计算后，每行提供「Copy amount & schedule」或「Send tuition email」按钮，把 amount 和格式化后的 schedule 填入剪贴板或直接打开现有发邮件页并预填。

---

## 六、实现顺序建议

1. **Phase 1 — 数据与配置**
   - 新建 `tuition_level_config` 与默认值（Bronze Performance / Silver Beginner / Silver Performance / Gold）。
   - 新建 `tuition_month_config`，支持按 month 存 `noTrainingDates`。
   - Swimmer 扩展字段：trainingWeekdays, trainingTimeSlot, trainingLocation, ratePerHourOverride（API 与 admin  swimmers 编辑处可稍后接）。

2. **Phase 2 — 计算与主界面**
   - API：给定 month，返回每个 swimmer 的 tuition 与 schedule（读 level config、month config、swimmers）。
   - 页面：选择月份 → 显示表格（Swimmer, Level, Sessions, Rate, Tuition） + 每行可展开/弹窗看训练计划列表（MM/DD time location）。
   - 无训练日：在同上页面选择月份后，可编辑该月 noTrainingDates 并保存。

3. **Phase 3 — Swimmer 配置**
   - 在 admin swimmers 或月度学费下「Swimmer 配置」中，可编辑每个 swimmer 的 trainingWeekdays、timeSlot、location、rateOverride；保存回 Firestore。

4. **Phase 4 — 与发邮件打通**
   - 「Send tuition email」或「Copy schedule」：带出 amount 与格式化 schedule，接现有 tuition invoice 流程。

---

## 七、训练计划文本格式（与邮件一致）

- 每行一条：`MM/DD timeSlot location`
- 例如：
  ```
  01/11 7-8PM Mary Wayte Pool
  01/18 7-8PM Mary Wayte Pool
  01/25 7-8PM Mary Wayte Pool
  ```
- 用于邮件时可合并为一段（换行），与现有 `practiceText` 一致，便于粘贴到现有 Tuition 页的 Practice Details。

---

## 八、边界情况

- Swimmer 无 level：不参与计算或标为「需配置 level」。
- Swimmer 无 trainingWeekdays：不参与计算或标为「需配置训练日」，表格中仍显示该 swimmer，方便补填。
- 某月 level 无配置：使用代码内默认值（见上表），或标为「需配置 level 费率」。
- 无训练日仅影响「该月哪些天可训练」，不改变单价逻辑。

如你确认该设计方向，可以从 Phase 1 开始实现（Level 配置 + 月度无训练日 + Swimmer 扩展字段与读写），再接着做 Phase 2 的计算与主界面。
