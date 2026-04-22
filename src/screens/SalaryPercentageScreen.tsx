import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Alert, Platform, StatusBar, Modal, RefreshControl, KeyboardAvoidingView 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 

const API_BASE = 'https://hrms.dcstechnosis.com/api'; 

export default function SalaryPercentageScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [percentagesList, setPercentagesList] = useState<any[]>([]);
  
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [formData, setFormData] = useState({
    _id: '',
    name: '',
    basicPercentage: '50',
    hraPercentage: '30',
    otherAllowancesPercentage: '20',
    employeePfPercentage: '12',
    employeeEsiPercentage: '0.75',
    employerPfPercentage: '12',
    employerEsiPercentage: '3.25'
  });

  const hasPerm = (action: string) => permissions.includes(`SALARY-PERCENTAGE:${action}`);
  const canView = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');
  const canUpdate = hasPerm('UPDATE');
  const canDelete = hasPerm('DELETE');

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const permsStr = await AsyncStorage.getItem('userPermissions');
      const perms = permsStr ? JSON.parse(permsStr) : [];
      setPermissions(perms.map((p: string) => p.toUpperCase()));

      if (perms.map((p: string) => p.toUpperCase()).includes('SALARY-PERCENTAGE:VIEW')) {
          const config = { headers: { Authorization: `Bearer ${token}` } };
          const res = await axios.get(`${API_BASE}/salary-percentage?limit=100`, config);
          setPercentagesList(res.data?.data?.data || res.data?.data || []);
      }
    } catch (error) {
      console.log("Salary Percentage Fetch Error", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const resetForm = () => {
      setFormData({
        _id: '', name: '', basicPercentage: '', hraPercentage: '', otherAllowancesPercentage: '',
        employeePfPercentage: '', employeeEsiPercentage: '', employerPfPercentage: '', employerEsiPercentage: ''
      });
      setIsEditing(false);
  };

  const handleSave = async () => {
      if (!formData.name || !formData.basicPercentage || !formData.hraPercentage) {
          return Alert.alert("Required", "Please fill the structure name and base percentages.");
      }

      try {
          setSaveLoading(true);
          const token = await AsyncStorage.getItem('userToken');
          const config = { headers: { Authorization: `Bearer ${token}` } };
          
          const payload = {
              name: formData.name,
              basicPercentage: Number(formData.basicPercentage),
              hraPercentage: Number(formData.hraPercentage),
              otherAllowancesPercentage: Number(formData.otherAllowancesPercentage || 0),
              employeePfPercentage: Number(formData.employeePfPercentage || 0),
              employeeEsiPercentage: Number(formData.employeeEsiPercentage || 0),
              employerPfPercentage: Number(formData.employerPfPercentage || 0),
              employerEsiPercentage: Number(formData.employerEsiPercentage || 0)
          };

          if (isEditing) {
              await axios.put(`${API_BASE}/salary-percentage/${formData._id}`, payload, config);
              Alert.alert("Success", "Salary percentage updated successfully");
          } else {
              await axios.post(`${API_BASE}/salary-percentage`, payload, config);
              Alert.alert("Success", "Salary percentage added successfully");
          }

          setIsModalVisible(false);
          fetchData(true);
      } catch (err: any) {
          Alert.alert("Error", err.response?.data?.message || "Failed to save salary percentage.");
      } finally {
          setSaveLoading(false);
      }
  };

  const handleDelete = (id: string, name: string) => {
      Alert.alert("Delete", `Are you sure you want to delete the '${name}' percentage structure?`, [
          { text: "Cancel", style: "cancel" },
          { 
              text: "Delete", style: "destructive", onPress: async () => {
                  try {
                      const token = await AsyncStorage.getItem('userToken');
                      await axios.delete(`${API_BASE}/salary-percentage/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                      Alert.alert("Deleted", "Structure deleted successfully");
                      fetchData(true);
                  } catch (err: any) {
                      Alert.alert("Error", err.response?.data?.message || "Failed to delete.");
                  }
              } 
          }
      ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} />
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} colors={[colors.primary]} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={styles.header}>
            <View style={{flex: 1}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <MaterialCommunityIcons name="percent" size={24} color={colors.primary} style={{marginRight: 8}}/>
                 <Text style={[styles.title, {color: colors.textMain}]}>Salary Percentage</Text>
              </View>
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: 4, marginLeft: 32}}>Manage salary division rules</Text>
            </View>
            
            {canCreate && (
                <TouchableOpacity style={[styles.addBtn, {backgroundColor: colors.primary}]} onPress={() => { resetForm(); setIsModalVisible(true); }}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Add New</Text>
                </TouchableOpacity>
            )}
        </View>

        {loading && !refreshing ? <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 50}} /> : (
            <View style={{marginTop: 10}}>
                {!canView ? (
                    <Text style={{textAlign: 'center', color: colors.textSub, marginTop: 40}}>You do not have permission to view this data.</Text>
                ) : percentagesList.length === 0 ? (
                    <View style={{alignItems: 'center', marginTop: 50}}>
                        <MaterialCommunityIcons name="folder-percent-outline" size={60} color={colors.border} />
                        <Text style={{color: colors.textSub, marginTop: 10, fontWeight: '600'}}>No percentage structures found.</Text>
                    </View>
                ) : (
                    percentagesList.map((item: any, index: number) => (
                        <View key={index} style={[styles.card, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                            <View style={[styles.cardHeader, {borderBottomColor: colors.border}]}>
                                <Text style={[styles.cardTitle, {color: colors.textMain}]}>{item.name}</Text>
                                <View style={{flexDirection: 'row'}}>
                                    {canUpdate && (
                                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isLightMode ? '#EFF6FF' : '#1E3A8A'}]} onPress={() => {
                                            setFormData({
                                                _id: item._id, name: item.name, 
                                                basicPercentage: String(item.basicPercentage), hraPercentage: String(item.hraPercentage),
                                                otherAllowancesPercentage: String(item.otherAllowancesPercentage), employeePfPercentage: String(item.employeePfPercentage),
                                                employeeEsiPercentage: String(item.employeeEsiPercentage), employerPfPercentage: String(item.employerPfPercentage),
                                                employerEsiPercentage: String(item.employerEsiPercentage)
                                            });
                                            setIsEditing(true); setIsModalVisible(true);
                                        }}>
                                            <Feather name="edit-2" size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                    {canDelete && (
                                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#450A0A', marginLeft: 10}]} onPress={() => handleDelete(item._id, item.name)}>
                                            <Feather name="trash-2" size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <View style={styles.grid}>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>BASIC</Text><Text style={[styles.gridValue, {color: colors.textMain}]}>{item.basicPercentage}%</Text></View>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>HRA</Text><Text style={[styles.gridValue, {color: colors.textMain}]}>{item.hraPercentage}%</Text></View>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>OTHER</Text><Text style={[styles.gridValue, {color: colors.textMain}]}>{item.otherAllowancesPercentage}%</Text></View>
                            </View>
                            
                            <View style={[styles.grid, {marginTop: 15}]}>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>EMP PF</Text><Text style={[styles.gridValue, {color: '#10B981'}]}>{item.employeePfPercentage}%</Text></View>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>EMP ESI</Text><Text style={[styles.gridValue, {color: '#10B981'}]}>{item.employeeEsiPercentage}%</Text></View>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>EMPLYR PF</Text><Text style={[styles.gridValue, {color: '#F59E0B'}]}>{item.employerPfPercentage}%</Text></View>
                                <View style={styles.gridItem}><Text style={styles.gridLabel}>EMPLYR ESI</Text><Text style={[styles.gridValue, {color: '#F59E0B'}]}>{item.employerEsiPercentage}%</Text></View>
                            </View>
                        </View>
                    ))
                )}
            </View>
        )}
      </ScrollView>

      {/* 🚀 PREMIUM MODAL */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: colors.cardBg}]}>
                  <View style={[styles.modalHeader, {borderBottomColor: colors.border}]}>
                      <Text style={{fontSize: 18, fontWeight: '900', color: colors.textMain}}>{isEditing ? 'Edit Structure' : 'Add New Structure'}</Text>
                      <TouchableOpacity onPress={() => setIsModalVisible(false)}><Feather name="x" size={24} color={colors.textSub} /></TouchableOpacity>
                  </View>
                  
                  <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 40}} showsVerticalScrollIndicator={false}>
                      <Text style={[styles.label, {color: colors.textMain, marginTop: 0}]}>Structure Name *</Text>
                      <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} value={formData.name} onChangeText={(t) => setFormData({...formData, name: t})} placeholder="e.g. Default, Management" placeholderTextColor={colors.textSub} />

                      <Text style={{color: colors.primary, fontWeight: '800', marginTop: 20, marginBottom: 10, fontSize: 13, letterSpacing: 0.5}}>EARNINGS PERCENTAGE</Text>
                      <View style={styles.formRow}>
                          <View style={{flex: 1, marginRight: 10}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>Basic (%) *</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.basicPercentage} onChangeText={(t) => setFormData({...formData, basicPercentage: t})} placeholder="50" placeholderTextColor={colors.textSub} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>HRA (%) *</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.hraPercentage} onChangeText={(t) => setFormData({...formData, hraPercentage: t})} placeholder="30" placeholderTextColor={colors.textSub} />
                          </View>
                      </View>
                      <View style={{flex: 1, marginTop: 10}}>
                          <Text style={[styles.label, {color: colors.textMain}]}>Other Allowances (%)</Text>
                          <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.otherAllowancesPercentage} onChangeText={(t) => setFormData({...formData, otherAllowancesPercentage: t})} placeholder="20" placeholderTextColor={colors.textSub} />
                      </View>

                      <Text style={{color: colors.primary, fontWeight: '800', marginTop: 25, marginBottom: 10, fontSize: 13, letterSpacing: 0.5}}>DEDUCTIONS PERCENTAGE</Text>
                      <View style={styles.formRow}>
                          <View style={{flex: 1, marginRight: 10}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>Employee PF (%)</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.employeePfPercentage} onChangeText={(t) => setFormData({...formData, employeePfPercentage: t})} placeholder="12" placeholderTextColor={colors.textSub} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>Employee ESI (%)</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.employeeEsiPercentage} onChangeText={(t) => setFormData({...formData, employeeEsiPercentage: t})} placeholder="0.75" placeholderTextColor={colors.textSub} />
                          </View>
                      </View>
                      <View style={styles.formRow}>
                          <View style={{flex: 1, marginRight: 10}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>Employer PF (%)</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.employerPfPercentage} onChangeText={(t) => setFormData({...formData, employerPfPercentage: t})} placeholder="12" placeholderTextColor={colors.textSub} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={[styles.label, {color: colors.textMain}]}>Employer ESI (%)</Text>
                              <TextInput style={[styles.input, {borderColor: colors.border, color: colors.textMain}]} keyboardType="numeric" value={formData.employerEsiPercentage} onChangeText={(t) => setFormData({...formData, employerEsiPercentage: t})} placeholder="3.25" placeholderTextColor={colors.textSub} />
                          </View>
                      </View>
                  </ScrollView>
                  
                  <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
                      <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.primary}]} onPress={handleSave} disabled={saveLoading}>
                          {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 15}}>Save Changes</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '900' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },
  
  card: { borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 15, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: '900', textTransform: 'capitalize' },
  actionBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  gridItem: { flexBasis: '22%' }, // Ensures 4 items in a row
  gridLabel: { fontSize: 9, color: '#64748B', fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  gridValue: { fontSize: 14, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  
  formRow: { flexDirection: 'row', marginTop: 10 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 15, fontSize: 14, fontWeight: '600' },
  
  modalFooter: { padding: 20, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  saveBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }
});