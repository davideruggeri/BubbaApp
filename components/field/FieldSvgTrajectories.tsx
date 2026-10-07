import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path, Polygon, Circle, G } from 'react-native-svg';
import { FieldTrajectory } from './fieldTypes';
import { toCanvasPx, buildSmoothPath, buildArrowHead } from './fieldMath';

interface FieldSvgTrajectoriesProps {
    trajectories: FieldTrajectory[];
    activeDrawingPts: { x: number; y: number }[];
    drawingColor: string;
    currentSize: { width: number; height: number };
    isModal: boolean;
    domNode: any;
    flip: boolean;
    fallbackW: number;
    onTrajectoryPress?: (trajectory: FieldTrajectory) => void;
}

export const FieldSvgTrajectories: React.FC<FieldSvgTrajectoriesProps> = ({
    trajectories,
    activeDrawingPts,
    drawingColor,
    currentSize,
    isModal,
    domNode,
    flip,
    fallbackW,
    onTrajectoryPress
}) => {
    const allTrajectories = [...trajectories];
    if (activeDrawingPts.length >= 2) {
        allTrajectories.push({ points: activeDrawingPts, color: drawingColor || '#C8323C' });
    }

    return (
        <Svg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
            pointerEvents="box-none"
        >
            {allTrajectories.map((tr, tIdx) => {
                if (!tr.points || tr.points.length < 2) return null;
                const pxPts = tr.points.map(p => toCanvasPx(p, currentSize, isModal, domNode, flip, fallbackW));
                const pathData = buildSmoothPath(pxPts);
                const arrowHead = buildArrowHead(pxPts);
                const color = tr.color || '#C8323C';
                const firstPt = pxPts[0];
                const isClickable = !!(tr.onPress || onTrajectoryPress);

                return (
                    <G
                        key={`traj-${tIdx}`}
                        onPress={isClickable ? () => {
                            if (tr.onPress) tr.onPress();
                            else if (onTrajectoryPress) onTrajectoryPress(tr);
                        } : undefined}
                    >
                        {/* Area di tocco allargata invisibile per facilitare il tap sulla traiettoria */}
                        {isClickable && (
                            <Path
                                d={pathData}
                                stroke="transparent"
                                strokeWidth={22}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        )}
                        {/* Punto di rilascio iniziale del lancio */}
                        <Circle
                            cx={firstPt.x}
                            cy={firstPt.y}
                            r={4.5}
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth={2.5}
                        />
                        {/* Traiettoria Curva */}
                        <Path
                            d={pathData}
                            stroke={color}
                            strokeWidth={3.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        {/* Freccia orientata verso il punto di caduta */}
                        {arrowHead && (
                            <Polygon
                                points={arrowHead}
                                fill={color}
                            />
                        )}
                    </G>
                );
            })}
            {activeDrawingPts.length === 1 && (() => {
                const p0 = toCanvasPx(activeDrawingPts[0], currentSize, isModal, domNode, flip, fallbackW);
                return (
                    <Circle
                        cx={p0.x}
                        cy={p0.y}
                        r={5}
                        fill="#ffffff"
                        stroke={drawingColor || '#C8323C'}
                        strokeWidth={3}
                    />
                );
            })()}
        </Svg>
    );
};
