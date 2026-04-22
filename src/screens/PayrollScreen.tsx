import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform, StatusBar, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme'; 
import GlobalAppBar from '../components/GlobalAppBar'; 

const API_BASE = 'https://hrms.dcstechnosis.com/api'; 
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayrollScreen({ navigation }: any) {
  const { colors, isLightMode } = useTheme(); 
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const hasPerm = (action: string) => permissions.includes(`PAYROLL:${action}`);
  const canView = hasPerm('VIEW');
  const canCreate = hasPerm('CREATE');

  const fetchPayroll = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const permsStr = await AsyncStorage.getItem('userPermissions');
      
      // 🚀 FIXED: Strict uppercase mapping
      const perms = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase()) : [];
      setPermissions(perms);

      if (perms.includes('PAYROLL:VIEW')) {
          const res = await axios.get(`${API_BASE}/payroll?month=${selectedMonth}&year=${selectedYear}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          setPayrolls(res.data?.data?.data || res.data?.data || []);
      }
    } catch (err) {
      console.log("Payroll Fetch Error");
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPayroll(); }, [selectedMonth, selectedYear]));

  const generatePayroll = async () => {
      Alert.alert("Confirm", `Generate payroll for ${MONTHS[selectedMonth-1]} ${selectedYear}?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Generate", onPress: async () => {
              try {
                  setGenerating(true);
                  const token = await AsyncStorage.getItem('userToken');
                  await axios.post(`${API_BASE}/payroll/generate`, { month: selectedMonth, year: selectedYear }, {
                      headers: { Authorization: `Bearer ${token}` }
                  });
                  Alert.alert("Success", "Payroll generated successfully!");
                  fetchPayroll();
              } catch (err: any) {
                  Alert.alert("Error", err.response?.data?.message || "Failed to generate payroll.");
              } finally {
                  setGenerating(false);
              }
          }}
      ]);
  };

  const totalPayslips = payrolls.length;
  const totalPayout = payrolls.reduce((sum, item) => sum + (item.netPay || item.earnedGrossSalary || 0), 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />
      <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
        <GlobalAppBar navigation={navigation} />
      </View>

      <ScrollView contentContainerStyle={{padding: 16}}>
        <View style={styles.header}>
            <View>
              <Text style={[styles.title, {color: colors.textMain}]}>Payroll</Text>
              <Text style={{color: colors.textSub, fontSize: 12, marginTop: 2}}>Manage monthly salary and payslips</Text>
            </View>
        </View>

        {!canView ? (
            <View style={{alignItems: 'center', marginTop: 60}}>
                <MaterialCommunityIcons name="shield-lock-outline" size={60} color={colors.border} />
                <Text style={{color: colors.textSub, marginTop: 15, fontWeight: '600'}}>You don't have permission to view Payroll.</Text>
            </View>
        ) : (
            <>
                {/* Filters */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                    <View style={{flexDirection: 'row', flex: 1}}>
                        <View style={[styles.pickerFake, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1, marginRight: 10}]}>
                            <Text style={{color: colors.textMain, fontWeight: 'bold'}}>{MONTHS[selectedMonth-1]}</Text>
                            <Feather name="chevron-down" color={colors.textSub} />
                        </View>
                        <View style={[styles.pickerFake, {borderColor: colors.border, backgroundColor: colors.cardBg, flex: 0.6}]}>
                            <Text style={{color: colors.textMain, fontWeight: 'bold'}}>{selectedYear}</Text>
                            <Feather name="chevron-down" color={colors.textSub} />
                        </View>
                    </View>
                </View>

                {canCreate && (
                    <TouchableOpacity style={[styles.generateBtn, {backgroundColor: colors.primary}]} onPress={generatePayroll} disabled={generating}>
                        {generating ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <MaterialCommunityIcons name="cog-play-outline" size={20} color="#fff" style={{marginRight: 8}} />
                                <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 15}}>Generate Payroll</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* KPIs */}
                <View style={{flexDirection: 'row', marginTop: 20, marginBottom: 20}}>
                    <View style={[styles.kpiCard, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                        <Text style={{color: colors.textSub, fontSize: 12, fontWeight: '700'}}>Total Payslips</Text>
                        <Text style={{color: colors.textMain, fontSize: 24, fontWeight: '900', marginTop: 8}}>{totalPayslips}</Text>
                    </View>
                    <View style={[styles.kpiCard, {backgroundColor: colors.cardBg, borderColor: colors.border, marginLeft: 15}]}>
                        <Text style={{color: colors.textSub, fontSize: 12, fontWeight: '700'}}>Total Payout</Text>
                        <Text style={{color: colors.primary, fontSize: 24, fontWeight: '900', marginTop: 8}}>₹{(totalPayout/1000).toFixed(1)}K</Text>
                    </View>
                </View>

                {loading ? <ActivityIndicator size="large" color={colors.primary} /> : (
                    <View style={[styles.table, {backgroundColor: colors.cardBg, borderColor: colors.border}]}>
                        {payrolls.map((p, i) => (
                            <View key={i} style={[styles.row, {borderBottomColor: colors.border}]}>
                                <View style={{flex: 1}}>
                                    <Text style={{color: colors.textMain, fontWeight: 'bold'}}>{p.employeeId?.userId?.firstName} {p.employeeId?.userId?.lastName}</Text>
                                    <Text style={{color: colors.textSub, fontSize: 11}}>Gross: ₹{p.grossSalary}</Text>
                                </View>
                                <View style={{alignItems: 'flex-end'}}>
                                    <Text style={{color: '#10B981', fontWeight: '900', fontSize: 16}}>₹{p.netPay || p.earnedGrossSalary}</Text>
                                    <Text style={{color: colors.textSub, fontSize: 10, marginTop: 2}}>NET PAY</Text>
                                </View>
                            </View>
                        ))}
                        {payrolls.length === 0 && <Text style={{padding: 20, textAlign: 'center', color: colors.textSub}}>No payroll data found for this month.</Text>}
                    </View>
                )}
            </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900' },
  pickerFake: { borderWidth: 1, borderRadius: 10, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  generateBtn: { flexDirection: 'row', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 20 },
  table: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 40 },
  row: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, alignItems: 'center' }
});