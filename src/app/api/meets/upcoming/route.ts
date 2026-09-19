import { privateMeetJson } from "@/lib/meets/http";
import { meetAuthError, requireMeetUser } from "@/lib/meets/auth";
import { MeetServiceError, meetServiceStatus } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestedSwimmerIds(url: URL): string[] {
  const fromList = url.searchParams.getAll("swimmerIds").flatMap((value) => value.split(","));
  const fromOne = url.searchParams.getAll("swimmerId");
  return [...new Set([...fromList, ...fromOne].map((id) => id.trim()).filter(Boolean))];
}

/**
 * Upcoming meets this household Attended, with each swimmer’s selected events.
 * One call for every child, or pass swimmerIds=a,b to limit the household in that same call.
 */
export async function GET(req: Request) {
  try {
    const user = await requireMeetUser(req);
    const swimmerIds = requestedSwimmerIds(new URL(req.url));
    const upcoming = await getMeetService().listUpcomingSwimmerMeets(user.uid, user.email, {
      swimmerIds: swimmerIds.length ? swimmerIds : undefined,
    });
    return privateMeetJson({ ok: true, swimmerIds: swimmerIds.length ? swimmerIds : null, upcoming });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return privateMeetJson({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return privateMeetJson({ ok: false, error: msg }, { status: meetServiceStatus(e) });
  }
}
