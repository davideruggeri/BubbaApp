import { StyleSheet } from 'react-native';

export const tournamentDetailStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        width: '100%',
    },
    actionBar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
    },
    actionChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionChipText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#e0e0e0',
        borderRadius: 10,
        padding: 4,
        gap: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    summaryCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 6,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    summaryItem: {
        alignItems: 'center',
    },
    summaryNumber: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    summaryLabel: {
        fontSize: 11,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    summaryDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#ccc',
    },
    matchCard: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardContent: {
        padding: 16,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '500',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginRight: 6,
    },
    liveText: {
        color: '#EF4444',
        fontSize: 11,
        fontWeight: 'bold',
    },
    completedBadge: {
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    completedBadgeText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
    },
    matchBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    opponentText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    matchBadges: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    detailBadge: {
        fontSize: 11,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
        color: '#333',
        fontWeight: '600',
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    scoreSubText: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },
    cardActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        width: 1,
        height: '100%',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    statsScrollContent: {
        padding: 16,
        gap: 14,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    kpiCard: {
        flex: 1,
        minWidth: 130,
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        alignItems: 'center',
    },
    kpiValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    kpiLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    tableContainer: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
    },
    tableTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    tableSub: {
        fontSize: 12,
        marginTop: 2,
        marginBottom: 12,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    tableHeaderRow: {
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderRadius: 8,
    },
    cellCol: {
        paddingHorizontal: 8,
    },
    colName: {
        width: 140,
    },
    colNum: {
        width: 58,
        textAlign: 'center',
    },
    headerCellText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#444',
    },
    genderTag: {
        fontSize: 11,
        fontWeight: 'bold',
        marginRight: 6,
    },
    cellText: {
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 480,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        marginBottom: 10,
    },
    dayChipBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        minWidth: 100,
    },
    dayChipNum: {
        fontSize: 10,
        fontWeight: '700',
    },
    dayChipDate: {
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'capitalize',
        marginTop: 2,
    },
    customDateBtn: {
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    eventListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
});
