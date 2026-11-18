import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Signup() {
  const [email, setEmail] = useState('johnlucas03@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      // This stops "Creating..." after 8 sec if proxy is down
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Proxy timeout - Supabase not responding. Try again or check Vercel deployment.')), 8000)
      );

      const signupPromise = supabase.auth.signUp({ 
        email: email.trim(), 
        password: password.trim() 
      });

      const result: any = await Promise.race([signupPromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        Alert.alert('Signup Failed', error.message);
        return;
      }

      if (data?.user) {
        Alert.alert('Success', 'Account created! Please login now.');
        router.replace('/(auth)/login' as any);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Create Account</Text>
      
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20 }}
      />

      <TouchableOpacity 
        onPress={handleCreate} 
        disabled={loading}
        style={{ backgroundColor: loading ? '#888' : '#000', padding: 14, borderRadius: 8, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{loading ? 'Creating...' : 'Create Account'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#666' }}>Already have account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}