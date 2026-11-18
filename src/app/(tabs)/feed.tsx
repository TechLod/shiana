import StoriesBar from '@/components/StoriesBar';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Feed() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<{[key:string]:boolean}>({});
  const [likesCount, setLikesCount] = useState<{[key:string]:number}>({});
  const [commentsCount, setCommentsCount] = useState<{[key:string]:number}>({});
  const [showComment, setShowComment] = useState<string|null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<{[key:string]:any[]}>({});
  const [filter,setFilter]=useState<'ForYou'|'Trending'>('ForYou');
  const [authors, setAuthors] = useState<{[key:string]:string}>({});
  const [storyRefresh, setStoryRefresh] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data: postsData } = await supabase.from('posts').select('*').eq('post_type','personal').order('created_at',{ascending:false}).limit(50);
    setPosts(postsData||[]);
    if (postsData && postsData.length > 0) {
      const userIds = [...new Set(postsData.map((p:any)=>p.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
      const map: {[key:string]:string} = {};
      (profilesData||[]).forEach((pr:any)=>{
        const key = pr.id || pr.user_id;
        if (key) map[key] = pr.username || pr.display_name || pr.name || 'Unknown';
      });
      if (Object.keys(map).length === 0) {
        const { data: profiles2 } = await supabase.from('profiles').select('*').in('user_id', userIds);
        (profiles2||[]).forEach((pr:any)=>{
          const key = pr.user_id || pr.id;
          if (key) map[key] = pr.username || pr.display_name || pr.name || 'Unknown';
        });
      }
      setAuthors(map);
    }
    if(postsData && postsData.length>0){
      try{
        const postIds = postsData.map((p:any)=>p.id);
        const { data: commentsData } = await supabase.from('comments').select('*').in('post_id', postIds).order('created_at',{ascending:false});
        const { data: likesData } = await supabase.from('likes').select('post_id').in('post_id', postIds);
        const counts: {[key:string]:number} = {}; const list: {[key:string]:any[]} = {}; const likeCounts: {[key:string]:number} = {};
        commentsData?.forEach((c:any)=>{ counts[c.post_id]=(counts[c.post_id]||0)+1; if(!list[c.post_id]) list[c.post_id]=[]; list[c.post_id].push(c); });
        likesData?.forEach((l:any)=>{ likeCounts[l.post_id]=(likeCounts[l.post_id]||0)+1; });
        setCommentsCount(counts); setCommentsList(list); setLikesCount(likeCounts);
      }catch(e){}
    }
    setLoading(false);
  };
  useEffect(()=>{load();},[]);

  // STORY BAR + : PICK IMAGE OR VIDEO FROM PHONE DIRECTLY - NO CAMERA
  const handleAddStory = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow gallery access to add a story'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Login first'); return; }

      const fileExt = asset.uri.split('.').pop()?.split('?')[0] || (asset.type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const res = await fetch(asset.uri);
      const blob = await res.blob();

      const { error: uploadError } = await supabase.storage.from('stories').upload(fileName, blob, {
        contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('stories').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: urlData.publicUrl,
        image_url: urlData.publicUrl,
        media_type: asset.type,
        created_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      setStoryRefresh((v) => v + 1); // refresh StoriesBar so new circle shows
      Alert.alert('Story added!');
    } catch (e: any) {
      Alert.alert('Story failed: ' + (e.message || 'Upload failed'));
    }
  };

  const handleLike = async (id:string) => {
    const isLiked = liked[id]; setLiked({...liked, [id]:!isLiked});
    setLikesCount({...likesCount, [id]: (likesCount[id]||0) + (isLiked? -1 : 1)});
    try{ const { data:{user} } = await supabase.auth.getUser(); if(!user) return; if(isLiked){ await supabase.from('likes').delete().eq('post_id',id).eq('user_id',user.id); } else { await supabase.from('likes').insert({ post_id:id, user_id:user.id }); } }catch(e){}
  };
  const handleAddComment = async (postId:string) => {
    if(!commentText.trim()) return; const text = commentText.trim(); setCommentText('');
    setCommentsCount({...commentsCount, [postId]:(commentsCount[postId]||0)+1});
    setCommentsList({...commentsList, [postId]:[{text},...(commentsList[postId]||[])]});
    try{ const { data:{user} } = await supabase.auth.getUser(); await supabase.from('comments').insert({ post_id:postId, user_id:user?.id, text }); }catch(e){}
  };
  const handleShare = async (item:any) => { await Share.share({message: `${item.caption} - on Shiana 🚀\n${item.photo_url}`}); };
  const displayedPosts = filter==='Trending'? [...posts].sort((a:any,b:any)=>( (likesCount[b.id]||0)*2 + (commentsCount[b.id]||0)*3 ) - ( (likesCount[a.id]||0)*2 + (commentsCount[a.id]||0)*3 )) : posts;

  if(loading) return <View style={{flex:1,backgroundColor:'black',justifyContent:'center',alignItems:'center'}}><ActivityIndicator color="white"/></View>

  return (
    <View style={{flex:1,backgroundColor:'black'}}>
      <View style={{position:'absolute', top:0, left:0, right:0, zIndex:100, paddingTop:10, paddingHorizontal:14, backgroundColor:'rgba(0,0,0,0.25)'}}>
        <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
          {/* + : OPENS PHONE GALLERY FOR STORY - IMAGE OR VIDEO - NO CAMERA */}
          <TouchableOpacity 
            onPress={handleAddStory}
            style={{width:48, height:48, borderRadius:24, backgroundColor:'white', justifyContent:'center', alignItems:'center'}}
          >
            <Text style={{fontSize:22, color:'black', fontWeight:'bold'}}>+</Text>
          </TouchableOpacity>

          <View style={{flexDirection:'row', gap:20}}>
            <TouchableOpacity onPress={()=>setFilter('ForYou')}><Text style={{color:filter==='ForYou'?'white':'#aaa', fontWeight:'bold', fontSize:15, borderBottomWidth:filter==='ForYou'?2:0, borderBottomColor:'white', paddingBottom:2}}>For You</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setFilter('Trending')}><Text style={{color:filter==='Trending'?'white':'#aaa', fontWeight:'bold', fontSize:15, borderBottomWidth:filter==='Trending'?2:0, borderBottomColor:'white', paddingBottom:2}}>Trending 🔥</Text></TouchableOpacity>
          </View>

          <TouchableOpacity onPress={()=>router.push('/tabs/profile' as any)}>
            <Text style={{fontSize:22}}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={{marginTop:6}}>
          <StoriesBar key={storyRefresh} />
        </View>
      </View>

      <FlatList
        data={displayedPosts}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onRefresh={load}
        refreshing={loading}
        keyExtractor={(item)=>item.id}
        renderItem={({item})=>{
          const likeCount = likesCount[item.id] || 0; const isLiked = liked[item.id]; const commentCount = commentsCount[item.id] || 0; const postComments = commentsList[item.id]||[];
          const authorName = authors[item.user_id] || item.username || item.author_name || 'Unknown';
          return (
            <View style={{height:SCREEN_HEIGHT, width:SCREEN_WIDTH, backgroundColor:'black'}}>
              <Image source={{uri:item.photo_url}} style={{width:SCREEN_WIDTH, height:SCREEN_HEIGHT}} resizeMode="cover"/>
              <View style={{position:'absolute', bottom:80, left:14, right:90}}>
                <Text style={{color:'white',fontWeight:'bold',fontSize:15, textShadowColor:'black', textShadowRadius:10, textShadowOffset:{width:0,height:1}}}>@{authorName} • 🔥 {filter}</Text>
                <Text style={{color:'white',fontSize:14,marginTop:6, textShadowColor:'black', textShadowRadius:10}}>{item.caption}</Text>
                <Text style={{color:'white',fontSize:12,marginTop:6, textShadowColor:'black', textShadowRadius:10}}>📍 {item.location_tag||'Samara, Russia'}</Text>
                {showComment===item.id && (
                  <View style={{marginTop:10,backgroundColor:'white',borderRadius:12,padding:8}}>
                    {postComments.slice(0,3).map((c:any,i:number)=><Text key={i} style={{color:'black',fontSize:12,marginBottom:3}}>💬 {c.text}</Text>)}
                    <View style={{flexDirection:'row',marginTop:6,backgroundColor:'#eee',borderRadius:20,paddingHorizontal:10,paddingVertical:6,alignItems:'center'}}>
                      <TextInput value={commentText} onChangeText={setCommentText} placeholder="Add comment..." style={{flex:1,fontSize:13}} placeholderTextColor="#888"/>
                      <TouchableOpacity onPress={()=>handleAddComment(item.id)} style={{backgroundColor:'black',paddingHorizontal:12,paddingVertical:5,borderRadius:12,marginLeft:6}}><Text style={{color:'white',fontSize:11,fontWeight:'bold'}}>Post</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              <View style={{position:'absolute', right:10, bottom:110, alignItems:'center', gap:18}}>
                <TouchableOpacity onPress={()=>handleLike(item.id)} style={{alignItems:'center'}}>
                  <View style={{width:48,height:48,borderRadius:24,backgroundColor:isLiked?'#fe2c55':'rgba(0,0,0,0.35)',justifyContent:'center',alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.3)'}}><Text style={{fontSize:24}}>{isLiked?'❤️':'🤍'}</Text></View>
                  <Text style={{color:'white',fontSize:12,marginTop:3,fontWeight:'bold', textShadowColor:'black', textShadowRadius:8}}>{likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setShowComment(showComment===item.id?null:item.id)} style={{alignItems:'center'}}>
                  <View style={{width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'center',alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.3)'}}><Text style={{fontSize:22}}>💬</Text></View>
                  <Text style={{color:'white',fontSize:12,marginTop:3,fontWeight:'bold', textShadowColor:'black', textShadowRadius:8}}>{commentCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>handleShare(item)} style={{alignItems:'center'}}>
                  <View style={{width:48,height:48,borderRadius:24,backgroundColor:'rgba(0,0,0,0.35)',justifyContent:'center',alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.3)'}}><Text style={{fontSize:20,color:'white'}}>↗</Text></View>
                  <Text style={{color:'white',fontSize:10,marginTop:3, textShadowColor:'black', textShadowRadius:8}}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  );
}