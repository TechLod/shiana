import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
export default function VideoEditor({onSave}:{onSave:(data:any)=>void}){
  const [caption,setCaption]=useState('');
  const [music,setMusic]=useState('No music');
  return(
    <View style={{backgroundColor:'black',padding:15}}>
      <TextInput value={caption} onChangeText={setCaption} placeholder="Add text on video..." placeholderTextColor="#888" style={{color:'white',fontSize:18,borderWidth:1,borderColor:'#333',padding:12,borderRadius:10}}/>
      <View style={{flexDirection:'row',gap:10,marginTop:10}}>
        {['No music','Trending 🔥','Club 🎵','Chill 🌙'].map(m=><TouchableOpacity key={m} onPress={()=>setMusic(m)} style={{backgroundColor:music===m?'#7c3aed':'#222',padding:8,borderRadius:10}}><Text style={{color:'white',fontSize:11}}>{m}</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity onPress={()=>onSave({caption,music})} style={{backgroundColor:'#fe2c55',padding:15,borderRadius:10,marginTop:15,alignItems:'center'}}><Text style={{color:'white',fontWeight:'bold'}}>Post Video</Text></TouchableOpacity>
    </View>
  );
}