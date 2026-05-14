import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Image, Modal, Alert, Platform, StatusBar } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../constants/theme';
import { useFocusEffect } from '@react-navigation/native'; 
// 🚀 FIXED: Imported the centralized Base API URL to maintain system DRY standards
import { API_BASE } from '../api/api';

// 🚀 FIXED: Encodes spaces so image loads flawlessly everywhere
const getCleanAvatarUrl = (url: string) => {
    if (!url) return '';
    let clean = url.replace(/\\/g, '/'); 
    let fullUrl = clean;
    if (!clean.startsWith('http')) {
        // 🚀 FIXED: Substituted hardcoded host string directly with API_BASE standard mapping
        fullUrl = clean.startsWith('/') ? `${API_BASE.replace('/api', '')}${clean}` : `${API_BASE.replace('/api', '')}/${clean}`;
    }
    return encodeURI(fullUrl); 
};

export default function GlobalAppBar({ navigation, onSearch, searchQuery }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [userInitials, setUserInitials] = useState('U');
  const [userAvatar, setUserAvatar] = useState<string | null>(null); 
  const [imgError, setImgError] = useState(false); 
  
  // 🚀 NEW: State for avatar dropdown menu
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const loadUserData = async () => {
      try {
        setImgError(false); 
        const name = await AsyncStorage.getItem('userName');
        const avatarUrl = await AsyncStorage.getItem('userAvatar'); 
        
        // 🚀 FIXED: Pass the raw URL through the cleaner function
        if (avatarUrl && avatarUrl.length > 5 && !avatarUrl.includes('ui-avatars')) {
            setUserAvatar(getCleanAvatarUrl(avatarUrl));
        } else {
            setUserAvatar(null); 
        }

        if (name && name !== 'User') {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const parts = cleanName.split(' ');

  let initials = '';

  if (parts.length > 1) {
    initials =
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0);
  } else {
    initials = parts[0].substring(0, 2);
  }

  setUserInitials(initials.toUpperCase());
}
      } catch (e) {
        console.log("AppBar Error:", e);
      }
  };

  useEffect(() => { loadUserData(); }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  // 🚀 UPDATED: Opens menu instead of directly navigating
  const handleAvatarPress = () => {
    setShowAvatarMenu(true);
  };

  // 🚀 NEW: Logout function
  const handleLogout = () => {
    setShowAvatarMenu(false);
    Alert.alert("Logout", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" }, 
        { text: "Logout", style: "destructive", onPress: async () => {
          await AsyncStorage.clear();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
    ]);
  };

  if (isSearchActive) {
    return (
      <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => { 
              setIsSearchActive(false); 
              if (onSearch) onSearch(''); 
          }}
          style={styles.iconBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.textMain} />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.searchInput, { color: colors.textMain }]}
          placeholder="Search employees, leaves, leads..."
          placeholderTextColor={colors.textSub}
          value={searchQuery}
          onChangeText={(text) => { if(onSearch) onSearch(text); }}
          autoFocus 
        />
        
        {searchQuery ? (
          <TouchableOpacity onPress={() => { if(onSearch) onSearch(''); }} style={styles.iconBtn}>
            <Feather name="x" size={20} color={colors.textSub} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{paddingRight: 12}}>
          <Feather name="menu" size={22} color={colors.textMain} />
        </TouchableOpacity>
        
        <Image 
            source={require('../assets/logo.png')} 
            style={styles.appBarLogo} 
        />
        
        <View style={styles.titleWrapper}>
          <Text style={[styles.title, { color: colors.textMain }]}>DCS Technosis</Text>
          <Text style={styles.subtitle}>HRMS PORTAL</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity style={[styles.avatar, { borderColor: colors.border, borderWidth: 1 }]} onPress={handleAvatarPress}>
           {userAvatar && !imgError ? (
               <Image 
                   source={{ uri: userAvatar }} 
                   style={styles.avatarImage} 
                   onError={() => setImgError(true)} 
               />
           ) : (
               <View
  style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }}
>
  <Text style={styles.avatarText}>
    {userInitials}
  </Text>
</View>
           )}
        </TouchableOpacity>
      </View>

      {/* 🚀 NEW: Avatar Dropdown Menu */}
      <Modal visible={showAvatarMenu} transparent animationType="fade">
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowAvatarMenu(false)} activeOpacity={1}>
              <View style={[styles.avatarMenu, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <TouchableOpacity 
                      style={[styles.avatarMenuItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} 
                      onPress={() => { setShowAvatarMenu(false); navigation.navigate('Settings'); }}
                  >
                      <Feather name="settings" size={18} color={colors.textMain} />
                      <Text style={[styles.avatarMenuText, { color: colors.textMain }]}>Settings</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.avatarMenuItem} onPress={handleLogout}>
                      <Feather name="log-out" size={18} color="#EF4444" />
                      <Text style={[styles.avatarMenuText, { color: '#EF4444' }]}>Log Out</Text>
                  </TouchableOpacity>
              </View>
          </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      paddingHorizontal: 16, 
      paddingVertical: 16, 
      borderBottomWidth: 5
  },
  leftSection: { flexDirection: 'row', alignItems: 'center' },
  
  appBarLogo: {
      width: 32,
      height: 32,
      resizeMode: 'contain'
  },
  
  titleWrapper: { marginLeft: 8, justifyContent: 'center' },
  title: { 
      fontSize: 16, 
      fontWeight: '900', 
      letterSpacing: -0.2 
  },
  subtitle: { 
      fontSize: 8, 
      color: '#3b82f6', 
      fontWeight: '900', 
      letterSpacing: 1, 
      marginTop: -1
  },
  
  rightSection: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8 },
  
avatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#3b82f6',
  overflow: 'hidden',

  justifyContent: 'center',
  alignItems: 'center',
},
  avatarImage: {
      width: '100%',
      height: '100%',
       borderRadius: 20,
      
  },
  avatarText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '700',

  includeFontPadding: false,

  textAlign: 'center',
  textAlignVertical: 'center',

  lineHeight: 14,
},
  
  searchInput: { 
      flex: 1, 
      marginLeft: 10, 
      fontSize: 15,
      paddingVertical: 8
  },

  // 🚀 NEW: Styles for the Avatar Menu Modal
  menuOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.2)', 
      alignItems: 'flex-end', 
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 60 : 100, 
      paddingRight: 16 
  },
  avatarMenu: { 
      width: 160, 
      borderRadius: 12, 
      borderWidth: 1, 
      elevation: 5, 
      shadowColor: '#000', 
      shadowOffset: { width: 0, height: 4 }, 
      shadowOpacity: 0.15, 
      shadowRadius: 5 
  },
  avatarMenuItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 16 
  },
  avatarMenuText: { 
      fontSize: 14, 
      fontWeight: '700', 
      marginLeft: 13
  }
});