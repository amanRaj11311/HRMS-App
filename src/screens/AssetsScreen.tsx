import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Platform, RefreshControl, StatusBar, KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

const CATEGORIES = ['laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'other (custom)'];
const STATUSES = ['available', 'assigned', 'maintenance'];

interface Asset {
  _id: string;
  brand: string;
  name: string;
  serialNumber: string;
  category: string;
  status: string;
  assignedTo?: any; 
  assignedDate?: string;
  assignmentHistory?: any[];
}

export default function AdminAssetsScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme();
  
  // --- PERMISSIONS & CORE STATES ---
  const [permissions, setPermissions] = useState<string[]>([]);
  const [myEmpId, setMyEmpId] = useState<string>('');
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState<any>(null);
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFieldTarget, setDateFieldTarget] = useState<'assignedDate' | 'returnDate'>('assignedDate');

  const [formData, setFormData] = useState({
    _id: '', category: 'laptop', name: '', brand: '', serialNumber: '', 
    status: 'available', assignedTo: '', assignedToName: 'None', assignedDate: '', returnDate: ''
  });

  const canViewAll = permissions.includes('ASSET:VIEW');
  const canCreate = permissions.includes('ASSET:CREATE');
  const canUpdate = permissions.includes('ASSET:UPDATE');
  const canDelete = permissions.includes('ASSET:DELETE');
  const canViewSelf = permissions.includes('ASSET:SELF');

  useFocusEffect(
    useCallback(() => {
      initScreen();
    }, [])
  );

  const initScreen = async () => {
    setLoading(true);
    const permsStr = await AsyncStorage.getItem('userPermissions');
    const empId = await AsyncStorage.getItem('employeeId');
    
    const rawArray = permsStr ? JSON.parse(permsStr) : [];
    const pArray = rawArray.map((p: string) => p.trim().toUpperCase());
    
    setPermissions(pArray);
    if (empId) setMyEmpId(empId);
    
    if (pArray.includes('ASSET:VIEW') || pArray.includes('ASSET:CREATE') || pArray.includes('ASSET:UPDATE')) {
        fetchEmployees();
    }
    
    fetchData(false, pArray, empId);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=1000`, { headers: { Authorization: `Bearer ${token}` } });
      const empData = res.data?.data?.data || res.data?.data || res.data || [];
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (e) {}
  };

  const fetchData = async (isSilent = false, currentPerms = permissions, empId = myEmpId) => {
    try {
      if (!isSilent) setLoading(true);
      
      const userCanViewAll = currentPerms.includes('ASSET:VIEW');
      const userCanViewSelf = currentPerms.includes('ASSET:SELF');

      if (!userCanViewAll && !userCanViewSelf) {
          setAssets([]);
          setLoading(false);
          setRefreshing(false);
          return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const ts = new Date().getTime();
      
      let url = `${API_BASE}/assets?limit=1000&_t=${ts}`;
      
      if (!userCanViewAll && userCanViewSelf && empId) {
          url = `${API_BASE}/assets?assignedTo=${empId}&limit=200&_t=${ts}`;
      }

      const assetsRes = await axios.get(url, config);
      const assetsData = assetsRes.data?.data?.data || assetsRes.data?.data || assetsRes.data || [];
      setAssets(Array.isArray(assetsData) ? assetsData : []);
      
    } catch (err: any) {
      console.log("Assets fetch error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
  };

  const totalAssets = assets.length;
  const assignedAssets = assets.filter(a => a.status === 'assigned').length;
  const maintenanceAssets = assets.filter(a => a.status === 'maintenance').length;
  const availableAssets = assets.filter(a => a.status === 'available').length;

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Asset", `Are you sure you want to delete ${name}?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await axios.delete(`${API_BASE}/assets/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            
            if (res.data && res.data.success === false) {
                Alert.alert("Error", res.data.message || "Backend prevented deletion.");
                return;
            }

            setAssets(prev => prev.filter(a => a._id !== id));
            Alert.alert("Success", "Asset deleted successfully");
          } catch (err: any) { 
              Alert.alert("Error", err.response?.data?.message || "Failed to delete."); 
          }
        }
      }
    ]);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date && event.type === 'set') {
      setSelectedDate(date);
      setFormData({ ...formData, [dateFieldTarget]: date.toISOString().split('T')[0] });
    }
  };

  // 🚀 FIXED: Robust Error Parser translates ugly backend errors to clean human-readable messages
  const parseBackendError = (errMsg: string) => {
      let cleanMsg = String(errMsg || '');
      
      // Duplicate Key Error
      if (cleanMsg.includes('E11000') || cleanMsg.toLowerCase().includes('duplicate')) {
          if (cleanMsg.includes('serialNumber') || cleanMsg.includes('serial')) {
              return "This Serial Number is already registered! Please enter a unique Serial Number.";
          }
          return "A record with this exact information already exists (Duplicate Entry).";
      }
      
      // Enum Validation Error (If the backend blocks custom category names)
      if (cleanMsg.includes('valid enum value') || cleanMsg.includes('enum')) {
          return "Database Restriction: Your server does not accept custom category names. Please select a predefined category (like 'other').";
      }
      
      return cleanMsg;
  };

  const submitForm = async (isReturnAction = false) => {
    if (!formData.name || !formData.brand || !formData.serialNumber || !formData.category) {
      Alert.alert("Required", "Please fill asset category, name, brand, and serial number.");
      return;
    }
    
    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      let finalCategory = formData.category.toLowerCase().trim();
      let finalName = formData.name;
      
      // 🚀 SMART JUGAD: If user types a custom category, map it to 'other' to pass the backend's strict enum check,
      // and neatly prepend the custom category text into the Asset Name so no data is lost!
      if (isCustomCategory && finalCategory !== 'other') {
          finalName = `[${formData.category.trim()}] ${formData.name}`;
          finalCategory = 'other';
      }

      let payload: any = { 
          name: finalName,
          brand: formData.brand,
          serialNumber: formData.serialNumber,
          category: finalCategory,
          status: isReturnAction ? 'available' : formData.status,
      };

      if (payload.status === 'assigned' && formData.assignedTo && formData.assignedTo !== 'None') {
          payload.assignedTo = formData.assignedTo;
          if (formData.assignedDate) {
              payload.assignedDate = formData.assignedDate; 
          }
      }

      if (isReturnAction || payload.status === 'available') {
          payload.assignedTo = null;
      }
      
      let res;
      if (isEditing) {
        res = await axios.put(`${API_BASE}/assets/${formData._id}`, payload, config);
      } else {
        res = await axios.post(`${API_BASE}/assets`, payload, config);
      }
      
      if (res.data && (res.data.success === false || res.data.status === 'error')) {
          const readableError = parseBackendError(res.data.message || "Backend validation failed.");
          Alert.alert("Save Failed", readableError);
          setFormLoading(false);
          return;
      }

      setIsModalVisible(false);
      await fetchData(true); 
      Alert.alert("Success", `Asset ${isEditing ? 'updated' : 'added'} successfully.`);
    } catch (err: any) {
      const rawError = err.response?.data?.message || err.message || "Failed to save asset.";
      Alert.alert("Error", parseBackendError(rawError));
    } finally { 
      setFormLoading(false); 
    }
  };

  const filteredAssets = assets.filter(asset => {
    const searchLow = (searchQuery || '').toLowerCase();
    const nameMatch = (asset.name || '').toLowerCase().includes(searchLow);
    const brandMatch = (asset.brand || '').toLowerCase().includes(searchLow);
    const snMatch = (asset.serialNumber || '').toLowerCase().includes(searchLow);
    return nameMatch || brandMatch || snMatch;
  });

  const employeeOptions = ['None', ...employees.map(e => {
      const user = e.userId || {};
      return `${user.firstName || ''} ${user.lastName || ''} (${e.employeeId || e._id.substring(0,4)})`;
  })];

  const handleEmployeeSelect = (selection: string) => {
      if (selection === 'None') {
          setFormData({ ...formData, assignedTo: '', assignedToName: 'None' });
      } else {
          const matchedEmp = employees.find(e => {
             const user = e.userId || {};
             const str = `${user.firstName || ''} ${user.lastName || ''} (${e.employeeId || e._id.substring(0,4)})`;
             return str === selection;
          });
          if (matchedEmp) {
              setFormData({ ...formData, assignedTo: matchedEmp._id, assignedToName: selection });
          }
      }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} onSearch={setSearchQuery} searchQuery={searchQuery} showSearch={true} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
      >
        <View style={styles.pageHeader}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name="briefcase-outline" size={26} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.pageTitle, { color: colors.textMain, flexShrink: 1 }]} numberOfLines={2}>Asset Management</Text>
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSub }]} numberOfLines={1}>{canViewAll ? "Manage company assets & devices" : "Your assigned assets"}</Text>
          </View>
          
          {canCreate && (
              <TouchableOpacity style={styles.applyBtn} onPress={() => { 
                  setIsEditing(false); 
                  setIsCustomCategory(false);
                  setFormData({ _id: '', category: 'laptop', name: '', brand: '', serialNumber: '', status: 'available', assignedTo: '', assignedToName: 'None', assignedDate: new Date().toISOString().split('T')[0], returnDate: '' });
                  setIsModalVisible(true); 
              }}>
                <MaterialCommunityIcons name="plus" size={16} color="#fff" style={{marginRight: 4}} />
                <Text style={styles.applyBtnText}>New</Text>
              </TouchableOpacity>
          )}
        </View>

        {(canViewAll || canViewSelf) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiWrapper} contentContainerStyle={{paddingVertical: 5}}>
              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#3B82F6' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="layers" size={16} color="#3B82F6" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Total</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{totalAssets}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#F59E0B' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="account-check" size={16} color="#F59E0B" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Assigned</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{assignedAssets}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#EF4444' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="hammer-wrench" size={16} color="#EF4444" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Repair</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{maintenanceAssets}</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.cardBg, borderLeftColor: '#10B981' }]}>
                <View style={styles.kpiLabelRow}>
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{marginRight: 6}} />
                    <Text style={styles.kpiLabel}>Available</Text>
                </View>
                <Text style={[styles.kpiVal, { color: colors.textMain }]}>{availableAssets}</Text>
              </View>
            </ScrollView>
        )}

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} /> : filteredAssets.map((asset) => {
           let statusColor = '#10B981'; 
           let statusBg = isLightMode ? '#D1FAE5' : '#064E3B';
           if(asset.status === 'assigned') { statusColor = '#3B82F6'; statusBg = isLightMode ? '#DBEAFE' : '#1E3A8A'; }
           if(asset.status === 'maintenance') { statusColor = '#EF4444'; statusBg = isLightMode ? '#FEE2E2' : '#7F1D1D'; }

           const assignedUser = asset.assignedTo?.userId || {};
           const assignedName = assignedUser.firstName ? `${assignedUser.firstName} ${assignedUser.lastName}` : '---';

           return (
          <View key={asset._id} style={[styles.appAssetCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.appCardHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                  <View style={[styles.appAvatarBox, { backgroundColor: isLightMode ? '#F1F5F9' : '#334155' }]}>
                      <MaterialCommunityIcons name={asset.category === 'laptop' ? 'laptop' : asset.category === 'desktop' ? 'monitor' : 'devices'} size={22} color={isLightMode ? '#475569' : '#F8FAFC'} />
                  </View>
                  <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={[styles.appNameText, {color: colors.textMain}]} numberOfLines={1}>{asset.name}</Text>
                    <Text style={[styles.appEmailText, {color: colors.textSub}]} numberOfLines={1}>{asset.brand} • S/N: {asset.serialNumber}</Text>
                  </View>
              </View>
              <View style={[styles.appStatusBadge, {backgroundColor: statusBg}]}>
                <Text style={{color: statusColor, fontSize: 10, fontWeight: '800', textTransform:'uppercase'}}>{asset.status}</Text>
              </View>
            </View>

            <View style={[styles.appDateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
              <View style={{flex: 1}}>
                  <Text style={styles.appDateLabel}>CATEGORY</Text>
                  <Text style={[styles.appDateValue, {color: colors.textMain, textTransform:'capitalize'}]}>{asset.category || 'N/A'}</Text>
              </View>
              <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}>
                  <Text style={styles.appDateLabel}>ASSIGNED TO</Text>
                  <Text style={[styles.appDateValue, {color: colors.textMain}]} numberOfLines={1}>{asset.status === 'assigned' ? assignedName : '---'}</Text>
              </View>
            </View>

            <View style={styles.appCardFooter}>
              <View style={{flex: 1}}>
                  <Text style={{color: colors.textSub, fontSize: 11, fontWeight: '600'}}>
                     {asset.status === 'assigned' && asset.assignedDate ? `Assigned: ${new Date(asset.assignedDate).toLocaleDateString()}` : `Added: ${asset._id ? new Date(parseInt(asset._id.substring(0, 8), 16) * 1000).toLocaleDateString() : 'N/A'}`}
                  </Text>
              </View>
              
              <View style={styles.actionArea}>
                {canViewAll && (
                    <TouchableOpacity style={[styles.appActionBtn, {backgroundColor: isLightMode ? '#F3E8FF' : '#4C1D95', marginRight: 8}]} onPress={() => {
                        setSelectedAssetHistory(asset);
                        setIsHistoryModalVisible(true);
                    }}>
                        <Feather name="eye" size={16} color="#A855F7" />
                    </TouchableOpacity>
                )}

                {canUpdate && (
                    <TouchableOpacity style={[styles.appActionBtn, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155'}]} onPress={() => {
                       const cat = asset.category || 'laptop';
                       const isStandard = CATEGORIES.includes(cat.toLowerCase());
                       setIsCustomCategory(!isStandard);

                       setFormData({
                        _id: asset._id, category: cat, name: asset.name, brand: asset.brand, 
                        serialNumber: asset.serialNumber, status: asset.status || 'available', 
                        assignedTo: asset.assignedTo?._id || '', assignedToName: assignedName, 
                        assignedDate: asset.assignedDate ? asset.assignedDate.split('T')[0] : '', returnDate: ''
                       });
                       setIsEditing(true); setIsModalVisible(true);
                    }}><Feather name="edit-2" size={16} color={colors.textMain} /></TouchableOpacity>
                )}
                
                {canDelete && (
                    <TouchableOpacity style={[styles.appActionBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#7F1D1D', marginLeft: 8}]} onPress={() => handleDelete(asset._id, asset.name)}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )})}

        {!loading && filteredAssets.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 50}}>
                <Feather name="inbox" size={50} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                    {canCreate ? "No assets found. Click 'Add Asset' to create one." : "No assets assigned to you."}
                </Text>
            </View>
        )}
      </ScrollView>

      {/* 🚀 ADD/EDIT ASSET MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
            
            <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mTitle, {color: colors.textMain}]}>{isEditing ? 'Edit Asset' : 'Add Asset'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{padding: 24, paddingBottom: 0}}>
              
              <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Category *</Text>
              <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowCategoryModal(true)}>
                  <Text style={{color: colors.textMain, textTransform:'capitalize'}}>
                      {isCustomCategory ? 'Other (Custom)' : (formData.category || 'Select Category')}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
              </TouchableOpacity>

              {isCustomCategory && (
                  <TextInput 
                      style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain, marginTop: 10}]} 
                      value={formData.category} 
                      onChangeText={(t)=>setFormData({...formData, category:t})} 
                      placeholderTextColor={colors.textSub} 
                      placeholder="Type custom category (e.g., Server, Headphone)..."
                  />
              )}

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Brand *</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.brand} onChangeText={(t)=>setFormData({...formData, brand:t})} placeholderTextColor={colors.textSub} placeholder="e.g. HP"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Asset Name *</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.name} onChangeText={(t)=>setFormData({...formData, name:t})} placeholderTextColor={colors.textSub} placeholder="e.g. HP ProBook"/>
                  </View>
              </View>

              <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>S/N *</Text>
                    <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={formData.serialNumber} onChangeText={(t)=>setFormData({...formData, serialNumber:t})} placeholderTextColor={colors.textSub} placeholder="Serial Number"/>
                  </View>
                  <View style={{width:'48%'}}>
                    <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Status *</Text>
                    <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowStatusModal(true)}>
                        <Text style={{color: colors.textMain, textTransform:'capitalize'}}>{formData.status}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </View>
              </View>

              {formData.status === 'assigned' && (
                <View style={{flexDirection: 'row', justifyContent:'space-between', marginTop: 15}}>
                    <View style={{width:'48%'}}>
                      <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Assign To</Text>
                      {canViewAll ? (
                          <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowAssignModal(true)}>
                              <Text style={{color: colors.textMain}} numberOfLines={1}>{formData.assignedToName}</Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                          </TouchableOpacity>
                      ) : (
                          <View style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]}>
                              <Text style={{color: colors.textSub}} numberOfLines={1}>{formData.assignedToName}</Text>
                          </View>
                      )}
                    </View>
                    <View style={{width:'48%'}}>
                      <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Assigned Date</Text>
                      <TouchableOpacity style={[styles.dropdownBtn, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => { setDateFieldTarget('assignedDate'); setShowDatePicker(true); }}>
                        <Text style={{color: colors.textMain}}>{formData.assignedDate}</Text>
                        <MaterialCommunityIcons name="calendar" size={20} color={colors.textSub} />
                      </TouchableOpacity>
                    </View>
                </View>
              )}

              {showDatePicker && (<DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange}/>)}
              <View style={{height: 40}} />
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
              </TouchableOpacity>
              
              {isEditing && formData.status === 'assigned' && canViewAll && (
                <TouchableOpacity style={[styles.subBtn, {backgroundColor: '#F59E0B', marginRight: 10}]} onPress={() => submitForm(true)} disabled={formLoading}>
                    {formLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>Return Asset</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.subBtn, {backgroundColor: colors.primary}]} onPress={() => submitForm(false)} disabled={formLoading}>
                {formLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>{isEditing ? 'Update Asset' : 'Save Asset'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🚀 HISTORY MODAL */}
      <Modal visible={isHistoryModalVisible} animationType="fade" transparent={true}>
        <View style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg, maxHeight: '70%' }]}>
            <View style={[styles.mHeader, {borderBottomColor: colors.border}]}>
              <View>
                  <Text style={[styles.mTitle, {color: colors.textMain}]}>Assignment History</Text>
                  <Text style={{fontSize: 12, color: colors.textSub, marginTop: 2, fontWeight: '600'}}>Track asset assignment & returns</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
            </View>

            <ScrollView style={{padding: 24}}>
                {selectedAssetHistory?.assignmentHistory?.length > 0 ? (
                    selectedAssetHistory.assignmentHistory.map((history: any, idx: number) => {
                        const userName = history.assignedTo?.userId?.firstName ? `${history.assignedTo.userId.firstName} ${history.assignedTo.userId.lastName}` : 'Unknown Employee';
                        return (
                            <View key={idx} style={{padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginBottom: 16, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B'}}>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <View style={{width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary+'20', justifyContent: 'center', alignItems: 'center', marginRight: 10}}>
                                            <MaterialCommunityIcons name="account" size={18} color={colors.primary} />
                                        </View>
                                        <Text style={{fontWeight: 'bold', color: colors.textMain, fontSize: 14}}>{userName}</Text>
                                    </View>
                                    {history.returnedAt ? (
                                        <Text style={{color: '#10B981', fontSize: 11, fontWeight: '900', textTransform: 'uppercase'}}>Returned</Text>
                                    ) : (
                                        <Text style={{color: '#F59E0B', fontSize: 11, fontWeight: '900', textTransform: 'uppercase'}}>In Use</Text>
                                    )}
                                </View>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10}}>
                                    <View>
                                        <Text style={{color: colors.textSub, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4}}>Assigned At</Text>
                                        <Text style={{color: colors.textMain, fontSize: 13, fontWeight: 'bold'}}>{new Date(history.assignedAt).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={{alignItems: 'flex-end'}}>
                                        <Text style={{color: colors.textSub, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4}}>Returned At</Text>
                                        <Text style={{color: colors.textMain, fontSize: 13, fontWeight: 'bold'}}>{history.returnedAt ? new Date(history.returnedAt).toLocaleDateString() : '---'}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={{alignItems: 'center', paddingVertical: 30}}>
                        <MaterialCommunityIcons name="history" size={40} color={colors.border} />
                        <Text style={{textAlign: 'center', color: colors.textSub, marginTop: 10, fontWeight: '600'}}>No assignment history available.</Text>
                    </View>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <DropdownModal 
          visible={showCategoryModal} 
          onClose={() => setShowCategoryModal(false)} 
          title="Select Category" 
          options={CATEGORIES} 
          selectedValue={isCustomCategory ? 'other (custom)' : formData.category.toLowerCase()} 
          onSelect={(v: any) => {
              if (v === 'other (custom)') {
                  setIsCustomCategory(true);
                  setFormData({...formData, category: ''});
              } else {
                  setIsCustomCategory(false);
                  setFormData({...formData, category: v});
              }
          }} 
          colors={colors}
      />
      <DropdownModal visible={showStatusModal} onClose={() => setShowStatusModal(false)} title="Select Status" options={STATUSES} selectedValue={formData.status} onSelect={(v: any) => setFormData({...formData, status:v})} colors={colors}/>
      <DropdownModal visible={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign To" options={employeeOptions} selectedValue={formData.assignedToName} onSelect={handleEmployeeSelect} colors={colors}/>
      
    </SafeAreaView>
  );
}

const DropdownModal = ({ visible, onClose, title, options, onSelect, selectedValue, colors }: any) => (
  <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.calOverlay} onPress={onClose} activeOpacity={1}>
          <View style={[styles.dropdownList, { backgroundColor: colors.cardBg, borderColor: colors.border, width: '90%', maxHeight: 400 }]}>
              <Text style={{ padding: 18, fontSize: 16, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.textMain }}>{title}</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {options.map((opt: string) => (
                  <TouchableOpacity key={opt} style={{padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border}} onPress={() => { onSelect(opt); onClose(); }}>
                      <Text style={{ color: selectedValue === opt ? colors.primary : colors.textMain, fontWeight: selectedValue === opt ? '800' : '600', fontSize: 15, textTransform: 'capitalize' }}>{opt}</Text>
                  </TouchableOpacity>
              ))}</ScrollView>
          </View>
      </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 150 }, 
  
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 5 },
  pageTitle: { fontSize: 24, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 13, marginTop: 4, marginLeft: 34 },
  applyBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, elevation: 3, marginTop: 5 },
  applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  
  kpiWrapper: { flexDirection: 'row', marginBottom: 20 },
  kpiCard: { width: 120, padding: 15, borderRadius: 12, marginRight: 12, borderLeftWidth: 4, elevation: 2 },
  kpiLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kpiVal: { fontSize: 22, fontWeight: '900', marginTop: 5 },
  kpiLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },

  appAssetCard: { borderRadius: 20, marginBottom: 16, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 6 },
  appCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  appAvatarBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  appNameText: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  appEmailText: { fontSize: 12, fontWeight: '600' },
  appStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  appDateBox: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-between' },
  appDateLabel: { fontSize: 9, color: '#64748B', marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  appDateValue: { fontSize: 13, fontWeight: 'bold' },
  appCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionArea: { minWidth: 90, alignItems: 'flex-end', justifyContent: 'center', flexDirection: 'row' },
  appActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  mOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
  mCard: { width: '100%', padding: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 10 },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, padding: 24, paddingBottom: 16 },
  mTitle: { fontSize: 20, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12, color: '#64748B' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dropdownText: { fontSize: 14, fontWeight: '600' },
  inputObj: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, fontWeight: '600' },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 24, borderTopWidth: 1, borderColor: '#F1F5F9', marginTop: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
  cancelBtnText: { fontWeight: '800', fontSize: 14 },
  subBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  subBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 },
  dropdownList: { position: 'relative', borderWidth: 1, borderRadius: 16, elevation: 5, overflow: 'hidden' }
});