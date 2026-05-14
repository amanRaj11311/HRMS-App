import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Platform, Switch, StatusBar, RefreshControl, KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import {showLocalNotification} from '../services/notificationService';
import { API_BASE } from '../api/api';


const TYPES = ['general', 'holiday', 'policy', 'urgent', 'celebration'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const AUDIENCES = ['all', 'admin', 'hr', 'employee'];

interface Announcement {
  _id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  targetAudience: string;
  isPinned: boolean;
  createdAt: string;
}

const AnnouncementsScreen = ({ navigation }: any) => {
  const { colors, isLightMode } = useTheme();
  
  // --- CORE STATES ---
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- MODAL & FORM ---
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editRecordId, setEditRecordId] = useState<string>('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showAudienceModal, setShowAudienceModal] = useState(false);

  const initialFormState = { title: '', description: '', type: 'general', priority: 'medium', targetAudience: 'all', isPinned: false };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    initScreen();
  }, []);

  const initScreen = async () => {
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const role = await AsyncStorage.getItem('userRole');
    if (permsStr) setPermissions(JSON.parse(permsStr));
    if (role?.toLowerCase().includes('admin')) setIsAdmin(true);
    fetchAnnouncements();
  };

  // 🚀 PERMISSION CHECKER HELPER
  const hasAction = (action: string) => {
    if (isAdmin) return true;
    return permissions.includes(`ANNOUNCEMENT:${action.toUpperCase()}`);
  };

  const fetchAnnouncements = async (isRefresh = false) => {
    try {
      if(!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/announcements?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.data?.data?.data || res.data?.data || res.data || [];
      
      const sortedData = data.sort((a: any, b: any) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAnnouncements(sortedData);
    } catch (err) {
      console.error("Failed to load announcements");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveAnnouncement = async () => {
    if (!formData.title || !formData.description) return Alert.alert("Required", "Title and description are required.");
    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (isEditing) {
        await axios.put(`${API_BASE}/announcements/${editRecordId}`, formData, config);
        showLocalNotification(
          'Announcement Updated',
          `${formData.title} has been updated.`,
        );
        Alert.alert("Success", "Updated successfully.");
      } else {
        await axios.post(`${API_BASE}/announcements`, formData, config);
        showLocalNotification(
          'New Announcement',
          `${formData.title} has been published.`,
        );
        Alert.alert("Success", "Published successfully.");
      }
      setIsAddModalVisible(false);
      fetchAnnouncements(true); 
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save.");
    } finally { setFormLoading(false); }
  };

  const deleteAnnouncement = (id: string) => {
    Alert.alert("Delete?", "Are you sure?", [
        { text: "Cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE}/announcements/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchAnnouncements(true);
        }}
    ]);
  };

  const getTypeStyle = (type: string) => {
    const t = type?.toLowerCase();
    if (t === 'holiday') return { bg: '#dcfce7', text: '#16a34a' };
    if (t === 'urgent') return { bg: '#fef2f2', text: '#dc2626' };
    return { bg: '#eff6ff', text: '#3b82f6' };
  };

  const CustomDropdownModal = ({ visible, onClose, title, data, onSelect }: any) => (
    <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropOverlay} onPress={onClose} activeOpacity={1}>
            <View style={[styles.dropContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Text style={[styles.dropTitle, { color: colors.textMain }]}>{title}</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                    {data.map((item: any, index: number) => (
                        <TouchableOpacity key={index} style={styles.dropItem} onPress={() => { onSelect(item); onClose(); }}>
                            <Text style={{ color: colors.textMain, textTransform: 'capitalize' }}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      {/* AppBar padding fix for collapse */}
      <View style={{paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg}}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAnnouncements(true)} />}>
        
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Feather name="volume-2" size={24} color="#3b82f6" />
                <Text style={[styles.pageTitle, { color: colors.textMain, marginLeft: 10 }]}>Announcements</Text>
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSub }]}>Company updates and important notices</Text>
          </View>
          
          {/* 🚀 ADD PERMISSION CHECK */}
          {hasAction('CREATE') && (
            <TouchableOpacity style={styles.addBtn} onPress={() => { setIsEditing(false); setFormData(initialFormState); setIsAddModalVisible(true); }}>
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.addBtnText}>New</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} /> : announcements.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())).map((ann, index) => (
            <View key={ann._id || index} style={[styles.annCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.cardTopRow}>
                    <View style={{flexDirection: 'row', flex: 1}}>
                        <View style={[styles.badge, {backgroundColor: getTypeStyle(ann.type).bg}]}><Text style={{color: getTypeStyle(ann.type).text, fontSize: 10, fontWeight: 'bold'}}>{ann.type.toUpperCase()}</Text></View>
                        {ann.isPinned && <View style={[styles.badge, {backgroundColor: '#fef3c7', marginLeft: 6}]}><Feather name="paperclip" size={10} color="#d97706" /></View>}
                    </View>
                    
                    {/* 🚀 EDIT/DELETE PERMISSION CHECK */}
                    <View style={{flexDirection: 'row'}}>
                        {hasAction('UPDATE') && <TouchableOpacity onPress={() => { setEditRecordId(ann._id); setIsEditing(true); setFormData({...ann}); setIsAddModalVisible(true); }} style={styles.iconBtn}><Feather name="edit-2" size={14} color={colors.textSub} /></TouchableOpacity>}
                        {hasAction('DELETE') && <TouchableOpacity onPress={() => deleteAnnouncement(ann._id)} style={styles.iconBtn}><Feather name="trash-2" size={14} color="#ef4444" /></TouchableOpacity>}
                    </View>
                </View>

                <Text style={[styles.annTitle, {color: colors.textMain}]}>{ann.title}</Text>
                <Text style={[styles.annDesc, {color: colors.textSub}]}>{ann.description}</Text>
                
                <View style={[styles.cardFooter, {borderTopColor: colors.border}]}>
                    <Text style={{fontSize: 11, color: colors.textSub}}>Published: {new Date(ann.createdAt).toLocaleDateString('en-GB')}</Text>
                    <View style={{flexDirection:'row', alignItems:'center'}}><Feather name="users" size={12} color={colors.textSub} /><Text style={{fontSize: 11, color: colors.textSub, marginLeft: 4, textTransform:'capitalize'}}>{ann.targetAudience}</Text></View>
                </View>
            </View>
        ))}
      </ScrollView>

      {/* ADD/EDIT MODAL */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.modalNav, {borderBottomColor: colors.border}]}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>{isEditing ? 'Edit' : 'New'} Announcement</Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><Feather name="x" size={24} color={colors.textMain}/></TouchableOpacity>
                </View>
                <ScrollView style={{padding: 20}}>
                    <Text style={[styles.label, {color: colors.textMain}]}>Title *</Text>
                    <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border}]} value={formData.title} onChangeText={(t)=>setFormData({...formData, title:t})} placeholder="Heading..." placeholderTextColor={colors.textSub}/>
                    
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 15}}>
                        <TouchableOpacity style={[styles.dropField, {borderColor: colors.border}]} onPress={()=>setShowTypeModal(true)}><Text style={{color: colors.textMain, textTransform:'capitalize'}}>{formData.type}</Text><Feather name="chevron-down" size={16}/></TouchableOpacity>
                        <TouchableOpacity style={[styles.dropField, {borderColor: colors.border, marginHorizontal: 10}]} onPress={()=>setShowPriorityModal(true)}><Text style={{color: colors.textMain, textTransform:'capitalize'}}>{formData.priority}</Text><Feather name="chevron-down" size={16}/></TouchableOpacity>
                    </View>

                    <Text style={[styles.label, {color: colors.textMain, marginTop: 20}]}>Description *</Text>
                    <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border, height: 120, textAlignVertical:'top'}]} multiline value={formData.description} onChangeText={(t)=>setFormData({...formData, description:t})} placeholder="Message details..." placeholderTextColor={colors.textSub}/>

                    <View style={styles.pinRow}>
                        <Text style={{color: colors.textMain, fontWeight:'bold'}}>Pin to top</Text>
                        <Switch trackColor={{ false: "#cbd5e1", true: "#93c5fd" }} thumbColor={formData.isPinned ? "#3b82f6" : "#f1f5f9"} onValueChange={(v) => setFormData({...formData, isPinned: v})} value={formData.isPinned} />
                    </View>
                </ScrollView>
                <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
                    <TouchableOpacity style={[styles.submitBtn, {flex: 1}]} onPress={saveAnnouncement} disabled={formLoading}>
                        {formLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold'}}>{isEditing ? 'Update' : 'Publish'}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomDropdownModal visible={showTypeModal} onClose={()=>setShowTypeModal(false)} title="Type" data={TYPES} onSelect={(v:any)=>setFormData({...formData, type:v})} />
      <CustomDropdownModal visible={showPriorityModal} onClose={()=>setShowPriorityModal(false)} title="Priority" data={PRIORITIES} onSelect={(v:any)=>setFormData({...formData, priority:v})} />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 12, marginTop: 4, marginLeft: 34 },
  addBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  annCard: { borderRadius: 16, borderWidth: 1, marginBottom: 16, padding: 16, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  iconBtn: { padding: 5, marginLeft: 10 },
  annTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  annDesc: { fontSize: 13, lineHeight: 20, marginBottom: 15 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '85%' },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
  label: { marginBottom: 8, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  dropField: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  submitBtn: { backgroundColor: '#3b82f6', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 40 },
  dropContent: { borderRadius: 15, padding: 10, borderWidth: 1 },
  dropTitle: { padding: 15, fontSize: 16, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }
});

export default AnnouncementsScreen;