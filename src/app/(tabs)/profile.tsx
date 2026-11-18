import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const W = Dimensions.get('window').width;

export default function Profile(){
  const router = useRouter();
  const [profile,setProfile]=useState<any>(null);
  const [posts,setPosts]=useState<any[]>([]);
  const [tab,setTab]=useState(0);
  const [editOpen,setEditOpen]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [actionModal,setActionModal]=useState<'none'|'password'|'email'|'deleteAccount'|'deletePost'|'deactivate'>('none');
  const [editData,setEditData]=useState({display_name:'', username:'', bio:'', flag:'🇳🇬'});
  const [newPassword,setNewPassword]=useState('');
  const [newEmail,setNewEmail]=useState('');
  const [selectedPost,setSelectedPost]=useState<any>(null);
  const [followersCount,setFollowersCount]=useState(0);
  const [followingCount,setFollowingCount]=useState(0);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);
    if(prof) setEditData({ display_name: prof.display_name || '', username: prof.username || '', bio: prof.bio || '', flag: prof.flag || '🇳🇬' });
    const { data: myPosts } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at',{ascending:false});
    setPosts(myPosts||[]);
    const { count: f1 } = await supabase.from('follows').select('*',{count:'exact', head:true}).eq('following_id', user.id);
    const { count: f2 } = await supabase.from('follows').select('*',{count:'exact', head:true}).eq('follower_id', user.id);
    setFollowersCount(f1||0);
    setFollowingCount(f2||0);
  };
  useEffect(()=>{load();},[]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if(result.canceled) return;
    const uri = result.assets[0].uri;
    try{
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) return;
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/avatar.${fileExt}`;
      const res = await fetch(uri);
      const blob = await res.blob();
      await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      load();
    }catch(e:any){ Alert.alert(e.message); }
  };

  const saveEdit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    await supabase.from('profiles').update({ display_name: editData.display_name, username: editData.username, bio: editData.bio, flag: editData.flag }).eq('id', user.id);
    setEditOpen(false); load();
  };

  const filteredPosts = tab === 0 ? posts : tab === 1 ? posts.filter((p:any)=>p.is_private) : posts;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView>
        {/* TOP ROW - Edit left, icons right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }}>
          <TouchableOpacity onPress={()=>setEditOpen(true)}><Text style={{ fontSize: 15, color: '#555' }}>✏️ Edit</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 18 }}>👀</Text>
            <Text style={{ fontSize: 18 }}>👤+</Text>
            <TouchableOpacity onPress={()=>setMenuOpen(true)}><Text style={{ fontSize: 20 }}>☰</Text></TouchableOpacity>
          </View>
        </View>

        {/* === AVATAR - CENTERED IN THE MIDDLE === */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#ddd' }} />
            ) : (
              <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 40 }}>👤</Text>
              </View>
            )}
            {/* + button on avatar */}
            <View style={{ position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', lineHeight: 18 }}>+</Text>
            </View>
          </TouchableOpacity>

          {/* USERNAME + BIO - CENTERED */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 10 }}>@{profile?.username || 'mynametry'}</Text>
          <Text style={{ fontSize: 14, color: '#333', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
            {editData.flag} {profile?.bio || 'Bbbhhhhhh'}
          </Text>

          {/* STATS - ONLY Following + Followers, NO Likes - CENTERED */}
          <View style={{ flexDirection: 'row', gap: 32, marginTop: 14, justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{followingCount}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Following</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{followersCount}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Followers</Text>
            </View>
            {/* LIKES DELETED - NOTHING HERE ANYMORE */}
          </View>
        </View>

        {/* TABS */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={()=>setTab(0)}><Text style={{ fontSize: 18, opacity: tab===0?1:0.4 }}>▦</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab(1)}><Text style={{ fontSize: 18, opacity: tab===1?1:0.4 }}>🔒</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab(2)}><Text style={{ fontSize: 18, opacity: tab===2?1:0.4 }}>🔁</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab(3)}><Text style={{ fontSize: 18, opacity: tab===3?1:0.4 }}>📌</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab(4)}><Text style={{ fontSize: 18, opacity: tab===4?1:0.4 }}>♡</Text></TouchableOpacity>
        </View>

        <Text style={{ padding: 12, fontSize: 13, color: '#666' }}>Posts: {filteredPosts.length}</Text>

        {filteredPosts.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>No posts yet</Text>
        ) : (
          <FlatList
            data={filteredPosts}
            numColumns={3}
            scrollEnabled={false}
            keyExtractor={(item:any)=>item.id}
            renderItem={({item})=>(
              <TouchableOpacity onPress={()=>setSelectedPost(item)} style={{ width: W/3, height: W/3, padding: 1 }}>
                <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} />
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>

      {/* EDIT MODAL */}
      <Modal visible={editOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Edit Profile</Text>
            <TextInput value={editData.display_name} onChangeText={(t)=>setEditData({...editData, display_name:t})} placeholder="Display name" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 10 }} />
            <TextInput value={editData.username} onChangeText={(t)=>setEditData({...editData, username:t})} placeholder="Username" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 10 }} />
            <TextInput value={editData.bio} onChangeText={(t)=>setEditData({...editData, bio:t})} placeholder="Bio" style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 10 }} />
            <TouchableOpacity onPress={saveEdit} style={{ backgroundColor: 'black', padding: 12, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setEditOpen(false)} style={{ padding: 12, alignItems: 'center' }}><Text>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MENU MODAL */}
      <Modal visible={menuOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); setActionModal('password');}} style={{ padding: 14 }}><Text>Change Password</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); setActionModal('email');}} style={{ padding: 14 }}><Text>Change Email</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); setActionModal('deactivate');}} style={{ padding: 14 }}><Text>Deactivate Account</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); setActionModal('deleteAccount');}} style={{ padding: 14 }}><Text style={{ color: 'red' }}>Delete Account</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setMenuOpen(false)} style={{ padding: 14, alignItems: 'center' }}><Text>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ACTION MODAL - password / email */}
      <Modal visible={actionModal==='password' || actionModal==='email'} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>{actionModal==='password' ? 'New Password' : 'New Email'}</Text>
            <TextInput value={actionModal==='password' ? newPassword : newEmail} onChangeText={actionModal==='password' ? setNewPassword : setNewEmail} placeholder={actionModal==='password' ? 'New password' : 'New email'} secureTextEntry={actionModal==='password'} style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, marginBottom: 12 }} />
            <TouchableOpacity onPress={async ()=>{
              try{
                if(actionModal==='password') await supabase.auth.updateUser({ password: newPassword });
                else await supabase.auth.updateUser({ email: newEmail });
                Alert.alert('Updated'); setActionModal('none');
              }catch(e:any){ Alert.alert(e.message); }
            }} style={{ backgroundColor: 'black', padding: 12, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: 'white' }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setActionModal('none')} style={{ padding: 12, alignItems: 'center' }}><Text>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}