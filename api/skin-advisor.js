export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbw9oNvan-bC9_ekfwfd-X2KiCpcTFwa4uhqK8tvigWN2wiAhMrhd4cAyYeWB_X9nMAkww/exec";

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(200).json(data);

    // Guardar en Google Sheets (sin bloquear la respuesta)
    try {
      const texto = data.content?.[0]?.text || "";
      const parsed = JSON.parse(texto.replace(/```json|```/g, "").trim());
      const perfil = req.body.messages?.[0]?.content;
      const textoPerfil = Array.isArray(perfil)
        ? perfil.find(p => p.type === "text")?.text || ""
        : perfil || "";

      const nombreMatch  = textoPerfil.match(/Clienta:\s*([^,]+)/);
      const edadMatch    = textoPerfil.match(/(\d+)\s*años/);
      const ciudadMatch  = textoPerfil.match(/años,\s*([^\n]+)/);
      const preocMatch   = textoPerfil.match(/Preocupaciones:\s*([^\n]+)/);
      const medicoMatch  = textoPerfil.match(/Estado médico:\s*([^\n]+)/);
      const nivelMatch   = textoPerfil.match(/Nivel de rutina:\s*([^\n]+)/);

      const payload = {
        nombre:             nombreMatch?.[1]?.trim() || "",
        edad:               edadMatch?.[1] || "",
        ciudad:             ciudadMatch?.[1]?.trim() || "",
        tipo_piel:          parsed.evaluacion_piel?.tipo_detectado || "",
        preocupaciones:     preocMatch?.[1]?.trim() || "",
        estado_medico:      medicoMatch?.[1]?.trim() || "",
        nivel_rutina:       nivelMatch?.[1]?.trim() || "",
        ingredientes_clave: parsed.vista_advisor?.ingredientes_clave_a_buscar || [],
        nivel_ticket:       parsed.vista_advisor?.nivel_ticket || "",
        diagnostico:        parsed.vista_advisor?.diagnostico_comercial || ""
      };

      await fetch(SHEETS_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ data: JSON.stringify(payload) }).toString(),
  redirect: "follow"
});
    } catch(sheetErr) {
      console.error("Sheet error:", sheetErr.message);
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
