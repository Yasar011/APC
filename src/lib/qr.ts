import QRCode from "qrcode";

/**
 * Renders a QR to a data URL. Error-correction level M survives a cracked
 * or smudged phone screen at the bus door without bloating the image.
 */
export async function qrDataUrl(payload: string, size = 240) {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
