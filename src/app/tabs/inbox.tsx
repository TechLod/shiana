import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Inbox() {
  const router = useRouter();
  const [tab, setTab] = useState<'chats'|'requests'>('chats');
  const [requests, setRequests] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    // Incoming requests - people who want to message YOU
    const { data: reqs } = await supabase.from('message_requests')
      .select('*').eq('receiver_id', user.id).eq('status', 'pending')
      .order('created_at', { ascending: false });
    setRequests(reqs || []);

    // Your accepted chats
    const { data: convs } = await supabase.from('conversations')
      .select('*, messages(text, created_at)')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setChats(convs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (req: any) => {
    // Create conversation + mark accepted
    const { data: conv } = await supabase.from('conversations')
      .insert({ user1_id: req.sender_id, user2_id: req.receiver_id })
      .select().single();
    await supabase.from('message_requests').update({ status: 'accepted' }).eq('id', req.id);
    // If they sent a first message with request, save it
    if (req.message && conv) {
      await supabase.from('messages').insert({ conversation_id: conv.id, sender_id: req.sender_id, text: req.message });
    }
    load();
  };

  const handleDecline = async (req: any) => {
    await supabase.from('message_requests').update({ status: 'declined' }).eq('id', req.id);
    load();
  };

  if (loading) return <View style={{flex:1,backgroundColor:'black',justifyContent:'center',alignItems:'center'}}><ActivityIndicator color="white"/></View>;

  return (
    <View style={{flex:1, backgroundColor:'black', paddingTop:50, paddingHorizontal:16}}>
      <Text style={{color:'white', fontSize:22, fontWeight:'bold'}}>Inbox</Text>
      <Text style={{color:'#888', fontSize:12, marginTop:4}}>No one can message you until you accept their request</Text>

      <View style={{flexDirection:'row', gap:20, marginTop:20}}>
        <TouchableOpacity onPress={()=>setTab('chats')}><Text style={{color:tab==='chats'?'white':'#888', fontWeight:'bold', borderBottomWidth:tab==='chats'?2:0, borderBottomColor:'white', paddingBottom:4}}>Chats</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('requests')}><Text style={{color:tab==='requests'?'white':'#888', fontWeight:'bold', borderBottomWidth:tab==='requests'?2:0, borderBottomColor:'white', paddingBottom:4}}>Requests ({requests.length})</Text></TouchableOpacity>
      </View>

      {tab === 'requests' ? (
        <FlatList data={requests} keyExtractor={i=>i.id} ListEmptyComponent={<Text style={{color:'#888', marginTop:30, textAlign:'center'}}>No pending requests</Text>}
          renderItem={({item})=>(
            <View style={{backgroundColor:'#1a1a1a', padding:14, borderRadius:12, marginTop:12}}>
              <Text style={{color:'white', fontWeight:'bold'}}>User {item.sender_id.slice(0,6)} wants to message you</Text>
              {item.message ? <Text style={{color:'#ccc', marginTop:6}}>"{item.message}"</Text> : null}
              <View style={{flexDirection:'row', gap:10, marginTop:12}}>
                <TouchableOpacity onPress={()=>handleAccept(item)} style={{backgroundColor:'white', padding:10, borderRadius:20, flex:1, alignItems:'center'}}><Text style={{color:'black', fontWeight:'bold'}}>Accept</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>handleDecline(item)} style={{backgroundColor:'#333', padding:10, borderRadius:20, flex:1, alignItems:'center'}}><Text style={{color:'white'}}>Decline</Text></TouchableOpacity>
              </View>
            </View>
          )} />
      ) : (
        <FlatList data={chats} keyExtractor={i=>i.id} ListEmptyComponent={<Text style={{color:'#888', marginTop:30, textAlign:'center'}}>No chats yet. Send a request from someone's profile to start.</Text>}
          renderItem={({item})=>{
            const otherId = item.user1_id === myId ? item.user2_id : item.user1_id;
            return (
              <TouchableOpacity onPress={()=>router.push(`/chat/${item.id}` as any)} style={{flexDirection:'row', paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#222', alignItems:'center'}}>
                <View style={{width:44,height:44,borderRadius:22,backgroundColor:'#333',justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:20}}>👤</Text></View>
                <View style={{marginLeft:12}}>
                  <Text style={{color:'white', fontWeight:'bold'}}>User {otherId.slice(0,6)}</Text>
                  <Text style={{color:'#888', fontSize:12}}>Tap to open chat</Text>
                </View>
              </TouchableOpacity>
            );
          }} />
      )}
    </View>
  );
}