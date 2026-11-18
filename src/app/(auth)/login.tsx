import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Login() {
  const [email, setEmail] = useState('johnlucas03@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout - check internet')), 8000)
      );

      const loginPromise = supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password.trim() 
      });

      const result: any = await Promise.race([loginPromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        Alert.alert('Login Failed', error.message);
        return;
      }

      if (data?.session) {
        router.replace('/(tabs)' as any);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Shiana Login</Text>
      
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
        onPress={handleLogin} 
        disabled={loading}
        style={{ backgroundColor: loading ? '#888' : '#000', padding: 14, borderRadius: 8, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{loading ? 'Loading...' : 'Login'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ color: '#666' }}>Don't have account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}