import { redirect } from "next/navigation";

/**
 * QR 短链接跳转页
 * 广告/传单上的二维码指向 primeswimacademy.com/go，
 * 通过环境变量 QR_GO_REDIRECT 控制跳转目标，无需更换二维码。
 *
 * 在 .env.local 中设置，例如：
 *   QR_GO_REDIRECT=/              → 首页
 *   QR_GO_REDIRECT=/tryout        → 试课页
 *   QR_GO_REDIRECT=https://...    → 任意完整 URL
 */
export default function GoPage() {
  const destination =
    process.env.QR_GO_REDIRECT?.trim() || "/";

  if (destination.startsWith("http://") || destination.startsWith("https://")) {
    redirect(destination);
  }

  redirect(destination.startsWith("/") ? destination : `/${destination}`);
}
