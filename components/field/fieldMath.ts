import { Platform } from 'react-native';
import { FIELD } from '../../utils/statsEngine';
import { MARGIN_X, MARGIN_Y, TOTAL_L, TOTAL_W, FIELD_ASPECT_RATIO } from './fieldTypes';

export function toCanvasPx(
    p: { x: number; y: number },
    size: { width: number; height: number },
    isModal: boolean,
    domNode: any,
    flip: boolean,
    fallbackW: number
): { x: number; y: number } {
    const domW = domNode?.clientWidth || domNode?.getBoundingClientRect?.()?.width;
    const domH = domNode?.clientHeight || domNode?.getBoundingClientRect?.()?.height;

    const w = size.width || domW || (isModal ? 680 : fallbackW);
    const h = size.height || domH || Math.round(w / FIELD_ASPECT_RATIO);
    const displayX = flip ? FIELD.L - p.x : p.x;
    const px = ((displayX + MARGIN_X) / TOTAL_L) * w;
    const py = ((p.y + MARGIN_Y) / TOTAL_W) * h;
    return { x: px, y: py };
}

export function buildSmoothPath(pxPts: { x: number; y: number }[]): string {
    if (!pxPts || pxPts.length < 2) return '';
    if (pxPts.length === 2) {
        return `M ${pxPts[0].x.toFixed(1)} ${pxPts[0].y.toFixed(1)} L ${pxPts[1].x.toFixed(1)} ${pxPts[1].y.toFixed(1)}`;
    }
    let d = `M ${pxPts[0].x.toFixed(1)} ${pxPts[0].y.toFixed(1)}`;
    for (let i = 1; i < pxPts.length - 1; i++) {
        const xc = (pxPts[i].x + pxPts[i + 1].x) / 2;
        const yc = (pxPts[i].y + pxPts[i + 1].y) / 2;
        d += ` Q ${pxPts[i].x.toFixed(1)} ${pxPts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    d += ` L ${pxPts[pxPts.length - 1].x.toFixed(1)} ${pxPts[pxPts.length - 1].y.toFixed(1)}`;
    return d;
}

export function buildArrowHead(pxPts: { x: number; y: number }[], arrowLen = 14, angleDeg = 28): string | null {
    if (!pxPts || pxPts.length < 2) return null;
    const last = pxPts[pxPts.length - 1];
    let prev = pxPts[pxPts.length - 2];
    for (let i = pxPts.length - 2; i >= 0; i--) {
        const dist = Math.hypot(last.x - pxPts[i].x, last.y - pxPts[i].y);
        if (dist >= 8) {
            prev = pxPts[i];
            break;
        }
    }
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    const rad = (angleDeg * Math.PI) / 180;
    const p1x = last.x - arrowLen * Math.cos(angle - rad);
    const p1y = last.y - arrowLen * Math.sin(angle - rad);
    const p2x = last.x - arrowLen * Math.cos(angle + rad);
    const p2y = last.y - arrowLen * Math.sin(angle + rad);
    return `${last.x.toFixed(1)},${last.y.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;
}

export function getCoordFromEvent(
    e: any,
    rawNode: any,
    isModal: boolean,
    currentSize: { width: number; height: number },
    flip: boolean,
    inlineFieldWidth: number
): { x: number; y: number } | null {
    const domNode = rawNode?.getBoundingClientRect ? rawNode : (rawNode?.node?.getBoundingClientRect ? rawNode.node : null);
    if (Platform.OS === 'web' && domNode && typeof domNode.getBoundingClientRect === 'function') {
        let clientX: number | undefined = e?.nativeEvent?.clientX ?? e?.clientX;
        let clientY: number | undefined = e?.nativeEvent?.clientY ?? e?.clientY;

        if (clientX == null && e?.nativeEvent?.pageX != null && typeof window !== 'undefined') {
            clientX = e.nativeEvent.pageX - (window.scrollX || 0);
        }
        if (clientY == null && e?.nativeEvent?.pageY != null && typeof window !== 'undefined') {
            clientY = e.nativeEvent.pageY - (window.scrollY || 0);
        }

        const { locationX, locationY } = e?.nativeEvent || {};
        const rect = domNode.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            if (clientX == null && locationX != null) {
                clientX = rect.left + locationX;
            }
            if (clientY == null && locationY != null) {
                clientY = rect.top + locationY;
            }

            if (clientX != null && clientY != null) {
                const relX = clientX - rect.left;
                const relY = clientY - rect.top;
                let x = -MARGIN_X + (relX / rect.width) * TOTAL_L;
                let y = -MARGIN_Y + (relY / rect.height) * TOTAL_W;
                if (flip) x = FIELD.L - x;
                x = Math.max(-MARGIN_X, Math.min(FIELD.L + MARGIN_X, Math.round(x * 10) / 10));
                y = Math.max(-MARGIN_Y, Math.min(FIELD.W + MARGIN_Y, Math.round(y * 10) / 10));
                return { x, y };
            }
        }
    }

    const { locationX, locationY } = e?.nativeEvent || {};
    if (locationX == null || locationY == null) return null;
    const width = currentSize.width || (isModal ? 680 : inlineFieldWidth);
    const heightVal = currentSize.height || Math.round(width / FIELD_ASPECT_RATIO);
    let x = -MARGIN_X + (locationX / width) * TOTAL_L;
    let y = -MARGIN_Y + (locationY / heightVal) * TOTAL_W;
    if (flip) x = FIELD.L - x;
    x = Math.max(-MARGIN_X, Math.min(FIELD.L + MARGIN_X, Math.round(x * 10) / 10));
    y = Math.max(-MARGIN_Y, Math.min(FIELD.W + MARGIN_Y, Math.round(y * 10) / 10));
    return { x, y };
}
