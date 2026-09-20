import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const admin = createClient(url, service);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Authentification requise" }, 401);

  const { application_id } = await req.json();
  if (!application_id) return json({ error: "application_id requis" }, 400);

  const { data: reserved, error: reserveError } = await userClient.rpc(
    "reserve_administrative_document",
    { p_application_id: application_id },
  );
  if (reserveError || !reserved) {
    return json({ error: reserveError?.message || "Réservation impossible" }, 400);
  }

  const doc = Array.isArray(reserved) ? reserved[0] : reserved;
  const verificationUrl =
    `https://educo.loukatech.com/?page=V%C3%A9rifier%20un%20document&token=${doc.verification_token}`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("EDUCO — DOCUMENT OFFICIEL", {
    x: 55,
    y: 780,
    size: 18,
    font: bold,
    color: rgb(0.12, 0.29, 0.35),
  });
  page.drawText(doc.document_number, { x: 55, y: 745, size: 12, font: bold });
  page.drawText(`Ministère : ${doc.ministry}`, { x: 55, y: 710, size: 11, font });
  page.drawText(`Type : ${doc.document_type}`, { x: 55, y: 685, size: 11, font });
  page.drawText(`Signataire : ${doc.signer_name}`, { x: 55, y: 645, size: 10, font });
  page.drawText(`Qualité : ${doc.signer_title}`, { x: 55, y: 625, size: 10, font });
  if (doc.legal_reference) {
    page.drawText(`Référence juridique : ${doc.legal_reference}`, {
      x: 55,
      y: 590,
      size: 9,
      font,
    });
  }

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 240 });
  const qr = await pdf.embedPng(
    Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0)),
  );
  page.drawImage(qr, { x: 390, y: 490, width: 125, height: 125 });
  page.drawText("Scanner pour vérifier l'authenticité", {
    x: 350,
    y: 470,
    size: 8,
    font,
  });

  const bytes = await pdf.save();
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const storagePath = `${doc.ministry}/${doc.id}/${doc.document_number}.pdf`;
  const upload = await admin.storage
    .from("official-administrative-documents")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (upload.error) {
    return json({ error: "Stockage impossible", detail: upload.error.message }, 500);
  }

  const { data: finalized, error: finalizeError } = await userClient.rpc(
    "finalize_administrative_document",
    {
      p_document_id: doc.id,
      p_storage_path: storagePath,
      p_sha256: sha256,
    },
  );

  if (finalizeError) {
    await admin.storage
      .from("official-administrative-documents")
      .remove([storagePath]);
    return json({ error: finalizeError.message }, 400);
  }

  return json({
    document: Array.isArray(finalized) ? finalized[0] : finalized,
    verification_url: verificationUrl,
    sha256,
  });
});
