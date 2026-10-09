// Solo admin: indica qué variables de entorno están configuradas (nunca sus valores).
const { json, verifyToken, getBearer } = require('./utils/security');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido' });
  const session = verifyToken(getBearer(event));
  if (!session || session.role !== 'admin') return json(401, { error: 'No autorizado.' });

  const names = ['GATE_ANSWER', 'ADMIN_PASSWORD', 'GOOGLE_SHEET_ID', 'SESSION_SECRET', 'START_DATE'];
  const vars = {};
  names.forEach((n) => (vars[n] = Boolean(process.env[n])));

  let sheet = 'sin probar';
  if (process.env.GOOGLE_SHEET_ID) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/export?format=csv`);
      sheet = r.ok ? 'accesible' : `error ${r.status}`;
    } catch (e) { sheet = 'sin conexión'; }
  }
  return json(200, { vars, sheet, startDate: process.env.START_DATE || '2023-10-08 (por defecto)' });
};
