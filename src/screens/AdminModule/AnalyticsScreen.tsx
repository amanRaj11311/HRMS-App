import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView, Dimensions, Animated, Easing, Platform, StatusBar, RefreshControl } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from 'react-native-chart-kit';
import Feather from 'react-native-vector-icons/Feather';
import GlobalAppBar from '../../components/GlobalAppBar';
import { useTheme } from '../../constants/theme'; 

const { width } = Dimensions.get('window');
const API_BASE = 'https://hrms.dcstechnosis.com/api';

const AnalyticsScreen = ({ navigation }: any) => {
  const { colors, isLightMode } = useTheme(); 
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [topEmployees, setTopEmployees] = useState<any[]>([]); // 🚀 Nayi State Add Ki Hai

  const slideAnims = useRef([...Array(10)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    fetchAnalytics();
  }, [currentYear]);

  // 🚀 Attendance API se Live Top Performers calculate karne ka logic
  const calculateTopPerformers = async (token: string) => {
    try {
        const res = await axios.get(`${API_BASE}/attendance?limit=1000`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const allAttendance = Array.isArray(res.data?.data?.data) ? res.data.data.data : (Array.isArray(res.data?.data) ? res.data.data : []);
        const empMap: any = {};

        allAttendance.forEach((rec: any) => {
            const empInfo = rec.employeeId || {};
            const empId = empInfo._id || empInfo;
            if (!empId || typeof empInfo !== 'object') return; // Agar data populate nahi hua toh skip

            if (!empMap[empId]) {
                empMap[empId] = {
                    name: `${empInfo.userId?.firstName || ''} ${empInfo.userId?.lastName || ''}`.trim() || 'Unknown Employee',
                    role: empInfo.designation || empInfo.department || 'Staff',
                    presentScore: 0,
                    totalDays: 0
                };
            }

            empMap[empId].totalDays += 1;
            const status = String(rec.status || '').toLowerCase();
            
            // Present Logic
            if (status === 'present' || status === 'wfh' || status === 'late') {
                empMap[empId].presentScore += 1;
            } else if (status === 'half-day' || status === 'halfday') {
                empMap[empId].presentScore += 0.5;
            }
        });

        // Percentage nikalna aur sort karna
        const calculatedList = Object.values(empMap).map((emp: any) => {
            const pct = emp.totalDays > 0 ? Math.round((emp.presentScore / emp.totalDays) * 100) : 0;
            return { name: emp.name, role: emp.role, presentPct: pct };
        });

        calculatedList.sort((a: any, b: any) => b.presentPct - a.presentPct);
        setTopEmployees(calculatedList.slice(0, 5)); // Top 5 utha liye

    } catch (error) {
        console.log("Top Performers Fetch Error:", error);
    }
  };

  const fetchAnalytics = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      
      // 1. Analytics Data layenge
      const response = await axios.get(`${API_BASE}/analytics?year=${currentYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyticsData(response.data?.data);
      
      // 2. Attendance se live performance calculate karenge
      await calculateTopPerformers(token || '');

      const animations = slideAnims.map(anim => 
        Animated.timing(anim, {
          toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.ease)
        })
      );
      Animated.stagger(150, animations).start();

    } catch (error) {
      console.log("Analytics Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics(true);
  };

  const getSlideUpStyle = (index: number) => {
    if (!slideAnims[index]) return {};
    return {
      opacity: slideAnims[index],
      transform: [{ translateY: slideAnims[index].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
    };
  };

  const chartConfig = {
    backgroundColor: colors.cardBg,
    backgroundGradientFrom: colors.cardBg,
    backgroundGradientTo: colors.cardBg,
    color: (opacity = 1) => isLightMode ? `rgba(0, 0, 0, ${opacity * 0.2})` : `rgba(255, 255, 255, ${opacity * 0.2})`,
    labelColor: (opacity = 1) => colors.textSub,
    strokeWidth: 2,
    decimalPlaces: 0,
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let attendanceLabels = ['Jan']; 
  let attendanceData = [[0, 0, 0]]; 
  let totalLatesYearly = 0; 
  
  if (analyticsData?.attendanceTrend && analyticsData.attendanceTrend.length > 0) {
    attendanceLabels = analyticsData.attendanceTrend.map((item: any) => monthNames[item._id?.month - 1] || 'Mon');
    attendanceData = analyticsData.attendanceTrend.map((item: any) => {
      totalLatesYearly += (item.late || 0); 
      return [item.present || 0, item.absent || 0, item.late || 0];
    });
  }

  const maxAttendanceValue = Math.max(...attendanceData.flat(), 15); 

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  let deptPieData = [];
  let totalDepartments = 0; 
  if (analyticsData?.deptStats) {
    totalDepartments = analyticsData.deptStats.length;
    deptPieData = analyticsData.deptStats.map((dept: any, index: number) => ({
      name: dept._id || 'Unknown',
      population: dept.count || 0,
      color: pieColors[index % pieColors.length],
      legendFontColor: colors.textSub,
      legendFontSize: 12
    }));
  }

  const leaveColors = { maternity: '#6366f1', casual: '#8b5cf6', sick: '#f97316', earned: '#ef4444' };
  let leavePieData = [];
  let totalLeavesTaken = 0; 
  if (analyticsData?.leaveDistribution) {
    leavePieData = analyticsData.leaveDistribution.map((leave: any) => {
      totalLeavesTaken += (leave.count || 0); 
      return {
        name: leave._id || 'Other',
        population: leave.count || 0,
        color: leaveColors[leave._id?.toLowerCase() as keyof typeof leaveColors] || '#94a3b8',
        legendFontColor: colors.textSub,
        legendFontSize: 12
      };
    });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalAppBar navigation={navigation} title="Analytics" />

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ marginTop: 10, color: colors.textSub }}>Analyzing Data...</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        >
          
          <View style={styles.headerRow}>
            <Text style={[styles.pageTitle, { color: colors.textMain }]}>Company-wide HR metrics</Text>
            <View style={[styles.yearBadge, { backgroundColor: isLightMode ? '#e2e8f0' : '#334155' }]}>
                <Text style={[styles.yearText, { color: isLightMode ? '#475569' : '#cbd5e1' }]}>{currentYear}</Text>
            </View>
          </View>

          <Animated.View style={[styles.summaryGrid, getSlideUpStyle(0)]}>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
               <View style={[styles.iconPill, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}><Feather name="users" size={20} color="#3b82f6" /></View>
               <Text style={[styles.summaryValue, { color: colors.textMain }]}>{analyticsData?.overview?.totalEmployees || 0}</Text>
               <Text style={[styles.summaryLabel, { color: colors.textSub }]}>Total Employees</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
               <View style={[styles.iconPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}><Feather name="briefcase" size={20} color="#10b981" /></View>
               <Text style={[styles.summaryValue, { color: colors.textMain }]}>{totalDepartments}</Text>
               <Text style={[styles.summaryLabel, { color: colors.textSub }]}>Departments</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
               <View style={[styles.iconPill, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}><Feather name="calendar" size={20} color="#f97316" /></View>
               <Text style={[styles.summaryValue, { color: colors.textMain }]}>{totalLeavesTaken}</Text>
               <Text style={[styles.summaryLabel, { color: colors.textSub }]}>Leaves Taken</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
               <View style={[styles.iconPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}><Feather name="clock" size={20} color="#ef4444" /></View>
               <Text style={[styles.summaryValue, { color: colors.textMain }]}>{totalLatesYearly}</Text>
               <Text style={[styles.summaryLabel, { color: colors.textSub }]}>Total Lates</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border, paddingBottom: 25 }, getSlideUpStyle(1)]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <Feather name="bar-chart-2" size={18} color="#3b82f6" style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.cardTitle, { color: colors.textMain }]}>Monthly Attendance</Text>
                <Text style={{fontSize: 11, color: colors.textSub, marginTop: 2}}>Present, Absent, Late Breakdown</Text>
              </View>
            </View>

            <View style={styles.legendContainer}>
               <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#60a5fa' }]} />
                  <Text style={[styles.legendText, { color: colors.textSub }]}>Present</Text>
               </View>
               <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#f87171' }]} />
                  <Text style={[styles.legendText, { color: colors.textSub }]}>Absent</Text>
               </View>
               <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#fbbf24' }]} />
                  <Text style={[styles.legendText, { color: colors.textSub }]}>Late</Text>
               </View>
            </View>
            
            {attendanceData.flat().reduce((a, b) => a + b, 0) === 0 ? (
                <Text style={styles.noDataText}>No attendance data for {currentYear}</Text>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, minWidth: '100%', justifyContent: 'space-around' }}>
                  <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'space-between', paddingBottom: 25, zIndex: -1 }]}>
                     <View style={[styles.gridLine, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155' }]} />
                     <View style={[styles.gridLine, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155' }]} />
                     <View style={[styles.gridLine, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155' }]} />
                     <View style={[styles.gridLine, { backgroundColor: isLightMode ? '#f1f5f9' : '#334155' }]} />
                  </View>
                  {attendanceData.map((monthData, index) => (
                    <View key={index} style={{ alignItems: 'center', marginHorizontal: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 180, borderBottomWidth: 2, borderBottomColor: isLightMode ? '#cbd5e1' : '#475569', paddingHorizontal: 5 }}>
                        <View style={styles.singleBarWrapper}>
                          {monthData[0] > 0 && <Text numberOfLines={1} style={[styles.barValueText, { color: colors.textSub }]}>{monthData[0]}</Text>}
                          <View style={[styles.customBar, { height: (monthData[0] / maxAttendanceValue) * 160, backgroundColor: '#60a5fa' }]} />
                        </View>
                        <View style={styles.singleBarWrapper}>
                          {monthData[1] > 0 && <Text numberOfLines={1} style={[styles.barValueText, { color: colors.textSub }]}>{monthData[1]}</Text>}
                          <View style={[styles.customBar, { height: (monthData[1] / maxAttendanceValue) * 160, backgroundColor: '#f87171' }]} />
                        </View>
                        <View style={styles.singleBarWrapper}>
                          {monthData[2] > 0 && <Text numberOfLines={1} style={[styles.barValueText, { color: colors.textSub }]}>{monthData[2]}</Text>}
                          <View style={[styles.customBar, { height: (monthData[2] / maxAttendanceValue) * 160, backgroundColor: '#fbbf24' }]} />
                        </View>
                      </View>
                      <Text style={[styles.monthLabel, { color: colors.textMain }]}>{attendanceLabels[index]}</Text>
                    </View>
                  ))}
                </ScrollView>
            )}
          </Animated.View>

          {/* <Animated.View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSlideUpStyle(2)]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <Feather name="award" size={18} color="#10b981" style={{ marginRight: 8 }} />
              <View>
                  <Text style={[styles.cardTitle, { color: colors.textMain }]}>Top Performers</Text>
                  <Text style={{fontSize: 11, color: colors.textSub, marginTop: 2}}>Employee-wise Attendance %</Text>
              </View>
            </View>
            
            {topEmployees.length === 0 ? (
                <Text style={styles.noDataText}>No performance data available</Text>
            ) : (
                topEmployees.map((emp: any, index: number) => (
                    <View key={index} style={{ marginBottom: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 13 }}>{emp.name || 'Unknown'} <Text style={{fontWeight: 'normal', color: colors.textSub, fontSize: 11}}> ({emp.role || 'N/A'})</Text></Text>
                            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 13 }}>{emp.presentPct || 0}%</Text>
                        </View>
                        <View style={{ height: 8, backgroundColor: isLightMode ? '#e2e8f0' : '#334155', borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${Math.min(emp.presentPct || 0, 100)}%`, backgroundColor: '#10b981', borderRadius: 4 }} />
                        </View>
                    </View>
                ))
            )}
          </Animated.View> */}

          <Animated.View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSlideUpStyle(3)]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <Feather name="pie-chart" size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.textMain }]}>Headcount by Department</Text>
            </View>
            {deptPieData.length === 0 ? (
                <Text style={styles.noDataText}>No department data available</Text>
            ) : (
                <PieChart
                  data={deptPieData}
                  width={width - 50}
                  height={200}
                  chartConfig={chartConfig}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"15"}
                  absolute
                />
            )}
          </Animated.View>

          <Animated.View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSlideUpStyle(4)]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <Feather name="coffee" size={18} color="#f59e0b" style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.textMain }]}>Leave Distribution</Text>
            </View>
            {leavePieData.length === 0 ? (
                <Text style={styles.noDataText}>No approved leaves yet</Text>
            ) : (
                <PieChart
                  data={leavePieData}
                  width={width - 50}
                  height={200}
                  chartConfig={chartConfig}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"15"}
                  absolute
                />
            )}
          </Animated.View>

          <Animated.View style={[styles.chartCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSlideUpStyle(5)]}>
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <Feather name="list" size={18} color="#ec4899" style={{ marginRight: 8 }} />
              <Text style={[styles.cardTitle, { color: colors.textMain }]}>Department Summary</Text>
            </View>
            <View style={[styles.tableHeader, { backgroundColor: isLightMode ? '#f8fafc' : '#1e293b' }]}>
              <Text style={[styles.tableCol, { flex: 2 }]}>DEPARTMENT</Text>
              <Text style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}>HEADCOUNT</Text>
            </View>
            
            {(!analyticsData?.deptStats || analyticsData.deptStats.length === 0) ? (
                <Text style={styles.noDataText}>No department data available</Text>
            ) : (
                analyticsData.deptStats.map((dept: any, index: number) => (
                  <View key={index} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold', color: colors.textMain }]}>{dept._id}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.textSub }]}>{dept.count}</Text>
                  </View>
                ))
            )}
          </Animated.View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 15, paddingBottom: 40 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 25, alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  pageTitle: { fontSize: 18, fontWeight: 'bold' },
  yearBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  yearText: { fontSize: 14, fontWeight: 'bold' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 5 },
  summaryCard: { width: '48%', padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 15, elevation: 1 },
  iconPill: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  summaryValue: { fontSize: 26, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '600' },

  chartCard: { borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  noDataText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 30, fontStyle: 'italic' },

  legendContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginBottom: 5 },
  legendColorBox: { width: 14, height: 14, borderRadius: 3, marginRight: 6 },
  legendText: { fontSize: 12, fontWeight: '500' },
  
  gridLine: { height: 1, width: '100%' }, 

  singleBarWrapper: { alignItems: 'center', marginHorizontal: 4 },
  barValueText: { fontSize: 11, marginBottom: 6, fontWeight: '700', minWidth: 30, textAlign: 'center' }, 
  customBar: { width: 28, borderTopLeftRadius: 6, borderTopRightRadius: 6 }, 
  monthLabel: { marginTop: 12, fontSize: 13, fontWeight: 'bold' },

  tableHeader: { flexDirection: 'row', padding: 10, borderRadius: 8, marginBottom: 5 },
  tableCol: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1 },
  tableCell: { fontSize: 13 }
});

export default AnalyticsScreen;