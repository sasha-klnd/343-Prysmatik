from datetime import datetime


def urbix_email_html(
    *,
    title: str,
    subtitle: str,
    badge: str | None = None,
    rows: list[tuple[str, str]] | None = None,
    cta_text: str | None = None,
    cta_url: str | None = None,
    footer_note: str = "UrbiX • Montreal",
) -> str:
    rows = rows or []
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    # Gmail-safe HTML (no JS, minimal CSS, table layout)
    return f"""\
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body style="margin:0;padding:0;background:#07080c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07080c;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:92%;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);">
            <!-- top glow -->
            <tr>
              <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 45%,#22c55e 100%);padding:1px;"></td>
            </tr>

            <!-- header -->
            <tr>
              <td style="background:rgba(255,255,255,0.03);backdrop-filter:blur(14px);padding:22px 24px 14px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;">
                      <div style="font-size:14px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
                        URBIX
                      </div>
                      <div style="margin-top:10px;font-size:22px;font-weight:800;line-height:1.2;">
                        {title}
                      </div>
                      <div style="margin-top:8px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.75);">
                        {subtitle}
                      </div>
                    </td>
                    <td align="right" style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;">
                      {f'''
                      <span style="
                        display:inline-block;
                        padding:8px 12px;
                        border-radius:999px;
                        font-size:12px;
                        font-weight:700;
                        color:#ffffff;
                        background:rgba(34,197,94,0.18);
                        border:1px solid rgba(34,197,94,0.35);
                        ">
                        {badge}
                      </span>
                      ''' if badge else ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- content card -->
            <tr>
              <td style="background:#0b0d14;padding:18px 24px 22px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="border-radius:16px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.02);">
                  <tr>
                    <td style="padding:18px 18px 14px 18px;">
                      {''.join([
        f'''
                        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:10px;">
                          <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.55);">
                            {k}
                          </div>
                          <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#ffffff;text-align:right;">
                            {v}
                          </div>
                        </div>
                        <div style="height:1px;background:rgba(255,255,255,0.06);margin:10px 0;"></div>
                        '''
        for (k, v) in rows
    ])}
                      <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.45);margin-top:6px;">
                        Sent {now}
                      </div>
                    </td>
                  </tr>
                </table>

                {f'''
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  <tr>
                    <td>
                      <a href="{cta_url or '#'}"
                        style="
                          display:inline-block;
                          padding:12px 16px;
                          border-radius:14px;
                          font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;
                          font-size:14px;
                          font-weight:800;
                          text-decoration:none;
                          color:#ffffff;
                          background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#22c55e 120%);
                          border:1px solid rgba(255,255,255,0.14);
                        ">
                        {cta_text}
                      </a>
                    </td>
                  </tr>
                </table>
                ''' if cta_text else ''}

                <div style="margin-top:18px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.45);">
                  {footer_note}
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
