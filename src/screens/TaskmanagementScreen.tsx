import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, 
  ActivityIndicator, Alert, Modal, StatusBar, Platform, RefreshControl, TextInput, KeyboardAvoidingView
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

const STATUS_OPTIONS = ['To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

export default function TaskManagementModule({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Form States
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRecordId, setEditRecordId] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Dropdown Visibility States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Default +7 days
    priority: 'Medium',
    status: 'To Do',
    assignee: '',
    assigneeName: 'Unassigned',
    labels: '',
  });

  // 🚀 FIXED: Helper function for checking exact permissions
  const canDo = (action: string) => permissions.includes(`TASK:${action.toUpperCase()}`);

  useFocusEffect(useCallback(() => {
    initScreen();
  }, []));

  const initScreen = async () => {
    setLoading(true);
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const pArray = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase().trim()) : [];
    setPermissions(pArray);
    
    // Only fetch employees if they can create/update to assign tasks
    if (pArray.includes('TASK:CREATE') || pArray.includes('TASK:UPDATE')) {
        await fetchEmployees();
    }
    await fetchTasks(false, pArray);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      setAllEmployees((res.data?.data?.data || res.data?.data || []).filter((e:any) => !e.isDeleted));
    } catch (e) {
      console.log("Error fetching employees", e);
    }
  };

  const fetchTasks = async (isSilent = false, currentPerms = permissions) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      // 🚀 SECURE API CALL: View All vs View Self
      const canViewAll = currentPerms.includes('TASK:VIEW');
      const url = canViewAll 
          ? `${API_BASE}/tasks?limit=500&_t=${Date.now()}` 
          : `${API_BASE}/tasks/self?limit=500&_t=${Date.now()}`;

      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      
      let data = res.data?.data || [];
      // Sort tasks: Newest first
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTasks(data);
    } catch (e) {
      console.log("Fetch Error:", e);
    } finally { 
      setLoading(false); setRefreshing(false); 
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTasks(true);
  };

  const saveTask = async () => {
    if (!formData.title.trim()) {
        return Alert.alert("Validation", "Task title is required.");
    }

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate.toISOString(),
        dueDate: formData.dueDate.toISOString(),
        priority: formData.priority,
        status: formData.status,
        assignee: formData.assignee || null,
        labels: formData.labels ? formData.labels.split(',').map(l => l.trim()).filter(l => l) : []
      };

      if (isEditing) {
          await axios.put(`${API_BASE}/tasks/${editRecordId}`, payload, config);
      } else {
          await axios.post(`${API_BASE}/tasks`, payload, config);
      }
      
      setIsTaskModalVisible(false);
      fetchTasks(true);
      Alert.alert("Success", `Task ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (err: any) { 
        Alert.alert("Error", err.response?.data?.message || "Failed to save task."); 
    } finally { 
        setFormLoading(false); 
    }
  };

  const deleteTask = (id: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                await axios.delete(`${API_BASE}/tasks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchTasks(true);
            } catch (e) {
                Alert.alert("Error", "Failed to delete task.");
            }
        }}
    ]);
  };

  const openAddModal = () => {
      setIsEditing(false);
      setEditRecordId('');
      setFormData({
          title: '',
          description: '',
          startDate: new Date(),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
          priority: 'Medium',
          status: 'To Do',
          assignee: '',
          assigneeName: 'Unassigned',
          labels: ''
      });
      setIsTaskModalVisible(true);
  };

  const openEditModal = (item: any) => {
      setIsEditing(true);
      setEditRecordId(item._id);
      
      const sDate = item.startDate ? new Date(item.startDate) : new Date();
      const dDate = item.dueDate ? new Date(item.dueDate) : new Date();
      
      setFormData({
          title: item.title || '',
          description: item.description || '',
          startDate: isNaN(sDate.getTime()) ? new Date() : sDate,
          dueDate: isNaN(dDate.getTime()) ? new Date() : dDate,
          priority: item.priority || 'Medium',
          status: item.status || 'To Do',
          assignee: item.assignee?._id || '',
          assigneeName: item.assignee ? `${item.assignee.userId?.firstName || ''} ${item.assignee.userId?.lastName || ''}`.trim() : 'Unassigned',
          labels: Array.isArray(item.labels) ? item.labels.join(', ') : ''
      });
      setIsTaskModalVisible(true);
  };

  const getSafeDateString = (d: Date | string) => {
      if (!d) return '--/--/----';
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '--/--/----';
      return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
  };

  const getPriorityStyle = (priority: string) => {
      const p = String(priority || "").toLowerCase();
      if (p === 'high' || p === 'urgent') return { bg: '#FEE2E2', text: '#DC2626' };
      if (p === 'medium') return { bg: '#FEF3C7', text: '#D97706' };
      return { bg: '#E0F2FE', text: '#2563EB' }; 
  };

  const getStatusStyle = (status: string) => {
      const s = String(status || "").toLowerCase();
      if (s === 'done' || s === 'completed') return { bg: '#DCFCE7', text: '#16A34A', icon: 'check-circle' };
      if (s === 'in progress') return { bg: '#DBEAFE', text: '#2563EB', icon: 'progress-clock' };
      if (s === 'in review') return { bg: '#F3E8FF', text: '#7C3AED', icon: 'eye-outline' };
      return { bg: '#F1F5F9', text: '#64748B', icon: 'format-list-bulleted' }; 
  };

  const filteredTasks = tasks.filter(task => {
      const searchStr = searchQuery.toLowerCase();
      const matchTitle = (task.title || '').toLowerCase().includes(searchStr);
      const matchAssignee = task.assignee ? `${task.assignee.userId?.firstName} ${task.assignee.userId?.lastName}`.toLowerCase().includes(searchStr) : false;
      return matchTitle || matchAssignee;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        
        <View style={styles.header}>
            <View>
              <Text style={[styles.title, {color: colors.textMain}]}>Task Management</Text>
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: 2}}>{filteredTasks.length} tasks</Text>
            </View>
            
            {/* 🚀 FIXED: Render ADD button only if user has CREATE permission */}
            {canDo('CREATE') && (
                <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={styles.addBtnText}>Add Task</Text>
                </TouchableOpacity>
            )}
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}}/> : filteredTasks.map((item, index) => {
            const pStyle = getPriorityStyle(item.priority);
            const sStyle = getStatusStyle(item.status);
            const empName = item.assignee ? `${item.assignee.userId?.firstName || ''} ${item.assignee.userId?.lastName || ''}`.trim() : 'Unassigned';

            return (
            <View key={index} style={[styles.taskCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                <View style={styles.cardHeader}>
                    <Text style={[styles.taskTitle, {color: colors.textMain}]} numberOfLines={2}>{item.title}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        
                        {/* 🚀 FIXED: Render UPDATE and DELETE buttons strictly based on Permissions */}
                        {canDo('UPDATE') && (
                            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
                                <Feather name="edit-2" size={16} color={colors.textSub} />
                            </TouchableOpacity>
                        )}
                        {canDo('DELETE') && (
                            <TouchableOpacity style={[styles.iconBtn, {marginLeft: 8}]} onPress={() => deleteTask(item._id)}>
                                <Feather name="trash-2" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        )}

                    </View>
                </View>

                {item.description ? (
                    <Text style={[styles.taskDesc, {color: colors.textSub}]} numberOfLines={2}>{item.description}</Text>
                ) : null}

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="account-circle-outline" size={16} color={colors.textSub} style={{marginRight: 4}} />
                        <Text style={[styles.metaText, {color: colors.textMain}]} numberOfLines={1}>{empName}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="calendar-clock-outline" size={16} color={colors.textSub} style={{marginRight: 4}} />
                        <Text style={[styles.metaText, {color: colors.textMain}]}>{getSafeDateString(item.dueDate)}</Text>
                    </View>
                </View>

                <View style={styles.badgeRow}>
                    <View style={[styles.badge, {backgroundColor: sStyle.bg}]}>
                        <MaterialCommunityIcons name={sStyle.icon} size={12} color={sStyle.text} style={{marginRight: 4}} />
                        <Text style={[styles.badgeText, {color: sStyle.text}]}>{item.status}</Text>
                    </View>
                    <View style={[styles.badge, {backgroundColor: pStyle.bg, marginLeft: 8}]}>
                        <Text style={[styles.badgeText, {color: pStyle.text}]}>{item.priority}</Text>
                    </View>
                    
                    {Array.isArray(item.labels) && item.labels.map((label: string, lIdx: number) => (
                        <View key={lIdx} style={[styles.badge, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155', marginLeft: 8}]}>
                            <Text style={[styles.badgeText, {color: colors.textSub}]}>{label}</Text>
                        </View>
                    ))}
                </View>

            </View>
        )})}

        {!loading && filteredTasks.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Feather name="check-square" size={50} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>No tasks found.</Text>
            </View>
        )}
      </ScrollView>

      {/* --- ADD/EDIT TASK MODAL --- */}
      <Modal visible={isTaskModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.modalNav}>
                    <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>{isEditing ? 'Edit Task' : 'Add Task'}</Text>
                    <TouchableOpacity onPress={() => setIsTaskModalVisible(false)}><Feather name="x" size={24} color={colors.textMain}/></TouchableOpacity>
                </View>

                <ScrollView style={{padding: 20}} showsVerticalScrollIndicator={false}>
                    
                    <Text style={styles.label}>Title *</Text>
                    <TextInput 
                        style={[styles.input, {borderColor: colors.border, color: colors.textMain, backgroundColor: colors.background}]} 
                        placeholder="Task Title" placeholderTextColor={colors.textSub}
                        value={formData.title} onChangeText={t => setFormData({...formData, title: t})}
                    />

                    <Text style={[styles.label, {marginTop: 15}]}>Description</Text>
                    <TextInput 
                        style={[styles.textArea, {borderColor: colors.border, color: colors.textMain, backgroundColor: colors.background}]} 
                        placeholder="Detailed description..." placeholderTextColor={colors.textSub}
                        multiline textAlignVertical="top"
                        value={formData.description} onChangeText={t => setFormData({...formData, description: t})}
                    />

                    <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                        <View style={{width:'48%'}}>
                            <Text style={styles.label}>Start Date</Text>
                            <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: colors.background}]} onPress={() => setShowStartDatePicker(true)}>
                                <Text style={{color: colors.textMain}}>{getSafeDateString(formData.startDate)}</Text>
                                <Feather name="calendar" size={14} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>
                        <View style={{width:'48%'}}>
                            <Text style={styles.label}>Due Date</Text>
                            <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: colors.background}]} onPress={() => setShowDueDatePicker(true)}>
                                <Text style={{color: colors.textMain}}>{getSafeDateString(formData.dueDate)}</Text>
                                <Feather name="calendar" size={14} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                        <View style={{width:'48%'}}>
                            <Text style={styles.label}>Priority</Text>
                            <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: colors.background}]} onPress={() => setShowPriorityModal(true)}>
                                <Text style={{color: colors.textMain}}>{formData.priority}</Text>
                                <Feather name="chevron-down" size={16} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>
                        <View style={{width:'48%'}}>
                            <Text style={styles.label}>Status</Text>
                            <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: colors.background}]} onPress={() => setShowStatusModal(true)}>
                                <Text style={{color: colors.textMain}}>{formData.status}</Text>
                                <Feather name="chevron-down" size={16} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={[styles.label, {marginTop: 15}]}>Assignee</Text>
                    <TouchableOpacity style={[styles.inputBox, {borderColor: colors.border, backgroundColor: colors.background}]} onPress={() => setShowAssigneeModal(true)}>
                        <Text style={{color: colors.textMain}}>{formData.assigneeName}</Text>
                        <Feather name="chevron-down" size={16} color={colors.textSub} />
                    </TouchableOpacity>

                    <Text style={[styles.label, {marginTop: 15}]}>Labels (comma separated)</Text>
                    <TextInput 
                        style={[styles.input, {borderColor: colors.border, color: colors.textMain, backgroundColor: colors.background, marginBottom: 20}]} 
                        placeholder="e.g. frontend, urgent" placeholderTextColor={colors.textSub}
                        value={formData.labels} onChangeText={t => setFormData({...formData, labels: t})}
                    />

                </ScrollView>
                
                <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
                    <TouchableOpacity style={[styles.submitBtn, {backgroundColor: colors.primary}]} onPress={saveTask} disabled={formLoading}>
                        {formLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold', fontSize: 16}}>{isEditing ? 'Update Task' : 'Create Task'}</Text>}
                    </TouchableOpacity>
                </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DROPDOWNS & PICKERS */}
      <DropdownModal visible={showStatusModal} title="Select Status" data={STATUS_OPTIONS} onSelect={(v:string) => setFormData({...formData, status: v})} onClose={()=>setShowStatusModal(false)} colors={colors} />
      <DropdownModal visible={showPriorityModal} title="Select Priority" data={PRIORITY_OPTIONS} onSelect={(v:string) => setFormData({...formData, priority: v})} onClose={()=>setShowPriorityModal(false)} colors={colors} />
      
      <DropdownModal 
        visible={showAssigneeModal} 
        title="Select Assignee" 
        data={[{_id: '', userId: {firstName: 'Unassigned', lastName: ''}}, ...allEmployees]} 
        displayKey={(i:any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`.trim() || 'Unassigned'} 
        onSelect={(v:any) => setFormData({...formData, assignee: v._id, assigneeName: `${v.userId?.firstName || ''} ${v.userId?.lastName || ''}`.trim() || 'Unassigned'})} 
        onClose={()=>setShowAssigneeModal(false)} colors={colors} 
      />

      {showStartDatePicker && <DateTimePicker value={formData.startDate} mode="date" onChange={(e, d) => { setShowStartDatePicker(false); if(e.type === 'set' && d) setFormData({...formData, startDate: d}); }} />}
      {showDueDatePicker && <DateTimePicker value={formData.dueDate} mode="date" onChange={(e, d) => { setShowDueDatePicker(false); if(e.type === 'set' && d) setFormData({...formData, dueDate: d}); }} />}

    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, data, onSelect, displayKey, colors }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.statusSheet, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.sheetTitle, { color: colors.textMain }]}>{title}</Text>
              <ScrollView style={{maxHeight: 300}}>
                  {data.map((item: any, index: number) => (
                      <TouchableOpacity key={index} style={[styles.sheetItem, {borderBottomColor: colors.border}]} onPress={() => { onSelect(item); onClose(); }}>
                          <Text style={[styles.sheetText, { color: colors.textMain }]}>{typeof displayKey === 'function' ? displayKey(item) : item}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900' },
  addBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, marginLeft: 6 },
  
  taskCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, paddingRight: 10 },
  iconBtn: { padding: 6 },
  taskDesc: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, flex: 1 },
  metaText: { fontSize: 12, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '85%', overflow: 'hidden' },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
  modalFooter: { padding: 20, borderTopWidth: 1 },
  submitBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  label: { marginBottom: 6, fontWeight: '600', fontSize: 12, color: '#64748B' },
  input: { borderWidth: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 14, height: 80 },
  inputBox: { borderWidth: 1, height: 48, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  statusSheet: { padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  sheetItem: { paddingVertical: 15, borderBottomWidth: 1 },
  sheetText: { fontSize: 15, textAlign: 'center', textTransform: 'capitalize' }
});