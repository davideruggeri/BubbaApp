// utils/matchExporter.ts
// Esportatore Excel (.xlsx) per le partite di BubbaApp, basato sul layout completo di StatistichePartita
import { MatchAnalysis, MatchEvent } from '../services/firestore/types';
import { derive, FIELD, GOAL_X, isOB, pullZone, ratioFor, playerStats, teamStats, describeEvent } from './statsEngine';
import { Platform } from 'react-native';

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(b: Uint8Array): number {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function zip(files: [string, Uint8Array | string][]): Blob {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const cd: Uint8Array[] = [];
    let off = 0;

    for (const [name, str] of files) {
        const nb = enc.encode(name);
        const data = typeof str === 'string' ? enc.encode(str) : str;
        const crc = crc32(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true);
        h.setUint16(4, 20, true);
        h.setUint16(6, 0x0800, true);
        h.setUint16(8, 0, true);
        h.setUint16(10, 0, true);
        h.setUint16(12, 0x21, true);
        h.setUint32(14, crc, true);
        h.setUint32(18, data.length, true);
        h.setUint32(22, data.length, true);
        h.setUint16(26, nb.length, true);
        h.setUint16(28, 0, true);
        parts.push(new Uint8Array(h.buffer), nb, data);

        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true);
        c.setUint16(10, 0, true);
        c.setUint16(12, 0, true);
        c.setUint16(14, 0x21, true);
        c.setUint32(16, crc, true);
        c.setUint32(20, data.length, true);
        c.setUint32(24, data.length, true);
        c.setUint16(28, nb.length, true);
        c.setUint32(42, off, true);
        cd.push(new Uint8Array(c.buffer), nb);
        off += 30 + nb.length + data.length;
    }

    const cdSize = cd.reduce((s, b) => s + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, off, true);
    return new Blob([...parts, ...cd, new Uint8Array(e.buffer)] as any, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

const xesc = (s: any) =>
    String(s ?? '')
        .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(i: number): string {
    let s = '';
    i++;
    while (i) {
        const m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}

function xStyles() {
    const fonts: string[] = [];
    const fills: string[] = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>'
    ];
    const borders: string[] = [];
    const xfs: string[] = [];
    const ids: Record<string, number> = {};

    const idx = (arr: string[], x: string) => {
        let i = arr.indexOf(x);
        if (i < 0) {
            i = arr.length;
            arr.push(x);
        }
        return i;
    };

    function id(st: any) {
        st = st || {};
        const k = JSON.stringify(st);
        if (k in ids) return ids[k];
        const fo = idx(fonts, `<font>${st.b ? '<b/>' : ''}<sz val="${st.sz || 11}"/>${st.color ? `<color rgb="FF${st.color}"/>` : ''}<name val="Calibri"/></font>`);
        const fi = st.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
        const bo = idx(borders, '<border>' + ['left', 'right', 'top', 'bottom'].map(n => st.br && st.br.includes(n[0]) ? `<${n} style="thin"><color rgb="FF000000"/></${n}>` : `<${n}/>`).join('') + '<diagonal/></border>');
        const al = st.al || st.rot ? `<alignment${st.al ? ` horizontal="${st.al}"` : ''}${st.rot ? ` textRotation="${st.rot}" vertical="bottom"` : ''}/>` : '';
        xfs.push(`<xf numFmtId="0" fontId="${fo}" fillId="${fi}" borderId="${bo}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
        return (ids[k] = xfs.length - 1);
    }

    id(null);
    const xml = () =>
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>` +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

    return { id, xml };
}

const HDR = { b: 1, color: 'FFFFFF', fill: '003057' };

function cellXML(ref: string, v: any, si: number): string {
    const s = si ? ` s="${si}"` : '';
    if (v == null || v === '') return si ? `<c r="${ref}"${s}/>` : '';
    if (typeof v === 'object' && v.f) {
        const cv = v.v == null || v.v === '' ? '<v></v>' : typeof v.v === 'number' ? `<v>${v.v}</v>` : `<v>${xesc(v.v)}</v>`;
        return `<c r="${ref}"${s}${typeof v.v === 'number' ? '' : ' t="str"'}><f>${xesc(v.f)}</f>${cv}</c>`;
    }
    if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
}

function sheetXML(sh: any, S: any): string {
    if (sh.cells) return gridXML(sh, S);
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    x += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    x += '<cols>' + sh.rows[0].map((h: any, i: number) => `<col min="${i + 1}" max="${i + 1}" width="${(sh.widths && sh.widths[i]) || Math.max(9, Math.min(40, String(h).length + 3))}" customWidth="1"/>`).join('') + '</cols><sheetData>';
    const hs = S.id(HDR);
    sh.rows.forEach((r: any[], ri: number) => {
        const bold = ri === 0 || (sh.boldRows && sh.boldRows.includes(ri)) ? hs : 0;
        x += `<row r="${ri + 1}">` + r.map((v, ci) => cellXML(colName(ci) + (ri + 1), v, bold)).join('') + '</row>';
    });
    x += '</sheetData>';
    if (sh.rows.length > 1) x += `<autoFilter ref="A1:${colName(sh.rows[0].length - 1)}${sh.rows.length}"/>`;
    return x + '</worksheet>';
}

function gridXML(sh: any, S: any): string {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    const cols = Object.keys(sh.cols || {}).map(Number).sort((a, b) => a - b);
    if (cols.length) x += '<cols>' + cols.map(c => `<col min="${c + 1}" max="${c + 1}" width="${sh.cols[c]}" customWidth="1"/>`).join('') + '</cols>';
    x += '<sheetData>';
    const rows = [...new Set([...Object.keys(sh.cells), ...Object.keys(sh.heights || {})])].map(Number).sort((a, b) => a - b);
    for (const r of rows) {
        const h = sh.heights && sh.heights[r];
        const row = sh.cells[r] || {};
        x += `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ''}>` +
            Object.keys(row).map(Number).sort((a, b) => a - b).map(c => cellXML(colName(c) + r, row[c].v, S.id(row[c].s))).join('') + '</row>';
    }
    return x + '</sheetData></worksheet>';
}

function buildXLSX(sheets: any[]): Blob {
    const files: [string, Uint8Array | string][] = [];
    const S = xStyles();
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => `<sheet name="${xesc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>' +
        '<definedNames>' + sheets.map((s, i) => s.rows && s.rows.length > 1 ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xesc(s.name.slice(0, 31))}'!$A$1:$${colName(s.rows[0].length - 1)}$${s.rows.length}</definedName>` : '').join('') + '</definedNames></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
    sheets.forEach((s, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXML(s, S)]));
    files.push(['xl/styles.xml', S.xml()]);
    return zip(files);
}

export function exportMatchSheets(
    matches: MatchAnalysis[],
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>
): any[] {
    const nm = (id?: string | null) => (id && playerMap[id] ? playerMap[id].name : id || '?');
    const gn = (id?: string | null) => (id && playerMap[id] ? playerMap[id].g : '');

    // 1. Giocatori
    const ps = playerStats(matches);
    const ids = Object.keys(ps).sort((a, b) => ps[b].pts - ps[a].pts);
    const pRows: any[][] = [['Giocatore', 'Sesso', 'Punti giocati', 'Punti O', 'Punti D', 'Tocchi', 'Mete', 'Assist', 'Difese (D)', 'di cui Callahan', 'TO lancio', 'TO presa', 'Stall out', 'TO totali', '+/−', 'Pull', 'Pull fuori', 'Distanza media pull dalla meta (m)']];
    ids.forEach((id, i) => {
        const s = ps[id], r = i + 2;
        pRows.push([
            nm(id), gn(id), s.pts, s.ptsO, s.ptsD, s.touches || 0, s.goals, s.ast, s.ds, s.call, s.tt, s.td, s.ts,
            { f: `K${r}+L${r}+M${r}` }, { f: `G${r}+H${r}+I${r}-N${r}` }, s.pulls, s.pullOB, s.pullDistN ? Math.round(10 * s.pullDist / s.pullDistN) / 10 : ''
        ]);
    });
    const last = ids.length + 1;
    if (ids.length) pRows.push(['TOTALE', '', '', '', '', ...'FGHIJKLMNOPQ'.split('').map(c => ({ f: `SUM(${c}2:${c}${last})` })), '']);

    // 2. Squadra
    const tRows: any[][] = [['Partita', 'Data', 'Punteggio noi', 'Punteggio loro', 'Punti O', 'Hold', 'Hold puliti (0 TO)', 'Break subiti', 'Punti D', 'Occasioni di break', 'Break fatti', 'TO nostri', 'TO lancio', 'TO presa', 'Stall out', 'TO altro', 'TO loro', 'Nostre D', 'Errori loro', 'Pull nostri', 'Pull nostri fuori', 'Pull loro', 'Pull loro fuori', 'Durata media punto (s)']];
    for (const g of matches) {
        const t = teamStats(g);
        tRows.push([
            g.opponent, g.date, t.score.us, t.score.them, t.oPts, t.holds, t.clean, t.broken, t.dPts, t.breakChances, t.breaks, t.toUs, t.toThrow, t.toDrop, t.toStall, t.toOther, t.toThem, t.ds, t.errs, t.pullsUs, t.pullsUsOB, t.pullsThem, t.pullsThemOB, t.durN ? Math.round(t.durSum / t.durN) : ''
        ]);
    }

    // 3. Punti, 4. Linee, 5. Pull, 6. Eventi
    const ptRows: any[][] = [['Partita', 'Punto', 'Inizio', 'Esito', 'Tipo', 'Punteggio', 'F', 'M', 'Linea', 'Tocchi', 'TO nostri', 'TO loro', 'Durata (s)']];
    const allIds = [...new Set(matches.flatMap(g => derive(g).points.flatMap(p => [...p.played])))];
    allIds.sort((a, b) => (gn(a) + nm(a)).localeCompare(gn(b) + nm(b)));
    const lRows: any[][] = [['Partita', 'Punto', 'Inizio', 'Esito', ...allIds.map(nm)]];
    const plRows: any[][] = [['Partita', 'Punto', 'Squadra', 'Lanciatore', 'x (m dalla linea di fondo di chi lancia)', 'y (m)', 'Fuori', 'Distanza dalla meta di chi riceve (m)', 'Zona']];
    const eRows: any[][] = [['Partita', 'Punto', 'Tempo (mm:ss)', 'Evento', 'Giocatore', 'Assist', 'Descrizione', 'x (m dalla nostra linea di fondo)', 'y (m)']];

    const EV_LABELS: Record<string, string> = {
        start: 'Inizio punto', pull: 'Pull', touch: 'Tocco', goal: 'Meta', call: 'Callahan',
        tt: 'TO lancio', td: 'TO presa', ts: 'Stall out', tx: 'TO altro',
        d: 'Difesa', err: 'Errore loro', tg: 'Meta loro', line: 'Cambio linea', dset: 'Schema difesa'
    };

    for (const g of matches) {
        const st = derive(g);
        const t0 = (g.events && g.events.length) ? (g.events[0].t || 0) : 0;
        for (const pt of st.points) {
            const fCount = pt.line.filter(id => gn(id) === 'F').length;
            const mCount = pt.line.length - fCount;
            ptRows.push([
                g.opponent, pt.n, pt.o ? 'Attacco' : 'Difesa',
                pt.result === 'us' ? 'Meta nostra' : pt.result === 'them' ? 'Meta loro' : 'In corso',
                pt.result ? (pt.o ? (pt.result === 'us' ? 'Hold' : 'Break subito') : (pt.result === 'us' ? 'Break' : 'Hold loro')) : '',
                pt.scoreAfter ? `${pt.scoreAfter.us}-${pt.scoreAfter.them}` : '',
                fCount, mCount, [...pt.played].map(nm).join(', '), pt.touches || 0, pt.toUs, pt.toThem,
                pt.t1 && pt.t0 ? Math.round((pt.t1 - pt.t0) / 1000) : ''
            ]);
            lRows.push([
                g.opponent, pt.n, pt.o ? 'O' : 'D',
                pt.result === 'us' ? 'Noi' : pt.result === 'them' ? 'Loro' : '',
                ...allIds.map(id => pt.played.has(id) ? (pt.o ? 'O' : 'D') : '')
            ]);
            const pl = pt.pull;
            if (pl && pl.x != null) {
                plRows.push([
                    g.opponent, pt.n, pl.team === 'us' ? 'Noi' : 'Loro',
                    nm(pl.p), pl.x, pl.y, isOB(pl) ? 'Sì' : 'No',
                    isOB(pl) ? '' : Math.round((GOAL_X - pl.x) * 10) / 10,
                    pullZone(pl)
                ]);
            }
        }

        let n = 0;
        for (const e of (g.events || [])) {
            if (e.k === 'start') n++;
            const s = Math.round(((e.t || t0) - t0) / 1000);
            const tm = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
            eRows.push([
                g.opponent, n, tm, EV_LABELS[e.k] || e.k,
                nm(e.s || e.p), nm(e.a), describeEvent(e, playerMap),
                e.x != null ? e.x : '', e.y != null ? e.y : ''
            ]);
        }
    }

    return [
        { name: 'Giocatori', rows: pRows, boldRows: ids.length ? [pRows.length - 1] : [] },
        { name: 'Squadra', rows: tRows },
        { name: 'Punti', rows: ptRows, widths: [14, 7, 9, 12, 12, 10, 5, 5, 50, 8, 9, 9, 10] },
        { name: 'Linee', rows: lRows },
        { name: 'Pull', rows: plRows, widths: [14, 7, 9, 12, 14, 8, 7, 14, 20] },
        { name: 'Eventi', rows: eRows, widths: [14, 7, 10, 14, 12, 12, 50, 16, 8] }
    ];
}

export async function exportAndDownloadXLSX(
    matches: MatchAnalysis[],
    playerMap: Record<string, { name: string; g: 'M' | 'F' }>,
    customFileName?: string
) {
    if (!matches.length) return;
    const blob = buildXLSX(exportMatchSheets(matches, playerMap));
    const name = customFileName || (matches.length === 1
        ? `bubba-stats_vs_${matches[0].opponent.replace(/[^\w-]+/g, '_')}_${matches[0].date}.xlsx`
        : `bubba-stats_torneo_${new Date().toISOString().slice(0, 10)}.xlsx`);

    if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
}
