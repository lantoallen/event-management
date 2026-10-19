import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { APP_NAME, SITE_URL } from "@/lib/config";

export const alt = `${APP_NAME}: register for events and get a QR ticket`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The preview shown when the link is shared in chats and on LinkedIn.
export default async function Image() {
  // A real QR code (it opens the site) and the app icon.
  const qr = await QRCode.toDataURL(SITE_URL, { margin: 0, width: 136, color: { dark: "#1d1b18", light: "#ffffff" } });
  const icon = `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), "src/app/icon.svg"))).toString("base64")}`;
  const ticket = { border: "2px solid #cfcbc2", borderRadius: 16, background: "#ffffff" };
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f7f6f3", padding: 72, color: "#1d1b18" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
            <img src={icon} width={56} height={56} alt="" />
            {APP_NAME}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 640 }}>
              Event registration with QR tickets and door check-in
            </div>
            <div style={{ fontSize: 28, color: "#6a655d", maxWidth: 640 }}>A demo project by Allen Lanto</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 340, alignSelf: "center", ...ticket }}>
          <div style={{ display: "flex", flexDirection: "column", padding: 28, gap: 8 }}>
            <div style={{ fontSize: 18, color: "#6a655d" }}>Tue, Oct 20, 7:00 PM</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>Open mic night</div>
            <div style={{ fontSize: 18, color: "#17703f" }}>You&apos;re going</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 28, borderTop: "2px dashed #cfcbc2", background: "#f0eee9", borderRadius: "0 0 16px 16px" }}>
            <div style={{ display: "flex", background: "#ffffff", padding: 12 }}>
              <img src={qr} width={136} height={136} alt="" />
            </div>
            <div style={{ marginTop: 16, fontSize: 24, letterSpacing: 4, fontFamily: "monospace" }}>YPLEH-CEALY</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
