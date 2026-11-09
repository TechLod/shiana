import { useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
export function PostOptions({ post, onDeleted, onUpdated, visible, onClose }: any) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [saving, setSaving] = useState(false);

  const deletePost = async () => {
    Alert.alert('Delete post?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          // 1. Delete from DB
          const { error } = await supabase.from('posts').delete().eq('id', post.id);
          if(error) throw error;

          // 2. Delete file from storage (optional)
          const fileUrl = post.photo_url || post.video_url;
          if(fileUrl){
            const fileName = fileUrl.split('/').pop();
            if(fileName) await supabase.storage.from('posts').remove([fileName]);
          }

          onDeleted(post.id);
          onClose();
          Alert.alert('Deleted');
        } catch(e: any) {
          Alert.alert('Delete failed', e.message);
        }
      }}
    ]);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('posts').update({ caption }).eq('id', post.id);
      if(error) throw error;
      onUpdated({...post, caption });
      setEditing(false);
      onClose();
    } catch(e: any) {
      Alert.alert('Update failed', e.message);
    }
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'flex-end'}}>
        <View style={{backgroundColor:'#111',borderTopLeftRadius:20,borderTopRightRadius:20,padding:20}}>
          {!editing? (
            <>
              <TouchableOpacity onPress={() => setEditing(true)} style={{padding:18,backgroundColor:'#222',borderRadius:12,marginBottom:10}}>
                <Text style={{color:'white',textAlign:'center',fontWeight:'bold'}}>✏️ Edit Caption</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deletePost} style={{padding:18,backgroundColor:'#ff4444',borderRadius:12,marginBottom:10}}>
                <Text style={{color:'white',textAlign:'center',fontWeight:'bold'}}>🗑️ Delete Post</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{padding:18,backgroundColor:'#333',borderRadius:12}}>
                <Text style={{color:'#aaa',textAlign:'center'}}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{color:'white',fontWeight:'bold',marginBottom:10}}>Edit Caption</Text>
              <TextInput value={caption} onChangeText={setCaption} placeholder="Caption..." placeholderTextColor="#888" style={{backgroundColor:'white',borderRadius:10,padding:14}} multiline />
              <View style={{flexDirection:'row',gap:10,marginTop:15}}>
                <TouchableOpacity onPress={() => setEditing(false)} style={{flex:1,padding:16,backgroundColor:'#333',borderRadius:12}}><Text style={{color:'white',textAlign:'center'}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} disabled={saving} style={{flex:1,padding:16,backgroundColor:'#facc15',borderRadius:12}}><Text style={{textAlign:'center',fontWeight:'bold'}}>{saving? 'Saving...' : 'Save'}</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}