# Private Lesson System Improvements

## 概述

本次改进优化了私教课的预约流程，包括：
1. 改进slot添加流程（支持批量添加和重复模式）
2. 改进booking流程（标记taken时选择学员、自动发送确认邮件）
3. 添加reminder功能（自动提醒和手动提醒）

## 主要改进

### 1. 改进Slot添加流程 (`/admin/slots`)

**新功能：**
- **单次添加模式**：保持原有功能，添加单个slot
- **重复添加模式**：支持批量创建重复的slots
  - 选择开始日期和结束日期
  - 选择星期几（可多选）
  - 设置时间段、教练、地点
  - 一次性创建所有符合条件的slots

**使用场景：**
- 每周固定时间的私教课
- 某个时间段内重复的slots
- 快速创建多个相似slots

### 2. 改进Booking流程 (`/private-lessons`)

**新功能：**
- **选择学员**：标记slot为"taken"时，必须选择一个已注册的学员
- **自动发送确认邮件**：创建booking后自动发送确认邮件给家长
- **保存booking记录**：所有booking信息保存在`privateLessonBookings`集合中
- **添加备注**：可以为每个booking添加备注信息

**Booking数据结构：**
```typescript
{
  slotId: string;           // 关联的slot ID
  swimmerId: string;         // 学员ID（来自privatelessonstudents）
  swimmerName: string;       // 学员姓名
  parentEmail: string;       // 家长邮箱
  parentName?: string;       // 家长姓名
  parentPhone?: string;      // 家长电话
  coachId: number;          // 教练ID
  locationId: number;       // 地点ID
  startTime: Timestamp;     // 开始时间
  endTime: Timestamp;       // 结束时间
  status: "confirmed" | "cancelled";
  notes?: string;           // 备注
  reminderSent?: boolean;   // 是否已发送提醒
  reminderSentAt?: Timestamp; // 提醒发送时间
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**确认邮件内容：**
- 课程日期和时间
- 教练姓名
- 地点
- 备注信息（如有）
- 温馨提示

### 3. Reminder功能

**自动提醒：**
- **Cron Job**：每天上午9:00 UTC（约凌晨1-2点 PST/PDT）自动运行
- **触发条件**：课程开始前24小时（明天上课的课程）
- **发送对象**：所有已确认但未发送提醒的bookings
- **邮件内容**：课程提醒，包含日期、时间、教练、地点

**手动提醒：**
- Admin可以通过API手动发送提醒
- 适用于特殊情况或需要立即提醒的情况

**API端点：**
- `GET /api/private-lessons/reminder` - 自动发送提醒（由cron调用）
- `POST /api/private-lessons/reminder` - 手动发送提醒（需要admin权限）

## API文档

### Booking API (`/api/private-lessons/booking`)

#### GET - 获取bookings
```
GET /api/private-lessons/booking?slotId=xxx&swimmerId=xxx&status=confirmed
```

**查询参数：**
- `slotId` (可选) - 按slot ID筛选
- `swimmerId` (可选) - 按学员ID筛选
- `status` (可选) - 按状态筛选（confirmed/cancelled）

**返回：**
```json
{
  "bookings": [
    {
      "id": "booking-id",
      "slotId": "slot-id",
      "swimmerId": "swimmer-id",
      "swimmerName": "John Doe",
      "parentEmail": "parent@example.com",
      ...
    }
  ]
}
```

#### POST - 创建booking
```
POST /api/private-lessons/booking
Authorization: Bearer <id-token>
Content-Type: application/json

{
  "slotId": "slot-id",
  "swimmerId": "swimmer-id",
  "notes": "Optional notes"
}
```

**功能：**
- 创建booking记录
- 更新slot状态为"taken"
- 自动发送确认邮件

#### PUT - 更新booking
```
PUT /api/private-lessons/booking
Authorization: Bearer <id-token>
Content-Type: application/json

{
  "id": "booking-id",
  "status": "cancelled",
  "notes": "Updated notes"
}
```

**功能：**
- 更新booking状态或备注
- 如果状态改为"cancelled"，slot会自动恢复为"available"

### Reminder API (`/api/private-lessons/reminder`)

#### GET - 自动发送提醒（Cron Job）
```
GET /api/private-lessons/reminder
X-Vercel-Cron: 1
```

**功能：**
- 查找所有明天上课的已确认bookings
- 发送提醒邮件
- 标记为已发送

#### POST - 手动发送提醒
```
POST /api/private-lessons/reminder
Authorization: Bearer <id-token>
Content-Type: application/json

{
  "bookingId": "booking-id"
}
```

## 数据库结构

### `privateLessonBookings` 集合

每个文档包含：
- `slotId`: string - 关联的slot ID
- `swimmerId`: string - 学员ID
- `swimmerName`: string - 学员姓名
- `parentEmail`: string - 家长邮箱
- `parentName`: string (可选) - 家长姓名
- `parentPhone`: string (可选) - 家长电话
- `coachId`: number - 教练ID
- `locationId`: number - 地点ID
- `startTime`: Timestamp - 开始时间
- `endTime`: Timestamp - 结束时间
- `status`: "confirmed" | "cancelled" - 状态
- `notes`: string (可选) - 备注
- `reminderSent`: boolean - 是否已发送提醒
- `reminderSentAt`: Timestamp (可选) - 提醒发送时间
- `createdAt`: Timestamp - 创建时间
- `updatedAt`: Timestamp - 更新时间

## 使用流程

### 添加Slots

1. 访问 `/admin/slots`
2. 选择"Single Slot"或"Recurring Slots"
3. 填写表单信息
4. 点击"Add Slot"或"Create Recurring Slots"

### 预约课程

1. 访问 `/private-lessons`
2. 查看可用slots（日历视图）
3. 点击一个slot（仅admin可见）
4. 在弹出对话框中选择已注册的学员
5. 添加备注（可选）
6. 点击"Confirm Booking"
7. 系统自动：
   - 创建booking记录
   - 更新slot状态为"taken"
   - 发送确认邮件给家长

### 自动提醒

- 系统每天自动运行，查找明天上课的课程
- 自动发送提醒邮件
- 无需手动操作

## 注意事项

1. **Registration是必需的**：只有已注册的学员才能被选择进行booking
2. **Email必需**：学员必须有email地址才能接收确认和提醒邮件
3. **Slot唯一性**：每个slot只能被一个学员预约
4. **Cron Job时区**：Cron job使用UTC时间，每天9:00 UTC运行（约PST/PDT凌晨1-2点）
5. **提醒时间**：提醒在课程开始前24小时发送（明天上课的课程）

## 未来改进建议

1. **Google Calendar集成**：自动同步到Google Calendar
2. **取消/改期功能**：允许取消或改期booking
3. **等待列表**：当slot被占满时，允许加入等待列表
4. **多学员预约**：支持一个slot多个学员（如小组课）
5. **提醒自定义**：允许自定义提醒时间和内容
6. **统计报表**：显示booking统计和收入报表


