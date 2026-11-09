import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Avatar, Empty, Loading } from '../../components/ui';
import { useAuth } from '../../context/Authcontext';
import { addComment, deleteComment, fetchComments } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { colors } from '../../lib/theme';
import type { Comment } from '../../types';

export default function CommentsScreen(): React.JSX.Element {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Comment>>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setComments(await fetchComments(postId));
    } catch (e) {
      Alert.alert('Could not load comments', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!user || !text.trim() || sending) return;
    setSending(true);
    try {
      const created = await addComment(user.id, postId, text);
      setComments((prev) => [...prev, created]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Could not send your comment', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const remove = (comment: Comment) => {
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
          } catch {
            Alert.alert('Could not delete the comment');
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty title="No comments yet" body="Start the conversation." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.author?.avatar_url ?? ""} name={item.author?.username ?? "user"} size={36} />
            <View style={styles.body}>
              <Text style={styles.name}>
                @{item.author?.username ?? "user"} <Text style={styles.time}>{timeAgo(item.created_at ?? "")}</Text>
              </Text>
              <Text style={styles.text}>{item.body ?? ""}</Text>
              {item.user_id === user?.id ? (
                <Pressable onPress={() => remove(item)} accessibilityRole="button">
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment"
          placeholderTextColor={colors.sub}
          style={styles.input}
          maxLength={500}
          multiline
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          style={[styles.send, (!text.trim() || sending) && styles.sendOff]}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 16, flexGrow: 1 },
  row: { flexDirection: 'row', gap: 10 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, fontWeight: '400', color: colors.sub },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  delete: { fontSize: 12, color: colors.danger, marginTop: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  send: { height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  sendText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
});
