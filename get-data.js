// Lee el Google Sheet (GOOGLE_SHEET_ID) en el servidor y devuelve fotos + razones.
// El ID de la hoja NUNCA llega al navegador. Requiere token válido.
const { json, verifyToken, getBearer } = require('./utils/security');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const pick = (row, keys) => {
  for (const k of keys) if (row[k] !== undefined && String(row[k]).trim() !== '') return String(row[k]).trim();
  return '';
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido' });

  const session = verifyToken(getBearer(event));
  if (!session) return json(401, { error: 'Sesión no válida o expirada.' });

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return json(500, { error: 'GOOGLE_SHEET_ID no configurado en Netlify.' });

  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv`);
    if (!res.ok) return json(502, { error: 'No se pudo leer el Google Sheet (¿está compartido como "cualquiera con el enlace puede ver"?).' });

    const table = parseCSV(await res.text());
    if (table.length < 2) return json(200, { photos: [], reasons: [], startDate: process.env.START_DATE || '2023-10-08' });

    const headers = table[0].map((h) => h.trim());
    const photos = [], reasons = [];

    table.slice(1).forEach((cells, idx) => {
      const row = {};
      headers.forEach((h, i) => (row[h] = cells[i] || ''));
      const categoryRaw = pick(row, ['Categoría', 'Categoria']);
      const category = categoryRaw.toLowerCase();
      const title = pick(row, ['Título de la Imagen', 'Titulo']);
      const url = pick(row, ['Enlace de la Imagen (URL)', 'URL']);
      const desc = pick(row, ['Descripción / Mensaje Romántico', 'Descripcion']);

      if (category.includes('razon') || category.includes('razón')) {
        const text = desc || title;
        if (text) reasons.push(text);
      } else if (url && category && /^https:\/\//i.test(url)) {
        photos.push({ id: idx + 1, category: categoryRaw, title, url, desc });
      }
    });

    return json(200, { photos, reasons, startDate: process.env.START_DATE || '2023-10-08' }, { 'Cache-Control': 'private, max-age=60' });
  } catch (err) {
    return json(502, { error: 'Error al conectar con Google Sheets.' });
  }
};
