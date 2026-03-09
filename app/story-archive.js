import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getArchivedStories, getArchiveDays } from '../services/stories';
import { STORY_LABELS } from '../utils/constants';

const { width } = Dimensions.get('window');
const CELL_SIZE = width / 7;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export default function StoryArchiveScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth());
    const [year, setYear] = useState(now.getFullYear());
    const [activeDays, setActiveDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
    const [dayStories, setDayStories] = useState([]);

    useEffect(() => { loadActiveDays(); }, [month, year]);

    const loadActiveDays = async () => {
        if (!user) return;
        const days = await getArchiveDays(user.uid, month, year);
        setActiveDays(days);
        setSelectedDay(null);
        setDayStories([]);
    };

    const selectDay = async (day) => {
        setSelectedDay(day);
        const stories = await getArchivedStories(user.uid, month, year);
        const filtered = stories.filter(s => {
            const ts = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null;
            return ts && ts.getDate() === day;
        });
        setDayStories(filtered);
    };

    const prevMonth = () => {
        if (month === 0) { setMonth(11); setYear(year - 1); }
        else setMonth(month - 1);
    };

    const nextMonth = () => {
        const now = new Date();
        if (year === now.getFullYear() && month >= now.getMonth()) return;
        if (month === 11) { setMonth(0); setYear(year + 1); }
        else setMonth(month + 1);
    };

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarCells = [];

    for (let i = 0; i < firstDay; i++) calendarCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

    const isToday = (day) => {
        const now = new Date();
        return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Story Archive</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Month navigator */}
            <View style={styles.monthNav}>
                <TouchableOpacity onPress={prevMonth}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
                <TouchableOpacity onPress={nextMonth}>
                    <Ionicons name="chevron-forward" size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaders}>
                {DAYS.map(d => (
                    <Text key={d} style={styles.dayHeaderText}>{d}</Text>
                ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
                {calendarCells.map((day, idx) => {
                    const hasStories = day && activeDays.includes(day);
                    const isSelected = day === selectedDay;
                    return (
                        <TouchableOpacity
                            key={idx}
                            style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                            onPress={() => day && (hasStories ? selectDay(day) : setSelectedDay(null))}
                            disabled={!day}
                        >
                            {day && (
                                <>
                                    <Text style={[
                                        styles.cellDay,
                                        isToday(day) && styles.cellDayToday,
                                        isSelected && styles.cellDaySelected,
                                    ]}>
                                        {day}
                                    </Text>
                                    {hasStories && <View style={styles.dot} />}
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Stories for selected day */}
            {selectedDay && (
                <View style={styles.dayContent}>
                    <Text style={styles.dayTitle}>
                        {MONTHS[month]} {selectedDay}, {year}
                    </Text>
                    {dayStories.length > 0 ? (
                        <FlatList
                            data={dayStories}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.storyThumb}>
                                    <Image source={{ uri: item.media }} style={styles.storyThumbImage} />
                                    <View style={styles.storyTypeBadge}>
                                        <Text style={styles.storyTypeText}>
                                            {STORY_LABELS[item.type] || 'Story'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
                        />
                    ) : (
                        <Text style={styles.noneText}>No stories on this day</Text>
                    )}
                </View>
            )}

            {!selectedDay && (
                <View style={styles.emptyHint}>
                    <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
                    <Text style={styles.emptyHintText}>Tap a highlighted day to view stories</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
    monthNav: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    },
    monthLabel: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
    dayHeaders: { flexDirection: 'row', paddingHorizontal: 0 },
    dayHeaderText: {
        width: CELL_SIZE, textAlign: 'center', color: Colors.textTertiary,
        fontSize: FontSize.xs, fontWeight: '600', paddingBottom: Spacing.sm,
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
        width: CELL_SIZE, height: CELL_SIZE, justifyContent: 'center', alignItems: 'center',
    },
    calendarCellSelected: { backgroundColor: Colors.primarySurface, borderRadius: CELL_SIZE / 2 },
    cellDay: { fontSize: FontSize.md, color: Colors.text },
    cellDayToday: { color: Colors.primary, fontWeight: 'bold' },
    cellDaySelected: { color: Colors.primary, fontWeight: 'bold' },
    dot: {
        width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary,
        marginTop: 2,
    },
    dayContent: { marginTop: Spacing.lg },
    dayTitle: {
        color: Colors.text, fontSize: FontSize.md, fontWeight: '600',
        paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
    },
    storyThumb: { width: 90, height: 130, marginRight: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden' },
    storyThumbImage: { width: '100%', height: '100%' },
    storyTypeBadge: {
        position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    },
    storyTypeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
    noneText: { color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
    emptyHint: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
    emptyHintText: { color: Colors.textTertiary, fontSize: FontSize.md },
});
