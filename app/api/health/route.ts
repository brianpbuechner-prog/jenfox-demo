export function GET() {
  return Response.json({
    ok: true,
    airtable: Boolean(process.env.AIRTABLE_TOKEN),
    password: Boolean(process.env.SITE_PASSWORD),
  });
}
