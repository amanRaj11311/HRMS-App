import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Platform, Image, StatusBar, RefreshControl, KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 
import { API_BASE } from '../api/api';

const PERIODS = [
  'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026',
  'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 
];

interface Employee {
  _id: string; 
  userId?: { _id: string; firstName: string; lastName: string; avatar?: string; };
  designation: string;
  department: string;
  isDeleted?: boolean;
}

interface PerformanceReview {
  _id: string;
  employeeId: any; 
  reviewPeriod?: string; 
  period?: string;       
  overallRating: number;
  technicalSkills: number;
  communication: number;
  teamwork: number;
  leadership: number;
  punctuality: number;
  productivity: number;
  strengths: string;
  improvements: string;
  goals: string;
  comments: string;
}

const PerformanceScreen = ({ navigation }: any) => {
  const { colors, isLightMode } = useTheme();
  
  // --- PERMISSIONS & CORE STATES ---
  const [permissions, setPermissions] = useState<string[]>([]);
  const [myEmpId, setMyEmpId] = useState<string>('');

  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false); 
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('All Periods');
  const [filterEmpId, setFilterEmpId] = useState<string>('All');
  const [filterEmpName, setFilterEmpName] = useState<string>('All Employees');

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [showFilterPeriodModal, setShowFilterPeriodModal] = useState(false);
  const [showFilterEmpModal, setShowFilterEmpModal] = useState(false);
  const [showFormEmpModal, setShowFormEmpModal] = useState(false);
  const [showFormPeriodModal, setShowFormPeriodModal] = useState(false);
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editRecordId, setEditRecordId] = useState<string>('');

  const initialFormState = {
    employeeId: '',
    employeeName: 'Select Employee',
    period: 'Q1 2026',
    overallRating: 0,
    technicalSkills: 0,
    communication: 0,
    teamwork: 0,
    leadership: 0,
    punctuality: 0,
    productivity: 0,
    strengths: '',
    improvements: '',
    goals: '',
    comments: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // 🚀 100% STRICT DYNAMIC PERMISSIONS
  const hasPerm = (action: string) => {
      return permissions.includes(`PERFORMANCE:${action.toUpperCase()}`);
  };

  const canViewAll = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');
  const canUpdate = hasPerm('UPDATE');
  const canViewSelf = hasPerm('SELF');
  const canDelete = hasPerm('DELETE');

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
    
    if (pArray.includes('PERFORMANCE:VIEW') || pArray.includes('PERFORMANCE:CREATE') || pArray.includes('PERFORMANCE:UPDATE')) {
        fetchEmployees();
    }
    
    fetchData(false, pArray, empId);
  };

  const fetchEmployees = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
      const empList = res.data?.data?.data || res.data?.data || res.data || [];
      const validEmployees = empList.filter((emp: any) => emp && emp.userId);
      setEmployees(validEmployees);
    } catch (err) {}
  };

  const fetchData = async (isSilent = false, currentPerms = permissions, empId = myEmpId) => {
    try {
      if(!isSilent) setLoading(true);
      
      const userCanViewAll = currentPerms.includes('PERFORMANCE:VIEW');
      const userCanViewSelf = currentPerms.includes('PERFORMANCE:SELF');

      if (!userCanViewAll && !userCanViewSelf) {
          setReviews([]);
          setLoading(false);
          setRefreshing(false);
          return;
      }

      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      let url = `${API_BASE}/performance?limit=1000`;
      
      if (!userCanViewAll && userCanViewSelf && empId) {
          url = `${API_BASE}/performance?employeeId=${empId}&limit=100`;
      }

      const res = await axios.get(url, config);
      setReviews(res.data?.data || res.data || []);
      
    } catch (err) {
      console.error("Failed to load reviews");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const getEmployeeDetails = (review: any) => {
    if (!review || !review.employeeId) return { firstName: 'Unknown', lastName: '', avatar: '', designation: 'Employee', mongoId: '' };
    
    if (typeof review.employeeId === 'object' && review.employeeId.userId) {
        return {
            firstName: review.employeeId.userId.firstName || 'Unknown',
            lastName: review.employeeId.userId.lastName || '',
            avatar: review.employeeId.userId.avatar || '',
            designation: review.employeeId.designation || 'Employee',
            mongoId: review.employeeId._id
        };
    }

    const searchId = typeof review.employeeId === 'object' ? review.employeeId._id : review.employeeId;
    const matchedEmp = employees.find(e => e._id === searchId || e.userId?._id === searchId);

    if (matchedEmp && matchedEmp.userId) {
        return {
            firstName: matchedEmp.userId.firstName || 'Unknown',
            lastName: matchedEmp.userId.lastName || '',
            avatar: matchedEmp.userId.avatar || '',
            designation: matchedEmp.designation || 'Employee',
            mongoId: matchedEmp._id
        };
    }
    return { firstName: 'Unknown', lastName: '', avatar: '', designation: 'Employee', mongoId: searchId };
  };

  const saveReview = async () => {
    if (!formData.employeeId) {
      Alert.alert("Required", "Please select an employee.");
      return;
    }
    if (formData.overallRating === 0) {
      Alert.alert("Required", "Please provide an overall rating.");
      return;
    }

    try {
      setFormLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const payload = {
        employeeId: formData.employeeId,
        reviewerId: myEmpId,
        reviewPeriod: formData.period, 
        period: formData.period,       
        overallRating: formData.overallRating,
        technicalSkills: formData.technicalSkills,
        communication: formData.communication,
        teamwork: formData.teamwork,
        leadership: formData.leadership,
        punctuality: formData.punctuality,
        productivity: formData.productivity,
        strengths: formData.strengths,
        improvements: formData.improvements,
        goals: formData.goals,
        comments: formData.comments
      };

      let res;
      if (isEditing) {
        res = await axios.put(`${API_BASE}/performance/${editRecordId}`, payload, config);
      } else {
        res = await axios.post(`${API_BASE}/performance`, payload, config);
      }
      
      if (res.data && (res.data.success === false || res.data.status === 'error')) {
          Alert.alert("Save Failed", res.data.message || "Backend validation failed.");
          setFormLoading(false);
          return;
      }
      
      setIsAddModalVisible(false);
      setFormData(initialFormState);
      await fetchData(true); 
      Alert.alert("Success", `Performance review ${isEditing ? 'updated' : 'added'} successfully.`);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to save review.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClick = (review: PerformanceReview) => {
    setIsEditing(true);
    setEditRecordId(review._id);
    const emp = getEmployeeDetails(review);
    const periodValue = review.reviewPeriod || review.period || 'Q1 2026';

    setFormData({
      employeeId: emp.mongoId || '',
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      period: periodValue,
      overallRating: review.overallRating || 0,
      technicalSkills: review.technicalSkills || 0,
      communication: review.communication || 0,
      teamwork: review.teamwork || 0,
      leadership: review.leadership || 0,
      punctuality: review.punctuality || 0,
      productivity: review.productivity || 0,
      strengths: review.strengths || '',
      improvements: review.improvements || '',
      goals: review.goals || '',
      comments: review.comments || ''
    });

    setIsAddModalVisible(true);
  };
  const handleDelete = (id: string) => {
  Alert.alert(
    "Confirm Delete",
    "Are you sure you want to delete this review?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE}/performance/${id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            await fetchData(true);
            Alert.alert("Success", "Review deleted successfully.");
          } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Delete failed.");
          }
        }
      }
    ]
  );
};

  const handleAddClick = () => {
    setIsEditing(false);
    setEditRecordId('');
    setFormData(initialFormState);
    setIsAddModalVisible(true);
  };

  const getRatingInfo = (rating: number) => {
    if (rating === 5) return { label: 'Excellent', color: '#10b981' }; 
    if (rating === 4) return { label: 'Good', color: '#84cc16' }; 
    if (rating === 3) return { label: 'Average', color: '#eab308' }; 
    if (rating === 2) return { label: 'Below Avg', color: '#f97316' }; 
    if (rating === 1) return { label: 'Poor', color: '#ef4444' }; 
    return { label: 'Not Rated', color: '#94a3b8' };
  };

  const filteredReviews = reviews.filter(review => {
    const empDetails = getEmployeeDetails(review);
    const fullName = `${empDetails.firstName} ${empDetails.lastName}`.toLowerCase();
    const searchLow = (searchQuery || '').toLowerCase();
    const reviewPeriodStr = review.reviewPeriod || review.period || '';
    
    const matchSearch = fullName.includes(searchLow) || reviewPeriodStr.toLowerCase().includes(searchLow);
    const matchPeriod = filterPeriod === 'All Periods' || reviewPeriodStr === filterPeriod;
    const matchEmp = filterEmpId === 'All' || empDetails.mongoId === filterEmpId;

    return matchSearch && matchPeriod && matchEmp;
  });

  const activeEmployees = employees.filter(emp => emp.isDeleted !== true);

  const CustomDropdownModal = ({ visible, onClose, title, data, onSelect, displayKey }: any) => (
    <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropOverlay} onPress={onClose} activeOpacity={1}>
            <View style={[styles.dropContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Text style={[styles.dropTitle, { color: colors.textMain }]}>{title}</Text>
                <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                    {data.map((item: any, index: number) => (
                        <TouchableOpacity key={index} style={[styles.dropItem, {borderBottomColor: colors.border}]} onPress={() => { onSelect(item); onClose(); }}>
                            <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 15, textTransform: 'capitalize' }}>
                              {typeof displayKey === 'function' ? displayKey(item) : item[displayKey] || item}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </TouchableOpacity>
    </Modal>
  );

  const StarRater = ({ label, value, onChange }: any) => {
    const info = getRatingInfo(value);
    return (
      <View style={styles.starRow}>
         <Text style={[styles.starLabel, {color: colors.textMain}]}>{label}</Text>
         <View style={{flexDirection: 'row', alignItems: 'center'}}>
             {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => onChange(star)} style={{padding: 2}}>
                <Feather name="star" size={18} color={star <= value ? '#facc15' : colors.border} fill={star <= value ? '#facc15' : 'transparent'} />
              </TouchableOpacity>
            ))}
            <Text style={[styles.starInfoText, {color: info.color}]}>{value > 0 ? info.label : ''}</Text>
         </View>
      </View>
    )
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />} 
      >
        
        <View style={styles.pageHeader}>
          <View style={{ flex: 1 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Feather name="star" size={24} color="#3b82f6" style={{ marginRight: 8 }} />
                <Text style={[styles.pageTitle, { color: colors.textMain }]}>Performance</Text>
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSub }]}>{canViewAll ? "Evaluate and track team performance" : "Your personal performance reviews"}</Text>
          </View>
          
          {canCreate && (
              <TouchableOpacity style={styles.addBtn} onPress={handleAddClick}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addBtnText}>New</Text>
              </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterBtn, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1, marginRight: 10}]} onPress={() => setShowFilterPeriodModal(true)}>
              <Text style={{color: colors.textMain, fontSize: 13, fontWeight: '600'}}>{filterPeriod}</Text>
              <Feather name="chevron-down" size={16} color={colors.textSub} />
            </TouchableOpacity>

            {canViewAll && (
                <TouchableOpacity style={[styles.filterBtn, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1.5}]} onPress={() => setShowFilterEmpModal(true)}>
                  <Text style={{color: colors.textMain, fontSize: 13, fontWeight: '600'}} numberOfLines={1}>{filterEmpName}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSub} />
                </TouchableOpacity>
            )}
        </View>

        <CustomDropdownModal visible={showFilterPeriodModal} onClose={() => setShowFilterPeriodModal(false)} title="Select Period" data={['All Periods', ...PERIODS]} displayKey={(item:any) => item} onSelect={(val:any) => setFilterPeriod(val)} />
        <CustomDropdownModal visible={showFilterEmpModal} onClose={() => setShowFilterEmpModal(false)} title="Select Employee" data={[{userId:{_id:'All', firstName:'All', lastName:'Employees'}} , ...activeEmployees]} displayKey={(item:any) => `${item.userId?.firstName} ${item.userId?.lastName}`} onSelect={(emp:any) => { setFilterEmpId(emp.userId?._id); setFilterEmpName(`${emp.userId?.firstName} ${emp.userId?.lastName}`); }} />

        {loading && !refreshing ? <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} /> : filteredReviews.map((review, index) => {
           const emp = getEmployeeDetails(review);
           const overallInfo = getRatingInfo(review.overallRating);
           const periodText = review.reviewPeriod || review.period || '--';

           return (
            <View key={review._id || index} style={[styles.reviewCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                        <View style={[styles.avatarBox, {backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a', borderColor: colors.border}]}>
                           {emp.avatar && emp.avatar.includes('http') && !emp.avatar.includes('ui-avatars') ? (
                              <Image source={{ uri: emp.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                           ) : (
                              <Text style={{fontWeight: 'bold', fontSize: 16, color: '#3b82f6'}}>{emp.firstName?.substring(0,2).toUpperCase()}</Text>
                           )}
                        </View>
                        <View style={{marginLeft: 12, flex: 1}}>
                            <Text style={{fontWeight: 'bold', fontSize: 16, color: colors.textMain}} numberOfLines={1}>{emp.firstName} {emp.lastName}</Text>
                            <Text style={{fontSize: 12, color: colors.textSub, marginTop: 2}}>{emp.designation}</Text>
                        </View>
                    </View>
                    
                    {canUpdate && (
                        <TouchableOpacity onPress={() => handleEditClick(review)} style={[styles.editBtn, {borderColor: colors.border, backgroundColor: isLightMode ? '#f8fafc' : '#1e293b'}]}>
                            <Feather name="edit-2" size={14} color={colors.textSub} />
                        </TouchableOpacity>
                    )}
                    {canDelete && (
  <TouchableOpacity 
    onPress={() => handleDelete(review._id)} 
    style={[styles.editBtn, {borderColor: colors.border, backgroundColor: isLightMode ? '#fef2f2' : '#3f1d1d', marginLeft: 8}]}
  >
    <Feather name="trash-2" size={14} color="red" />
  </TouchableOpacity>
)}
                </View>

                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 15}}>
                    <View style={[styles.periodBadge, {backgroundColor: isLightMode ? '#eff6ff' : '#1e3a8a'}]}>
                        <Text style={{color: '#3b82f6', fontSize: 11, fontWeight: '800', textTransform: 'uppercase'}}>{periodText}</Text>
                    </View>
                    
                    <View style={{alignItems: 'flex-end'}}>
                       <View style={{flexDirection: 'row', alignItems: 'center'}}>
                         <Text style={{fontSize: 22, fontWeight: '900', color: overallInfo.color, marginRight: 6}}>{review.overallRating}</Text>
                         <View style={{flexDirection: 'row'}}>
                           {[1, 2, 3, 4, 5].map(star => (
                             <Feather key={star} name="star" size={12} color={star <= review.overallRating ? '#facc15' : colors.border} fill={star <= review.overallRating ? '#facc15' : 'transparent'} style={{marginLeft: 2}} />
                           ))}
                         </View>
                       </View>
                       <Text style={{fontSize: 11, fontWeight: 'bold', color: overallInfo.color, marginTop: 2}}>{overallInfo.label}</Text>
                    </View>
                </View>

                <View style={styles.barsContainer}>
                   <ProgressBar label="Technical" value={review.technicalSkills} colors={colors} />
                   <ProgressBar label="Communication" value={review.communication} colors={colors} />
                   <ProgressBar label="Teamwork" value={review.teamwork} colors={colors} />
                </View>

                {review.comments ? (
                   <View style={[styles.commentsBox, {backgroundColor: isLightMode ? '#f8fafc' : '#1e293b'}]}>
                      <Text style={{fontSize: 12, color: colors.textSub, fontStyle: 'italic', fontWeight: '500'}} numberOfLines={2}>"{review.comments}"</Text>
                   </View>
                ) : null}
            </View>
          )
        })}

        {!loading && filteredReviews.length === 0 && (
            <View style={{alignItems: 'center', marginTop: 40}}>
                <Feather name="star" size={40} color={colors.border} />
                <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 10, fontSize: 14, fontWeight: '600' }}>
                    {canCreate ? "No performance reviews found." : "No performance reviews available for you yet."}
                </Text>
            </View>
        )}
      </ScrollView>

      {/* 🚀 FORM MODAL */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            
            <View style={[styles.modalNav, {borderBottomColor: colors.border}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Feather name="star" size={18} color="#3b82f6" style={{marginRight: 8}}/>
                 <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.textMain}}>{isEditing ? 'Edit Review' : 'New Review'}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)} style={{padding: 5}}><Feather name="x" size={24} color={colors.textMain}/></TouchableOpacity>
            </View>

            <ScrollView style={{padding: 20}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                 <View style={{flex: 1.2, marginRight: 15}}>
                    <Text style={[styles.label, {color: colors.textMain}]}>Employee <Text style={{color:'red'}}>*</Text></Text>
                    <TouchableOpacity 
                        style={[styles.input, {borderColor: colors.border, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center'}]} 
                        onPress={() => !isEditing && canViewAll && setShowFormEmpModal(true)} 
                        disabled={isEditing || !canViewAll}
                    >
                        <Text style={{color: formData.employeeId ? colors.textMain : colors.textSub, fontWeight: '600'}} numberOfLines={1}>{formData.employeeName}</Text>
                        {(!isEditing && canViewAll) && <Feather name="chevron-down" size={16} color={colors.textSub} />}
                    </TouchableOpacity>
                 </View>
                 <View style={{flex: 0.8}}>
                    <Text style={[styles.label, {color: colors.textMain}]}>Period <Text style={{color:'red'}}>*</Text></Text>
                    <TouchableOpacity style={[styles.input, {borderColor: colors.border, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center'}]} onPress={() => setShowFormPeriodModal(true)}>
                        <Text style={{color: colors.textMain, fontWeight: '600'}}>{formData.period}</Text>
                        <Feather name="chevron-down" size={16} color={colors.textSub} />
                    </TouchableOpacity>
                 </View>
              </View>
              
              <CustomDropdownModal visible={showFormEmpModal} onClose={() => setShowFormEmpModal(false)} title="Select Employee" data={activeEmployees} displayKey={(item:any) => `${item.userId?.firstName} ${item.userId?.lastName}`} onSelect={(emp:any) => { setFormData({...formData, employeeId: emp.userId._id, employeeName: `${emp.userId.firstName} ${emp.userId.lastName}`}); }} />
              <CustomDropdownModal visible={showFormPeriodModal} onClose={() => setShowFormPeriodModal(false)} title="Select Period" data={PERIODS} displayKey={(item:any) => item} onSelect={(val:any) => setFormData({...formData, period: val})} />

              <View style={{flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10}}>
                 <View style={{width: '48%'}}><StarRater label="Overall Rating *" value={formData.overallRating} onChange={(v:number) => setFormData({...formData, overallRating: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Technical Rating" value={formData.technicalSkills} onChange={(v:number) => setFormData({...formData, technicalSkills: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Communication" value={formData.communication} onChange={(v:number) => setFormData({...formData, communication: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Teamwork" value={formData.teamwork} onChange={(v:number) => setFormData({...formData, teamwork: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Leadership Rating" value={formData.leadership} onChange={(v:number) => setFormData({...formData, leadership: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Punctuality" value={formData.punctuality} onChange={(v:number) => setFormData({...formData, punctuality: v})} /></View>
                 <View style={{width: '48%'}}><StarRater label="Productivity" value={formData.productivity} onChange={(v:number) => setFormData({...formData, productivity: v})} /></View>
              </View>

              <Text style={[styles.label, {color: colors.textMain}]}>Strengths</Text>
              <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border, height: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 15}]} multiline value={formData.strengths} onChangeText={(t)=>setFormData({...formData, strengths:t})} placeholderTextColor={colors.textSub} placeholder="Enter strengths..."/>

              <Text style={[styles.label, {color: colors.textMain}]}>Improvements</Text>
              <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border, height: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 15}]} multiline value={formData.improvements} onChangeText={(t)=>setFormData({...formData, improvements:t})} placeholderTextColor={colors.textSub} placeholder="Enter areas for improvement..."/>

              <Text style={[styles.label, {color: colors.textMain}]}>Goals</Text>
              <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border, height: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 15}]} multiline value={formData.goals} onChangeText={(t)=>setFormData({...formData, goals:t})} placeholderTextColor={colors.textSub} placeholder="Enter future goals..."/>

              <Text style={[styles.label, {color: colors.textMain}]}>Comments</Text>
              <TextInput style={[styles.input, {color: colors.textMain, borderColor: colors.border, height: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 30}]} multiline value={formData.comments} onChangeText={(t)=>setFormData({...formData, comments:t})} placeholderTextColor={colors.textSub} placeholder="Final comments..."/>

            </ScrollView>

            <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
              <TouchableOpacity style={[styles.submitBtn, {backgroundColor: 'transparent', flex: 1, marginRight: 10, borderWidth: 1, borderColor: colors.border}]} onPress={() => setIsAddModalVisible(false)}>
                <Text style={{color: colors.textMain, fontWeight:'bold'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, {flex: 1}]} onPress={saveReview} disabled={formLoading}>
                {formLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'bold'}}>{isEditing ? 'Update' : 'Submit'}</Text>}
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const ProgressBar = ({ label, value, colors }: any) => {
  const widthPct = `${(value / 5) * 100}%`;
  return (
    <View style={{marginBottom: 10}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
        <Text style={{fontSize: 12, color: colors.textSub, fontWeight: '600'}}>{label}</Text>
        <Text style={{fontSize: 12, fontWeight: 'bold', color: colors.textMain}}>{value}/5</Text>
      </View>
      <View style={{height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden'}}>
         <View style={{height: '100%', width: widthPct, backgroundColor: '#3b82f6', borderRadius: 3}} />
      </View>
    </View>
  )
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 5 },
  pageTitle: { fontSize: 24, fontWeight: 'bold' },
  pageSubtitle: { fontSize: 13, marginTop: 4, marginLeft: 32 },
  addBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center', elevation: 2 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginLeft: 8 },
  
  filterRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center', justifyContent: 'space-between' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15 },

  reviewCard: { borderRadius: 16, borderWidth: 1, marginBottom: 18, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  avatarBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1 },
  editBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
  
  periodBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  barsContainer: { borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.2)', paddingTop: 15 },
  commentsBox: { marginTop: 10, padding: 12, borderRadius: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: '90%' },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
  label: { marginBottom: 8, fontWeight: '600', fontSize: 13 },
  input: { borderWidth: 1, minHeight: 48, borderRadius: 10, paddingHorizontal: 12 },
  modalFooter: { flexDirection: 'row', padding: 20, borderTopWidth: 1, backgroundColor: 'transparent' },
  submitBtn: { backgroundColor: '#3b82f6', height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  dropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 30 },
  dropContent: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  dropTitle: { padding: 18, fontSize: 16, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  starRow: { marginBottom: 20 },
  starLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  starInfoText: { fontSize: 11, fontWeight: 'bold', marginLeft: 8 }
});

export default PerformanceScreen;