/** Submit notifications go to Evan in Slack. The app never emails anyone. */
export async function notifySlack(env: Env, text: string): Promise<boolean> {
  const url = env.SLACK_WEBHOOK_URL;
  if (!url || !/^https:\/\/hooks\.slack\.com\//.test(url)) return false;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    return res.ok;
  } catch {
    return false;
  }
}
