import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as DocumentPicker from '@react-native-documents/picker';
import { useTheme } from '../constants/theme';
import { DrawerActions } from '@react-navigation/native'; 
import GlobalAppBar from '../components/GlobalAppBar';
import { API_BASE } from '../api/api';

const safeDecodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = base64.replace(/=+$/, '');
    let output = '';
    
    for (let i = 0; i < str.length; i += 4) {
        let enc1 = chars.indexOf(str.charAt(i));
        let enc2 = chars.indexOf(str.charAt(i + 1));
        let enc3 = chars.indexOf(str.charAt(i + 2));
        let enc4 = chars.indexOf(str.charAt(i + 3));
        
        let chr1 = (enc1 << 2) | (enc2 >> 4);
        let chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        let chr3 = ((enc3 & 3) << 6) | enc4;
        
        output += String.fromCharCode(chr1);
        if (enc3 !== 64 && enc3 !== -1) output += String.fromCharCode(chr2);
        if (enc4 !== 64 && enc4 !== -1) output += String.fromCharCode(chr3);
    }
    
    return JSON.parse(decodeURIComponent(escape(output)));
  } catch (e) {
    return null;
  }
};

export default function DocumentsScreen({ navigation }: any) {
  const [documents, setDocuments] = useState<any[]>([]); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  
  const [canViewAllDocs, setCanViewAllDocs] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null); 

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userInitials, setUserInitials] = useState('US');

  const { colors, isLightMode, toggleTheme } = useTheme();
  const styles = getDynamicStyles(colors, isLightMode);

  const [docForm, setDocForm] = useState({
    name: '',
    type: 'Offer Letter',
    url: '',
    description: '',
    targetEmployeeId: '', 
    targetEmployeeName: 'Select Employee'
  });

  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isEmpDropdownVisible, setIsEmpDropdownVisible] = useState(false); 

  const documentTypes = [
    'Offer Letter', 'Appointment Letter', 'Salary Slip', 
    'Experience Letter', 'ID Card', 'Tax Document', 'Other'
  ];

  const categories = [
    { id: '1', title: 'Offer Letter', icon: 'file-document', color: '#3B82F6', bg: isLightMode ? '#EFF6FF' : 'rgba(59, 130, 246, 0.2)' },
    { id: '2', title: 'Appointment Letter', icon: 'file-sign', color: '#8B5CF6', bg: isLightMode ? '#F5F3FF' : 'rgba(139, 92, 246, 0.2)' },
    { id: '3', title: 'Salary Slip', icon: 'file-chart', color: '#10B981', bg: isLightMode ? '#F0FDF4' : 'rgba(16, 185, 129, 0.2)' },
    { id: '4', title: 'Experience Letter', icon: 'medal', color: '#F59E0B', bg: isLightMode ? '#FFFBEB' : 'rgba(245, 158, 11, 0.2)' },
    { id: '5', title: 'ID Card', icon: 'card-account-details', color: '#EC4899', bg: isLightMode ? '#FDF2F8' : 'rgba(236, 72, 153, 0.2)' },
    { id: '6', title: 'Tax Document', icon: 'file-percent', color: '#14B8A6', bg: isLightMode ? '#F0FDFA' : 'rgba(20, 184, 166, 0.2)' },
  ];

  useEffect(() => {
    getUserData();
  }, []);

  useEffect(() => {
    if (employeeId) {
      fetchDocuments();
      const interval = setInterval(() => fetchDocuments(true), 25000);
      return () => clearInterval(interval);
    }
  }, [employeeId, canViewAllDocs]);

  const getUserData = async () => {
    try {
      const name = await AsyncStorage.getItem('userName');
      const token = await AsyncStorage.getItem('userToken');
      const perms = await AsyncStorage.getItem('userPermissions');
      
      let hasViewAll = false;
      if (perms) {
          const parsedPerms = JSON.parse(perms);
          hasViewAll = parsedPerms.some((p: string) => p.toUpperCase() === 'DOCUMENTS:VIEW_ALL' || p.toUpperCase() === 'DOCUMENTS:VIEW-ALL');
          setCanViewAllDocs(hasViewAll);
      }

      if (token) {
          const decoded = safeDecodeJWT(token);
          let currentEmpId = null;
          if (decoded && (decoded.id || decoded._id || decoded.userId)) {
              currentEmpId = decoded.id || decoded._id || decoded.userId;
              setEmployeeId(currentEmpId);
          } else {
              const empId = await AsyncStorage.getItem('employeeId');
              if (empId) {
                  currentEmpId = empId;
                  setEmployeeId(empId);
              }
          }

          if (hasViewAll) {
              const empRes = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
              const emps = empRes.data?.data?.data || empRes.data?.data || [];
              setAllEmployees(emps.filter((e:any) => !e.isDeleted));
          }
      }
      
      if (name && name !== "User") {
          const parts = name.trim().split(" ");
          setUserInitials(parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase());
      }
    } catch (e) {
      setUserInitials('US');
    }
  };

  const fetchDocuments = async (isSilent = false) => {
    if (!employeeId) return;
    try {
      if (!isSilent && documents.length === 0) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      let url = `${API_BASE}/documents`;
      if (!canViewAllDocs) {
          url += `?employeeId=${employeeId}`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data?.data || res.data || [];
      const sortedData = (Array.isArray(data) ? data : []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDocuments(sortedData);
    } catch (error) {
      console.log("Error fetching documents:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments(true);
  };
const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
      });
      
      if (res && res.length > 0) {
        const file = res[0];
        setSelectedFile({
          uri: file.uri,
          type: file.type || 'application/pdf',
          name: file.name || 'document.pdf'
        });
        setDocForm({...docForm, url: file.name || 'File Selected'}); 
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick document');
      }
    }
  };
  const handleSaveDocument = async () => {
    if (!docForm.name || (!selectedFile && !docForm.url)) {
      Alert.alert("Required", "Please provide Document Name and select a file or paste URL (*)");
      return;
    }

    if (canViewAllDocs && !docForm.targetEmployeeId) {
      Alert.alert("Required", "Please select an employee.");
      return;
    }
    
    try {
      setActionLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const formattedDocType = docForm.type.toLowerCase().replace(/\s+/g, '-');
      const targetId = canViewAllDocs ? docForm.targetEmployeeId : employeeId;

      let config: any = {
          headers: { Authorization: `Bearer ${token}` }
      };

      // 🚀 FIXED: JSON Parsing Error Issue. If file is selected -> Multipart. If URL -> JSON.
      if (selectedFile) {
          const formData = new FormData();
          formData.append('employeeId', targetId);
          formData.append('documentName', docForm.name.trim());
          formData.append('documentType', formattedDocType);
          formData.append('remarks', docForm.description);
          formData.append('file', {
              uri: selectedFile.uri,
              type: selectedFile.type || 'application/pdf',
              name: selectedFile.name || 'document.pdf'
          } as any);

          config.headers['Content-Type'] = 'multipart/form-data';
          await axios.post(`${API_BASE}/documents`, formData, config);
      } else {
          const payload = {
              employeeId: targetId,
              documentName: docForm.name.trim(),
              documentType: formattedDocType,
              documentUrl: docForm.url.trim(),
              remarks: docForm.description
          };
          await axios.post(`${API_BASE}/documents`, payload, config);
      }
      
      Alert.alert("Success", "Document added successfully.");
      setIsModalVisible(false);
      setDocForm({ name: '', type: 'Offer Letter', url: '', description: '', targetEmployeeId: '', targetEmployeeName: 'Select Employee' });
      setSelectedFile(null);
      fetchDocuments(true); 
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to add document.";
      Alert.alert("Error", errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDocument = (docId: string, docName: string) => {
    Alert.alert(
      "Remove Document?",
      `Are you sure you want to remove '${docName}'?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "OK", 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(`${API_BASE}/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setDocuments(prev => prev.filter(d => d._id !== docId));
            } catch (error) {
              Alert.alert("Error", "Failed to delete document.");
            }
          }
        }
      ]
    );
  };

  const formatDisplayType = (type: string) => {
    if (!type) return 'Other';
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getFileCount = (type: string) => {
    const apiFormattedType = type.toLowerCase().replace(/\s+/g, '-');
    return documents.filter(doc => doc.documentType === apiFormattedType || doc.documentType === type).length;
  };

  const filteredCategories = categories.filter(cat => 
    searchQuery === '' || cat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredDocuments = documents.filter(doc => {
    const searchLow = searchQuery.toLowerCase();
    const docName = (doc.documentName || '').toLowerCase();
    const docType = formatDisplayType(doc.documentType).toLowerCase();
    
    let empName = '';
    if (canViewAllDocs && doc.employeeId && doc.employeeId.firstName) {
        empName = `${doc.employeeId.firstName} ${doc.employeeId.lastName}`.toLowerCase();
    }
    
    return searchQuery === '' || docName.includes(searchLow) || docType.includes(searchLow) || empName.includes(searchLow);
  });

  const renderCategoryCard = ({ item }: { item: any }) => (
    <View style={styles.catCard}>
      <View style={[styles.iconBox, { backgroundColor: item.bg }]} >
        <MaterialCommunityIcons name={item.icon} size={24} color={item.color} />
      </View>
      <Text style={styles.catTitle}>{item.title}</Text>
      <Text style={styles.catCount}>{getFileCount(item.title)} files</Text>
    </View>
  );

  const renderDocumentItem = ({ item }: { item: any }) => {
    const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : '--';
    const empName = item.employeeId?.firstName ? `${item.employeeId.firstName} ${item.employeeId.lastName}` : '';
    
    return (
      <View style={styles.docItemCard}>
        <View style={styles.docItemLeft}>
          <View style={styles.docIconBg}>
            <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.docItemName}>{item.documentName}</Text>
            <Text style={styles.docItemType}>{formatDisplayType(item.documentType)} • {formattedDate}</Text>
            {canViewAllDocs && empName ? <Text style={[styles.docItemType, {color: colors.primary, marginTop: 2, fontWeight: 'bold'}]}>{empName}</Text> : null}
          </View>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity 
              style={styles.viewBtn}
              onPress={() => {
                  let url = item.documentUrl;
                  if (url) {
                      // 🚀 FIXED: Space decoding issue causing unopenable PDF files
                      let clean = url.replace(/\\/g, '/');
                      let fullUrl = clean.startsWith('http') ? clean : `${API_BASE.replace('/api', '')}${clean.startsWith('/') ? '' : '/'}${clean}`;
                      Linking.openURL(encodeURI(fullUrl)).catch(() => alert("Invalid URL"));
                  }
              }}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.viewBtn, {backgroundColor: isLightMode ? '#FEE2E2' : '#7F1D1D', borderColor: isLightMode ? '#FECACA' : '#991B1B', marginLeft: 8, paddingHorizontal: 8}]}
              onPress={() => handleDeleteDocument(item._id, item.documentName)}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} backgroundColor="transparent" translucent={true} />
       
      <GlobalAppBar 
        navigation={navigation} 
        showSearch={true} 
        searchQuery={searchQuery} 
        onSearch={setSearchQuery}
        onSearchChange={setSearchQuery} 
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <MaterialCommunityIcons name="folder-open" size={28} color={colors.primary} style={{ marginRight: 8 }} />
             <Text style={styles.pageTitleText}>{canViewAllDocs ? "All Documents" : "My Documents"}</Text>
          </View>
          <Text style={styles.subtitle}>Access and manage employment documents</Text>
        </View>
        <TouchableOpacity style={styles.iconAddBtn} onPress={() => {
            setDocForm({ name: '', type: 'Offer Letter', url: '', description: '', targetEmployeeId: '', targetEmployeeName: 'Select Employee' });
            setSelectedFile(null);
            setIsModalVisible(true);
        }}>
           <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
      >
        <View style={styles.categoriesSection}>
          <FlatList
            horizontal
            data={filteredCategories}
            keyExtractor={item => item.id}
            renderItem={renderCategoryCard}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            ListEmptyComponent={<Text style={{padding: 20, color: colors.textSub}}>No categories match your search.</Text>}
          />
        </View>

        <View style={styles.mainContent}>
          {loading && !refreshing ? (
             <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} />
          ) : filteredDocuments.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <MaterialCommunityIcons name={searchQuery ? "magnify-close" : "folder-open-outline"} size={60} color={colors.border} />
              <Text style={styles.emptyTitle}>{searchQuery ? 'No results found' : 'No documents yet'}</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try searching with a different keyword.' : `Your HR team will upload employment documents here.\nYou can also add links to your own documents.`}
              </Text>
              {!searchQuery && (
                <TouchableOpacity style={styles.addFirstBtn} onPress={() => setIsModalVisible(true)}>
                  <MaterialCommunityIcons name="plus" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.addFirstBtnText}>Add First Document</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.docListContainer}>
              <Text style={styles.sectionTitle}>Uploaded Documents</Text>
              <FlatList
                data={filteredDocuments}
                keyExtractor={item => item._id}
                renderItem={renderDocumentItem}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Document</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                {canViewAllDocs && (
                  <>
                    <Text style={styles.inputLabel}>Employee *</Text>
                    <TouchableOpacity 
                      style={styles.dropdownInput} 
                      onPress={() => setIsEmpDropdownVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dropdownText}>{docForm.targetEmployeeName}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.inputLabel}>Document Name *</Text>
                <TextInput 
                  style={styles.textInput}
                  placeholder="e.g. Offer Letter 2025"
                  placeholderTextColor={colors.textSub}
                  value={docForm.name}
                  onChangeText={(txt) => setDocForm({...docForm, name: txt})}
                />
                
                <Text style={styles.inputLabel}>Document Type</Text>
                <TouchableOpacity 
                  style={styles.dropdownInput} 
                  onPress={() => setIsDropdownVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownText}>{docForm.type}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSub} />
                </TouchableOpacity>
                
                <Text style={styles.inputLabel}>File / Document URL *</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <TouchableOpacity 
                      style={[styles.dropdownInput, { flex: 1, marginRight: 10, justifyContent: 'center', backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                      onPress={handlePickFile}
                    >
                      <MaterialCommunityIcons name="upload" size={18} color={colors.primary} style={{marginRight: 6}} />
                      <Text style={[styles.dropdownText, { color: colors.primary, fontWeight: 'bold' }]} numberOfLines={1}>
                        {selectedFile ? 'File Selected' : 'Upload File'}
                      </Text>
                    </TouchableOpacity>
                    <TextInput 
                      style={[styles.textInput, { flex: 2 }]}
                      placeholder="Or Paste URL..."
                      placeholderTextColor={colors.textSub}
                      value={docForm.url}
                      onChangeText={(txt) => setDocForm({...docForm, url: txt})}
                      editable={!selectedFile} 
                    />
                </View>
                {selectedFile && <Text style={{fontSize: 11, color: colors.primary, marginTop: 4}}>{selectedFile.name}</Text>}
                
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput 
                  style={styles.textArea}
                  placeholder="Optional description..."
                  placeholderTextColor={colors.textSub}
                  multiline={true}
                  numberOfLines={2}
                  textAlignVertical="top"
                  value={docForm.description}
                  onChangeText={(txt) => setDocForm({...docForm, description: txt})}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSaveDocument} disabled={actionLoading}>
                  {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <>
                      <MaterialCommunityIcons name="content-save-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.submitBtnText}>Save Document</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isDropdownVisible} transparent animationType="fade" onRequestClose={() => setIsDropdownVisible(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setIsDropdownVisible(false)}>
          <View style={styles.dropdownMenu}>
            {documentTypes.map((type) => (
              <TouchableOpacity 
                key={type} 
                style={[styles.dropdownItem, docForm.type === type && styles.dropdownItemActive]}
                onPress={() => {
                  setDocForm({...docForm, type: type});
                  setIsDropdownVisible(false);
                }}
              >
                <Text style={[styles.dropdownItemText, docForm.type === type && styles.dropdownItemTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isEmpDropdownVisible} transparent animationType="fade" onRequestClose={() => setIsEmpDropdownVisible(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setIsEmpDropdownVisible(false)}>
          <View style={[styles.dropdownMenu, {maxHeight: 300}]}>
            <ScrollView nestedScrollEnabled={true}>
                {allEmployees.map((emp) => {
                  const fName = emp.userId?.firstName || emp.firstName || '';
                  const lName = emp.userId?.lastName || emp.lastName || '';
                  return (
                    <TouchableOpacity 
                        key={emp._id} 
                        style={[styles.dropdownItem, docForm.targetEmployeeId === emp._id && styles.dropdownItemActive]}
                        onPress={() => {
                        setDocForm({...docForm, targetEmployeeId: emp._id, targetEmployeeName: `${fName} ${lName}`});
                        setIsEmpDropdownVisible(false);
                        }}
                    >
                        <Text style={[styles.dropdownItemText, docForm.targetEmployeeId === emp._id && styles.dropdownItemTextActive]}>
                        {fName} {lName}
                        </Text>
                    </TouchableOpacity>
                  )
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getDynamicStyles = (colors: any, isLight: boolean) => StyleSheet.create({
  container: { 
      flex: 1, 
      backgroundColor: isLight ? '#EFF6FF' : colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  pageTitleText: { fontSize: 22, fontWeight: '900', color: colors.textMain },
  subtitle: { fontSize: 13, color: colors.textSub, marginTop: 4, marginLeft: 36 },

  iconAddBtn: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  categoriesSection: { paddingVertical: 20 },
  catCard: { backgroundColor: colors.cardBg, width: 140, padding: 15, borderRadius: 16, marginRight: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, elevation: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  catTitle: { fontSize: 13, fontWeight: '700', color: colors.textMain, textAlign: 'center', marginBottom: 4 },
  catCount: { fontSize: 11, color: colors.textSub, fontWeight: '500' },
  mainContent: { paddingHorizontal: 15, paddingBottom: 40 },
  emptyStateBox: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginTop: 15, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 25 },
  addFirstBtn: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addFirstBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  docListContainer: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain, marginBottom: 15 },
  docItemCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  docItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  docIconBg: { backgroundColor: isLight ? '#EFF6FF' : 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 10 },
  docItemName: { fontSize: 14, fontWeight: '700', color: colors.textMain, marginBottom: 2 },
  docItemType: { fontSize: 12, color: colors.textSub },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: isLight ? '#F8FAFC' : '#334155', borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', margin: 0, padding: 0, zIndex: 10 },
  modalCard: { width: '100%', backgroundColor: colors.cardBg, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 12, marginBottom: 5 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain },
  modalBody: { paddingBottom: 5 }, 
  inputLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub, marginBottom: 4, marginTop: 12 },
  textInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textMain, backgroundColor: isLight ? '#FFF' : colors.background },
  dropdownInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isLight ? '#FFF' : colors.background },
  dropdownText: { fontSize: 14, color: colors.textMain },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textMain, backgroundColor: isLight ? '#FFF' : colors.background, height: 70 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderColor: colors.border, paddingTop: 15, marginTop: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
  cancelBtnText: { color: colors.textSub, fontWeight: '700', fontSize: 13 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  submitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenu: { width: '80%', backgroundColor: colors.cardBg, borderRadius: 12, padding: 5, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8 },
  dropdownItemActive: { backgroundColor: colors.primary },
  dropdownItemText: { fontSize: 15, color: colors.textMain },
  dropdownItemTextActive: { color: '#FFF', fontWeight: '700' },
});