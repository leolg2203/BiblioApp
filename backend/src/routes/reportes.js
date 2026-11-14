const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { db, config } = require('../db');
const { parsearRangos, ErrorApp } = require('../util');

const r = express.Router();
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function contar(filas, clave, orden) {
  const m = new Map();
  (orden || []).forEach((k) => m.set(k, 0));
  filas.forEach((f) => { const k = f[clave] ?? 'Sin dato'; m.set(k, (m.get(k) || 0) + 1); });
  const lista = [...m.entries()].map(([etiqueta, total]) => ({ etiqueta, total }));
  return orden ? lista : lista.sort((a, b) => b.total - a.total);
}

// CU-10 Generar reporte mensual
function calcular(anio, mes) {
  if (!(anio >= 2000 && mes >= 1 && mes <= 12)) throw new ErrorApp(400, 'Elige un mes y un año válidos.');
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
  const visitas = db.prepare(`
    SELECT vi.fecha, vi.hora_entrada, vi.edad, vi.visitante_id, v.nombre, v.genero,
           COALESCE(o.nombre, 'Sin dato') AS ocupacion, a.nombre AS actividad,
           CAST(strftime('%w', vi.fecha) AS INTEGER) AS dia
    FROM visita vi JOIN visitante v ON v.id = vi.visitante_id
    LEFT JOIN ocupacion o ON o.id = v.ocupacion_id JOIN actividad a ON a.id = vi.actividad_id
    WHERE substr(vi.fecha, 1, 7) = ? ORDER BY vi.fecha, vi.hora_entrada`).all(periodo);

  const rangos = parsearRangos(config().rangos_edad);
  visitas.forEach((v) => {
    const rg = v.edad == null ? null : rangos.find((x) => v.edad >= x.min && v.edad <= x.max);
    v.rango = rg ? rg.etiqueta : 'Sin dato';
    v.dia_nombre = DIAS[v.dia];
  });

  const anterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
  const totalAnterior = db.prepare('SELECT COUNT(*) n FROM visita WHERE substr(fecha,1,7) = ?').get(anterior).n;
  const diasAbiertos = new Set(visitas.map((v) => v.fecha)).size;
  const conDatoEdad = rangos.map((x) => x.etiqueta);
  if (visitas.some((v) => v.rango === 'Sin dato')) conDatoEdad.push('Sin dato');

  return {
    periodo, titulo: `${MESES[mes - 1]} ${anio}`,
    total_visitas: visitas.length,
    visitantes_distintos: new Set(visitas.map((v) => v.visitante_id)).size,
    promedio_dia: diasAbiertos ? Math.round(visitas.length / diasAbiertos) : 0,
    dias_abiertos: diasAbiertos,
    total_mes_anterior: totalAnterior,
    prestamos: db.prepare('SELECT COUNT(*) n FROM prestamo WHERE substr(fecha_prestamo,1,7) = ?').get(periodo).n,
    por_genero: contar(visitas, 'genero'),
    por_edad: contar(visitas, 'rango', conDatoEdad),
    por_actividad: contar(visitas, 'actividad'),
    por_ocupacion: contar(visitas, 'ocupacion'),
    por_dia: contar(visitas, 'dia_nombre', DIAS.slice(1).concat(DIAS[0])).filter((d) => d.total > 0 || d.etiqueta !== 'Domingo'),
    visitas,
  };
}

const params = (req) => [Number(req.query.anio), Number(req.query.mes)];

r.get('/reportes/mensual', (req, res) => {
  const { visitas, ...resumen } = calcular(...params(req));
  res.json(resumen);
});

const SECCIONES = [
  ['Visitas por género', 'por_genero'],
  ['Visitas por rango de edad', 'por_edad'],
  ['Visitas por actividad', 'por_actividad'],
  ['Visitas por ocupación', 'por_ocupacion'],
  ['Visitas por día de la semana', 'por_dia'],
];

r.get('/reportes/mensual/excel', async (req, res) => {
  const rep = calcular(...params(req));
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet('Resumen');
  hoja.columns = [{ width: 34 }, { width: 14 }, { width: 12 }];
  hoja.addRow([`Reporte mensual de visitas — ${rep.titulo}`]).font = { bold: true, size: 14 };
  hoja.addRow([]);
  [['Total de visitas', rep.total_visitas], ['Visitantes distintos', rep.visitantes_distintos],
    ['Días con visitas', rep.dias_abiertos], ['Promedio por día', rep.promedio_dia],
    ['Préstamos realizados', rep.prestamos], ['Visitas del mes anterior', rep.total_mes_anterior]]
    .forEach((f) => hoja.addRow(f));
  SECCIONES.forEach(([titulo, clave]) => {
    hoja.addRow([]);
    const h = hoja.addRow([titulo, 'Visitas', '%']);
    h.font = { bold: true };
    rep[clave].forEach((x) => hoja.addRow([x.etiqueta, x.total, rep.total_visitas ? Math.round((x.total * 1000) / rep.total_visitas) / 10 : 0]));
  });
  const det = wb.addWorksheet('Visitas');
  det.columns = ['Fecha', 'Hora', 'Nombre', 'Edad', 'Género', 'Ocupación', 'Actividad'].map((header) => ({ header, width: 18 }));
  det.getRow(1).font = { bold: true };
  rep.visitas.forEach((v) => det.addRow([v.fecha, v.hora_entrada, v.nombre, v.edad, v.genero, v.ocupacion, v.actividad]));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${rep.periodo}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

r.get('/reportes/mensual/pdf', (req, res) => {
  const rep = calcular(...params(req));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${rep.periodo}.pdf"`);
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  doc.pipe(res);
  const verde = '#1F6F5C';
  doc.fillColor('#1C1C1A').fontSize(20).text('Reporte mensual de visitas');
  doc.fontSize(13).fillColor('#5F6360').text(rep.titulo).moveDown();
  doc.fillColor('#1C1C1A').fontSize(11);
  [['Total de visitas', rep.total_visitas], ['Visitantes distintos', rep.visitantes_distintos],
    ['Promedio por día con visitas', rep.promedio_dia], ['Préstamos realizados', rep.prestamos],
    ['Visitas del mes anterior', rep.total_mes_anterior]]
    .forEach(([k, v]) => doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(String(v)).font('Helvetica'));
  SECCIONES.forEach(([titulo, clave]) => {
    const lista = rep[clave];
    if (doc.y > 620) doc.addPage();
    doc.moveDown().font('Helvetica-Bold').fontSize(12).text(titulo).font('Helvetica').fontSize(10).moveDown(0.3);
    const max = Math.max(1, ...lista.map((x) => x.total));
    lista.forEach((x) => {
      if (doc.y > 700) doc.addPage();
      const y = doc.y;
      doc.fillColor('#1C1C1A').text(x.etiqueta, 50, y, { width: 150 });
      doc.rect(205, y + 1, 260, 9).fill('#EFEFEC');
      doc.rect(205, y + 1, Math.max(1, (260 * x.total) / max), 9).fill(verde);
      doc.fillColor('#1C1C1A').text(String(x.total), 475, y, { width: 60, align: 'right' });
      doc.y = y + 16;
    });
  });
  doc.end();
});

module.exports = r;
