import { NextRequest, NextResponse } from "next/server";
import { buildPdf } from "@/lib/pdf-maker";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_NAME = 60;
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const name = (form.get("name") as string | null)?.trim() ?? "";
    if (!name || !/[a-zA-Z]/.test(name))
      return NextResponse.json(
        { error: "Name must contain at least one letter." },
        { status: 400 },
      );
    if (name.length > MAX_NAME)
      return NextResponse.json(
        { error: `Name must be under ${MAX_NAME} characters.` },
        { status: 400 },
      );

    const indexNumber = (form.get("indexNumber") as string | null)?.trim() ?? "";
    if (!indexNumber)
      return NextResponse.json(
        { error: "Index number is required." },
        { status: 400 },
      );

    const programOfStudy = (form.get("programOfStudy") as string | null)?.trim() ?? "";
    if (!programOfStudy)
      return NextResponse.json(
        { error: "Program of study is required." },
        { status: 400 },
      );

    const ghanaCardNumber = (form.get("ghanaCardNumber") as string | null)?.trim() ?? "";
    if (!ghanaCardNumber)
      return NextResponse.json(
        { error: "Ghana Card number is required." },
        { status: 400 },
      );

    const files = [form.get("image1") as File | null, form.get("image2") as File | null];
    for (let i = 0; i < 2; i++) {
      const f = files[i];
      if (!f || !(f instanceof File))
        return NextResponse.json(
          { error: "Two images are required." },
          { status: 400 },
        );
      if (!ALLOWED.has(f.type))
        return NextResponse.json(
          { error: `Photo ${i + 1} must be JPEG, PNG, or WebP.` },
          { status: 400 },
        );
      if (f.size > MAX_FILE)
        return NextResponse.json(
          { error: `Photo ${i + 1} is too large (max 10 MB).` },
          { status: 400 },
        );
    }

    const [buf1, buf2] = await Promise.all(
      files.map((f) => f!.arrayBuffer().then((ab) => Buffer.from(ab))),
    );

    const pdf = await buildPdf(name, indexNumber, programOfStudy, ghanaCardNumber, buf1, buf2);
    const safeName =
      name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim() || "document";

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF." },
      { status: 500 },
    );
  }
}
