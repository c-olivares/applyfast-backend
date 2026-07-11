// api/validate.js
// ─────────────────────────────────────────────────────────────────────────────
// Valida si una clave de licencia (preapproval_id de MP) está activa.
// La extensión llama a este endpoint cada vez que el usuario abre el popup
// (máximo una vez por día, el resto del tiempo usa el caché local).
//
// GET /api/validate?key=PREAPPROVAL_ID
// Respuesta: { valid: true/false, status: "authorized"|"...", message: "..." }
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { key } = req.query;

  if (!key || key.trim().length < 10) {
    return res.status(400).json({ valid: false, message: 'Clave inválida' });
  }

  const token = process.env.MP_ENV === 'production'
    ? process.env.MP_ACCESS_TOKEN_PROD
    : process.env.MP_ACCESS_TOKEN_TEST;

  try {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${key.trim()}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // MP devuelve 404 si el ID no existe
    if (response.status === 404) {
      return res.status(200).json({
        valid: false,
        message: 'Clave no encontrada. Verificá que la copiaste correctamente.',
      });
    }

    if (!response.ok) {
      return res.status(200).json({ valid: false, message: 'Error al verificar con Mercado Pago' });
    }

    const data = await response.json();

    // Suscripción válida solo si está "authorized" (activa y al día)
    // "pending"   = esperando primer pago
    // "authorized" = activa ✓
    // "paused"    = pausada
    // "cancelled" = cancelada
    const valid = data.status === 'authorized' || data.status === 'pending';

    return res.status(200).json({
      valid,
      status: data.status,
      message: valid
        ? '✓ Suscripción activa'
        : 'Suscripción inactiva o cancelada. Verificá tu cuenta de Mercado Pago.',
      nextPayment: data.auto_recurring?.next_payment_date || null,
      plan: data.reason || 'ApplyFast Premium',
    });

  } catch (err) {
    // Si el endpoint falla, no bloqueamos al usuario (beneficio de la duda)
    console.error('[ApplyFast validate] Error:', err.message);
    return res.status(200).json({
      valid: true,
      status: 'unknown',
      message: 'No se pudo verificar en este momento. Acceso temporal mantenido.',
    });
  }
};
