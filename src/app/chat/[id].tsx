import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ChatScreen() {
  const { id } = useLocalSearchParams(); // conversation id
  const conversationId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [myId, setMyId] = useState('');
  const [otherId, setOtherId] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !conversationId) return;
    setMyId(user.id);

    // 1. Check this conversation is really yours - security
    const { data: conv } = await supabase.from('conversations')
      .select('*').eq('id', conversationId).single();

    if (!conv) { router.back(); return; }
    if (conv.user1_id !== user.id && conv.user2_id !== user.id) { router.back(); return; }

    setOtherId(conv.user1_id === user.id ? conv.user2_id : conv.user1_id);

    // 2. Load all messages
    const { data } = await supabase.from('messages')
      .select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // 3. Realtime - new message appears instantly without refresh
    const channel = supabase.channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const msgText = text.trim();
    setText('');

    // Optimistic - show instantly
    const tempMsg = { id: `temp-${Date.now()}`, sender_id: myId, text: msgText, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: myId,
      text: msgText,
    });
    if (error) {
      // If failed, remove temp message
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setText(msgText);
    }
  };

  if (loading) return <View style={{flex:1,backgroundColor:'black',justifyContent:'center',alignItems:'center'}}><ActivityIndicator color="white"/></View>;

  return (
    <KeyboardAvoidingView style={{flex:1, backgroundColor:'black'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* HEADER */}
      <View style={{flexDirection:'row', alignItems:'center', paddingTop:50, paddingHorizontal:14, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#222'}}>
        <TouchableOpacity onPress={()=>router.back()}><Text style={{color:'white', fontSize:22}}>←</Text></TouchableOpacity>
        <View style={{width:36,height:36,borderRadius:18,backgroundColor:'#333',justifyContent:'center',alignItems:'center', marginLeft:12}}><Text style={{fontSize:18}}>👤</Text></View>
        <View style={{marginLeft:10}}>
          <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>User {otherId.slice(0,6)}</Text>
          <Text style={{color:'#4ade80', fontSize:11}}>● Accepted - you can chat</Text>
        </View>
      </View>

      {/* MESSAGES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item)=>item.id}
        contentContainerStyle={{padding:14, paddingBottom:20}}
        onContentSizeChange={()=>flatListRef.current?.scrollToEnd({animated:false})}
        ListEmptyComponent={<Text style={{color:'#888', textAlign:'center', marginTop:40}}>Say hi! This chat only exists because they accepted your request.</Text>}
        renderItem={({item})=>{
          const isMine = item.sender_id === myId;
          return (
            <View style={{alignSelf: isMine ? 'flex-end' : 'flex-start', backgroundColor: isMine ? 'white' : '#222', paddingHorizontal:14, paddingVertical:10, borderRadius:18, maxWidth:'80%', marginBottom:8}}>
              <Text style={{color: isMine ? 'black' : 'white', fontSize:15}}>{item.text}</Text>
              <Text style={{color: isMine ? '#888' : '#666', fontSize:10, marginTop:4, textAlign:'right'}}>
                {new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
              </Text>
            </View>
          );
        }}
      />

      {/* INPUT */}
      <View style={{flexDirection:'row', alignItems:'center', padding:10, paddingBottom:24, borderTopWidth:1, borderTopColor:'#222', gap:10}}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor="#888"
          style={{flex:1, backgroundColor:'#1a1a1a', color:'white', borderRadius:22, paddingHorizontal:16, paddingVertical:12, fontSize:15}}
          multiline
        />
        <TouchableOpacity onPress={sendMessage} style={{backgroundColor:'white', width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center'}}>
          <Text style={{fontSize:18}}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}