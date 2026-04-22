import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, Platform, StatusBar, RefreshControl, KeyboardAvoidingView 
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../constants/theme'; 
import GlobalAppBar from '../../components/GlobalAppBar'; 

const API_BASE = 'https://hrms.dcstechnosis.com/api'; 

interface Permission {
  _id: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: any[]; 
}

const RolesPermissionsScreen = ({ navigation }: any) => {
  const { colors, isLightMode } = useTheme();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ROLES' | 'PERMISSIONS'>('ROLES');
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPerms, setGroupedPerms] = useState<Record<string, Permission[]>>({});

  // Modals
  const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
  const [isPermModalVisible, setIsPermModalVisible] = useState(false);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [permForm, setPermForm] = useState({ resource: '', action: '', description: '' });

  // Assignment State
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [rolesRes, permsRes] = await Promise.all([
          axios.get(`${API_BASE}/role`, config),
          axios.get(`${API_BASE}/permission?limit=500`, config)
      ]);

      const rolesData = rolesRes.data?.data || [];
      const permsData = permsRes.data?.data || [];

      setRoles(rolesData);
      setPermissions(permsData);

      const grouped = permsData.reduce((acc: any, curr: Permission) => {
          const res = curr.resource || 'OTHER';
          if (!acc[res]) acc[res] = [];
          acc[res].push(curr);
          return acc;
      }, {});
      setGroupedPerms(grouped);

    } catch (err) {
      console.error("Failed to load roles/permissions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleCreateRole = async () => {
      if (!roleForm.name.trim()) return Alert.alert("Required", "Role Name is required");
      try {
          setActionLoading(true);
          const token = await AsyncStorage.getItem('userToken');
          await axios.post(`${API_BASE}/role`, roleForm, { headers: { Authorization: `Bearer ${token}` } });
          Alert.alert("Success", "Role created successfully");
          setIsRoleModalVisible(false);
          setRoleForm({ name: '', description: '' });
          fetchData(true);
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.message || "Failed to create role");
      } finally {
          setActionLoading(false);
      }
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
      Alert.alert("Delete Role", `Are you sure you want to completely delete the '${roleName}' role?`, [
          { text: "Cancel", style: "cancel" },
          { 
              text: "Delete", style: "destructive", 
              onPress: async () => {
                  try {
                      setActionLoading(true);
                      const token = await AsyncStorage.getItem('userToken');
                      await axios.delete(`${API_BASE}/role/${roleId}`, { headers: { Authorization: `Bearer ${token}` } });
                      Alert.alert("Deleted", "Role has been removed successfully.");
                      setIsAssignModalVisible(false);
                      fetchData(true);
                  } catch (e: any) {
                      Alert.alert("Error", e.response?.data?.message || "Failed to delete role.");
                  } finally {
                      setActionLoading(false);
                  }
              }
          }
      ]);
  };

  const handleCreatePermission = async () => {
      if (!permForm.resource.trim() || !permForm.action.trim()) return Alert.alert("Required", "Module and Action are required");
      try {
          setActionLoading(true);
          const token = await AsyncStorage.getItem('userToken');
          const payload = {
              resource: permForm.resource.toUpperCase().trim(),
              action: permForm.action.toUpperCase().trim(),
              description: permForm.description
          };
          await axios.post(`${API_BASE}/permission`, payload, { headers: { Authorization: `Bearer ${token}` } });
          Alert.alert("Success", "Permission created successfully");
          setIsPermModalVisible(false);
          setPermForm({ resource: '', action: '', description: '' });
          fetchData(true);
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.message || "Failed to create permission");
      } finally {
          setActionLoading(false);
      }
  };

  const openAssignModal = (role: Role) => {
      setSelectedRole(role);
      const assignedIds = role.permissions ? role.permissions.map(p => typeof p === 'object' ? p._id : p) : [];
      setSelectedPermIds(assignedIds);
      setIsAssignModalVisible(true);
  };

  const togglePermission = (id: string) => {
      setSelectedPermIds(prev => 
          prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
  };

  const saveAssignedPermissions = async () => {
      if (!selectedRole) return;
      try {
          setActionLoading(true);
          const token = await AsyncStorage.getItem('userToken');
          await axios.put(`${API_BASE}/role/${selectedRole._id}`, { permissions: selectedPermIds }, { headers: { Authorization: `Bearer ${token}` } });
          Alert.alert("Success", "Permissions updated successfully");
          setIsAssignModalVisible(false);
          fetchData(true);
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.message || "Failed to update permissions");
      } finally {
          setActionLoading(false);
      }
  };

  // --- UI RENDERERS ---

  const renderRoles = () => {
      if (roles.length === 0) return (
          <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="shield-off-outline" size={60} color={colors.border} />
              <Text style={[styles.emptyText, {color: colors.textSub}]}>No roles found.</Text>
          </View>
      );
      
      return roles.map(role => (
          <View key={role._id} style={[styles.appLeaveCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.appCardHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                      <View style={[styles.appAvatarBox, {backgroundColor: isLightMode ? '#F1F5F9' : '#334155'}]}>
                          <Text style={{fontWeight: '900', fontSize: 16, color: colors.primary}}>{role.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{marginLeft: 12, flex: 1}}>
                          <Text style={{fontWeight: 'bold', fontSize: 15, color: colors.textMain}} numberOfLines={1}>{role.name}</Text>
                          <Text style={{fontSize: 11, color: colors.textSub, marginTop: 2}}>System Role</Text>
                      </View>
                  </View>
                  <View style={[styles.appTypeBadge, {backgroundColor: isLightMode ? '#E0F2FE' : 'rgba(59,130,246,0.15)'}]}>
                      <Text style={{color: '#3B82F6', fontSize: 10, fontWeight: '800'}}>ROLE</Text>
                  </View>
              </View>

              <View style={[styles.appDateBox, { backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
                  <View style={{flex: 1}}>
                      <Text style={styles.appDateLabel}>PERMISSIONS</Text>
                      <Text style={[styles.appDateValue, {color: colors.textMain}]}>{role.permissions?.length || 0}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.textSub} style={{opacity: 0.5}} />
                  <View style={{flex: 1, alignItems: 'center'}}>
                      <Text style={styles.appDateLabel}>STATUS</Text>
                      <Text style={[styles.appDateValue, {color: colors.textMain}]}>Active</Text>
                  </View>
                  <View style={{flex: 1, alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border}}>
                      <Text style={styles.appDateLabel}>TOTAL</Text>
                      <Text style={[styles.appDateValue, {color: colors.primary, fontSize: 16}]}>{role.permissions?.length || 0}</Text>
                  </View>
              </View>

              <View style={styles.appCardFooter}>
                  <View style={{flex: 1, paddingRight: 10}}>
                      <Text style={{fontSize: 12, color: colors.textSub, fontWeight: '500'}} numberOfLines={1}>{role.description || 'Manage role & access'}</Text>
                  </View>
                  <View style={styles.actionArea}>
                      <TouchableOpacity style={[styles.appStatusBadge, { backgroundColor: isLightMode ? '#DCFCE7' : 'rgba(22,163,74,0.15)', borderColor: isLightMode ? '#BBF7D0' : '#16A34A' }]} onPress={() => openAssignModal(role)}>
                          <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>EDIT PERMS</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      ));
  };

  const renderPermissions = () => {
      const keys = Object.keys(groupedPerms).sort();
      if (keys.length === 0) return (
          <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="key-remove" size={60} color={colors.border} />
              <Text style={[styles.emptyText, {color: colors.textSub}]}>No permissions defined.</Text>
          </View>
      );

      return keys.map(groupKey => (
          <View key={groupKey} style={[styles.modernPermGroupCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={[styles.modernPermGroupHeader, { borderBottomColor: colors.border, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
                  <MaterialCommunityIcons name="folder-key-outline" size={20} color={colors.textSub} style={{marginRight: 10}}/>
                  <Text style={[styles.modernPermGroupTitle, { color: colors.textMain }]}>{groupKey}</Text>
              </View>
              <View style={styles.modernChipContainer}>
                  {groupedPerms[groupKey].map(p => {
                      let badgeColor = isLightMode ? '#F1F5F9' : '#334155';
                      let textColor = colors.textMain;
                      
                      const act = p.action.toUpperCase();
                      if(act.includes('VIEW') || act.includes('READ')) { badgeColor = isLightMode ? '#DBEAFE' : '#1E3A8A'; textColor = '#3B82F6'; }
                      else if(act.includes('CREATE') || act.includes('ADD')) { badgeColor = isLightMode ? '#DCFCE7' : '#064E3B'; textColor = '#10B981'; }
                      else if(act.includes('UPDATE') || act.includes('EDIT')) { badgeColor = isLightMode ? '#FEF3C7' : '#78350F'; textColor = '#F59E0B'; }
                      else if(act.includes('DELETE') || act.includes('REMOVE')) { badgeColor = isLightMode ? '#FEE2E2' : '#7F1D1D'; textColor = '#EF4444'; }

                      return (
                          <View key={p._id} style={[styles.modernChip, { backgroundColor: badgeColor }]}>
                              <Text style={{color: textColor, fontSize: 11, fontWeight: '800', letterSpacing: 0.5}}>{act}</Text>
                          </View>
                      )
                  })}
              </View>
          </View>
      ));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      
      {/* 🚀 REMOVED BUTTON FROM HEADER */}
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
          <GlobalAppBar navigation={navigation} title="Roles & Access" />
      </View>

      {/* Tabs */}
      <View style={styles.tabWrapper}>
          <View style={[styles.modernTabContainer, { backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B' }]}>
              <TouchableOpacity style={[styles.modernTab, activeTab === 'ROLES' && [styles.modernActiveTab, {backgroundColor: colors.cardBg}]]} onPress={() => setActiveTab('ROLES')}>
                  <MaterialCommunityIcons name="shield-check" size={18} color={activeTab === 'ROLES' ? colors.primary : colors.textSub} style={{marginRight: 6}} />
                  <Text style={[styles.modernTabText, { color: activeTab === 'ROLES' ? colors.textMain : colors.textSub }]}>Roles</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modernTab, activeTab === 'PERMISSIONS' && [styles.modernActiveTab, {backgroundColor: colors.cardBg}]]} onPress={() => setActiveTab('PERMISSIONS')}>
                  <MaterialCommunityIcons name="key" size={18} color={activeTab === 'PERMISSIONS' ? colors.primary : colors.textSub} style={{marginRight: 6}} />
                  <Text style={[styles.modernTabText, { color: activeTab === 'PERMISSIONS' ? colors.textMain : colors.textSub }]}>Permissions</Text>
              </TouchableOpacity>
          </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />} 
      >
        <View style={{ padding: 16 }}>
            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} />
            ) : (
                activeTab === 'ROLES' ? renderRoles() : renderPermissions()
            )}
        </View>

        <View style={{ height: 180 }} /> 
      </ScrollView>

      {/* 🚀 FLOATING ACTION BUTTON PLACED AT BOTTOM RIGHT */}
      <TouchableOpacity 
          style={styles.extendedFab} 
          onPress={() => activeTab === 'ROLES' ? setIsRoleModalVisible(true) : setIsPermModalVisible(true)}
      >
          <Feather name="plus" size={20} color="#FFF" />
          <Text style={styles.fabText}>{activeTab === 'ROLES' ? 'Add Role' : 'Add Permission'}</Text>
      </TouchableOpacity>

      {/* --- CREATE ROLE MODAL --- */}
      <Modal visible={isRoleModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
              <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.mTitle, {color: colors.textMain}]}>Create New Role</Text>
                  <TouchableOpacity onPress={() => setIsRoleModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
              </View>
              <View style={{padding: 24}}>
                  <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Role Name *</Text>
                  <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={roleForm.name} onChangeText={(t)=>setRoleForm({...roleForm, name:t})} placeholder="e.g. Regional Manager" placeholderTextColor={colors.textSub} />
                  
                  <Text style={[styles.inputLabel, {color: colors.textSub}]}>Description</Text>
                  <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain, height: 80, textAlignVertical: 'top', paddingTop: 12}]} multiline value={roleForm.description} onChangeText={(t)=>setRoleForm({...roleForm, description:t})} placeholder="Brief description of this role..." placeholderTextColor={colors.textSub} />
              </View>
              <View style={[styles.modalFooterRow, {borderColor: colors.border}]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsRoleModalVisible(false)}>
                      <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.subBtn, {backgroundColor: colors.primary}]} onPress={handleCreateRole} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>Create Role</Text>}
                  </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- CREATE PERMISSION MODAL --- */}
      <Modal visible={isPermModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.mOverlay}>
          <View style={[styles.mCard, { backgroundColor: colors.cardBg }]}>
              <View style={[styles.mHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.mTitle, {color: colors.textMain}]}>Create Permission</Text>
                  <TouchableOpacity onPress={() => setIsPermModalVisible(false)}><MaterialCommunityIcons name="close" size={24} color={colors.textSub}/></TouchableOpacity>
              </View>
              <View style={{padding: 24}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <View style={{width: '48%'}}>
                          <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Module *</Text>
                          <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={permForm.resource} onChangeText={(t)=>setPermForm({...permForm, resource:t})} placeholder="e.g. USERS" placeholderTextColor={colors.textSub} autoCapitalize="characters" />
                      </View>
                      <View style={{width: '48%'}}>
                          <Text style={[styles.inputLabel, {color: colors.textSub, marginTop: 0}]}>Action *</Text>
                          <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain}]} value={permForm.action} onChangeText={(t)=>setPermForm({...permForm, action:t})} placeholder="e.g. READ" placeholderTextColor={colors.textSub} autoCapitalize="characters" />
                      </View>
                  </View>
                  <Text style={[styles.inputLabel, {color: colors.textSub}]}>Description</Text>
                  <TextInput style={[styles.inputObj, {backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain, height: 80, textAlignVertical: 'top', paddingTop: 12}]} multiline value={permForm.description} onChangeText={(t)=>setPermForm({...permForm, description:t})} placeholder="What does this permission allow?" placeholderTextColor={colors.textSub} />
              </View>
              <View style={[styles.modalFooterRow, {borderColor: colors.border}]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsPermModalVisible(false)}>
                      <Text style={[styles.cancelBtnText, {color: colors.textSub}]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.subBtn, {backgroundColor: colors.primary}]} onPress={handleCreatePermission} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator color="#fff" size="small"/> : <Text style={styles.subBtnText}>Create</Text>}
                  </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- ASSIGN PERMISSIONS FULL SCREEN MODAL --- */}
      <Modal visible={isAssignModalVisible} animationType="slide" transparent={false}>
          <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
              <View style={[styles.assignHeader, {borderBottomColor: colors.border, backgroundColor: colors.cardBg}]}>
                  <TouchableOpacity onPress={() => setIsAssignModalVisible(false)} style={{padding: 10}}>
                      <MaterialCommunityIcons name="arrow-left" size={26} color={colors.textMain}/>
                  </TouchableOpacity>
                  <View style={{flex: 1, alignItems: 'center'}}>
                      <Text style={{color: colors.textSub, fontSize: 10, fontWeight: '800', letterSpacing: 1}}>EDITING ROLE</Text>
                      <Text style={{color: colors.textMain, fontSize: 18, fontWeight: '900'}}>{selectedRole?.name}</Text>
                  </View>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      {selectedRole && (
                          <TouchableOpacity onPress={() => handleDeleteRole(selectedRole._id, selectedRole.name)} style={{padding: 8, marginRight: 8}}>
                              <MaterialCommunityIcons name="trash-can-outline" size={24} color="#EF4444"/>
                          </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={saveAssignedPermissions} disabled={actionLoading} style={{paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 20}}>
                          {actionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: '#fff', fontWeight: '800', fontSize: 13}}>Save</Text>}
                      </TouchableOpacity>
                  </View>
              </View>

              <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
                 <View style={{ padding: 16 }}>
                     {Object.keys(groupedPerms).sort().map(groupKey => (
                        <View key={groupKey} style={[styles.premiumModuleCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                            <View style={[styles.premiumModuleHeader, { borderBottomColor: colors.border, backgroundColor: isLightMode ? '#F8FAFC' : '#1E293B' }]}>
                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                    <MaterialCommunityIcons name="shield-key-outline" size={20} color={colors.primary} style={{marginRight: 10}}/>
                                    <Text style={[styles.premiumModuleTitle, { color: colors.textMain }]}>{groupKey}</Text>
                                </View>
                            </View>
                            
                            <View style={styles.premiumPermList}>
                                {groupedPerms[groupKey].map((p, index) => {
                                    const isSelected = selectedPermIds.includes(p._id);
                                    const isLast = index === groupedPerms[groupKey].length - 1;
                                    return (
                                        <TouchableOpacity 
                                            key={p._id} 
                                            onPress={() => togglePermission(p._id)}
                                            style={[styles.premiumPermRow, !isLast && {borderBottomWidth: 1, borderBottomColor: isLightMode ? '#F1F5F9' : '#334155'}]}
                                        >
                                            <Text style={{color: isSelected ? colors.primary : colors.textMain, fontSize: 13, fontWeight: isSelected ? '700' : '500'}}>
                                                {p.action}
                                            </Text>
                                            <View style={[styles.iosCheckbox, isSelected && {borderColor: colors.primary, backgroundColor: colors.primary}]}>
                                                {isSelected && <MaterialCommunityIcons name="check" size={12} color="#FFF" />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                     ))}
                     <View style={{ height: 100 }} />
                 </View>
              </ScrollView>
          </SafeAreaView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  tabWrapper: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 5, zIndex: 1 },
  modernTabContainer: { flexDirection: 'row', padding: 5, borderRadius: 12 },
  modernTab: { flex: 1, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  modernActiveTab: { shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  modernTabText: { fontSize: 14, fontWeight: '800' },

  // Role Cards
  appLeaveCard: { borderRadius: 20, marginBottom: 16, padding: 18, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.06, shadowRadius: 6, borderWidth: 1 },
  appCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  appAvatarBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  appTypeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  appStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  appDateBox: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-between' },
  appDateLabel: { fontSize: 9, color: '#64748B', marginBottom: 4, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  appDateValue: { fontSize: 13, fontWeight: 'bold' },
  appCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionArea: { minWidth: 90, alignItems: 'flex-end', justifyContent: 'center' },

  // Permission Chips (Main Screen)
  modernPermGroupCard: { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  modernPermGroupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modernPermGroupTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  modernChipContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  modernChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },

  // Assign Modal List (Compact Rows)
  premiumModuleCard: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  premiumModuleHeader: { padding: 12, borderBottomWidth: 1 },
  premiumModuleTitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
  premiumPermList: { paddingHorizontal: 16 },
  premiumPermRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }, 
  iosCheckbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },

  // 🚀 EXTENDED FLOATING BUTTON
  extendedFab: { 
      position: 'absolute', 
      bottom: 30, 
      right: 20, 
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#3B82F6', 
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderRadius: 30, 
      elevation: 10, 
      shadowColor: '#000', 
      shadowOffset: {width: 0, height: 4}, 
      shadowOpacity: 0.3, 
      shadowRadius: 5, 
      zIndex: 99999 
  },
  fabText: {
      color: '#FFF',
      fontWeight: 'bold',
      fontSize: 14,
      marginLeft: 8
  },
 
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 15, fontWeight: '600', paddingHorizontal: 20 },

  mOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
  mCard: { width: '100%', padding: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 10 },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, padding: 24, paddingBottom: 16 },
  mTitle: { fontSize: 20, fontWeight: '900' },
  inputLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12, color: '#64748B' },
  inputObj: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 14, fontWeight: '600' },
  modalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 24, borderTopWidth: 1, marginTop: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginRight: 10 },
  cancelBtnText: { fontWeight: '800', fontSize: 14 },
  subBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  subBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

  assignHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingBottom: 15, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15, borderBottomWidth: 1 }
});

export default RolesPermissionsScreen;