// utils/statsEngine.ts
// Motore di calcolo statistiche ed eventi per partite di beach/grass ultimate
import { MatchAnalysis, MatchEvent, MatchRosterPlayer } from '../services/firestore/types';

export const FIELD = { L: 75, W: 25, EZ: 15 }; // metri: mete da 15m, campo totale 75m, meta ricevente x=60
export const GOAL_X = FIELD.L - FIELD.EZ; // 60
export const DSETS = ['Veltroni', 'Zona', 'Uomo'] as const;
export const LOC_EVENTS = ['d', 'call', 'tt', 'td', 'ts', 'tx', 'err'] as const;

export const TO_US_LABELS: Record<string, string> = {
    tt: 'Lancio',
    td: 'Presa',
    ts: 'Stall out',
    tx: 'Altro'
};

export interface DerivedPoint {
    n: number;
    o: boolean;
    line: string[];
    played: Set<string>;
    pull: MatchEvent | null;
    ev: MatchEvent[];
    result: 'us' | 'them' | null;
    toUs: number;
    toThem: number;
    touches: number;
    gotDisc: boolean;
    t0?: number;
    t1?: number | null;
    scoreAfter?: { us: number; them: number };
}

export interface DerivedState {
    phase: 'line' | 'pull' | 'play';
    score: { us: number; them: number };
    points: DerivedPoint[];
    cur: DerivedPoint | null;
    poss: 'us' | 'them' | null;
    holder: string | null; // id del giocatore che ha attualmente il disco
    dset: string | null;
    nextO: boolean;
    halfTimeDone: boolean;
    halfTimePoint: number | null;
}

export function isOB(pl: { x?: number | null; y?: number | null }): boolean {
    if (pl.x == null || pl.y == null) return false;
    return pl.x < 0 || pl.x > FIELD.L || pl.y < 0 || pl.y > FIELD.W;
}

export function pullZone(pl: { x?: number | null; y?: number | null }): string {
    if (pl.x == null) return '';
    if (isOB(pl)) return 'Fuori';
    const d = GOAL_X - pl.x;
    if (d < 0) return 'In meta';
    if (d <= 10) return '0–10 m dalla meta';
    if (d <= 20) return '10–20 m dalla meta';
    return 'Corto (>20 m)';
}

// Calcolo rapporto ABBA per punto n (1-indexed)
// punto 1: A, 2-3: B, 4-5: A, 6-7: B...
export function ratioFor(g: { firstRatio?: 'M' | 'F' }, n: number): 'M' | 'F' {
    const a = g.firstRatio || 'F';
    const b = a === 'F' ? 'M' : 'F';
    if (n === 1) return a;
    return Math.floor((n - 2) / 2) % 2 === 0 ? b : a;
}

export function ratioLabel(r: 'M' | 'F'): string {
    return r === 'F' ? '3 Donne / 2 Uomini' : '3 Uomini / 2 Donne';
}

// Direzione in cui attacca Bubba sullo schermo: le squadre cambiano lato a ogni punto, dir0 è la direzione al punto 1.
// All'Half Time si inverte il campo rispetto ad inizio partita: il primo punto del 2° tempo attacca in direzione opposta a punto 1.
export const attRight = (g: { dir0?: 'R' | 'L' }, n: number, halfTimePoint?: number | null): boolean => {
    const isDir0Right = (g.dir0 || 'R') === 'R';
    if (halfTimePoint != null && n >= halfTimePoint) {
        const pointsIntoSecondHalf = n - halfTimePoint;
        return (pointsIntoSecondHalf % 2 === 0) !== isDir0Right;
    }
    return (n % 2 === 1) === isDir0Right;
};

