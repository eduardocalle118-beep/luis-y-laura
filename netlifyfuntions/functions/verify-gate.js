// Valida la respuesta de la primera pregunta (GATE_ANSWER) en el servidor.
const { json, signToken, safeEqual, normalize, rateLimit, clearRate, parseBody, sleep } = require('./utils/security');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Método no permitido' });
  if (!process.env.GATE_ANSWER || !process.env.SESSION_SECRET) {
    return json(500, { success: false, error: 'Servidor sin configurar (GATE_ANSWER / SESSION_SECRET).' });
  }

  const rl = rateLimit(event, 'gate', 5, 60_000);
  if (rl.limited) return json(429, { success: false, error: `Demasiados intentos. Espera ${rl.retryAfter}s.`, retryAfter: rl.retryAfter });

  const { answer } = parseBody(event);
  await sleep(400); // frena fuerza bruta

  // Acepta varias respuestas separadas por coma, p. ej. "azul,azul marino"
  const valid = process.env.GATE_ANSWER.split(',').map(normalize).filter(Boolean);
  const given = normalize(answer);
  const ok = given.length > 0 && valid.some((v) => safeEqual(v, given));

  if (!ok) return json(401, { success: false, error: 'Respuesta incorrecta.' });

  clearRate(rl.key);
  return json(200, { success: true, token: signToken('guest', 60 * 60 * 6) }); // 6 horas
};
