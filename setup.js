// api/setup.js
// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT DE CONFIGURACIÓN INICIAL — ejecutar UNA SOLA VEZ
// Crea el plan de suscripción en Mercado Pago y devuelve los valores
// que hay que copiar como variables de entorno en Vercel.
//
// Uso: GET https://tu-app.vercel.app/api/setup?secret=applyfast2024
//
// IMPORTANTE: una vez ejecutado, podés deshabilitar este endpoint
// borrando este archivo o agregando una variable MP_SETUP_DONE=true en Vercel.
// ─────────────────────────────────────────────────────────────────────────────

const SETUP_SECRET = process.env.SETUP_SECRET || 'applyfast2024';

module.exports = async function handler(req, res) {
  // Solo GET y con el secret correcto
  if (req.method !== 'GET') return res.status(405).end();
  if (req.query.secret !== SETUP_SECRET) {
    return res.status(401).json({ error: 'Secret incorrecto' });
  }
  // Si ya está configurado, no hacer nada
  if (process.env.MP_PLAN_ID) {
    return res.status(200).json({
      mensaje: 'El plan ya existe. Si querés recrearlo, borrá MP_PLAN_ID en Vercel primero.',
      planId: process.env.MP_PLAN_ID,
      initPoint: process.env.MP_PLAN_INIT_POINT,
    });
  }

  const token = process.env.MP_ENV === 'production'
    ? process.env.MP_ACCESS_TOKEN_PROD
    : process.env.MP_ACCESS_TOKEN_TEST;

  const backendUrl = process.env.BACKEND_URL || `https://${req.headers.host}`;

  try {
    const response = await fetch('https://api.mercadopago.com/preapproval_plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'ApplyFast Premium — Autocompletado ilimitado',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: parseFloat(process.env.SUBSCRIPTION_AMOUNT || '4990'),
          currency_id: process.env.SUBSCRIPTION_CURRENCY || 'ARS',
          // 7 días de prueba gratis
          free_trial: {
            frequency: 7,
            frequency_type: 'days',
          },
        },
        back_url: `${backendUrl}/success.html`,
      }),
    });

    const plan = await response.json();

    if (!plan.id) {
      return res.status(500).json({
        error: 'Error al crear el plan en MP',
        detalle: plan,
      });
    }

    return res.status(200).json({
      exito: true,
      mensaje: '¡Plan creado! Copiá estos valores como variables de entorno en Vercel:',
      variables: {
        MP_PLAN_ID:         plan.id,
        MP_PLAN_INIT_POINT: plan.init_point,
      },
      plan,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
