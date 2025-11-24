# 自动续费提醒邮件系统

## 功能概述

系统会自动每周运行一次，检查所有 swimmers 的会员状态，并向 `due_soon` 和 `grace` 状态的 swimmers 的家长发送续费提醒邮件。

## 配置

### 1. Vercel Cron Job

已在 `vercel.json` 中配置：
```json
{
  "crons": [
    {
      "path": "/api/admin/send-renewal-reminders-auto",
      "schedule": "0 10 * * 1"
    }
  ]
}
```

**运行时间**：每周一上午 10:00 UTC（转换为本地时间：PST/PDT 大约是上午 2:00-3:00）

### 2. 发送条件

系统会自动发送提醒邮件给符合以下条件的 swimmers：

- ✅ 状态为 `due_soon` 或 `grace`
- ✅ 有 `parentEmail`
- ✅ 没有被冻结（`isFrozen !== true`）

### 3. 邮件模板

- **Due Soon**: "Membership Renewal Reminder" - 提醒即将到期
- **Grace**: "Membership Past Due – Grace Period" - 宽限期内提醒

邮件包含：
- Swimmer 姓名和到期日
- 续费步骤说明
- 登录链接
- 联系方式

## 测试

### 发送测试邮件

1. 在 Admin Swimmers 页面
2. 点击 "Send Test Email" 按钮
3. 测试邮件会发送到你的管理员邮箱

### 手动触发自动发送

可以通过 API 手动触发（需要管理员权限）：

```bash
curl -X POST https://your-domain.com/api/admin/send-renewal-reminders-auto \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

## 监控

API 会返回详细的执行结果：

```json
{
  "ok": true,
  "sent": 5,
  "failed": 0,
  "total": 5,
  "timestamp": "2025-11-23T10:00:00.000Z",
  "details": [
    {
      "swimmer": "John Doe",
      "email": "parent@example.com",
      "status": "due_soon",
      "success": true
    }
  ]
}
```

## 注意事项

1. **只在生产环境运行**：Vercel Cron Jobs 只在生产环境（production）触发，预览部署不会执行
2. **时区**：Cron 时间使用 UTC，请根据你的时区调整
3. **邮件发送限制**：确保 Resend API key 有足够的发送配额
4. **重复发送**：系统每周运行一次，可能会重复发送给同一批 swimmers（这是预期的行为）

## 修改运行频率

如果需要修改运行频率，编辑 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/admin/send-renewal-reminders-auto",
      "schedule": "0 10 * * 1"  // 每周一 10:00 UTC
    }
  ]
}
```

常见 Cron 表达式：
- `"0 10 * * 1"` - 每周一 10:00 UTC
- `"0 10 * * 0"` - 每周日 10:00 UTC
- `"0 10 1 * *"` - 每月 1 号 10:00 UTC
- `"0 10 * * *"` - 每天 10:00 UTC（不推荐，太频繁）