export function derive(g: { pullFirst?: 'us' | 'them'; events?: MatchEvent[] }): DerivedState {
    const events = g.events || [];
    const st: DerivedState = {
        phase: 'line',
        score: { us: 0, them: 0 },
        points: [],
        cur: null,
        poss: null,
        holder: null,
        dset: null,
        nextO: g.pullFirst === 'them', // Se loro lanciano il pull per primi, noi partiamo in attacco (O)
        halfTimeDone: false,
        halfTimePoint: null
    };

    for (const e of events) {
        const c = st.cur;
        switch (e.k) {
            case 'start':
                st.cur = {
                    n: st.points.length + 1,
                    o: !!e.o,
                    line: (e.line || []).slice(),
                    played: new Set(e.line || []),
                    pull: null,
                    ev: [],
                    result: null,
                    toUs: 0,
                    toThem: 0,
                    touches: 0,
                    gotDisc: !!e.o,
                    t0: e.t,
                    t1: null
                };
                st.points.push(st.cur);
                st.phase = 'pull';
                st.poss = null;
                st.holder = null;
                st.dset = null;
                break;
            case 'pull':
                if (c) {
                    c.pull = e;
                    st.phase = 'play';
                    st.poss = c.o ? 'us' : 'them';
                }
                break;
            case 'line':
                if (c && e.line) {
                    c.line = e.line.slice();
                    e.line.forEach(id => c.played.add(id));
                }
                break;
            case 'touch':
                if (c) {
                    c.touches = (c.touches || 0) + 1;
                    if (e.p) {
                        st.holder = e.p;
                    }
                }
                break;
            case 'goal':
            case 'call':
                st.score.us++;
                st.holder = null;
                if (c) {
                    c.result = 'us';
                    if (e.k === 'call') {
                        c.toThem++;
                        c.gotDisc = true;
                    }
                }
                break;
            case 'tg':
                st.score.them++;
                st.holder = null;
                if (c) {
                    c.result = 'them';
                }
                break;
            case 'tt':
            case 'td':
            case 'ts':
            case 'tx':
                st.holder = null;
                if (c) {
                    c.toUs++;
                    st.poss = 'them';
                    st.dset = null;
                }
                break;
            case 'd':
            case 'err':
                st.holder = null;
                if (c) {
                    c.toThem++;
                    st.poss = 'us';
                    c.gotDisc = true;
                    st.dset = null;
                }
                break;
            case 'dset':
                st.dset = e.v || null;
                break;
            case 'halftime':
                st.halfTimeDone = true;
                st.halfTimePoint = st.points.length + 1;
                const initialO = g.pullFirst === 'them';
                st.nextO = !initialO;
                break;
        }

        if (c && e.k !== 'start') {
            c.ev.push(e);
        }

        if (c && c.result && e.k !== 'start' && c.t1 == null) {
            c.t1 = e.t;
            c.scoreAfter = { ...st.score };
            st.phase = 'line';
            st.nextO = c.result === 'them'; // Chi subisce punto attacca il successivo
            st.cur = null;
            st.poss = null;
        }
    }

    return st;
}

export interface PlayerStats {
    pts: number;
    ptsO: number;
    ptsD: number;
    goals: number;
    ast: number;
    ds: number;
    call: number;
    tt: number;
    td: number;
    ts: number;
    toTot: number;
    plusMinus: number;
    touches: number;
    pulls: number;
    pullOB: number;
    pullDist: number;
    pullDistN: number;
}

export function emptyPS(): PlayerStats {
    return {
        pts: 0,
        ptsO: 0,
        ptsD: 0,
        goals: 0,
        ast: 0,
        ds: 0,
        call: 0,
        tt: 0,
        td: 0,
        ts: 0,
        toTot: 0,
        plusMinus: 0,
        touches: 0,
        pulls: 0,
        pullOB: 0,
        pullDist: 0,
        pullDistN: 0
    };
}

export function playerStats(games: { pullFirst?: 'us' | 'them'; events?: MatchEvent[]; manualTouches?: Record<string, number> }[]): Record<string, PlayerStats> {
    const map: Record<string, PlayerStats> = {};
    const get = (id: string) => {
        if (!map[id]) map[id] = emptyPS();
        return map[id];
    };

    for (const g of games) {
        const st = derive(g);
        const gameTouches: Record<string, number> = {};
        for (const pt of st.points) {
            for (const id of pt.played) {
                const s = get(id);
                s.pts++;
                if (pt.o) s.ptsO++;
                else s.ptsD++;
            }
            if (pt.pull && pt.pull.team === 'us' && pt.pull.p) {
                const s = get(pt.pull.p);
                s.pulls++;
                if (pt.pull.x != null) {
                    if (isOB(pt.pull)) s.pullOB++;
                    else {
                        s.pullDist += GOAL_X - pt.pull.x;
                        s.pullDistN++;
                    }
                }
            }
            for (const e of pt.ev) {
                if (e.k === 'touch' && e.p) gameTouches[e.p] = (gameTouches[e.p] || 0) + 1;
                if (e.k === 'goal') {
                    if (e.s) {
                        get(e.s).goals++;
                        gameTouches[e.s] = (gameTouches[e.s] || 0) + 1;
                    }
                    if (e.a) get(e.a).ast++;
                }
                if (e.k === 'call' && e.p) {
                    const s = get(e.p);
                    s.goals++;
                    s.ds++;
                    s.call++;
                    gameTouches[e.p] = (gameTouches[e.p] || 0) + 1;
                }
                if (e.k === 'd' && e.p) get(e.p).ds++;
                if (e.k === 'tt' && e.p) get(e.p).tt++;
                if (e.k === 'td' && e.p) get(e.p).td++;
                if (e.k === 'ts' && e.p) get(e.p).ts++;
            }
        }
        if (g.manualTouches) {
            for (const [id, count] of Object.entries(g.manualTouches)) {
                gameTouches[id] = count;
            }
        }
        for (const [id, count] of Object.entries(gameTouches)) {
            get(id).touches += count;
        }
    }

    for (const id in map) {
        const s = map[id];
        s.toTot = s.tt + s.td + s.ts;
        s.plusMinus = s.goals + s.ast + s.ds - s.toTot;
    }

    return map;
}

