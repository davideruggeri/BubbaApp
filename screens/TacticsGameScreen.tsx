import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions, TouchableOpacity, Platform, TextInput, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { subscribeToTacticalSchemes, saveTacticalScheme, deleteTacticalScheme, TacticalScheme } from '../services/firestore';
import { useAuth } from '../context/AuthContext';
import { showAlert, showConfirmation } from '../utils/alert';

const { width, height } = Dimensions.get('window');

// Entities
type Position = { x: number; y: number };
type Player = {
    id: number;
    team: 'offense' | 'defense';
    pos: Position;
    velocity: Position; // Add velocity for momentum
    origin: Position; // Base position for idle movement
    role?: 'handler' | 'cutter' | 'defender'
};

const PLAYER_SIZE = 24;
const DISC_SIZE = 14;
const MAX_SPEED = 4.0; // Max speed
const ACCELERATION = 0.2; // How fast they speed up
const FRICTION = 0.90; // Damping
const DISC_SPEED = 12;
const DEFENDER_SPEED = 2.8;

export default function TacticsGameScreen() {
    const navigation = useNavigation();

    // Scheme Viewer State (not game state)
    const [isPlaying, setIsPlaying] = useState(false); // Animation play/pause
    const [gameState, setGameState] = useState<'editing' | 'playing'>('editing');
    // Multi-pass disc paths (array of arrays for multiple passes)
    const [discPaths, setDiscPaths] = useState<Position[][]>([]);
    const [currentDiscPassIndex, setCurrentDiscPassIndex] = useState(0);
    const discStartPosRef = useRef<Position>({ x: 0, y: 0 });
    const [snappedPlayerId, setSnappedPlayerId] = useState<number | null>(null);

    // Movement Sequences (NEW: support for multi-sequence workflow)
    type MovementSequence = {
        playerPaths: Record<number, Position[]>;
        basePositions: Record<number, Position>;
    };
    const [movementSequences, setMovementSequences] = useState<MovementSequence[]>([]);
    const [currentSequenceIndex, setCurrentSequenceIndex] = useState(0);

    // Animation State (kept for current editing session)
    const playerPaths = useRef<Record<number, Position[]>>({});
    const [maxFrames, setMaxFrames] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(0);

    // Tactics State
    const forceDirection = useRef<1 | -1>(1); // 1 = Force Right (defenders stand left), -1 = Force Left

    // Playbook State
    type SchemeType = 'vertical' | 'horizontal' | 'side' | 'custom';

    const [activeScheme, setActiveScheme] = useState<SchemeType>('vertical');
    const [showTacticsModal, setShowTacticsModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Editing Phases
    type EditPhase = 'setup' | 'movement' | 'disc';
    const [editPhase, setEditPhase] = useState<EditPhase>('setup');
    const [defenseLocked, setDefenseLocked] = useState(true); // Default locked

    const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

    // Game Format State
    type GameFormat = '5v5' | '7v7';
    const [gameFormat, setGameFormat] = useState<GameFormat>('5v5');

    // Save/Load State
    const [schemeName, setSchemeName] = useState('');
    const [savedSchemes, setSavedSchemes] = useState<TacticalScheme[]>([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);

    // Zoom State
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const gestureState = useRef({
        scale: 1,
        lastScale: 1,
        isPinching: false,
        panStartX: 0,
        panStartY: 0,
        lastPanX: 0,
        lastPanY: 0
    });
    const { userProfile } = useAuth();

    // Force re-render for web (where setNativeProps doesn't work)
    const [forceUpdate, setForceUpdate] = useState(0);

    // Calculate field dimensions based on game format
    const fieldDimensions = useMemo(() => {
        const AVAILABLE_HEIGHT = height - 190; // Increased buffer for 2-row header
        const AVAILABLE_WIDTH = width;

        // Format-specific specifications
        const specs = gameFormat === '5v5'
            ? { length: 75, width: 25, endzone: 15, brickDistance: 10 } // Beach Ultimate (Brick 10m from goal line)
            : { length: 100, width: 37, endzone: 18, brickDistance: 18 }; // Grass Ultimate (Brick 18m from goal line)

        const FIELD_ASPECT_RATIO = specs.length / specs.width;

        let fieldHeight: number, fieldWidth: number;
        if (AVAILABLE_WIDTH / AVAILABLE_HEIGHT > FIELD_ASPECT_RATIO) {
            // Height constrained
            fieldHeight = AVAILABLE_HEIGHT;
            fieldWidth = fieldHeight / FIELD_ASPECT_RATIO;
        } else {
            // Width constrained
            fieldWidth = AVAILABLE_WIDTH;
            fieldHeight = fieldWidth * FIELD_ASPECT_RATIO;
        }

        const scale = fieldHeight / specs.length;

        return {
            FIELD_WIDTH: fieldWidth,
            FIELD_HEIGHT: fieldHeight,
            ENDZONE_HEIGHT: specs.endzone * scale,
            TOP_BRICK_Y: (specs.endzone + specs.brickDistance) * scale,
            BOTTOM_BRICK_Y: (specs.length - specs.endzone - specs.brickDistance) * scale,
        };
    }, [gameFormat]);

    const { FIELD_WIDTH, FIELD_HEIGHT, ENDZONE_HEIGHT, TOP_BRICK_Y, BOTTOM_BRICK_Y } = fieldDimensions;


    // Refs for direct manipulation - using any to avoid strict View typing issues with setNativeProps
    const playerRefs = useRef<any>({});
    const discRef = useRef<any>(null);

    // Sync state to ref for PanResponder (Stale Closure Fix)
    const stateRef = useRef({
        gameState,
        isPlaying,
        activeScheme,
        showTacticsModal,
        isEditing,
        selectedPlayerId,
        editPhase,
        defenseLocked,
    });
    // Update ref on every render
    stateRef.current = { gameState, isPlaying, activeScheme, showTacticsModal, isEditing, selectedPlayerId, editPhase, defenseLocked };

    // Initial Positions for Schemes - Responsive to Field Dimensions
    const SCHEMES = useMemo(() => {
        const center = FIELD_WIDTH / 2;
        const is7v7 = gameFormat === '7v7';

        const baseSchemes = {
            vertical: is7v7 ? [
                // 7v7: 3 Handlers in back (at brick mark), 4 Cutters
                { x: FIELD_WIDTH * 0.3, y: BOTTOM_BRICK_Y }, // Handler 1
                { x: center, y: BOTTOM_BRICK_Y }, // Handler 2 (center)
                { x: FIELD_WIDTH * 0.7, y: BOTTOM_BRICK_Y }, // Handler 3
                { x: center, y: FIELD_HEIGHT * 0.55 }, // Cutter (Stack start)
                { x: center, y: FIELD_HEIGHT * 0.45 },
                { x: center, y: FIELD_HEIGHT * 0.35 },
                { x: center, y: FIELD_HEIGHT * 0.25 },
            ] : [
                // 5v5: 2 Handlers in back (at brick mark), 3 Cutters
                { x: FIELD_WIDTH * 0.35, y: BOTTOM_BRICK_Y }, // Handler 1
                { x: FIELD_WIDTH * 0.65, y: BOTTOM_BRICK_Y }, // Handler 2
                { x: FIELD_WIDTH * 0.25, y: FIELD_HEIGHT * 0.50 }, // Cutter 1
                { x: center, y: FIELD_HEIGHT * 0.50 }, // Cutter 2 (center)
                { x: FIELD_WIDTH * 0.75, y: FIELD_HEIGHT * 0.50 }, // Cutter 3
            ],
            horizontal: is7v7 ? [
                // 7v7: 3 Handlers (at brick mark) + 4 Cutters horizontal
                { x: FIELD_WIDTH * 0.3, y: BOTTOM_BRICK_Y },
                { x: center, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.7, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.2, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.4, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.6, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.8, y: FIELD_HEIGHT * 0.45 },
            ] : [
                // 5v5: 2 Handlers (at brick mark) + 3 Cutters horizontal
                { x: FIELD_WIDTH * 0.35, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.65, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.25, y: FIELD_HEIGHT * 0.45 },
                { x: center, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.75, y: FIELD_HEIGHT * 0.45 },
            ],
            side: is7v7 ? [
                // 7v7: 3 Handlers (at brick mark) + 4 Cutters side
                { x: FIELD_WIDTH * 0.2, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.35, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.5, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.55 },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.35 },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.25 },
            ] : [
                // 5v5: 2 Handlers (at brick mark) + 3 Cutters side
                { x: FIELD_WIDTH * 0.25, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.4, y: BOTTOM_BRICK_Y },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.45 },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.35 },
                { x: FIELD_WIDTH * 0.85, y: FIELD_HEIGHT * 0.25 },
            ]
        };

        return baseSchemes;
    }, [FIELD_WIDTH, FIELD_HEIGHT, BOTTOM_BRICK_Y, gameFormat]);

    // Store custom positions
    const customSchemePositions = useRef<Position[]>([]);

    // Game Logic State (Refs)
    const players = useRef<Player[]>([]);
    const discPos = useRef<Position>({ x: width / 2, y: FIELD_HEIGHT - 60 });
    const currentHandlerId = useRef<number>(1);
    const discTargetIndex = useRef(0);
    const requestRef = useRef<any>(null);
    const draggingPlayerId = useRef<number | null>(null);

    // Reset positions when dimensions or format changes
    useEffect(() => {
        // If switching formats, clear custom positions to ensure we use correct player count
        if (gameFormat === '7v7' && customSchemePositions.current.length === 5) {
            setActiveScheme('vertical');
            customSchemePositions.current = [];
        } else if (gameFormat === '5v5' && customSchemePositions.current.length === 7) {
            setActiveScheme('vertical');
            customSchemePositions.current = [];
        }

        resetPosition();
        setForceUpdate(prev => prev + 1);

        // Safety re-render for web layout timing
        if (Platform.OS === 'web') {
            setTimeout(() => setForceUpdate(prev => prev + 1), 100);
        }
    }, [FIELD_WIDTH, FIELD_HEIGHT, gameFormat]);



    // --- Helpers (Hoisted to be accessible by useEffects) ---
    const updateViewPosition = (ref: any, x: number, y: number, size: number) => {
        // setNativeProps only works on mobile, not web
        if (Platform.OS !== 'web' && ref?.setNativeProps) {
            ref.setNativeProps({
                style: {
                    left: x - size / 2,
                    top: y - size / 2
                }
            });
        } else if (Platform.OS === 'web') {
            // On web, trigger re-render to update positions
            setForceUpdate(prev => prev + 1);
        }
    };

    const resetPosition = () => {
        // Randomize Force (1 or -1)
        forceDirection.current = Math.random() > 0.5 ? 1 : -1;

        // Responsive Offsets
        const FORCE_OFFSET = FIELD_WIDTH * 0.08; // 8% of field width (~2m scale)
        const Y_OFFSET = FIELD_HEIGHT * 0.04; // 4% of field height (~1m scale)

        // Get Positions based on Active Scheme
        let offensePositions: Position[] = [];

        if (activeScheme === 'custom') {
            // Use stored custom positions or fallback to Vertical if empty (shouldn't be if initialized)
            offensePositions = customSchemePositions.current.length > 0 ? [...customSchemePositions.current] : [...SCHEMES.vertical];
        } else {
            offensePositions = [...(SCHEMES[activeScheme as keyof typeof SCHEMES] || SCHEMES.vertical)];
        }

        const startPlayers: Player[] = [];

        // Create Offense
        const numHandlers = gameFormat === '5v5' ? 2 : 3; // 2 handlers for 5v5, 3 for 7v7

        offensePositions.forEach((pos, index) => {
            startPlayers.push({
                id: index + 1,
                team: 'offense',
                pos: { ...pos },
                velocity: { x: 0, y: 0 },
                origin: { ...pos },
                role: index < numHandlers ? 'handler' : 'cutter'
            });
        });


        // Create Defense (Relative to Offense based on FORCE)
        const offenseCount = offensePositions.length;
        offensePositions.forEach((pos, index) => {
            // Apply Force Offset for start position
            // Force = 1 (Right) -> Stand Left (-x)
            // Force = -1 (Force Left) -> Stand on RIGHT (+x offset)
            const defX = pos.x - (forceDirection.current * FORCE_OFFSET);
            // GOAL SIDE: Subtract Y_OFFSET to start closer to Endzone (Top)
            const defY = pos.y - Y_OFFSET;

            startPlayers.push({
                id: index + 1 + offenseCount, // Dynamic ID offset
                team: 'defense',
                pos: { x: defX, y: defY },
                velocity: { x: 0, y: 0 },
                origin: { x: defX, y: defY },
                role: 'defender'
            });
        });

        // Reset Logic State
        players.current = startPlayers;
        currentHandlerId.current = 1;
        discPos.current = { ...startPlayers[0].pos };
        setDiscPaths([]);
        setCurrentDiscPassIndex(0);
        setSnappedPlayerId(null);
        setMovementSequences([]);
        setCurrentSequenceIndex(0);
        setGameState('editing');

        // Reset Views visually
        startPlayers.forEach(p => {
            updateViewPosition(playerRefs.current[p.id], p.pos.x, p.pos.y, PLAYER_SIZE);
        });
        updateViewPosition(discRef.current, discPos.current.x, discPos.current.y, DISC_SIZE);
    };

    // Confirm current movements and update player positions
    const handleConfirmMovement = () => {
        const currentPaths = playerPaths.current;
        const basePositions: Record<number, Position> = {};

        // Calculate final positions and update players
        players.current.forEach(player => {
            const path = currentPaths[player.id];
            if (path && path.length > 0) {
                const finalPos = path[path.length - 1];
                player.pos = { ...finalPos };
                player.origin = { ...finalPos };
                basePositions[player.id] = { ...finalPos };

                // Update visual position
                updateViewPosition(playerRefs.current[player.id], finalPos.x, finalPos.y, PLAYER_SIZE);
            } else {
                // No movement for this player, use current position
                basePositions[player.id] = { ...player.pos };
            }
        });

        // Save this sequence
        const sequence: MovementSequence = {
            playerPaths: { ...currentPaths },
            basePositions
        };

        setMovementSequences(prev => {
            const updated = [...prev];
            updated[currentSequenceIndex] = sequence;
            return updated;
        });

        // Clear paths for next sequence (but keep the player positions)
        playerPaths.current = {};

        showAlert('✓ Conferma', 'Movimenti confermati! Giocatori aggiornati alle nuove posizioni.');
    };

    // Prepare for a new movement sequence
    const handleNewSequence = () => {
        // Increment sequence index
        setCurrentSequenceIndex(prev => prev + 1);

        // Clear current paths
        playerPaths.current = {};

        showAlert('+ Nuova Sequenza', 'Pronto per disegnare nuovi movimenti dalle posizioni attuali.');
    };

    // Exit custom editing mode
    const handleExitCustom = () => {
        showConfirmation(
            'Uscire dalla modalità Custom?',
            'I progressi non salvati verranno persi.',
            () => {
                setIsEditing(false);
                resetPosition();
            },
            'Esci'
        );
    };

    // Helper function to find nearest player for disc snapping
    const findNearestPlayer = (pos: Position, snapRadius: number = PLAYER_SIZE * 2): Player | null => {
        let nearest: Player | null = null;
        let minDist = snapRadius;

        for (const p of players.current) {
            const dx = pos.x - p.pos.x;
            const dy = pos.y - p.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = p;
            }
        }


        return nearest;
    };

    // Save current scheme
    const handleSaveScheme = async () => {
        if (!schemeName.trim()) {
            showAlert('Errore', 'Inserisci un nome per lo schema');
            return;
        }
        if (!userProfile) {
            showAlert('Errore', 'Devi essere autenticato per salvare schemi');
            return;
        }

        try {
            const offensePositions = players.current
                .filter(p => p.team === 'offense')
                .sort((a, b) => a.id - b.id)
                .map(p => ({ x: p.pos.x, y: p.pos.y }));

            const defensePositions = players.current
                .filter(p => p.team === 'defense')
                .sort((a, b) => a.id - b.id)
                .map(p => ({ x: p.pos.x, y: p.pos.y }));

            await saveTacticalScheme({
                name: schemeName,
                createdBy: userProfile.uid,
                createdAt: new Date().toISOString(),
                gameFormat,
                offensePositions,
                defensePositions,
                forceDirection: forceDirection.current,
                discPaths: discPaths.length > 0 ? discPaths : undefined,
                movementSequences: movementSequences.length > 0 ? movementSequences : undefined
            });

            showAlert('Successo', 'Schema salvato con successo!');
            setSchemeName('');
            setShowSaveModal(false);
        } catch (error) {
            console.error('Error saving scheme:', error);
            showAlert('Errore', 'Impossibile salvare lo schema');
        }
    };

    // Load scheme
    const handleLoadScheme = (scheme: TacticalScheme) => {
        // Restore offense positions
        scheme.offensePositions.forEach((pos, i) => {
            const playerId = i + 1; // Offense IDs are 1-5
            const player = players.current.find(p => p.id === playerId);
            if (player) {
                player.pos = { ...pos };
                player.origin = { ...pos };
                updateViewPosition(playerRefs.current[playerId], pos.x, pos.y, PLAYER_SIZE);
            }
        });

        // Restore defense positions
        scheme.defensePositions.forEach((pos, i) => {
            const playerId = i + 6; // Defense IDs are 6-10
            const player = players.current.find(p => p.id === playerId);
            if (player) {
                player.pos = { ...pos };
                player.origin = { ...pos };
                updateViewPosition(playerRefs.current[playerId], pos.x, pos.y, PLAYER_SIZE);
            }
        });

        // Restore force direction
        forceDirection.current = scheme.forceDirection;

        // Restore game format
        setGameFormat(scheme.gameFormat);

        // Restore disc paths if exists
        if (scheme.flightPath) {
            // Legacy support: convert old flightPath to discPaths format
            setDiscPaths([scheme.flightPath]);
            setCurrentDiscPassIndex(0);
        } else if ((scheme as any).discPaths) {
            setDiscPaths((scheme as any).discPaths);
            setCurrentDiscPassIndex(0);
        } else {
            setDiscPaths([]);
            setCurrentDiscPassIndex(0);
        }

        // Restore movement sequences if exists
        if (scheme.movementSequences) {
            setMovementSequences(scheme.movementSequences);
            setCurrentSequenceIndex(0);
        } else {
            setMovementSequences([]);
            setCurrentSequenceIndex(0);
        }

        setShowLoadModal(false);
        setActiveScheme('custom');
        showAlert('Successo', `Schema "${scheme.name}" caricato!`);
    };

    // Watch for scheme changes to reset positions
    useEffect(() => {
        if (gameState === 'editing') {
            resetPosition();
        }
    }, [activeScheme]);

    // Subscribe to saved schemes
    useEffect(() => {
        const unsubscribe = subscribeToTacticalSchemes(setSavedSchemes);
        return unsubscribe;
    }, []);

    // Auto-increment disc pass index when switching to Disc phase after completing a pass
    const prevEditPhase = useRef<EditPhase>('setup');
    useEffect(() => {
        if (editPhase === 'disc' && prevEditPhase.current !== 'disc') {
            // Switching TO disc phase from another phase
            // Check if the current pass has been drawn (has points)
            const currentPass = discPaths[currentDiscPassIndex];
            if (currentPass && currentPass.length > 0) {
                // Current pass is complete, prepare for new pass
                setCurrentDiscPassIndex(discPaths.length);
                if (discPaths.length === currentDiscPassIndex) {
                    // Add empty array for new pass
                    setDiscPaths(prev => [...prev, []]);
                }
            }
        }
        prevEditPhase.current = editPhase;
    }, [editPhase, discPaths, currentDiscPassIndex]);




    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (evt) => {
                const { gameState, showTacticsModal, isPlaying, isEditing } = stateRef.current;

                // Always capture gestures during editing or when not playing
                if (gameState === 'editing' && !showTacticsModal && !isPlaying) {
                    // Check for multi-touch (pinch zoom)
                    if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                        gestureState.current.isPinching = true;
                        return true;
                    }
                    return true; // Allow pan or editing
                }
                return false;
            },

            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Capture multi-touch events for zooming
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    return true;
                }
                // Allow dragging if moved enough
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },

            onPanResponderGrant: (evt, gestState) => {
                const { locationX, locationY } = evt.nativeEvent;
                const { editPhase, isEditing } = stateRef.current;

                // Multi-touch pinch zoom setup
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    const touches = evt.nativeEvent.touches;
                    const dx = touches[0].pageX - touches[1].pageX;
                    const dy = touches[0].pageY - touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    gestureState.current.lastScale = distance;
                    gestureState.current.isPinching = true;
                    return;
                }

                gestureState.current.isPinching = false;

                // Store starting position for pan
                gestureState.current.panStartX = panOffset.x;
                gestureState.current.panStartY = panOffset.y;

                if (!isEditing) return;

                // Hit Test Players
                let touchedPlayer = null;
                let minD = 9999;
                for (const p of players.current) {
                    const dx = locationX - p.pos.x;
                    const dy = locationY - p.pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < PLAYER_SIZE * 2 && dist < minD) {
                        minD = dist;
                        touchedPlayer = p;
                    }
                }

                if (touchedPlayer) {
                    draggingPlayerId.current = touchedPlayer.id;

                    if (editPhase === 'setup') {
                        // PHASE 1: SETUP
                        setSelectedPlayerId(touchedPlayer.id);
                        delete playerPaths.current[touchedPlayer.id];
                        setForceUpdate(prev => prev + 1);
                    } else if (editPhase === 'movement') {
                        // PHASE 2: MOVEMENT
                        setSelectedPlayerId(touchedPlayer.id);
                        const startPos = { ...touchedPlayer.pos };
                        playerPaths.current[touchedPlayer.id] = [startPos, { x: locationX, y: locationY }];
                        setForceUpdate(prev => prev + 1);
                    }
                } else {
                    // Touched Empty Space
                    if (editPhase === 'disc') {
                        // Determine disc start position
                        let startPos: Position;
                        if (discPaths.length > 0 && discPaths[discPaths.length - 1].length > 0) {
                            // Start from last point of last pass
                            const lastPath = discPaths[discPaths.length - 1];
                            startPos = lastPath[lastPath.length - 1];
                        } else {
                            // Start from current disc position
                            startPos = discPos.current;
                        }

                        discStartPosRef.current = startPos;
                        const newPath = [startPos, { x: locationX, y: locationY }];

                        // Update or create new pass
                        setDiscPaths(prev => {
                            const updated = [...prev];
                            updated[currentDiscPassIndex] = newPath;
                            return updated;
                        });
                    } else {
                        setSelectedPlayerId(null);
                    }
                }
            },

            onPanResponderMove: (evt, gestState) => {
                const { locationX, locationY } = evt.nativeEvent;
                const { editPhase, isEditing } = stateRef.current;

                // Handle pinch-to-zoom
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    const touches = evt.nativeEvent.touches;
                    const dx = touches[0].pageX - touches[1].pageX;
                    const dy = touches[0].pageY - touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (gestureState.current.lastScale > 0) {
                        const scale = distance / gestureState.current.lastScale;
                        setZoomLevel(prev => Math.max(0.5, Math.min(2.0, prev * scale)));
                    }

                    gestureState.current.lastScale = distance;
                    return;
                }

                // Handle panning when not editing
                if (!isEditing && !gestureState.current.isPinching) {
                    setPanOffset({
                        x: gestureState.current.panStartX + gestState.dx,
                        y: gestureState.current.panStartY + gestState.dy
                    });
                    return;
                }

                if (!isEditing) return;

                // PHASE 1: SETUP - Move Players
                if (editPhase === 'setup' && draggingPlayerId.current !== null) {
                    const p = players.current.find(pl => pl.id === draggingPlayerId.current);
                    if (p) {
                        const prevX = p.pos.x;
                        const prevY = p.pos.y;

                        // Clamp to field
                        p.pos.x = Math.max(0, Math.min(FIELD_WIDTH, locationX));
                        p.pos.y = Math.max(0, Math.min(FIELD_HEIGHT, locationY));

                        // Update Origin (Start Position)
                        p.origin = { ...p.pos };

                        updateViewPosition(playerRefs.current[p.id], p.pos.x, p.pos.y, PLAYER_SIZE);

                        // If handler, move disc
                        if (p.role === 'handler') {
                            discPos.current = { ...p.pos };
                            updateViewPosition(discRef.current, p.pos.x, p.pos.y, DISC_SIZE);
                        }

                        // LINKED DEFENSE LOGIC
                        const { defenseLocked } = stateRef.current;
                        if (defenseLocked && p.team === 'offense') {
                            // Find linked defender
                            const offset = gameFormat === '5v5' ? 5 : 7;
                            const defId = p.id + offset;
                            const defender = players.current.find(d => d.id === defId);

                            if (defender) {
                                // Calculate delta and apply to defender
                                const dx = p.pos.x - prevX;
                                const dy = p.pos.y - prevY;

                                defender.pos.x += dx;
                                defender.pos.y += dy;

                                // Clamp Defender
                                defender.pos.x = Math.max(0, Math.min(FIELD_WIDTH, defender.pos.x));
                                defender.pos.y = Math.max(0, Math.min(FIELD_HEIGHT, defender.pos.y));

                                defender.origin = { ...defender.pos };
                                updateViewPosition(playerRefs.current[defender.id], defender.pos.x, defender.pos.y, PLAYER_SIZE);
                            }
                        }

                    }
                }
                // PHASE 2: MOVEMENT - Draw Player Paths
                else if (editPhase === 'movement' && stateRef.current.selectedPlayerId !== null && draggingPlayerId.current !== null) {
                    if (playerPaths.current[stateRef.current.selectedPlayerId]) {
                        playerPaths.current[stateRef.current.selectedPlayerId].push({ x: locationX, y: locationY });
                        setForceUpdate(prev => prev + 1);
                    }
                }
                // PHASE 3: DISC - Draw Disc Path
                else if (editPhase === 'disc') {
                    const currentPos = { x: locationX, y: locationY };
                    const nearestPlayer = findNearestPlayer(currentPos);
                    setSnappedPlayerId(nearestPlayer?.id || null);

                    setDiscPaths(prev => {
                        const updated = [...prev];
                        const currentPath = updated[currentDiscPassIndex] || [discStartPosRef.current];
                        updated[currentDiscPassIndex] = [...currentPath, currentPos];
                        return updated;
                    });
                }
            },

            onPanResponderRelease: (evt, gestState) => {
                const { editPhase } = stateRef.current;

                if (editPhase === 'disc' && discPaths[currentDiscPassIndex]) {
                    const lastPath = discPaths[currentDiscPassIndex];
                    if (lastPath && lastPath.length > 0) {
                        const endPos = lastPath[lastPath.length - 1];
                        const nearestPlayer = findNearestPlayer(endPos);

                        if (nearestPlayer) {
                            // Snap to player
                            setDiscPaths(prev => {
                                const updated = [...prev];
                                updated[currentDiscPassIndex] = [...lastPath, nearestPlayer.pos];
                                return updated;
                            });

                            // Update disc position
                            discPos.current = { ...nearestPlayer.pos };
                            updateViewPosition(discRef.current, nearestPlayer.pos.x, nearestPlayer.pos.y, DISC_SIZE);
                        }
                    }
                }

                draggingPlayerId.current = null;
                gestureState.current.isPinching = false;
                setSnappedPlayerId(null);
            }
        })
    ).current;





    // ---Animation Loop (Multi-Sequence Support) ---
    const frameRef = useRef(0);
    const discFrameRef = useRef(0);

    useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            if (!stateRef.current.isPlaying) return;

            frameRef.current += 1;
            const currentF = frameRef.current;

            // Calculate total frames needed across ALL sequences
            let totalFrames = 0;
            let sequenceFrameBoundaries: { start: number, playerEnd: number, discEnd: number }[] = [];

            // Build frame boundaries for each sequence
            movementSequences.forEach((seq) => {
                const maxPlayerFrames = Math.max(
                    ...Object.values(seq.playerPaths).map(path => path?.length || 0),
                    0
                );
                // For now, we assume all disc passes happen after all sequences
                // (You can modify this if you want disc passes per sequence)

                const startFrame = totalFrames;
                const playerEndFrame = startFrame + maxPlayerFrames;

                sequenceFrameBoundaries.push({
                    start: startFrame,
                    playerEnd: playerEndFrame,
                    discEnd: playerEndFrame // No disc in this approach per sequence
                });

                totalFrames += maxPlayerFrames;
            });

            // Add disc movements after all player sequences
            const allDiscPoints = discPaths.flat();
            const discStartFrame = totalFrames;
            totalFrames += allDiscPoints.length;

            // Check if animation finished
            if (currentF > totalFrames && totalFrames > 0) {
                setIsPlaying(false);
                setGameState('editing');
                frameRef.current = 0;
                discFrameRef.current = 0;
                setCurrentFrame(0);
                return;
            }

            // Determine which sequence we're in
            let currentSequence = 0;
            for (let i = 0; i < sequenceFrameBoundaries.length; i++) {
                if (currentF <= sequenceFrameBoundaries[i].playerEnd) {
                    currentSequence = i;
                    break;
                }
                if (i === sequenceFrameBoundaries.length - 1) {
                    currentSequence = -1; // We're in disc phase
                }
            }

            // PHASE 1: Animate Players (within current sequence)
            if (currentSequence >= 0 && currentSequence < movementSequences.length) {
                const seq = movementSequences[currentSequence];
                const boundary = sequenceFrameBoundaries[currentSequence];
                const localFrame = currentF - boundary.start;

                players.current.forEach(p => {
                    const path = seq.playerPaths[p.id];

                    if (path && path.length > 0) {
                        const pointIndex = Math.min(localFrame, path.length - 1);
                        const point = path[pointIndex];

                        p.pos.x = point.x;
                        p.pos.y = point.y;
                        updateViewPosition(playerRefs.current[p.id], p.pos.x, p.pos.y, PLAYER_SIZE);
                    }
                    // Auto-follow for defenders
                    else if (p.team === 'defense') {
                        const offenseCount = gameFormat === '5v5' ? 5 : 7;
                        const attackerId = p.id - offenseCount;
                        const attacker = players.current.find(a => a.id === attackerId);

                        if (attacker) {
                            const basePos = seq.basePositions[p.id] || p.origin;
                            const attackerBase = seq.basePositions[attackerId] || attacker.origin;

                            const offsetX = basePos.x - attackerBase.x;
                            const offsetY = basePos.y - attackerBase.y;

                            p.pos.x = attacker.pos.x + offsetX;
                            p.pos.y = attacker.pos.y + offsetY;

                            updateViewPosition(playerRefs.current[p.id], p.pos.x, p.pos.y, PLAYER_SIZE);
                        }
                    }
                });
            }

            // PHASE 2: Animate Disc (after all player sequences)
            if (currentF > discStartFrame && allDiscPoints.length > 0) {
                const discLocalFrame = currentF - discStartFrame;
                const pointIndex = Math.min(discLocalFrame, allDiscPoints.length - 1);
                const point = allDiscPoints[pointIndex];

                discPos.current = { x: point.x, y: point.y };
                updateViewPosition(discRef.current, point.x, point.y, DISC_SIZE);
            }

            setCurrentFrame(currentF);
            animationFrameId = requestAnimationFrame(animate);
        };

        if (isPlaying) {
            setGameState('playing');
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Reset to initial positions when stopped
            if (frameRef.current > 0) {
                players.current.forEach(p => {
                    p.pos.x = p.origin.x;
                    p.pos.y = p.origin.y;
                    updateViewPosition(playerRefs.current[p.id], p.pos.x, p.pos.y, PLAYER_SIZE);
                });

                // Reset Disc
                const allDiscPoints = discPaths.flat();

                // If no disc paths, disc stays with handler?
                if (allDiscPoints.length > 0) {
                    discPos.current = { x: allDiscPoints[0].x, y: allDiscPoints[0].y };
                    updateViewPosition(discRef.current, discPos.current.x, discPos.current.y, DISC_SIZE);
                }

                setCurrentFrame(0);
                frameRef.current = 0;
            }
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, maxFrames]);

    const changeScheme = (scheme: SchemeType) => {
        setActiveScheme(scheme);
        if (scheme === 'custom') {
            setIsEditing(true);
            setEditPhase('setup'); // Start in setup phase
        } else {
            setIsEditing(false);
            setEditPhase('setup');
        }
        setShowTacticsModal(false);
    };

    const toggleFormat = () => {
        setGameFormat(prev => prev === '5v5' ? '7v7' : '5v5');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, { flexDirection: 'column', height: 160, justifyContent: 'center', gap: 10 }]}>
                {!isEditing ? (
                    <>
                        {/* Row 1: Back Button & Title */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative' }}>
                            {/* Back Button - Rotated 180 degrees */}
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={{ position: 'absolute', left: 10, padding: 5, zIndex: 10, transform: [{ rotate: '180deg' }] }}
                            >
                                <Image source={require('../assets/arrow.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>

                            <Text style={[styles.scoreText, { fontSize: 22 }]} numberOfLines={1}>Tactical Scheme</Text>
                        </View>

                        {/* Row 2: Tools & Zoom */}
                        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center', justifyContent: 'center' }}>
                            {discPaths.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsPlaying(!isPlaying);
                                        setGameState(isPlaying ? 'editing' : 'playing');
                                    }}
                                    style={styles.tacticsButton}
                                >
                                    <Image
                                        source={isPlaying ? require('../assets/cancella.png') : require('../assets/play.png')}
                                        style={{ width: 24, height: 24 }}
                                    />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setShowSaveModal(true)} style={styles.tacticsButton}>
                                <Image source={require('../assets/save.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowLoadModal(true)} style={styles.tacticsButton}>
                                <Image source={require('../assets/folder.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowTacticsModal(true)} style={styles.tacticsButton}>
                                <Image source={require('../assets/threeLine.png')} style={{ width: 24, height: 24 }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setGameFormat(prev => prev === '5v5' ? '7v7' : '5v5')}
                                style={[styles.tacticsButton, { paddingHorizontal: 8, justifyContent: 'center' }]}
                            >
                                <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>{gameFormat}</Text>
                            </TouchableOpacity>

                            {/* Zoom Controls */}
                            <View style={{ flexDirection: 'row', gap: 5, marginLeft: 10 }}>
                                <TouchableOpacity
                                    onPress={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}
                                    style={[styles.tacticsButton, { paddingHorizontal: 10 }]}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>-</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setZoomLevel(z => Math.min(2.0, z + 0.1))}
                                    style={[styles.tacticsButton, { paddingHorizontal: 10 }]}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                ) : (
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 5 }}>
                            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, padding: 2 }}>
                                {(['setup', 'movement', 'disc'] as EditPhase[]).map((phase) => (
                                    <TouchableOpacity
                                        key={phase}
                                        onPress={() => setEditPhase(phase)}
                                        style={{
                                            paddingVertical: 6,
                                            paddingHorizontal: 12,
                                            backgroundColor: editPhase === phase ? '#fff' : 'transparent',
                                            borderRadius: 18
                                        }}
                                    >
                                        <Text style={{
                                            color: editPhase === phase ? '#2b9348' : '#fff',
                                            fontWeight: 'bold',
                                            fontSize: 12,
                                            textTransform: 'capitalize'
                                        }}>
                                            {phase === 'setup' ? '1. Posiziona' : phase === 'movement' ? '2. Movimento' : '3. Disco'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
                            <Text style={styles.scoreText}>Editing: {schemeName || 'Custom'}</Text>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {/* Defense Lock Toggle (Only visible in Setup) */}
                                {editPhase === 'setup' && (
                                    <TouchableOpacity
                                        onPress={() => setDefenseLocked(!defenseLocked)}
                                        style={[styles.tacticsButton, { backgroundColor: defenseLocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,0,0,0.3)' }]}
                                    >
                                        <Text style={{ fontSize: 16 }}>{defenseLocked ? '🔒' : '🔓'}</Text>
                                    </TouchableOpacity>
                                )}


                                {/* Movement Phase Controls */}
                                {editPhase === 'movement' && (
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        {/* Sequence Indicator */}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                                            Seq {currentSequenceIndex + 1}/{Math.max(movementSequences.length, currentSequenceIndex + 1)}
                                        </Text>

                                        {/* Confirm Movement Button (visible when paths drawn) */}
                                        {Object.keys(playerPaths.current).length > 0 && (
                                            <TouchableOpacity
                                                onPress={handleConfirmMovement}
                                                style={[styles.tacticsButton, { backgroundColor: 'rgba(46, 147, 72, 0.6)', paddingHorizontal: 10 }]}
                                            >
                                                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>✓ Conferma</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* New Sequence Button (visible after confirming at least one) */}
                                        {movementSequences.length > currentSequenceIndex && (
                                            <TouchableOpacity
                                                onPress={handleNewSequence}
                                                style={[styles.tacticsButton, { backgroundColor: 'rgba(76, 201, 240, 0.6)', paddingHorizontal: 10 }]}
                                            >
                                                <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>+ Nuova Seq</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* Exit Custom Mode Button */}
                                        <TouchableOpacity
                                            onPress={handleExitCustom}
                                            style={[styles.tacticsButton, { backgroundColor: 'rgba(230, 57, 70, 0.5)' }]}
                                        >
                                            <Text style={{ color: 'white', fontSize: 14 }}>← Esci</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Disc Multi-Pass Controls */}
                                {editPhase === 'disc' && (
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                // Add new pass
                                                setCurrentDiscPassIndex(prev => prev + 1);
                                                setDiscPaths(prev => [...prev, []]);
                                            }}
                                            style={[styles.tacticsButton, { backgroundColor: 'rgba(76, 201, 240, 0.4)', paddingHorizontal: 8 }]}
                                        >
                                            <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>➕ Nuovo Pass</Text>
                                        </TouchableOpacity>

                                        {discPaths.length > 0 && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    // Remove last pass
                                                    setDiscPaths(prev => prev.slice(0, -1));
                                                    setCurrentDiscPassIndex(prev => Math.max(0, prev - 1));
                                                }}
                                                style={[styles.tacticsButton, { backgroundColor: 'rgba(230, 57, 70, 0.4)' }]}
                                            >
                                                <Image source={require('../assets/cancella.png')} style={{ width: 20, height: 20 }} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.tacticsButton}>
                                    <Image source={require('../assets/save.png')} style={{ width: 20, height: 20 }} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <View
                    style={[
                        styles.field,
                        {
                            width: FIELD_WIDTH,
                            height: FIELD_HEIGHT,
                            transform: [
                                { translateX: panOffset.x },
                                { translateY: panOffset.y },
                                { scale: zoomLevel }
                            ]
                        }
                    ]}
                    {...panResponder.panHandlers}
                >

                    {/* Top Endzone Area (Colored Background) */}
                    <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: ENDZONE_HEIGHT,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    }} />

                    {/* Top Goal Line (Attack) */}
                    <View style={{
                        position: 'absolute',
                        top: ENDZONE_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: 'white',
                    }} />
                    <View style={{
                        position: 'absolute',
                        top: ENDZONE_HEIGHT - 40,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                    }}>
                        <Text style={[styles.endzoneText, { fontSize: 20 }]}>ENDZONE</Text>
                    </View>

                    {/* Top Brick Mark (X) */}
                    <View style={{
                        position: 'absolute',
                        top: TOP_BRICK_Y - 15,
                        left: FIELD_WIDTH / 2 - 15,
                        width: 30,
                        height: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>X</Text>
                    </View>

                    {/* Bottom Brick Mark (X) */}
                    <View style={{
                        position: 'absolute',
                        top: BOTTOM_BRICK_Y - 15,
                        left: FIELD_WIDTH / 2 - 15,
                        width: 30,
                        height: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>X</Text>
                    </View>

                    {/* Bottom Endzone Area (Colored Background) */}
                    <View style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: ENDZONE_HEIGHT,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    }} />

                    {/* Bottom Goal Line (Defend) */}
                    <View style={{
                        position: 'absolute',
                        top: FIELD_HEIGHT - ENDZONE_HEIGHT,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: 'white',
                    }} />
                    <View style={{
                        position: 'absolute',
                        top: FIELD_HEIGHT - ENDZONE_HEIGHT + 10,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                    }}>
                        <Text style={[styles.endzoneText, { fontSize: 20 }]}>ENDZONE</Text>
                    </View>


                    {/* Render Player Paths */}
                    {Object.values(playerPaths.current).map((path, index) =>
                        path.map((p, i) => (
                            (i % 3 === 0) &&
                            <View key={`player-path-${index}-${i}`} style={[styles.pathDot, { left: p.x, top: p.y, backgroundColor: 'rgba(255, 215, 0, 0.6)' }]} />
                        ))
                    )}

                    {/* Render all disc paths */}
                    {discPaths.map((path, passIndex) =>
                        path.map((p, i) =>
                            (i % 3 === 0) && (
                                <View
                                    key={`disc-path-${passIndex}-${i}`}
                                    style={[
                                        styles.pathDot,
                                        {
                                            left: p.x,
                                            top: p.y,
                                            backgroundColor: 'rgba(255, 255, 255, 0.8)'
                                        }
                                    ]}
                                />
                            )
                        )
                    )}

                    {/* Visual feedback for snap */}
                    {snappedPlayerId !== null && players.current.find(p => p.id === snappedPlayerId) && (
                        <View
                            style={{
                                position: 'absolute',
                                left: players.current.find(p => p.id === snappedPlayerId)!.pos.x - PLAYER_SIZE,
                                top: players.current.find(p => p.id === snappedPlayerId)!.pos.y - PLAYER_SIZE,
                                width: PLAYER_SIZE * 2,
                                height: PLAYER_SIZE * 2,
                                borderRadius: PLAYER_SIZE,
                                borderWidth: 2,
                                borderColor: '#4cc9f0',
                                borderStyle: 'dashed',
                            }}
                        />
                    )}

                    {/* Initial Render of Players */}
                    {players.current.map(p => (
                        <View
                            key={p.id}
                            pointerEvents="none"
                            ref={(ref) => { playerRefs.current[p.id] = ref; }}
                            style={[
                                styles.player,
                                {
                                    left: p.pos.x - PLAYER_SIZE / 2,
                                    top: p.pos.y - PLAYER_SIZE / 2,
                                    backgroundColor: p.team === 'offense' ? '#4cc9f0' : '#e63946',
                                    borderColor: (p.id === selectedPlayerId && isEditing) ? '#4cc9f0' : 'white',
                                    borderWidth: (p.id === selectedPlayerId && isEditing) ? 2 : 1,
                                    borderStyle: (p.id === selectedPlayerId && isEditing) ? 'dashed' : 'solid'
                                }
                            ]}
                        />
                    ))}

                    {/* Disc */}
                    <View
                        ref={discRef}
                        pointerEvents="none"
                        style={[
                            styles.disc,
                            {
                                left: discPos.current.x - DISC_SIZE / 2,
                                top: discPos.current.y - DISC_SIZE / 2,
                            }
                        ]}
                    />

                    {/* Modal for Tactics */}
                    {showTacticsModal && (
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Choose Tactics</Text>
                                <TouchableOpacity style={styles.schemeButton} onPress={() => changeScheme('vertical')}>
                                    <Text style={styles.schemeText}>Vertical Stack</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.schemeButton} onPress={() => changeScheme('horizontal')}>
                                    <Text style={styles.schemeText}>Horizontal Stack</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.schemeButton} onPress={() => changeScheme('side')}>
                                    <Text style={styles.schemeText}>Side Stack</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.schemeButton, { backgroundColor: '#4361ee', marginTop: 10 }]} onPress={() => changeScheme('custom')}>
                                    <Text style={styles.schemeText}>Custom / Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.schemeButton, { backgroundColor: '#e63946' }]} onPress={() => setShowTacticsModal(false)}>
                                    <Text style={styles.schemeText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Save Scheme Modal */}
                    {showSaveModal && (
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Salva Schema</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Nome schema..."
                                    placeholderTextColor="#999"
                                    value={schemeName}
                                    onChangeText={setSchemeName}
                                />
                                <TouchableOpacity style={[styles.schemeButton, { backgroundColor: '#2a9d8f' }]} onPress={handleSaveScheme}>
                                    <Text style={styles.schemeText}>Salva</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.schemeButton, { backgroundColor: '#e63946' }]} onPress={() => setShowSaveModal(false)}>
                                    <Text style={styles.schemeText}>Annulla</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Load Scheme Modal */}
                    {showLoadModal && (
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                                <Text style={styles.modalTitle}>Carica Schema</Text>
                                <View style={{ maxHeight: 400, width: '100%' }}>
                                    {savedSchemes.length === 0 ? (
                                        <Text style={{ color: 'white', textAlign: 'center', marginVertical: 20 }}>Nessuno schema salvato</Text>
                                    ) : (
                                        savedSchemes.map(scheme => (
                                            <View key={scheme.id} style={styles.schemeListItem}>
                                                <TouchableOpacity
                                                    style={{ flex: 1 }}
                                                    onPress={() => handleLoadScheme(scheme)}
                                                >
                                                    <Text style={styles.schemeText}>{scheme.name}</Text>
                                                    <Text style={{ color: '#999', fontSize: 12 }}>
                                                        {new Date(scheme.createdAt).toLocaleDateString('it-IT')}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={async () => {
                                                        showConfirmation(
                                                            'Conferma Eliminazione',
                                                            `Eliminare lo schema "${scheme.name}"?`,
                                                            async () => {
                                                                try {
                                                                    await deleteTacticalScheme(scheme.id);
                                                                    showAlert('Successo', 'Schema eliminato');
                                                                } catch (error) {
                                                                    showAlert('Errore', 'Impossibile eliminare');
                                                                }
                                                            },
                                                            'Elimina'
                                                        );
                                                    }}
                                                >
                                                    <Image source={require('../assets/bin.png')} style={{ width: 24, height: 24 }} />
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>
                                <TouchableOpacity style={[styles.schemeButton, { backgroundColor: '#e63946', marginTop: 10 }]} onPress={() => setShowLoadModal(false)}>
                                    <Text style={styles.schemeText}>Chiudi</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}


                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#2b9348',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#1b4332',
    },
    backButton: {
        padding: 5,
    },
    tacticsButton: {
        padding: 5,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 5,
    },
    scoreText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    field: {
        backgroundColor: '#38b000',
        overflow: 'hidden',
        alignSelf: 'center',
        // @ts-ignore - userSelect is web-only
        userSelect: 'none',
    },
    endzone: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderBottomWidth: 2,
        borderColor: 'white',
    },
    endzoneTextContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    endzoneText: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '900',
        fontSize: 30,
        letterSpacing: 5,
    },
    player: {
        position: 'absolute',
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        borderRadius: PLAYER_SIZE / 2,
        ...Platform.select({
            web: {
                boxShadow: '0px 1px 3px rgba(0,0,0,0.3)',
            },
            default: {
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 1,
            }
        }),
        justifyContent: 'center',
        alignItems: 'center',
    },
    disc: {
        position: 'absolute',
        width: DISC_SIZE,
        height: DISC_SIZE,
        borderRadius: DISC_SIZE / 2,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ccc',
        elevation: 4,
    },
    pathDot: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayText: {
        color: '#ffd166',
        fontSize: 48,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#4cc9f0',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        elevation: 5,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    hintText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        textAlign: 'center',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 15,
        width: '80%',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#1b4332',
    },
    schemeButton: {
        backgroundColor: '#2b9348',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    schemeText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    textInput: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        width: '100%',
        fontSize: 16,
    },
    schemeListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1b4332',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        width: '100%',
    },
    brickLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        borderTopWidth: 2,
        borderTopColor: 'white',
        borderStyle: 'dashed',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    brickText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        backgroundColor: '#38b000',
        paddingHorizontal: 5,
    },
});
