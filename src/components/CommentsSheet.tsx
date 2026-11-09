import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native'
const supabase = createClient('https://shiana-proxy-gh4a.vercel.app','sb_publishable_kfSsqhkT-pCn5BV6xN5ymA_JB5K4rEB' as any)

export default function CommentsSheet({ postId, userId, onClose }: any) {
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')

  useEffect(()=>{ load() },[])
  const load = async () => {
    const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url)').eq('post_id', postId).order('created_at',{ascending:false})
    setComments(data||[])
  }
  const send = async () => {
    if(!text.trim()) return
    await supabase.from('comments').insert({ post_id: postId, user_id: userId, text: text.trim() })
    setText(''); load()
  }
  return (
    <View style={{flex:1, backgroundColor:'black', padding:20, paddingTop:40}}>
      <Text style={{color:'white', fontSize:20, fontWeight:'bold'}}>Comments</Text>
      <TouchableOpacity onPress={onClose} style={{position:'absolute', top:40, right:20}}><Text style={{color:'white'}}>✕ Close</Text></TouchableOpacity>
      <FlatList data={comments} keyExtractor={i=>i.id} style={{marginTop:20}} renderItem={({item})=>(
        <View style={{flexDirection:'row', marginBottom:12}}>
          <Text style={{color:'white', fontWeight:'bold'}}>{item.profiles?.username||'user'}: </Text>
          <Text style={{color:'#ccc', flex:1}}>{item.text}</Text>
        </View>
      )}/>
      <View style={{flexDirection:'row', marginTop:10}}>
        <TextInput value={text} onChangeText={setText} placeholder="Add comment..." placeholderTextColor="#555" style={{flex:1, backgroundColor:'#111', color:'white', padding:14, borderRadius:12}}/>
        <TouchableOpacity onPress={send} style={{backgroundColor:'white', padding:14, borderRadius:12, marginLeft:8}}><Text style={{fontWeight:'bold'}}>Send</Text></TouchableOpacity>
      </View>
    </View>
  )
}