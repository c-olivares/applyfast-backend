// api/webhook.js
// ─────────────────────────────────────────────────────────────────────────────
// Recibe notificaciones de Mercado Pago sobre cambios en suscripciones.
// Mercado Pago llama a este endpoint automáticamente cuando:
//   - Un usuario se suscribe
//   - Un pago mensual se procesa o falla
//   - Un usuario cancela
//
// Configurar en MP Developers → Tu aplicación → Notificaciones webhook:
//   URL: https://tu-app.vercel.app/api/webhook
//   Eventos: subscription_preapproval
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // MP envía tanto GET (para verificar que la URL existe) como POST (notificaciones)
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ApplyFast webhook activo' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = req.body;
    const type = body?.type;
    const dataId = body?.data?.id;

    console.log(`[ApplyFast webhook] tipo=${type} id=${dataId}`);

    // Solo procesar eventos de suscripciones
    if (type === 'subscription_preapproval' && dataId) {
      const token = process.env.MP_ENV === 'production'
        ? process.env.MP_ACCESS_TOKEN_PROD
        : process.env.MP_ACCESS_TOKEN_TEST;

      // Consultar el detalle de la suscripción
      const response = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const sub = await response.json();
        console.log(`[ApplyFast webhook] suscripción ${dataId} estado: ${sub.status}`);
        // Acá podés agregar lógica futura: enviar email, actualizar base de datos, etc.
      }
    }

    // Siempre responder 200 para que MP no reintente
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[ApplyFast webhook] Error:', err.message);
    // Igual respondemos 200 para evitar reintentos de MP
    return res.status(200).json({ received: true });
  }
};
