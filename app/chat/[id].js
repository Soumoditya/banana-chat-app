import { useState, useEffect, useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Modal,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import {
    subscribeToMessages,
    sendMessage,
    markAsRead,
    addReaction,
    deleteMessage,
    getChatInfo,
    setTyping,
    subscribeToTyping,
    pinMessage,
    unpinMessage,
    deleteMultipleMessages,
    clearChat,
} from '../../services/chat';
import { getUserProfile } from '../../services/users';
import { updateStreak } from '../../services/streaks';
import { uploadToCloudinary } from '../../config/cloudinary';
import { formatMessageTime, formatDateHeader, getInitials } from '../../utils/helpers';
import { REACTIONS, MESSAGE_TYPES } from '../../utils/constants';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio, Video, ResizeMode } from 'expo-av';
import EmojiPicker from '../../components/EmojiPicker';
import GiphyPicker from '../../components/GiphyPicker';
import ImageViewer from '../../components/ImageViewer';
import VideoViewer from '../../components/VideoViewer';

export default function ChatScreen() {
    const { id: chatId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [chatInfo, setChatInfo] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const [typing, setTypingUsers] = useState({});
    const [showMenu, setShowMenu] = useState(false);
    const [showReactions, setShowReactions] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGiphyPicker, setShowGiphyPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerVideo, setViewerVideo] = useState(null);
    const recordingRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const flatListRef = useRef(null);
    const [sending, setSending] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedMsgs, setSelectedMsgs] = useState([]);
    const [pinnedMsg, setPinnedMsg] = useState(null);

    useEffect(() => {
        loadChatInfo();
        const unsubMessages = subscribeToMessages(chatId, (msgs) => {
            setMessages(msgs);
            msgs.forEach(msg => {
                if (msg.senderId !== user?.uid && !msg.readBy?.[user?.uid]) {
                    markAsRead(chatId, msg.id, user.uid);
                }
            });
        });

        const unsubTyping = subscribeToTyping(chatId, (typingState) => {
            setTypingUsers(typingState);
        });

        return () => {
            unsubMessages();
            unsubTyping();
            setTyping(chatId, user?.uid, false);
        };
    }, [chatId]);

    // Update pinned message when messages or chatInfo changes
    useEffect(() => {
        if (chatInfo?.pinnedMessageId && messages.length > 0) {
            const pm = messages.find(m => m.id === chatInfo.pinnedMessageId);
            setPinnedMsg(pm || null);
        } else {
            setPinnedMsg(null);
        }
    }, [chatInfo, messages]);

    const loadChatInfo = async () => {
        const info = await getChatInfo(chatId);
        setChatInfo(info);

        if (info?.type === 'dm') {
            const otherId = info.participants?.find(p => p !== user?.uid);
            if (otherId) {
                const profile = await getUserProfile(otherId);
                setOtherUser(profile);
            }
        }
    };

    const getChatName = () => {
        if (!chatInfo) return 'Chat';
        if (chatInfo.isBroadcast) return '📢 Broadcast';
        if (chatInfo.type === 'group') return chatInfo.groupName || 'Group';
        if (chatInfo.nicknames?.[otherUser?.id]) return chatInfo.nicknames[otherUser.id];
        return otherUser?.displayName || 'User';
    };

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;
        try {
            setSending(true);
            await sendMessage(chatId, {
                senderId: user.uid,
                text: inputText.trim(),
                type: MESSAGE_TYPES.TEXT,
                replyTo: replyTo?.id || null,
            });
            if (chatInfo?.type === 'dm') {
                const otherId = chatInfo.participants?.find(p => p !== user.uid);
                if (otherId) updateStreak(user.uid, otherId);
            }
            setInputText('');
            setReplyTo(null);
            setTyping(chatId, user.uid, false);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSending(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setSending(true);
                const isVideo = asset.type === 'video';
                const uploaded = await uploadToCloudinary(asset.uri, isVideo ? 'video' : 'image');
                await sendMessage(chatId, {
                    senderId: user.uid,
                    text: '',
                    type: isVideo ? MESSAGE_TYPES.VIDEO : MESSAGE_TYPES.PHOTO,
                    media: uploaded.url,
                });
                setSending(false);
            }
        } catch (err) {
            setSending(false);
            Alert.alert('Error', 'Failed to send media: ' + err.message);
        }
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow microphone access');
                return;
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await recording.startAsync();
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(d => d + 1);
            }, 1000);
        } catch (err) {
            Alert.alert('Error', 'Failed to start recording: ' + err.message);
        }
    };

    const stopAndSendRecording = async () => {
        try {
            clearInterval(recordingTimerRef.current);
            setIsRecording(false);
            if (!recordingRef.current) return;
            await recordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            if (!uri) return;
            setSending(true);
            const uploaded = await uploadToCloudinary(uri, 'video');
            await sendMessage(chatId, {
                senderId: user.uid,
                text: '',
                type: MESSAGE_TYPES.VOICE,
                media: uploaded.url,
                duration: recordingDuration,
            });
            setSending(false);
        } catch (err) {
            setSending(false);
            Alert.alert('Error', 'Failed to send voice note: ' + err.message);
        }
    };

    const cancelRecording = async () => {
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
            } catch {}
            recordingRef.current = null;
        }
    };

    // GIF sending
    const handleSendGif = async (gifUrl, title) => {
        try {
            setSending(true);
            await sendMessage(chatId, {
                senderId: user.uid,
                text: title || '',
                type: MESSAGE_TYPES.GIF,
                media: gifUrl,
            });
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSending(false);
        }
    };

    // Voice playback
    const playVoiceNote = async (uri) => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            await sound.playAsync();
        } catch (err) {
            Alert.alert('Error', 'Could not play audio');
        }
    };
    const handleInputChange = (text) => {
        setInputText(text);
        if (text.length > 0) setTyping(chatId, user.uid, true);
        else setTyping(chatId, user.uid, false);
    };

    const handleReaction = async (messageId, emoji) => {
        await addReaction(chatId, messageId, user.uid, emoji);
        setShowReactions(null);
    };

    const handlePinMessage = async (msg) => {
        await pinMessage(chatId, msg.id);
        await loadChatInfo();
        setShowReactions(null);
    };

    const handleUnpin = async () => {
        await unpinMessage(chatId);
        await loadChatInfo();
    };

    const toggleSelect = (msgId) => {
        if (selectedMsgs.includes(msgId)) {
            setSelectedMsgs(selectedMsgs.filter(id => id !== msgId));
        } else {
            setSelectedMsgs([...selectedMsgs, msgId]);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedMsgs.length === 0) return;
        Alert.alert('Delete Messages', `Delete ${selectedMsgs.length} message(s)?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteMultipleMessages(chatId, selectedMsgs);
                    setSelectedMsgs([]);
                    setSelectMode(false);
                }
            },
        ]);
    };

    const handleClearChat = () => {
        Alert.alert('Clear Chat', 'Are you sure? All messages will be permanently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: async () => {
                    await clearChat(chatId);
                    setShowMenu(false);
                }
            },
        ]);
    };

    const handleMsgLongPress = (msg) => {
        if (selectMode) {
            toggleSelect(msg.id);
        } else {
            setShowReactions(msg.id);
        }
    };

    const getMessageTicks = (msg) => {
        if (msg.senderId !== user?.uid) return null;
        const readByOthers = Object.keys(msg.readBy || {}).filter(uid => uid !== user.uid);
        const deliveredToOthers = Object.keys(msg.delivered || {}).filter(uid => uid !== user.uid);
        if (readByOthers.length > 0) return 'read';
        if (deliveredToOthers.length > 0) return 'delivered';
        return 'sent';
    };

    const renderMessage = ({ item: msg, index }) => {
        const isMe = msg.senderId === user?.uid;
        const isSystem = msg.type === 'system';
        const ticks = getMessageTicks(msg);
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isSelected = selectedMsgs.includes(msg.id);

        let showDateHeader = false;
        if (!prevMsg || formatDateHeader(msg.timestamp) !== formatDateHeader(prevMsg.timestamp)) {
            showDateHeader = true;
        }

        if (isSystem) {
            return (
                <View>
                    {showDateHeader && <Text style={styles.dateHeader}>{formatDateHeader(msg.timestamp)}</Text>}
                    <View style={styles.systemMsg}>
                        <Text style={styles.systemMsgText}>{msg.text}</Text>
                    </View>
                </View>
            );
        }

        if (msg.deleted) {
            return (
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <View style={[styles.msgBubble, styles.deletedBubble]}>
                        <Text style={styles.deletedText}>🚫 Message deleted</Text>
                    </View>
                </View>
            );
        }

        return (
            <View>
                {showDateHeader && <Text style={styles.dateHeader}>{formatDateHeader(msg.timestamp)}</Text>}
                <Swipeable
                    ref={ref => { msg.swipeRef = ref; }}
                    renderLeftActions={() => (
                        <View style={{ justifyContent: 'center', width: 60, alignItems: 'center' }}>
                            <View style={{ backgroundColor: Colors.surfaceLight, borderRadius: 20, padding: 6 }}>
                                <Ionicons name="arrow-undo" size={20} color={Colors.text} />
                            </View>
                        </View>
                    )}
                    onSwipeableLeftOpen={() => {
                        setReplyTo(msg);
                        setTimeout(() => msg.swipeRef?.close(), 0);
                    }}
                    overshootLeft={false}
                >
                    <TouchableOpacity
                    style={[styles.msgRow, isMe && styles.msgRowMe, isSelected && styles.msgSelected]}
                    onLongPress={() => handleMsgLongPress(msg)}
                    onPress={() => selectMode ? toggleSelect(msg.id) : null}
                    activeOpacity={0.7}
                >
                    {/* Reply reference */}
                    {msg.replyTo && (
                        <TouchableOpacity 
                            style={[styles.replyRef, isMe && styles.replyRefMe]}
                            onPress={() => {
                                const targetIdx = messages.findIndex(m => m.id === msg.replyTo);
                                if (targetIdx >= 0) flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
                            }}
                        >
                            <View style={styles.replyBar} />
                            <Text style={styles.replyRefText} numberOfLines={1}>
                                {messages.find(m => m.id === msg.replyTo)?.text || 'Original message'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                        {/* Voice note */}
                        {msg.type === MESSAGE_TYPES.VOICE && msg.media && (
                            <TouchableOpacity style={styles.voiceNote} onPress={() => playVoiceNote(msg.media)}>
                                <Ionicons name="play-circle" size={32} color={isMe ? Colors.messageSentText : Colors.primary} />
                                <View style={styles.voiceWave}>
                                    {[...Array(12)].map((_, i) => (
                                        <View key={i} style={[styles.voiceBar, { height: 4 + Math.random() * 16 }]} />
                                    ))}
                                </View>
                                <Text style={[styles.voiceDuration, isMe && { color: Colors.messageSentText }]}>
                                    {msg.duration ? `${Math.floor(msg.duration / 60)}:${String(msg.duration % 60).padStart(2, '0')}` : '0:00'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {msg.type === MESSAGE_TYPES.PHOTO && msg.media && (
                            <TouchableOpacity onPress={() => setViewerImage(msg.media)} activeOpacity={0.9}>
                                <Image source={{ uri: msg.media }} style={styles.msgMedia} resizeMode="cover" />
                            </TouchableOpacity>
                        )}

                        {/* Video with expo-av */}
                        {msg.type === MESSAGE_TYPES.VIDEO && msg.media && (
                            <TouchableOpacity onPress={() => setViewerVideo(msg.media)} activeOpacity={0.9} style={{ position: 'relative' }}>
                                <Video
                                    source={{ uri: msg.media }}
                                    style={styles.msgMedia}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay={false}
                                    isMuted={true}
                                />
                                <View style={[styles.msgMedia, styles.videoOverlay]}>
                                    <Ionicons name="play-circle" size={54} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* GIF */}
                        {msg.type === MESSAGE_TYPES.GIF && msg.media && (
                            <Image source={{ uri: msg.media }} style={styles.msgMedia} resizeMode="cover" />
                        )}

                        {/* Text */}
                        {msg.text ? (
                            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{msg.text}</Text>
                        ) : null}

                        {/* Time + Ticks */}
                        <View style={styles.msgMeta}>
                            <Text style={styles.msgTime}>{formatMessageTime(msg.timestamp)}</Text>
                            {isMe && ticks && (
                                <Ionicons
                                    name={ticks === 'read' ? 'checkmark-done' : ticks === 'delivered' ? 'checkmark-done' : 'checkmark'}
                                    size={14}
                                    color={ticks === 'read' ? Colors.accent : Colors.textTertiary}
                                />
                            )}
                        </View>
                    </View>

                    {/* Reactions */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <View style={[styles.msgReactions, isMe && styles.msgReactionsMe]}>
                            {Object.values(msg.reactions).filter((v, i, a) => a.indexOf(v) === i).map((emoji, idx) => (
                                <Text key={idx} style={styles.msgReactionEmoji}>{emoji}</Text>
                            ))}
                        </View>
                    )}
                </TouchableOpacity>
                </Swipeable>

                {/* Reaction picker + actions */}
                {showReactions === msg.id && (
                    <View style={[styles.reactionPicker, isMe && styles.reactionPickerMe]}>
                        <View style={styles.reactionRow}>
                            {REACTIONS.map((emoji) => (
                                <TouchableOpacity key={emoji} style={styles.reactionBtn} onPress={() => handleReaction(msg.id, emoji)}>
                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => { setReplyTo(msg); setShowReactions(null); }}>
                                <Ionicons name="arrow-undo" size={18} color={Colors.text} />
                                <Text style={styles.actionBtnText}>Reply</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handlePinMessage(msg)}>
                                <Ionicons name="pin" size={18} color={Colors.accent} />
                                <Text style={styles.actionBtnText}>Pin</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelectMode(true); setSelectedMsgs([msg.id]); setShowReactions(null); }}>
                                <Ionicons name="checkbox-outline" size={18} color={Colors.text} />
                                <Text style={styles.actionBtnText}>Select</Text>
                            </TouchableOpacity>
                            {isMe && (
                                <TouchableOpacity style={styles.actionBtn} onPress={() => { deleteMessage(chatId, msg.id); setShowReactions(null); }}>
                                    <Ionicons name="trash" size={18} color={Colors.error} />
                                    <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity style={styles.dismissBtn} onPress={() => setShowReactions(null)}>
                            <Text style={styles.dismissBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const typingUserIds = Object.entries(typing)
        .filter(([uid, isTyping]) => uid !== user?.uid && isTyping)
        .map(([uid]) => uid);

    const isBroadcastBlocked = chatInfo?.isBroadcast && chatInfo?.adminId !== user?.uid;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior="padding"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity onPress={() => { if (selectMode) { setSelectMode(false); setSelectedMsgs([]); } else router.back(); }} style={styles.backBtn}>
                    <Ionicons name={selectMode ? "close" : "arrow-back"} size={24} color={Colors.text} />
                </TouchableOpacity>

                {selectMode ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.headerName}>{selectedMsgs.length} selected</Text>
                        <TouchableOpacity onPress={handleDeleteSelected}>
                            <Ionicons name="trash" size={22} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity style={styles.headerInfo} onPress={() => {
                            if (otherUser) router.push(`/user/${otherUser.id}`);
                        }}>
                            {otherUser?.avatar ? (
                                <TouchableOpacity onPress={() => setViewerImage(otherUser.avatar)}>
                                    <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
                                </TouchableOpacity>
                            ) : (
                                <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                                    <Text style={styles.headerAvatarText}>
                                        {chatInfo?.type === 'group' ? '👥' : getInitials(getChatName())}
                                    </Text>
                                </View>
                            )}
                            <View>
                                <Text style={styles.headerName}>{getChatName()}</Text>
                                {typingUserIds.length > 0 ? (
                                    <Text style={styles.typingText}>typing...</Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>

                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/call/${chatId}?type=audio&name=${encodeURIComponent(getChatName())}&avatar=${encodeURIComponent(otherUser?.photoURL || '')}`)}>
                                <Ionicons name="call-outline" size={20} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/call/${chatId}?type=video&name=${encodeURIComponent(getChatName())}&avatar=${encodeURIComponent(otherUser?.photoURL || '')}`)}>
                                <Ionicons name="videocam-outline" size={22} color={Colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMenu(true)}>
                                <Ionicons name="ellipsis-vertical" size={20} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            {/* Pinned message banner */}
            {pinnedMsg && !pinnedMsg.deleted && (
                <TouchableOpacity style={styles.pinnedBanner} onPress={() => {
                    const idx = messages.findIndex(m => m.id === pinnedMsg.id);
                    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                }}>
                    <Ionicons name="pin" size={14} color={Colors.accent} />
                    <Text style={styles.pinnedText} numberOfLines={1}>📌 {pinnedMsg.text || 'Media'}</Text>
                    <TouchableOpacity onPress={handleUnpin}>
                        <Ionicons name="close" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </TouchableOpacity>
            )}

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Reply Preview */}
            {replyTo && (
                <View style={styles.replyPreview}>
                    <View style={styles.replyPreviewBar} />
                    <View style={styles.replyPreviewContent}>
                        <Text style={styles.replyPreviewLabel}>Replying to</Text>
                        <Text style={styles.replyPreviewText} numberOfLines={1}>{replyTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyTo(null)}>
                        <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Input Bar */}
            {isBroadcastBlocked ? (
                <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
                    <Text style={{ color: Colors.textTertiary, fontSize: FontSize.sm, textAlign: 'center', flex: 1 }}>
                        📢 Only admins can send messages in broadcast
                    </Text>
                </View>
            ) : isRecording ? (
                <View style={[styles.inputBar, styles.recordingBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
                    <TouchableOpacity style={styles.cancelRecBtn} onPress={cancelRecording}>
                        <Ionicons name="trash" size={22} color={Colors.error} />
                    </TouchableOpacity>
                    <View style={styles.recordingIndicator}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.recordingText}>
                            {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.sendRecBtn} onPress={stopAndSendRecording}>
                        <Ionicons name="send" size={20} color={Colors.textInverse} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
                    <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
                        <Ionicons name="images" size={24} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.attachBtn} onPress={() => setShowGiphyPicker(true)}>
                        <View style={{ backgroundColor: Colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary }}>GIF</Text>
                        </View>
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        placeholder="Message..."
                        placeholderTextColor={Colors.textTertiary}
                        value={inputText}
                        onChangeText={handleInputChange}
                        multiline
                        maxLength={2000}
                    />

                    <TouchableOpacity style={styles.attachBtn} onPress={() => setShowEmojiPicker(true)}>
                        <Ionicons name="happy-outline" size={22} color={Colors.primary} />
                    </TouchableOpacity>

                    {inputText.trim() ? (
                        <TouchableOpacity
                            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                            onPress={handleSend}
                            disabled={sending}
                        >
                            <Ionicons name="send" size={20} color={Colors.textInverse} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
                            <Ionicons name="mic" size={22} color={Colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* 3-dot Menu Modal */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
                    <View style={[styles.menuCard, { marginTop: insets.top + 60 }]}>
                        {chatInfo?.type === 'group' && (
                            <>
                                <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    setShowMenu(false);
                                    Alert.prompt ? Alert.prompt('Edit Group Name', 'Enter new group name:', async (newName) => {
                                        if (newName?.trim()) {
                                            const { updateDoc, doc } = require('firebase/firestore');
                                            const { db } = require('../../config/firebase');
                                            await updateDoc(doc(db, 'chats', chatId), { groupName: newName.trim() });
                                            loadChatInfo();
                                        }
                                    }) : Alert.alert('Edit Group', 'Group name editing requires a text input modal — coming soon');
                                }}>
                                    <Ionicons name="pencil-outline" size={20} color={Colors.text} />
                                    <Text style={styles.menuText}>Edit Group Name</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.menuItem} onPress={() => {
                                    setShowMenu(false);
                                    router.push('/create-group');
                                }}>
                                    <Ionicons name="person-add-outline" size={20} color={Colors.text} />
                                    <Text style={styles.menuText}>Add Members</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setSelectMode(true); setShowMenu(false); }}>
                            <Ionicons name="checkbox-outline" size={20} color={Colors.text} />
                            <Text style={styles.menuText}>Select Messages</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { handleClearChat(); }}>
                            <Ionicons name="trash-outline" size={20} color={Colors.error} />
                            <Text style={[styles.menuText, { color: Colors.error }]}>Clear Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
                            <Ionicons name="close-outline" size={20} color={Colors.textSecondary} />
                            <Text style={styles.menuText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Emoji Picker */}
            <EmojiPicker
                visible={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelect={(emoji) => setInputText(prev => prev + emoji)}
            />

            {/* GIF Picker */}
            <GiphyPicker
                visible={showGiphyPicker}
                onClose={() => setShowGiphyPicker(false)}
                onSelect={handleSendGif}
            />

            {/* Image Viewer */}
            <ImageViewer
                visible={!!viewerImage}
                imageUrl={viewerImage}
                onClose={() => setViewerImage(null)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm, paddingBottom: Spacing.md,
        backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headerAvatar: { width: 38, height: 38, borderRadius: 19 },
    headerAvatarPlaceholder: { backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    headerAvatarText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: 'bold' },
    headerName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
    typingText: { color: Colors.accent, fontSize: FontSize.xs, fontStyle: 'italic' },
    headerBtn: { padding: Spacing.xs },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    pinnedBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.surfaceLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    },
    pinnedText: { flex: 1, color: Colors.text, fontSize: FontSize.sm },
    messagesList: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, paddingBottom: Spacing.lg },
    dateHeader: {
        color: Colors.textTertiary, fontSize: FontSize.xs, textAlign: 'center', marginVertical: Spacing.md,
        backgroundColor: Colors.surfaceLight, alignSelf: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full, overflow: 'hidden',
    },
    systemMsg: { alignItems: 'center', marginVertical: Spacing.sm },
    systemMsgText: {
        color: Colors.textTertiary, fontSize: FontSize.xs, fontStyle: 'italic',
        backgroundColor: Colors.surfaceLight, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, overflow: 'hidden',
    },
    msgRow: { marginVertical: 2, maxWidth: '80%', alignSelf: 'flex-start' },
    msgRowMe: { alignSelf: 'flex-end' },
    msgSelected: { backgroundColor: Colors.primarySurface + '40', borderRadius: BorderRadius.lg },
    msgBubble: { borderRadius: BorderRadius.lg, padding: Spacing.md, maxWidth: '100%' },
    msgBubbleMe: { backgroundColor: Colors.messageSent, borderBottomRightRadius: 4 },
    msgBubbleOther: { backgroundColor: Colors.messageReceived, borderBottomLeftRadius: 4 },
    deletedBubble: { backgroundColor: Colors.surfaceLight, opacity: 0.6 },
    deletedText: { color: Colors.textTertiary, fontSize: FontSize.sm, fontStyle: 'italic' },
    replyRef: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: Spacing.sm },
    replyRefMe: { justifyContent: 'flex-end' },
    replyBar: { width: 3, height: 20, backgroundColor: Colors.primary, borderRadius: 2, marginRight: Spacing.xs },
    replyRefText: { color: Colors.textTertiary, fontSize: FontSize.xs, maxWidth: 200 },
    voiceNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 160 },
    voiceWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
    voiceBar: { width: 3, backgroundColor: Colors.primary, borderRadius: 2, opacity: 0.7 },
    voiceDuration: { color: Colors.textTertiary, fontSize: FontSize.xs },
    msgMedia: { width: Dimensions.get('window').width * 0.72, height: Dimensions.get('window').width * 0.85, borderRadius: BorderRadius.md, marginBottom: Spacing.xs },
    videoOverlay: { position: 'absolute', top: 0, left: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
    videoPlayOverlay: { position: 'absolute', top: 0, left: 0, width: 260, height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.md },
    msgText: { color: Colors.messageReceivedText, fontSize: FontSize.md, lineHeight: 20 },
    msgTextMe: { color: Colors.messageSentText },
    msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
    msgTime: { color: Colors.textTertiary, fontSize: FontSize.xs },
    msgReactions: { flexDirection: 'row', marginTop: -4, marginLeft: Spacing.sm },
    msgReactionsMe: { justifyContent: 'flex-end', marginRight: Spacing.sm, marginLeft: 0 },
    msgReactionEmoji: { fontSize: 14, backgroundColor: Colors.surfaceLight, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1 },
    reactionPicker: {
        backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.xl,
        padding: Spacing.md, alignSelf: 'flex-start', marginBottom: Spacing.sm,
        maxWidth: '90%',
    },
    reactionPickerMe: { alignSelf: 'flex-end' },
    reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginBottom: Spacing.sm },
    actionRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.md },
    reactionBtn: { padding: 4 },
    reactionEmoji: { fontSize: 22 },
    actionBtn: { alignItems: 'center', gap: 2, paddingHorizontal: Spacing.sm },
    actionBtnText: { color: Colors.textSecondary, fontSize: 10 },
    dismissBtn: { alignItems: 'center', marginTop: Spacing.sm, paddingVertical: Spacing.xs },
    dismissBtnText: { color: Colors.textTertiary, fontSize: FontSize.sm },
    replyPreview: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderTopWidth: 0.5, borderTopColor: Colors.border,
    },
    replyPreviewBar: { width: 3, height: 30, backgroundColor: Colors.primary, borderRadius: 2, marginRight: Spacing.sm },
    replyPreviewContent: { flex: 1 },
    replyPreviewLabel: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600' },
    replyPreviewText: { color: Colors.textSecondary, fontSize: FontSize.sm },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm, paddingBottom: Spacing.lg,
        backgroundColor: Colors.surface, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: Spacing.sm,
    },
    attachBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    input: {
        flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        color: Colors.text, fontSize: FontSize.md, maxHeight: 100, minHeight: 40,
    },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    sendBtnDisabled: { backgroundColor: Colors.surfaceLight },
    micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    menuCard: {
        backgroundColor: Colors.surfaceElevated, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    menuText: { color: Colors.text, fontSize: FontSize.md },
    recordingBar: { justifyContent: 'center', gap: Spacing.md },
    cancelRecBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
    sendRecBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
    recordingText: { color: Colors.error, fontSize: FontSize.lg, fontWeight: '600' },
});