export interface TeamStats {
    pts: number;
    oPts: number;
    holds: number;
    clean: number;
    dPts: number;
    breaks: number;
    breakChances: number;
    broken: number;
    toUs: number;
    toThrow: number;
    toDrop: number;
    toStall: number;
    toOther: number;
    toThem: number;
    ds: number;
    errs: number;
    pullsUs: number;
    pullsUsOB: number;
    pullsThem: number;
    pullsThemOB: number;
    durSum: number;
    durN: number;
    score: { us: number; them: number };
}

export function teamStats(g: { pullFirst?: 'us' | 'them'; events?: MatchEvent[] }): TeamStats {
    const st = derive(g);
    const t: TeamStats = {
        pts: 0,
        oPts: 0,
        holds: 0,
        clean: 0,
        dPts: 0,
        breaks: 0,
        breakChances: 0,
        broken: 0,
        toUs: 0,
        toThrow: 0,
        toDrop: 0,
        toStall: 0,
        toOther: 0,
        toThem: 0,
        ds: 0,
        errs: 0,
        pullsUs: 0,
        pullsUsOB: 0,
        pullsThem: 0,
        pullsThemOB: 0,
        durSum: 0,
        durN: 0,
        score: st.score
    };

    for (const pt of st.points) {
        if (!pt.result) continue;
        t.pts++;
        if (pt.o) {
            t.oPts++;
            if (pt.result === 'us') {
                t.holds++;
                if (pt.toUs === 0) t.clean++;
            } else {
                t.broken++;
            }
        } else {
            t.dPts++;
            if (pt.gotDisc) t.breakChances++;
            if (pt.result === 'us') t.breaks++;
        }
        if (pt.t1 && pt.t0) {
            t.durSum += (pt.t1 - pt.t0) / 1000;
            t.durN++;
        }
    }

    for (const pt of st.points) {
        for (const e of pt.ev) {
            if (e.k === 'tt') t.toThrow++;
            if (e.k === 'td') t.toDrop++;
            if (e.k === 'ts') t.toStall++;
            if (e.k === 'tx') t.toOther++;
            if (e.k === 'd' || e.k === 'call') t.ds++;
            if (e.k === 'err') t.errs++;
        }
        if (pt.pull && pt.pull.x != null) {
            if (pt.pull.team === 'us') {
                t.pullsUs++;
                if (isOB(pt.pull)) t.pullsUsOB++;
            } else {
                t.pullsThem++;
                if (isOB(pt.pull)) t.pullsThemOB++;
            }
        }
    }

    t.toUs = t.toThrow + t.toDrop + t.toStall + t.toOther;
    t.toThem = t.ds + t.errs;
    return t;
}

export function describeEvent(e: MatchEvent, playerMap: Record<string, { name: string }>): string {
    const n = (id?: string | null) => (id && playerMap[id] ? playerMap[id].name : id || '?');
    switch (e.k) {
        case 'start':
            return (e.o ? 'Inizio punto in attacco' : 'Inizio punto in difesa') + ' — ' + (e.line || []).map(n).join(', ');
        case 'pull':
            return e.x == null
                ? 'Pull non registrato'
                : `Pull ${e.team === 'us' ? 'nostro' + (e.p ? ' (' + n(e.p) + ')' : '') : 'loro'}: ${pullZone(e)}`;
        case 'goal':
            return `META ${n(e.s)}` + (e.a ? ` — assist ${n(e.a)}` : '');
        case 'call':
            return `CALLAHAN ${n(e.p)}`;
        case 'tt':
            return `Turnover lancio — ${n(e.p)}`;
        case 'td':
            return `Turnover presa — ${n(e.p)}`;
        case 'ts':
            return `Stall out — ${n(e.p)}`;
        case 'tx':
            return `Turnover (altro)`;
        case 'd':
            return `DIFESA ${n(e.p)}`;
        case 'err':
            return `Errore avversario`;
        case 'tg':
            return `Meta avversaria`;
        case 'line':
            return (e.reason === 'injury' ? 'Sostituzione per infortunio — ' : 'Cambio linea — ') + (e.line || []).map(n).join(', ');
        case 'dset':
            return 'Difesa: ' + e.v;
        case 'touch':
            return `Tocco disco — ${n(e.p)}`;
        case 'halftime':
            return 'Intervallo (Half Time) — Ruoli invertiti';
        default:
            return e.k;
    }
}
