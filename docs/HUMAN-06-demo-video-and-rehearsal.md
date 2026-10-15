# HUMAN-06 — Demo video (OBS) and rehearsals

| Field | Value |
|---|---|
| Needed before | Submission / presentation. After HUMAN-02 (hosted URL). Not a prerequisite of any code wave |
| Time | ~8 h (3 rehearsals, recording, edit) |
| Cost | $0. OBS Studio 32.2.2 (free, [download](https://obsproject.com/download)); CapCut free tier for captions ([CapCut](https://www.capcut.com/tools/auto-caption-generator)) |
| Env vars | none (record in replay mode) |

## Steps

1. Install OBS from https://obsproject.com/download. Create a scene: Window Capture (browser) + mic, 1920×1080, 30 fps, MP4. Record a 10 s test clip and play it back ([A17](../../../AI/loop-research/scratchpads/A17-deploy-video.md)).
2. Open the hosted URL in a clean browser profile at 125% zoom. Close other tabs and notifications.
3. Rehearse the [PLAN-00 §3](PLAN-00-overview.md#3-audience-demo-script-300) script 3 times from a cold start. On rehearsal 2, cut the network after the page loads: sabotage and arm toggle must still work (client-side checker + recorded outputs). Log beat timings; the sabotage beat must show the flag in < 1 s.
4. Record the full 3:00 run in one take. Also record a ≤ 105 s cut for the video submission (hook 3 s → problem 15 s → demo 60 s → patterns 20 s → impact 15 s, [FINAL-REPORT](../../../AI/loop-research/FINAL-REPORT.md)).
5. Add captions in CapCut. Keep the on-screen `RECORDED` / `SAMPLE — hand-authored` labels visible; do not crop them out.
6. Upload to YouTube (unlisted is fine). Put the link in `README.md` line 6 (replace `<TBD>`), commit, push.
7. Keep the MP4 on the presenting laptop as the offline `FALLBACK — recorded` for the live slot. Never retry a failed live step on stage.

## Verification

```bash
grep -Eq "youtu\.?be" README.md && echo OK
```
