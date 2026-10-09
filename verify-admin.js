// Valida la contraseña del panel admin (ADMIN_PASSWORD) en el servidor.
const { json, signToken, safeEqual, rateLimit, clearRate, parseBody, sleep } = require('./utils/security');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Método no permitido' });
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    return json(500, { success: false, error: 'Servidor sin configurar (ADMIN_PASSWORD / SESSION_SECRET).' });
  }

  const rl = rateLimit(event, 'admin', 5, 5 * 60_000);
  if (rl.limited) return json(429, { success: false, error: `Demasiados intentos. Espera ${rl.retryAfter}s.`, retryAfter: rl.retryAfter });

  const { password } = parseBody(event);
  await sleep(500);

  if (typeof password !== 'string' || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return json(401, { success: false, error: 'Contraseña incorrecta.' });
  }

  clearRate(rl.key);
  return json(200, { success: true, token: signToken('admin', 60 * 30) }); // 30 minutos
};
