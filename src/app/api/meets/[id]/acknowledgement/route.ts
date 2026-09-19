import { privateMeetJson } from "@/lib/meets/http";
import { meetAuthError, requireMeetUser } from "@/lib/meets/auth";
import { MeetServiceError, meetServiceStatus } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["notice", "closed_review"]);

function parseAcknowledge(value: unknown): Array<"notice" | "closed_review"> {
  const list = Array.isArray(value) ? value : value != null ? [value] : [];
  return [...new Set(list.filter((item): item is "notice" | "closed_review" => ALLOWED.has(String(item))))];
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMeetUser(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as { swimmerId?: string; acknowledge?: unknown };
    const acknowledge = parseAcknowledge(body.acknowledge);
    if (!body.swimmerId || acknowledge.length === 0) {
      return privateMeetJson({ ok: false, error: "swimmerId and acknowledge are required" }, { status: 400 });
    }
    const commitment = await getMeetService().acknowledgeParentMeet({
      meetId: id,
      swimmerId: body.swimmerId,
      parentUID: user.uid,
      acknowledge,
    });
    return privateMeetJson({ ok: true, commitment });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return privateMeetJson({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return privateMeetJson({ ok: false, error: msg }, { status: meetServiceStatus(e) });
  }
}
