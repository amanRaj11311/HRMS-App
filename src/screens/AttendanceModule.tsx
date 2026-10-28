import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    ActivityIndicator, Alert, Modal, StatusBar, Platform, RefreshControl, TextInput, KeyboardAvoidingView, PermissionsAndroid
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Geolocation from 'react-native-geolocation-service';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../constants/theme';
import GlobalAppBar from '../components/GlobalAppBar';

import PhotoProofModal from '../screens/photofrommodal';
import GeoTagAttendanceCamera from '../screens/GeoAttendanceCamera';

import { API_BASE } from '../api/api';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'half-day', 'work-from-home', 'holiday', 'missed', 'overtime'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


const screenCache: {
    hasData: boolean;
    dateKey: string;
    permissions: string[];
    records: any[];
    checkoutRequests: any[];
    attSettings: any;
    todayRecord: any;
    allEmployees: any[];
    myName: string;
    selfCheckinAllowed: boolean;
} = {
    hasData: false,
    dateKey: '',
    permissions: [],
    records: [],
    checkoutRequests: [],
    attSettings: null,
    todayRecord: null,
    allEmployees: [],
    myName: 'My Record',
    selfCheckinAllowed: true,
};

const dateKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function AttendanceModule({ navigation }: any) {
    const { colors, isLightMode } = useTheme();

    const cacheValid = screenCache.hasData && screenCache.dateKey === dateKeyOf(new Date());

    const [permissions, setPermissions] = useState<string[]>(cacheValid ? screenCache.permissions : []);
    const [loading, setLoading] = useState(!cacheValid);
    const [refreshing, setRefreshing] = useState(false);

    const [records, setRecords] = useState<any[]>(cacheValid ? screenCache.records : []);
    const [checkoutRequests, setCheckoutRequests] = useState<any[]>(cacheValid ? screenCache.checkoutRequests : []);

    const [allEmployees, setAllEmployees] = useState<any[]>(cacheValid ? screenCache.allEmployees : []);
    const [searchQuery, setSearchQuery] = useState('');
    const [myName, setMyName] = useState(cacheValid ? screenCache.myName : 'My Record');

    const [isSyncing, setIsSyncing] = useState(false);

    const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [isDateFiltered, setIsDateFiltered] = useState(false);
    const [showFilterDatePicker, setShowFilterDatePicker] = useState(false);
    const [filterStatus, setFilterStatus] = useState('All Status');
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [filterEmpId, setFilterEmpId] = useState('All');
    const [filterEmpName, setFilterEmpName] = useState('All Employees');
    const [showEmpModal, setShowEmpModal] = useState(false);

    const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);
    const [requestLoading, setSubmitRequestLoading] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
    const [showRequestTimePicker, setShowRequestTimePicker] = useState(false);
    const [requestForm, setRequestForm] = useState({
        time: (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; })(),
        reason: ''
    });

    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editRecordId, setEditRecordId] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [showFormEmp, setShowFormEmp] = useState(false);
    const [showFormStatus, setShowFormStatus] = useState(false);
    const [showFormDate, setShowFormDate] = useState(false);
    const [showFormCheckIn, setShowFormCheckIn] = useState(false);
    const [showFormCheckOut, setShowFormCheckOut] = useState(false);

    const [formAbsentEmployees, setFormAbsentEmployees] = useState<any[]>([]);

    const [isDownloadModalVisible, setIsDownloadModalVisible] = useState(false);
    const [dlStartDate, setDlStartDate] = useState<Date>(new Date());
    const [dlEndDate, setDlEndDate] = useState<Date>(new Date());
    const [dlEmpId, setDlEmpId] = useState('All');
    const [dlEmpName, setDlEmpName] = useState('All Employees');
    const [showDlStartPicker, setShowDlStartPicker] = useState(false);
    const [showDlEndPicker, setShowDlEndPicker] = useState(false);
    const [showDlEmpModal, setShowDlEmpModal] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [selectedPhotoRecord, setSelectedPhotoRecord] = useState<any>(null);

    const [attSettings, setAttSettings] = useState<any>(cacheValid ? screenCache.attSettings : null);
    const [selfCheckinAllowed, setSelfCheckinAllowed] = useState<boolean>(cacheValid ? screenCache.selfCheckinAllowed : true);
    const [punchLoading, setPunchLoading] = useState(false);
    const [checkingLocation, setCheckingLocation] = useState(false);
    const [showGeoCam, setShowGeoCam] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [pendingAddress, setPendingAddress] = useState('');
    const [pendingAccuracy, setPendingAccuracy] = useState<number | null>(null);
    const [pendingDistance, setPendingDistance] = useState<number | null>(null);
    const [pendingLocationName, setPendingLocationName] = useState<string | null>(null);
    const [todayRecord, setTodayRecord] = useState<any>(cacheValid ? screenCache.todayRecord : null);
    const [showAttendanceCardModal, setShowAttendanceCardModal] = useState(false);
    const initDoneRef = useRef<boolean>(cacheValid);

    const getInitialTime = (hours: number, minutes = 0) => {
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d;
    };

    const [formData, setFormData] = useState({
        employeeId: '', employeeName: 'Select Employee', date: new Date(),
        status: 'present', checkIn: getInitialTime(9, 0), checkOut: getInitialTime(18, 0), notes: ''
    });

    const getSafeDateString = (d: Date) => {
        if (!d) return '--/--/----';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getCardDateString = (dStr: any) => {
        if (!dStr) return '--';
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return '--';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const formatTimeUI = (time: any) => {
        if (!time) return '--:-- --';
        let raw = (typeof time === 'object' && time.time) ? time.time : time;
        if (!raw) return '--:-- --';
        let t = new Date(raw);
        if (isNaN(t.getTime())) return '--:-- --';

        let h = t.getHours();
        const m = String(t.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    };

    const formatWorkingHours = (val: any) => {
        if (val === null || val === undefined || val === '') return '--';
        const num = parseFloat(val);
        if (isNaN(num) || num === 0) return '0h 0m';
        const h = Math.floor(num);
        const m = Math.round((num - h) * 60);
        return `${h}h ${m}m`;
    };

    const getStatusStyle = (status: string) => {
        const s = String(status || "").toLowerCase();
        if (s === 'present' || s === 'overtime') return { bg: '#DCFCE7', text: '#16A34A', dot: '#16A34A' };
        if (s === 'late') return { bg: '#FEF3C7', text: '#D97706', dot: '#D97706' };
        if (s === 'absent') return { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' };
        if (s === 'half-day' || s === 'halfday') return { bg: '#DBEAFE', text: '#2563EB', dot: '#2563EB' };
        if (s === 'missed') return { bg: '#FEE2E2', text: '#EA580C', dot: '#EA580C' };
        return { bg: '#F1F5F9', text: '#64748B', dot: '#64748B' };
    };

    const canDo = (action: string) => permissions.includes(`ATTENDANCE:${action.toUpperCase()}`);

    // 🚀 FIX: har focus par initScreen chalta hai, lekin ab silent mode me (spinner nahi dikhega
    // agar pehle se data hai)
    useFocusEffect(useCallback(() => {
        initScreen();
    }, []));

    // 🚀 FIX: yeh effect ab sirf tab chalega jab user filter date badle (initial setup ke baad).
    // Pehle yeh permissions set hote hi chal jata tha -> double fetch + flicker.
    useEffect(() => {
        if (!initDoneRef.current) return;
        fetchData(false); // date badalne par list badalti hai, isliye loader dikhana theek hai
    }, [filterDate, isDateFiltered]);

    useEffect(() => {
        if (isAddModalVisible && canDo('CREATE') && allEmployees.length > 0) {
            fetchFormAbsentees(formData.date);
        }
    }, [formData.date, isAddModalVisible, allEmployees]);

    const fetchFormAbsentees = async (d: Date) => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const pad = (n: number) => n < 10 ? '0' + n : n;
            const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const res = await axios.get(`${API_BASE}/attendance?date=${dStr}`, { headers: { Authorization: `Bearer ${token}` } });
            const punchedIds = (res.data?.data || []).map((r: any) => r.employeeId?._id || r.employeeId);
            const absentees = allEmployees.filter(emp => !punchedIds.includes(emp._id));
            setFormAbsentEmployees(absentees);
        } catch (e) {
            setFormAbsentEmployees(allEmployees);
        }
    };

    const initScreen = async () => {
        // 🚀 FIX: agar pehle se data hai (cache ya earlier load), to loader mat dikhao — silent refresh karo
        const silent = initDoneRef.current || screenCache.hasData;
        if (!silent) setLoading(true);

        const permsStr = await AsyncStorage.getItem('userPermissions');
        const userNameStr = await AsyncStorage.getItem('userName');

        const pArray = permsStr ? JSON.parse(permsStr).map((p: string) => p.toUpperCase()) : [];

        setPermissions(pArray);
        screenCache.permissions = pArray;
        if (userNameStr) {
            setMyName(userNameStr);
            screenCache.myName = userNameStr;
        }

        // 🚀 Individual self check-in/out permission (default true unless explicitly stored as 'false')
        const selfCheckinStr = await AsyncStorage.getItem('selfCheckinAllowed');
        const selfAllowed = selfCheckinStr !== 'false';
        setSelfCheckinAllowed(selfAllowed);
        screenCache.selfCheckinAllowed = selfAllowed;

        if (pArray.includes('ATTENDANCE:VIEW')) {
            fetchEmployees();
        }

        if (pArray.some((p: string) => p.includes('ATTENDANCE:SELF'))) {
            fetchTodayRecord();
        }

        await fetchData(silent, pArray);
        initDoneRef.current = true;
    };

    const fetchEmployees = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await axios.get(`${API_BASE}/employees?limit=500`, { headers: { Authorization: `Bearer ${token}` } });
            const list = (res.data?.data?.data || res.data?.data || []).filter((e: any) => !e.isDeleted);
            setAllEmployees(list);
            screenCache.allEmployees = list;
        } catch (e) { }
    };

    const fetchTodayRecord = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await axios.get(`${API_BASE}/attendance/self?limit=500&_t=${Date.now()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res?.data?.data || [];
            const todayStr = new Date().toDateString();
            const rec = data.find((r: any) => new Date(r.date || r.checkIn?.time).toDateString() === todayStr);
            setTodayRecord(rec || null);
            screenCache.todayRecord = rec || null;
        } catch (e) {
            setTodayRecord(null);
            screenCache.todayRecord = null;
        }
    };

    const fetchData = async (isSilent = false, pArray?: string[]) => {
        try {
            if (!isSilent) setLoading(true);
            const token = await AsyncStorage.getItem('userToken');
            const currentPerms = pArray || permissions;
            const canViewAll = currentPerms.includes('ATTENDANCE:VIEW');

            let url = `${API_BASE}/attendance`;
            let reqUrl = `${API_BASE}/checkout-requests`;

            const m = filterDate.getMonth() + 1;
            const y = filterDate.getFullYear();

            if (canViewAll) {
                const pad = (n: number) => n < 10 ? '0' + n : n;
                const dateStr = `${y}-${pad(m)}-${pad(filterDate.getDate())}`;
                url += `?date=${dateStr}&limit=500`;
                reqUrl += `?date=${dateStr}&limit=500`;
            } else {
                url = `${API_BASE}/attendance/self?month=${m}&year=${y}&limit=100`;
                reqUrl = `${API_BASE}/checkout-requests/self?limit=500`;
            }

            url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
            reqUrl += `${reqUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;

            const [res, reqRes, attSetRes] = await Promise.all([
                axios.get(url, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
                axios.get(reqUrl, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
                axios.get(`${API_BASE}/settings/attendance?_t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
            ]);

            if (attSetRes?.data?.data) {
                setAttSettings(attSetRes.data.data);
                screenCache.attSettings = attSetRes.data.data;
            }

            // 🚀 FIX: agar main attendance request fail ho gayi (network error), to purana data
            // mat mitao — wahi dikhne do jo pehle se screen par hai.
            if (!res) {
                return;
            }

            const data = res?.data?.data || [];
            const requestsData = reqRes?.data?.data || [];

            requestsData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setCheckoutRequests(requestsData);

            const uniqueRecordsMap = new Map();

            data.forEach((item: any) => {
                const empId = item.employeeId?._id || item.employeeId;
                const dObj = new Date(item.date || item.checkIn?.time);
                if (isNaN(dObj.getTime())) return;

                const dateKey = `${empId}_${dObj.getFullYear()}-${dObj.getMonth()}-${dObj.getDate()}`;

                if (uniqueRecordsMap.has(dateKey)) {
                    const existing = uniqueRecordsMap.get(dateKey);
                    if (item.checkIn?.time && !existing.checkIn?.time) {
                        uniqueRecordsMap.set(dateKey, item);
                    }
                } else {
                    uniqueRecordsMap.set(dateKey, item);
                }
            });

            // Status Override Logic
            const finalData = Array.from(uniqueRecordsMap.values()).map((item: any) => {
                let updated = { ...item };

                const relatedReq = requestsData.find((r: any) => {
                    const reqAttId = r.attendanceId?._id || r.attendanceId;
                    return String(reqAttId) === String(updated._id);
                });
                updated._relatedReq = relatedReq;

                const currentStatus = String(item.status).toLowerCase();

                if (!['absent', 'holiday', 'week-off'].includes(currentStatus)) {
                    if (updated.checkIn && updated.checkIn.time) {
                        const checkInDate = new Date(updated.checkIn.time);
                        const checkInMs = checkInDate.getTime();
                        const isLate = currentStatus === 'late';

                        if (!updated.checkOut || !updated.checkOut.time) {
                            updated.workingHours = 0;
                            updated.status = isLate ? 'late' : 'present';
                        }
                        else {
                            const checkOutDate = new Date(updated.checkOut.time);
                            const checkOutMs = checkOutDate.getTime();
                            const diffMs = checkOutMs - checkInMs;
                            const diffMinutes = diffMs / (1000 * 60);

                            if (diffMinutes <= 1) {
                                updated.checkOut = null;
                                updated.workingHours = 0;
                                updated.status = isLate ? 'late' : 'present';
                            }
                            else {
                                const workingHours = diffMs / (1000 * 60 * 60);
                                updated.workingHours = workingHours;

                                if (workingHours < 6) {
                                    updated.status = 'half-day';
                                } else {
                                    updated.status = isLate ? 'late' : 'present';
                                }
                            }
                        }
                    }
                }

                return updated;
            });

            setRecords(finalData);

            // 🚀 FIX: cache update — sirf tab jab aaj ki date dekh rahe hain
            if (dateKeyOf(filterDate) === dateKeyOf(new Date())) {
                screenCache.records = finalData;
                screenCache.checkoutRequests = requestsData;
                screenCache.dateKey = dateKeyOf(new Date());
                screenCache.hasData = true;
            }

        } catch (e) {
            console.log("Fetch Error:", e);
        } finally {
            setLoading(false); setRefreshing(false);
        }
    };

    const syncBiometric = async (silent = false) => {
        if (!silent) setIsSyncing(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const syncUrl = `${API_BASE}/device/attendance?_t=${Date.now()}`;

            await axios.get(syncUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            }).catch(() => { });

            return new Promise((resolve) => {
                setTimeout(async () => {
                    await fetchData(true);
                    await fetchTodayRecord();
                    if (!silent) {
                        Alert.alert("Success", "Attendance synchronized successfully!");
                        setIsSyncing(false);
                    }
                    resolve(true);
                }, 3000);
            });

        } catch (error: any) {
            if (!silent) {
                Alert.alert("Sync Error", "Failed to communicate with server.");
                setIsSyncing(false);
            }
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await syncBiometric(true);
        setRefreshing(false);
    };

    const escapeXml = (unsafe: string) => {
        return (unsafe || '').toString().replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;'; case '>': return '&gt;';
                case '&': return '&amp;'; case '\'': return '&apos;';
                case '"': return '&quot;'; default: return c;
            }
        });
    };

    const handleDownloadReport = async () => {
        try {
            setIsDownloading(true);
            const token = await AsyncStorage.getItem('userToken');
            const targetEmployees = dlEmpId === 'All' ? allEmployees : allEmployees.filter(e => e._id === dlEmpId);

            if (!targetEmployees || targetEmployees.length === 0) {
                Alert.alert("No Data", "No employees found for the selected criteria.");
                setIsDownloading(false);
                return;
            }

            const sDate = new Date(dlStartDate); sDate.setHours(0, 0, 0, 0);
            const eDate = new Date(dlEndDate); eDate.setHours(23, 59, 59, 999);

            if (eDate < sDate) {
                Alert.alert("Invalid Range", "End Date must be after or equal to Start Date.");
                setIsDownloading(false);
                return;
            }

            let excelContent = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
            excelContent += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">\n`;

            const chunkSize = 3;

            for (let i = 0; i < targetEmployees.length; i += chunkSize) {
                const chunk = targetEmployees.slice(i, i + chunkSize);
                const pad = (n: number) => n < 10 ? '0' + n : n;
                const startDateStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
                const endDateStr = `${eDate.getFullYear()}-${pad(eDate.getMonth() + 1)}-${pad(eDate.getDate())}`;

                const promises = chunk.map(emp =>
                    axios.get(`${API_BASE}/attendance?employeeId=${emp._id}&startDate=${startDateStr}&endDate=${endDateStr}&limit=500`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => null)
                );

                const results = await Promise.all(promises);

                results.forEach((res, idx) => {
                    const emp = chunk[idx];
                    const empIdStr = emp.employeeId || 'N/A';
                    const empNameStr = `${emp.userId?.firstName || ''} ${emp.userId?.lastName || ''}`.trim() || 'Unknown';

                    let baseName = empNameStr.replace(/[\\/?*[\]:]/g, '').substring(0, 20);
                    if (!baseName) baseName = `Emp_${i + idx}`;
                    const uniqueSheetName = `${baseName}_${empIdStr.substring(empIdStr.length - 4)}`;

                    const empRecords = res?.data?.data || [];
                    const monthlyRecordsMap = new Map();

                    empRecords.forEach((r: any) => {
                        const d = new Date(r.date || r.checkIn?.time);
                        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                        if (monthlyRecordsMap.has(dateKey)) {
                            const existing = monthlyRecordsMap.get(dateKey);
                            if (r.checkIn?.time && !existing.checkIn?.time) {
                                monthlyRecordsMap.set(dateKey, r);
                            }
                        } else {
                            monthlyRecordsMap.set(dateKey, r);
                        }
                    });

                    excelContent += `<Worksheet ss:Name="${escapeXml(uniqueSheetName)}">\n<Table>\n`;
                    excelContent += `<Row><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Employee ID</Data></Cell><Cell><Data ss:Type="String">Employee Name</Data></Cell><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">Check-In</Data></Cell><Cell><Data ss:Type="String">Check-Out</Data></Cell><Cell><Data ss:Type="String">Working Hours</Data></Cell></Row>\n`;

                    for (let dt = new Date(sDate); dt <= eDate; dt.setDate(dt.getDate() + 1)) {
                        const loopDate = new Date(dt);
                        const dateKey = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}-${String(loopDate.getDate()).padStart(2, '0')}`;
                        const displayDate = `${String(loopDate.getDate()).padStart(2, '0')}/${String(loopDate.getMonth() + 1).padStart(2, '0')}/${loopDate.getFullYear()}`;

                        let status, checkIn, checkOut, hrs;

                        if (monthlyRecordsMap.has(dateKey)) {
                            const rec = monthlyRecordsMap.get(dateKey);
                            status = rec.status || 'present';
                            checkIn = formatTimeUI(rec.checkIn);
                            checkOut = formatTimeUI(rec.checkOut);
                            hrs = rec.workingHours ? parseFloat(rec.workingHours).toFixed(2) : '0';
                        } else {
                            status = 'absent'; checkIn = "--:-- --"; checkOut = "--:-- --"; hrs = "0";
                        }

                        excelContent += `<Row><Cell><Data ss:Type="String">${displayDate}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(empIdStr)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(empNameStr)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(status)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(checkIn)}</Data></Cell><Cell><Data ss:Type="String">${escapeXml(checkOut)}</Data></Cell><Cell><Data ss:Type="String">${hrs}</Data></Cell></Row>\n`;
                    }
                    excelContent += `</Table>\n</Worksheet>\n`;
                });
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            excelContent += `</Workbook>`;

            const safeStart = getSafeDateString(dlStartDate).replace(/\//g, '');
            const safeEnd = getSafeDateString(dlEndDate).replace(/\//g, '');
            const fileName = `Attendance_${safeStart}_to_${safeEnd}.xls`;

            if (Platform.OS === 'android') {
                const androidVersion = Number(Platform.Version);
                if (androidVersion < 30) {
                    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        Alert.alert("Permission Denied", "App needs storage permission to save the file.");
                        setIsDownloading(false);
                        return;
                    }
                }

                const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
                await RNFS.writeFile(filePath, excelContent, 'utf8');
                Alert.alert("Download Complete! 🎉", `Report successfully saved in your phone's 'Downloads' folder:\n\n${fileName}`);
            } else {
                const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
                await RNFS.writeFile(filePath, excelContent, 'utf8');
                await Share.open({
                    url: `file://${filePath}`,
                    type: 'application/vnd.ms-excel',
                    title: 'Save Attendance Report'
                });
            }
            setIsDownloadModalVisible(false);
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Error", String(error.message || "An unexpected error occurred."));
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const saveRecord = async () => {
        if (!formData.employeeId) return Alert.alert("Required", "Please select an Employee first.");

        try {
            setFormLoading(true);
            const token = await AsyncStorage.getItem('userToken');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const pad = (n: number) => n < 10 ? '0' + n : n;
            const cIn = `${pad(formData.checkIn.getHours())}:${pad(formData.checkIn.getMinutes())}`;
            const cOut = `${pad(formData.checkOut.getHours())}:${pad(formData.checkOut.getMinutes())}`;
            const d = formData.date;
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

            const payload = {
                employeeId: formData.employeeId,
                date: dateStr,
                checkInTime: (formData.status === 'absent' || formData.status === 'holiday') ? null : cIn,
                checkOutTime: (formData.status === 'absent' || formData.status === 'holiday') ? null : cOut,
                status: formData.status, notes: formData.notes
            };

            if (isEditing) {
                await axios.put(`${API_BASE}/attendance/${editRecordId}`, payload, config);
            } else {
                await axios.post(`${API_BASE}/attendance`, payload, config);
            }

            setIsAddModalVisible(false);
            fetchData(true);
            fetchTodayRecord();
            Alert.alert("Success", "Attendance saved successfully.");
        } catch (err: any) {
            Alert.alert("Failed", err.response?.data?.message || "Server Error. Please check your data.");
        }
        finally { setFormLoading(false); }
    };

    const handleRequestCheckoutSubmit = async () => {
        if (!requestForm.reason.trim()) {
            return Alert.alert("Required", "Please provide a reason for missing the punch-out.");
        }

        try {
            setSubmitRequestLoading(true);
            const token = await AsyncStorage.getItem('userToken');

            const pad = (n: number) => n < 10 ? '0' + n : n;
            const timeStr = `${pad(requestForm.time.getHours())}:${pad(requestForm.time.getMinutes())}`;

            let recordDateStr = '';
            if (selectedAttendance?.date) {
                recordDateStr = selectedAttendance.date.split('T')[0];
            } else if (selectedAttendance?.checkIn?.time) {
                recordDateStr = selectedAttendance.checkIn.time.split('T')[0];
            } else {
                recordDateStr = `${filterDate.getFullYear()}-${pad(filterDate.getMonth() + 1)}-${pad(filterDate.getDate())}`;
            }

            const payload = {
                attendanceId: selectedAttendance._id,
                checkOutTime: timeStr,
                date: recordDateStr,
                reason: requestForm.reason
            };

            const res = await axios.post(`${API_BASE}/checkout-requests`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data?.success) {
                Alert.alert("Success 🎉", "Checkout request sent for approval!");
                setIsCheckoutModalVisible(false);
                setRequestForm({ time: getInitialTime(18, 0), reason: '' });
                fetchData(true);
            }
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Failed to submit request.");
        } finally {
            setSubmitRequestLoading(false);
        }
    };

    // 🚀 MATH FUNCTION: Haversine distance calculator for Geo-fence (same as Dashboard)
    const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000;
    };

    // 🚀 free reverse-geocoding via OpenStreetMap Nominatim (no API key) — same as Dashboard
    const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { 'User-Agent': 'DCS-HRMS-App/1.0 (support@dcstechnosis.com)' } }
            );
            const data = await res.json();
            return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } catch (e) {
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    };

    const hasSelfCheckinPermission = permissions.some(p => p.includes('ATTENDANCE:SELF'));

    // 🚀 Self check-in/out — card/button handler. Location/geofence logic is unchanged from Dashboard.
    const handlePunch = async () => {
        if (!hasSelfCheckinPermission) {
            return Alert.alert(
                "Not Allowed",
                "Self Check-In / Check-Out permission is not available. Please contact HR/Admin for permission."
            );
        }

        if (!attSettings || attSettings.checkinEnabled === false) {
            return Alert.alert(
                "Not Allowed",
                "Self check-in/out is disabled by admin. Please contact HR/admin."
            );
        }

        // 2) Individual (per-employee) flag
        if (selfCheckinAllowed === false) {
            return Alert.alert(
                "Not Allowed",
                "Self check-in/out is not enabled for your account. Please contact HR/admin."
            );
        }

        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    return Alert.alert("Permission Denied", "Location permission is required for attendance.");
                }
            } catch (err) {
                console.warn(err);
            }
        }

        setCheckingLocation(true);

        Geolocation.getCurrentPosition(
            async (position: any) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const accuracy = position.coords.accuracy ?? null;
                const locations = attSettings?.locations || [];

                let distanceFromAllowed: number | null = null;
                let nearestLocationName: string | null = null;

                if (attSettings?.locationEnabled) {
                    if (locations.length === 0) {
                        setCheckingLocation(false);
                        return Alert.alert("Configuration Error", "Location restriction is enabled but no office locations are configured.");
                    }

                    let nearest = locations[0];
                    let minDist = Infinity;
                    for (const loc of locations) {
                        const dist = getDistanceFromLatLonInMeters(userLat, userLng, loc.latitude, loc.longitude);
                        if (dist < minDist) { minDist = dist; nearest = loc; }
                    }

                    const withinRange = minDist <= (nearest.radiusMeters || 100);
                    distanceFromAllowed = minDist;
                    nearestLocationName = nearest.name || 'the office location';

                    if (!withinRange) {
                        setCheckingLocation(false);
                        return Alert.alert(
                            "Out of Range",
                            `You are outside the allowed location. You're ${Math.round(minDist)}m away from ${nearestLocationName}. Please move within ${nearest.radiusMeters || 100}m to check in/out.`
                        );
                    }
                }
                // Case A: locationEnabled is false — no validation, fall straight through to camera.

                const addr = await reverseGeocode(userLat, userLng);
                setPendingLocation({ latitude: userLat, longitude: userLng });
                setPendingAddress(addr);
                setPendingAccuracy(accuracy);
                setPendingDistance(distanceFromAllowed);
                setPendingLocationName(nearestLocationName);
                setCheckingLocation(false);
                setShowGeoCam(true);
            },
            (error: any) => {
                setCheckingLocation(false);
                Alert.alert("Location Error", error.message || "Failed to fetch current location. Make sure GPS is enabled.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const handlePhotoCaptured = async (fileUri: string) => {
        setShowGeoCam(false);
        if (!pendingLocation) return;

        setPunchLoading(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const myEmpId = await AsyncStorage.getItem('employeeId');

            const form = new FormData();
            form.append('file', {
                uri: fileUri,
                name: `attendance_${Date.now()}.jpg`,
                type: 'image/jpeg',
            } as any);

            const uploadRes = await axios.post(`${API_BASE}/upload`, form, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            const rawPath =
                uploadRes.data?.fileUrl ||
                uploadRes.data?.url ||
                uploadRes.data?.data?.fileUrl ||
                uploadRes.data?.data?.url;

            if (!rawPath) throw new Error('Upload did not return a file URL.');

            const apiOrigin = API_BASE.replace(/\/api\/?$/, '');
            const photoProof = /^https?:\/\//i.test(rawPath)
                ? rawPath
                : `${apiOrigin}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;

            // use the dedicated, filter-independent todayRecord instead of
            // searching the (possibly stale/filtered) `records` array.
            const isCheckingOut = todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time;
            const endpoint = isCheckingOut ? '/attendance/checkout' : '/attendance/checkin';

            await axios.post(
                `${API_BASE}${endpoint}`,
                {
                    employeeId: myEmpId,
                    method: 'mobile',
                    location: pendingLocation,
                    photoProof,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Success", `Successfully checked ${isCheckingOut ? 'out' : 'in'}!`);
            setShowAttendanceCardModal(false);
            await fetchData(true);
            await fetchTodayRecord();
        } catch (e: any) {
            Alert.alert("Error", e.response?.data?.message || e.message || "Failed to mark attendance.");
        } finally {
            setPunchLoading(false);
            setPendingLocation(null);
            setPendingAddress('');
            setPendingAccuracy(null);
            setPendingDistance(null);
            setPendingLocationName(null);
        }
    };

    const deleteRecord = (id: string) => {
        Alert.alert("Delete", "Are you sure?", [
            { text: "Cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('userToken');
                        await axios.delete(`${API_BASE}/attendance/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                        fetchData(true);
                        fetchTodayRecord();
                    } catch (e) { }
                }
            }
        ]);
    };

    const openEdit = (item: any) => {
        setIsEditing(true);
        setEditRecordId(item._id);

        const defaultIn = getInitialTime(9, 0);
        const defaultOut = getInitialTime(18, 0);

        setFormData({
            employeeId: item.employeeId?._id || item.employeeId,
            employeeName: `${item.employeeId?.userId?.firstName || ''} ${item.employeeId?.userId?.lastName || ''}`,
            date: new Date(item.date || new Date()),
            status: item.status || 'present',
            checkIn: item.checkIn?.time ? new Date(item.checkIn.time) : defaultIn,
            checkOut: item.checkOut?.time ? new Date(item.checkOut.time) : defaultOut,
            notes: item.notes || ''
        });
        setIsAddModalVisible(true);
    };

    const openAdd = () => {
        setIsEditing(false);
        setEditRecordId('');
        setFormData({
            employeeId: '', employeeName: 'Select Employee',
            date: filterDate, status: 'present',
            checkIn: getInitialTime(9, 0), checkOut: getInitialTime(18, 0), notes: ''
        });
        setIsAddModalVisible(true);
    };

    // 🚀 DYNAMIC KPI CALCULATION FROM CORRECTED FRONTEND DATA
    let totalPresentCount = 0;
    let absentCountLocal = 0;
    let lateCountLocal = 0;
    let halfDayCountLocal = 0;
    let otHoursTotal = 0;

    records.forEach(r => {
        const s = String(r.status || 'present').toLowerCase();

        if (s === 'absent') {
            absentCountLocal++;
        } else if (s !== 'holiday' && s !== 'week-off') {
            totalPresentCount++; // Present, Late, Half-day, Overtime sab isme count honge
            if (s === 'late') lateCountLocal++;
            if (s === 'half-day' || s === 'halfday') halfDayCountLocal++;
        }

        if (r.overtime && !isNaN(parseFloat(r.overtime))) {
            otHoursTotal += parseFloat(r.overtime);
        }
    });

    const otDisplayFormatted = otHoursTotal > 0 ? `${Math.floor(otHoursTotal)}h ${Math.round((otHoursTotal % 1) * 60)}m` : '0h';

    const displayRecords = records.filter(rec => {
        const name = `${rec.employeeId?.userId?.firstName || ''} ${rec.employeeId?.userId?.lastName || ''}`.toLowerCase();
        const safeSearch = String(searchQuery || '').toLowerCase();
        const matchesSearch = name.includes(safeSearch);

        const safeFilterStatus = String(filterStatus || 'All Status').toLowerCase();
        const safeRecStatus = String(rec.status || '').toLowerCase();
        const matchesStatus = safeFilterStatus === 'all status' || safeRecStatus === safeFilterStatus;

        const matchesEmp = filterEmpId === 'All' || (rec.employeeId?._id || rec.employeeId) === filterEmpId;
        return matchesSearch && matchesStatus && matchesEmp;
    });

    const showSelfPunchFab = !canDo('VIEW') && hasSelfCheckinPermission;

    const showNoSelfCheckinPermissionMsg = !canDo('VIEW') && !hasSelfCheckinPermission;
    const isCheckingOutForFab = todayRecord?.checkIn?.time && !todayRecord?.checkOut?.time;
    const checkinDisabledForFab = (attSettings && attSettings.checkinEnabled === false) || selfCheckinAllowed === false;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isLightMode ? "dark-content" : "light-content"} translucent backgroundColor="transparent" />

            <View style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: colors.cardBg }}>
                <GlobalAppBar navigation={navigation} showSearch={true} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.titleAccent, { backgroundColor: colors.primary || '#3B82F6' }]} />
                        <View>
                            <Text style={[styles.title, { color: colors.textMain }]}>{canDo('VIEW') ? "Team Attendance" : "My Attendance"}</Text>
                            <Text style={{ color: colors.textSub, fontSize: 11, marginTop: 2, fontWeight: '500' }}>{canDo('VIEW') ? "Managing Organization" : "Your personal records"}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        {canDo('CREATE') && (
                            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
                                <Feather name="plus" size={16} color="#FFF" /><Text style={styles.addBtnText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {showNoSelfCheckinPermissionMsg && (
                    <View style={[styles.attCard, { backgroundColor: colors.cardBg, borderColor: colors.border, borderLeftColor: '#6366F1', marginBottom: 16 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="lock-outline" size={20} color="#6366F1" style={{ marginRight: 10 }} />
                            <Text style={{ color: '#6366F1', fontSize: 13, flex: 1, fontWeight: '600' }}>
                                Self Check-In / Check-Out permission is not available. Please contact HR/Admin for permission.
                            </Text>
                        </View>
                    </View>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    <KpiCard label="Total Present" val={totalPresentCount} color="#10B981" bg="rgba(16,185,129,0.12)" icon="account-check" />
                    <KpiCard label="Absent" val={absentCountLocal} color="#EF4444" bg="rgba(239,68,68,0.12)" icon="account-remove" />
                    <KpiCard label="Late" val={lateCountLocal} color="#F59E0B" bg="rgba(245,158,11,0.12)" icon="clock-alert" />
                    <KpiCard label="Half Day" val={halfDayCountLocal} color="#3B82F6" bg="rgba(59,130,246,0.12)" icon="circle-half-full" />
                    <KpiCard label="Total OT (Hrs)" val={otDisplayFormatted} color="#8B5CF6" bg="rgba(139,92,246,0.12)" icon="clock-plus-outline" isLast />
                </ScrollView>

                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.filterPill, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                        onPress={() => setShowFilterDatePicker(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.filterText, { color: colors.primary }]}>
                            {canDo('VIEW') ? getSafeDateString(filterDate) : `${MONTHS[filterDate.getMonth()]} ${filterDate.getFullYear()}`}
                        </Text>
                        <Feather name="calendar" size={14} color={colors.primary} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, { borderColor: '#10B981', backgroundColor: '#10B98110', paddingHorizontal: 12 }]}
                        onPress={() => syncBiometric(false)}
                        disabled={isSyncing}
                        activeOpacity={0.8}
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#10B981" />
                        ) : (
                            <MaterialCommunityIcons name="fingerprint" size={18} color="#10B981" />
                        )}
                    </TouchableOpacity>

                    {canDo('VIEW') && (
                        <TouchableOpacity style={[styles.filterPill, { borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1 }]} onPress={() => setShowEmpModal(true)} activeOpacity={0.8}>
                            <Text style={[styles.filterText, { color: colors.textMain }]} numberOfLines={1}>{filterEmpName}</Text>
                            <Feather name="chevron-down" size={14} color={colors.textSub} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.filterPill, { borderColor: colors.border, backgroundColor: colors.cardBg }]} onPress={() => setShowStatusModal(true)} activeOpacity={0.8}><Text style={[styles.filterText, { color: colors.textMain }]}>{filterStatus}</Text></TouchableOpacity>
                </View>

                {loading && !refreshing ? <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }} /> : displayRecords.map((item, index) => {

                    const recordDateStr = item.date || item.checkIn?.time || filterDate;
                    const recordDateObj = new Date(recordDateStr);
                    recordDateObj.setHours(0, 0, 0, 0);

                    const todayObj = new Date();
                    todayObj.setHours(0, 0, 0, 0);

                    const isPastDay = recordDateObj.getTime() < todayObj.getTime();
                    const hasNoCheckout = item.checkIn?.time && (!item.checkOut?.time || item.workingHours === 0);
                    const canShowRequestButton = hasNoCheckout && isPastDay && !canDo('VIEW');
                    const relatedReq = item._relatedReq;
                    const statusText = item.status || 'present';
                    const hasPhotoProof = !!(item.checkIn?.photoProof || item.checkOut?.photoProof);
                    const statusStyle = getStatusStyle(statusText);

                    return (
                        <View key={item._id || index} style={[styles.attCard, { backgroundColor: colors.cardBg, borderColor: colors.border, borderLeftColor: statusStyle.dot }]}>
                            <View style={styles.cardHeader}>
                                <View style={styles.userInfo}>
                                    <View style={styles.avatarRing}>
                                        <View style={styles.avatar}><Text style={styles.avatarText}>{(item.employeeId?.userId?.firstName || 'U').charAt(0)}</Text></View>
                                    </View>
                                    <View>
                                        <Text style={[styles.userName, { color: colors.textMain }]}>{item.employeeId?.userId?.firstName} {item.employeeId?.userId?.lastName}</Text>
                                        <Text style={styles.userSub}>{getCardDateString(item.date || item.checkIn?.time || filterDate)}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                                    <View style={[styles.statusTag, { backgroundColor: statusStyle.bg }]}>
                                        <View style={[styles.statusTagDot, { backgroundColor: statusStyle.dot }]} />
                                        <Text style={[styles.statusTagText, { color: statusStyle.text }]}>{statusText}</Text>
                                    </View>

                                    {/* photo proof quick-view button */}
                                    {hasPhotoProof && (
                                        <TouchableOpacity
                                            style={[styles.editBtn, { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.25)' }]}
                                            onPress={() => { setSelectedPhotoRecord(item); setShowPhotoModal(true); }}
                                            activeOpacity={0.75}
                                        >
                                            <MaterialCommunityIcons name="camera-outline" size={15} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}

                                    {canDo('UPDATE') && item.status !== 'absent' && (
                                        <TouchableOpacity style={[styles.editBtn, { backgroundColor: 'rgba(100,116,139,0.08)', borderColor: 'rgba(100,116,139,0.2)' }]} onPress={() => openEdit(item)} activeOpacity={0.75}>
                                            <Feather name="edit-2" size={14} color={colors.textSub} />
                                        </TouchableOpacity>
                                    )}
                                    {canDo('DELETE') && item.status !== 'absent' && (
                                        <TouchableOpacity style={[styles.editBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]} onPress={() => deleteRecord(item._id)} activeOpacity={0.75}>
                                            <Feather name="trash-2" size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {item.status !== 'absent' && item.status !== 'holiday' && item.status !== 'week-off' && (
                                <View style={[styles.cardBody, { borderTopColor: colors.border }]}>
                                    <View style={styles.timeInfo}><Text style={styles.timeLabel}>CHECK IN</Text><Text style={[styles.timeValue, { color: colors.textMain }]}>{formatTimeUI(item.checkIn)}</Text></View>
                                    <View style={styles.timeInfo}><Text style={styles.timeLabel}>CHECK OUT</Text><Text style={[styles.timeValue, { color: colors.textMain }]}>
                                        {hasNoCheckout ? '--:-- --' : formatTimeUI(item.checkOut)}
                                    </Text></View>
                                    <View style={[styles.timeInfo, { alignItems: 'flex-end' }]}>
                                        <Text style={styles.timeLabel}>HOURS</Text>
                                        <Text style={{ fontSize: 14, color: hasNoCheckout ? '#EA580C' : '#3B82F6', fontWeight: '900' }}>
                                            {hasNoCheckout ? 'Missing' : formatWorkingHours(item.workingHours)}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {relatedReq ? (
                                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }}>
                                    {relatedReq.status === 'pending' && (
                                        <View style={[styles.reqStatusBox, { backgroundColor: '#FEF3C7' }]}>
                                            <MaterialCommunityIcons name="clock-fast" size={16} color="#D97706" style={{ marginRight: 6 }} />
                                            <Text style={{ color: '#D97706', fontSize: 12, fontWeight: 'bold' }}>Checkout Requested (Pending)</Text>
                                        </View>
                                    )}
                                    {relatedReq.status === 'approved' && (
                                        <View style={[styles.reqStatusBox, { backgroundColor: '#DCFCE7' }]}>
                                            <MaterialCommunityIcons name="check-decagram" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                                            <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: 'bold' }}>
                                                Checkout Approved {relatedReq.reviewedBy ? `by ${relatedReq.reviewedBy.firstName || relatedReq.reviewedBy.name || 'Admin'}` : ''}
                                            </Text>
                                        </View>
                                    )}
                                    {relatedReq.status === 'rejected' && canShowRequestButton && (
                                        <View>
                                            <View style={[styles.reqStatusBox, { backgroundColor: '#FEE2E2', marginBottom: 10 }]}>
                                                <MaterialCommunityIcons name="close-octagon" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                                                <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: 'bold' }}>Request Rejected: {relatedReq.rejectionReason || 'No reason provided'}</Text>
                                            </View>
                                            <TouchableOpacity style={styles.requestCheckoutBtn} onPress={() => { setSelectedAttendance(item); setIsCheckoutModalVisible(true); }} activeOpacity={0.85}>
                                                <MaterialCommunityIcons name="clock-out" size={16} color="#FFF" style={{ marginRight: 6 }} />
                                                <Text style={styles.requestCheckoutBtnText}>Request Checkout Again</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                canShowRequestButton && (
                                    <TouchableOpacity style={styles.requestCheckoutBtn} onPress={() => { setSelectedAttendance(item); setIsCheckoutModalVisible(true); }} activeOpacity={0.85}>
                                        <MaterialCommunityIcons name="clock-out" size={16} color="#FFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.requestCheckoutBtnText}>Request Checkout</Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    )
                })}

                {!loading && displayRecords.length === 0 && (
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <View style={styles.emptyIconWrap}>
                            <Feather name="inbox" size={40} color={colors.border} />
                        </View>
                        <Text style={{ textAlign: 'center', color: colors.textSub, marginTop: 14, fontSize: 14, fontWeight: '600' }}>No records found for the selected filter.</Text>
                    </View>
                )}
            </ScrollView>

            {/* REQUEST CHECKOUT MODAL IMPLEMENTATION */}
            <Modal visible={isCheckoutModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                        <View style={[styles.modalHeader, { borderColor: colors.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.modalHeaderIconWrap}>
                                    <MaterialCommunityIcons name="clock-check-outline" size={20} color={colors.primary} />
                                </View>
                                <Text style={[styles.mTitle, { color: colors.textMain }]}>Request Checkout</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)}>
                                <Feather name="x" size={22} color={colors.textMain} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ padding: 20 }}>
                            <Text style={styles.modalLabel}>Date</Text>
                            <View style={[styles.disabledInput, { backgroundColor: isLightMode ? '#F1F5F9' : '#1E293B', borderColor: colors.border }]}>
                                <Text style={{ color: colors.textMain }}>{selectedAttendance ? getCardDateString(selectedAttendance.date || selectedAttendance.checkIn?.time) : ''}</Text>
                            </View>

                            <Text style={[styles.modalLabel, { marginTop: 15 }]}>Checkout Time *</Text>
                            <TouchableOpacity style={[styles.disabledInput, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowRequestTimePicker(true)}>
                                <Text style={{ color: colors.textMain }}>{formatTimeUI({ time: requestForm.time })}</Text>
                                <Feather name="clock" size={16} color={colors.textSub} />
                            </TouchableOpacity>

                            <Text style={[styles.modalLabel, { marginTop: 15 }]}>Reason *</Text>
                            <TextInput style={[styles.modalTextArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textMain }]} placeholder="Why did you miss punching out?" placeholderTextColor={colors.textSub} multiline value={requestForm.reason} onChangeText={t => setRequestForm({ ...requestForm, reason: t })} />

                            <TouchableOpacity style={[styles.submitRequestBtn, { backgroundColor: colors.primary }]} onPress={handleRequestCheckoutSubmit} disabled={requestLoading} activeOpacity={0.85}>
                                {requestLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Send Request</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {canDo('VIEW') && (
                <TouchableOpacity style={[styles.downloadFab, { backgroundColor: colors.primary }]} onPress={() => setIsDownloadModalVisible(true)} activeOpacity={0.85}>
                    <MaterialCommunityIcons name="file-excel" size={24} color="#fff" />
                </TouchableOpacity>
            )}

            {/* 🚀 Self check-in/out — floating button. Tap opens the "Today's Attendance"
          card centered on screen; the card itself carries out the actual punch.
          Only rendered when the RBAC permission gate (Step 1) passes. */}
            {showSelfPunchFab && (
                <TouchableOpacity
                    style={[
                        styles.punchFab,
                        { backgroundColor: checkinDisabledForFab ? '#94A3B8' : (isCheckingOutForFab ? '#EF4444' : '#3B82F6') }
                    ]}
                    onPress={() => setShowAttendanceCardModal(true)}
                    activeOpacity={0.85}
                >
                    <MaterialCommunityIcons
                        name={checkinDisabledForFab ? "fingerprint" : (isCheckingOutForFab ? "logout" : "login")}
                        size={24}
                        color="#fff"
                    />
                    {!checkinDisabledForFab && !todayRecord?.checkIn?.time && (
                        <View style={styles.punchFabPulseDot} />
                    )}
                </TouchableOpacity>
            )}

            {/* 🚀 premium "Today's Attendance" card, opened from the floating button above */}
            <Modal visible={showAttendanceCardModal} transparent animationType="fade">
                <View style={styles.attModalOverlay}>
                    <View style={[styles.attModalCard, { backgroundColor: colors.cardBg }]}>
                        {/* decorative accent blobs for a richer, premium feel */}
                        <View pointerEvents="none" style={[styles.attCardBlobLarge, { backgroundColor: isCheckingOutForFab ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)' }]} />
                        <View pointerEvents="none" style={[styles.attCardBlobSmall, { backgroundColor: 'rgba(139,92,246,0.08)' }]} />

                        <TouchableOpacity style={styles.attModalCloseBtn} onPress={() => setShowAttendanceCardModal(false)} activeOpacity={0.7}>
                            <Feather name="x" size={18} color={colors.textSub} />
                        </TouchableOpacity>

                        <View style={styles.attModalHeaderRow}>
                            <View style={[styles.attModalIconWrap, { backgroundColor: isCheckingOutForFab ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)' }]}>
                                <MaterialCommunityIcons name="fingerprint" size={22} color={isCheckingOutForFab ? '#EF4444' : '#3B82F6'} />
                            </View>
                            <View>
                                <Text style={[styles.attModalTitle, { color: colors.textMain }]}>Today's Attendance</Text>
                                <Text style={styles.attModalSubtitle}>
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
                                </Text>
                            </View>
                        </View>

                        {(() => {
                            const st = todayRecord?.checkIn?.time ? getStatusStyle(todayRecord.status) : { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
                            return (
                                <View style={[styles.attStatusPill, { backgroundColor: st.bg }]}>
                                    <View style={[styles.attStatusDot, { backgroundColor: st.dot }]} />
                                    <Text style={[styles.attStatusText, { color: st.text }]}>
                                        {todayRecord?.checkIn?.time ? (todayRecord.status || 'Present') : 'Not Checked In'}
                                    </Text>
                                </View>
                            );
                        })()}

                        <View style={styles.attTimeGrid}>
                            <View style={styles.attTimeCol}>
                                <View style={[styles.attTimeIconTile, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                                    <MaterialCommunityIcons name="login" size={15} color="#3B82F6" />
                                </View>
                                <Text style={styles.attTimeLabel}>CHECK IN</Text>
                                <Text style={[styles.attTimeValue, { color: '#3B82F6' }]}>{formatTimeUI(todayRecord?.checkIn)}</Text>
                            </View>

                            <View style={styles.attTimeDividerLine} />

                            <View style={styles.attTimeCol}>
                                <View style={[styles.attTimeIconTile, { backgroundColor: 'rgba(100,116,139,0.10)' }]}>
                                    <MaterialCommunityIcons name="logout" size={15} color="#64748B" />
                                </View>
                                <Text style={styles.attTimeLabel}>CHECK OUT</Text>
                                <Text style={[styles.attTimeValue, { color: colors.textMain }]}>{formatTimeUI(todayRecord?.checkOut)}</Text>
                            </View>

                            <View style={styles.attTimeDividerLine} />

                            <View style={styles.attTimeCol}>
                                <View style={[styles.attTimeIconTile, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                                    <MaterialCommunityIcons name="clock-outline" size={15} color="#8B5CF6" />
                                </View>
                                <Text style={styles.attTimeLabel}>HOURS</Text>
                                <Text style={[styles.attTimeValue, { color: colors.textMain }]}>{formatWorkingHours(todayRecord?.workingHours)}</Text>
                            </View>
                        </View>

                        {checkinDisabledForFab ? (
                            <View style={styles.attDisabledBox}>
                                <MaterialCommunityIcons name="information" size={20} color="#6366F1" style={{ marginRight: 10 }} />
                                <Text style={styles.attDisabledText}>
                                    {selfCheckinAllowed === false
                                        ? "Self check-in/out is not enabled for your account. Contact HR/admin."
                                        : "Self check-in/out is disabled by admin. Contact HR/admin."}
                                </Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.attPunchBtn, isCheckingOutForFab ? styles.attPunchBtnOut : styles.attPunchBtnIn]}
                                onPress={handlePunch}
                                disabled={punchLoading || checkingLocation}
                                activeOpacity={0.85}
                            >
                                {(punchLoading || checkingLocation) ? <ActivityIndicator color="#fff" /> : (
                                    <>
                                        <View style={styles.attPunchIconWrap}>
                                            <MaterialCommunityIcons name={isCheckingOutForFab ? "logout" : "login"} size={18} color="#fff" />
                                        </View>
                                        <Text style={styles.attPunchBtnText}>{isCheckingOutForFab ? "Check Out" : "Check In"}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {checkingLocation && (
                            <View style={styles.attLocationRow}>
                                <MaterialCommunityIcons name="crosshairs-gps" size={13} color={colors.textSub} style={{ marginRight: 5 }} />
                                <Text style={styles.attLocationText}>Checking your location...</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={isDownloadModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContentCentered, { backgroundColor: colors.cardBg, borderColor: colors.border, padding: 24, borderRadius: 26 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.modalHeaderIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                                    <MaterialCommunityIcons name="file-excel-outline" size={20} color="#10B981" />
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textMain }}>Download Report</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsDownloadModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={colors.textSub} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: colors.textSub, marginBottom: 20, fontSize: 13 }}>Select date range and employee to generate custom excel report.</Text>

                        <Text style={styles.label}>Select Employee</Text>
                        <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 15 }]} onPress={() => setShowDlEmpModal(true)}>
                            <Text style={{ color: colors.textMain }}>{dlEmpName}</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 }}>
                            <View style={{ width: '48%' }}>
                                <Text style={styles.label}>Start Date</Text>
                                <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowDlStartPicker(true)}>
                                    <Text style={{ color: colors.textMain }}>{getSafeDateString(dlStartDate)}</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ width: '48%' }}>
                                <Text style={styles.label}>End Date</Text>
                                <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowDlEndPicker(true)}>
                                    <Text style={{ color: colors.textMain }}>{getSafeDateString(dlEndDate)}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.generateBtn}
                            onPress={handleDownloadReport}
                            disabled={isDownloading}
                            activeOpacity={0.85}
                        >
                            {isDownloading ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <MaterialCommunityIcons name="download" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Generate Excel</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isAddModalVisible} animationType="slide" transparent={true}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                            <View style={[styles.modalNav, { borderColor: colors.border }]}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textMain }}>{isEditing ? 'Update' : 'New'} Record</Text>
                                <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><Feather name="x" size={24} color={colors.textMain} /></TouchableOpacity>
                            </View>
                            <ScrollView style={{ padding: 20 }}>
                                <Text style={styles.label}>Employee *</Text>
                                <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, marginBottom: 15 }]} onPress={() => !isEditing && setShowFormEmp(true)} disabled={isEditing}>
                                    <Text style={{ color: colors.textMain }}>{formData.employeeName}</Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                                    <View style={{ width: '48%' }}><Text style={styles.label}>Date *</Text>
                                        <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowFormDate(true)}>
                                            <Text style={{ color: colors.textMain }}>{getSafeDateString(formData.date)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ width: '48%' }}><Text style={styles.label}>Status</Text>
                                        <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowFormStatus(true)}>
                                            <Text style={{ color: colors.textMain, textTransform: 'capitalize' }}>{formData.status}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {formData.status !== 'absent' && formData.status !== 'holiday' && formData.status !== 'missed' && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                                        <View style={{ width: '48%' }}><Text style={styles.label}>In Time</Text>
                                            <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowFormCheckIn(true)}><Text style={{ color: colors.textMain }}>{formatTimeUI(formData.checkIn)}</Text></TouchableOpacity>
                                        </View>
                                        <View style={{ width: '48%' }}><Text style={styles.label}>Out Time</Text>
                                            <TouchableOpacity style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setShowFormCheckOut(true)}><Text style={{ color: colors.textMain }}>{formatTimeUI(formData.checkOut)}</Text></TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                            <View style={[styles.modalFooter, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                                <TouchableOpacity style={styles.submitBtn} onPress={saveRecord} disabled={formLoading} activeOpacity={0.85}>
                                    {formLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>SUBMIT RECORD</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <DropdownModal visible={showStatusModal} title="Filter Status" data={['All Status', ...STATUS_OPTIONS]} onSelect={(v: string) => setFilterStatus(v)} onClose={() => setShowStatusModal(false)} colors={colors} />
            <DropdownModal visible={showFormStatus} title="Select Status" data={STATUS_OPTIONS} onSelect={(v: any) => setFormData({ ...formData, status: v })} onClose={() => setShowFormStatus(false)} colors={colors} />
            <DropdownModal visible={showEmpModal} title="Select Employee" data={[{ userId: { _id: 'All', firstName: 'All', lastName: 'Employees' } }, ...allEmployees]} displayKey={(i: any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`} onSelect={(v: any) => { setFilterEmpId(v._id || 'All'); setFilterEmpName(v.userId ? `${v.userId.firstName} ${v.userId.lastName}` : 'All Employees'); }} onClose={() => setShowEmpModal(false)} colors={colors} />

            <DropdownModal visible={showDlEmpModal} title="Select Employee" data={[{ userId: { _id: 'All', firstName: 'All', lastName: 'Employees' } }, ...allEmployees]} displayKey={(i: any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`} onSelect={(v: any) => { setDlEmpId(v._id || 'All'); setDlEmpName(v.userId ? `${v.userId.firstName} ${v.userId.lastName}` : 'All Employees'); }} onClose={() => setShowDlEmpModal(false)} colors={colors} />

            <DropdownModal visible={showFormEmp} title="Select Absent Employee"
                data={formAbsentEmployees}
                displayKey={(i: any) => `${i.userId?.firstName || ''} ${i.userId?.lastName || ''}`}
                onSelect={(v: any) => setFormData({ ...formData, employeeId: v._id, employeeName: `${v.userId?.firstName} ${v.userId?.lastName}` })}
                onClose={() => setShowFormEmp(false)} colors={colors}
            />

            {/* photo proof viewer — opens per attendance record */}
            <PhotoProofModal
                visible={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                checkInPhoto={selectedPhotoRecord?.checkIn?.photoProof}
                checkOutPhoto={selectedPhotoRecord?.checkOut?.photoProof}
                employeeName={`${selectedPhotoRecord?.employeeId?.userId?.firstName || ''} ${selectedPhotoRecord?.employeeId?.userId?.lastName || ''}`.trim() || myName}
            />

            {/* geo-tagged selfie camera for the self punch card — opens only after permission + geo-fence checks pass */}
            {pendingLocation && (
                <GeoTagAttendanceCamera
                    visible={showGeoCam}
                    onClose={() => { setShowGeoCam(false); setPendingLocation(null); }}
                    onCapture={handlePhotoCaptured}
                    latitude={pendingLocation.latitude}
                    longitude={pendingLocation.longitude}
                    address={pendingAddress}
                    accuracy={pendingAccuracy}
                    distanceFromAllowed={pendingDistance}
                    allowedLocationName={pendingLocationName}
                    locationBased={!!attSettings?.locationEnabled}
                />
            )}

            {showFilterDatePicker && <DateTimePicker value={filterDate} mode="date" onChange={(e, d) => {
                setShowFilterDatePicker(false);
                if (e.type === 'set' && d) {
                    setFilterDate(d);
                    setIsDateFiltered(true);
                }
            }} />}

            {showDlStartPicker && <DateTimePicker value={dlStartDate} mode="date" onChange={(e, d) => {
                setShowDlStartPicker(false);
                if (e.type === 'set' && d) setDlStartDate(d);
            }} />}

            {showDlEndPicker && <DateTimePicker value={dlEndDate} mode="date" onChange={(e, d) => {
                setShowDlEndPicker(false);
                if (e.type === 'set' && d) setDlEndDate(d);
            }} />}

            {showFormDate && <DateTimePicker value={formData.date} mode="date" onChange={(e, d) => { setShowFormDate(false); if (e.type === 'set' && d) setFormData({ ...formData, date: d }); }} />}
            {showFormCheckIn && <DateTimePicker value={formData.checkIn} mode="time" onChange={(e, d) => { setShowFormCheckIn(false); if (e.type === 'set' && d) setFormData({ ...formData, checkIn: d }); }} />}
            {showFormCheckOut && <DateTimePicker value={formData.checkOut} mode="time" onChange={(e, d) => { setShowFormCheckOut(false); if (e.type === 'set' && d) setFormData({ ...formData, checkOut: d }); }} />}
            {showRequestTimePicker && <DateTimePicker value={requestForm.time} mode="time" onChange={(e, d) => { setShowRequestTimePicker(false); if (e.type === 'set' && d) setRequestForm({ ...requestForm, time: d }); }} />}
        </SafeAreaView>
    );
}

const DropdownModal = ({ visible, onClose, title, data, onSelect, displayKey, colors }: any) => (
    <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
            <View style={[styles.statusSheet, { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1 }]}>
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { color: colors.textMain }]}>{title}</Text>
                <ScrollView style={{ maxHeight: 300 }}>{data.map((item: any, index: number) => (<TouchableOpacity key={index} style={[styles.sheetItem, { borderBottomColor: colors.border }]} onPress={() => { onSelect(item); onClose(); }}><Text style={[styles.sheetText, { color: colors.textMain }]}>{typeof displayKey === 'function' ? displayKey(item) : item}</Text></TouchableOpacity>))}</ScrollView>
            </View>
        </TouchableOpacity>
    </Modal>
);

// 🎨 Premium KPI pill — tinted icon tile, colored accent border, glow shadow
const KpiCard = ({ label, val, color, bg, icon, isLast }: any) => (
    <View style={[styles.kpiCard, { borderLeftColor: color, shadowColor: color }, isLast && { marginRight: 4 }]}>
        <View style={[styles.kpiIconTile, { backgroundColor: bg }]}>
            <MaterialCommunityIcons name={icon} size={17} color={color} />
        </View>
        <Text style={[styles.kpiVal, { color: '#1E293B' }]}>{val}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    titleAccent: { width: 4, height: 30, borderRadius: 2, marginRight: 10 },
    title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
    addBtn: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 7 },
    addBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12, marginLeft: 5 },

    // 🚀 Floating self check-in/out button
    punchFab: { position: 'absolute', bottom: 30, right: 20, width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
    punchFabPulseDot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FBBF24', borderWidth: 2, borderColor: '#fff' },

    // 🚀 Premium "Today's Attendance" modal card (opened via the floating button)
    attModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    attModalCard: { width: '100%', maxWidth: 380, borderRadius: 30, padding: 26, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20 },
    attCardBlobLarge: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -70, right: -50 },
    attCardBlobSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, bottom: -35, left: -25 },
    attModalCloseBtn: { position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(148,163,184,0.14)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    attModalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
    attModalIconWrap: { width: 46, height: 46, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    attModalTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
    attModalSubtitle: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    attStatusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
    attStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    attStatusText: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize', letterSpacing: 0.2 },
    attTimeGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, paddingHorizontal: 4 },
    attTimeCol: { flex: 1, alignItems: 'center' },
    attTimeIconTile: { width: 32, height: 32, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    attTimeLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '800', letterSpacing: 0.5, marginBottom: 5 },
    attTimeValue: { fontSize: 15, fontWeight: '900' },
    attTimeDividerLine: { width: 1, height: 44, backgroundColor: 'rgba(148,163,184,0.25)' },
    attDisabledBox: { flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 15, borderRadius: 16, alignItems: 'center' },
    attDisabledText: { color: '#6366F1', fontSize: 13, flex: 1, fontWeight: '600', lineHeight: 18 },
    attPunchBtn: { padding: 17, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
    attPunchBtnIn: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6' },
    attPunchBtnOut: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
    attPunchIconWrap: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    attPunchBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
    attLocationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    attLocationText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },

    kpiCard: { backgroundColor: '#FFF', width: 132, padding: 16, borderRadius: 18, marginRight: 12, borderLeftWidth: 4, elevation: 3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 9 },
    kpiIconTile: { width: 34, height: 34, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    kpiVal: { fontSize: 22, fontWeight: '900', marginTop: 2, letterSpacing: -0.3 },
    kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 4 },
    filterRow: { flexDirection: 'row', marginBottom: 15, justifyContent: 'space-between' },
    filterPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14, marginRight: 6 },
    filterText: { fontSize: 12, fontWeight: '700' },
    attCard: { padding: 17, borderRadius: 22, borderWidth: 1, borderLeftWidth: 4, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    userInfo: { flexDirection: 'row', alignItems: 'center' },
    avatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(99,102,241,0.25)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    avatarText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    userName: { fontSize: 14, fontWeight: '800' },
    userSub: { fontSize: 10, color: '#94A3B8', marginTop: 1, fontWeight: '500' },
    statusTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
    statusTagDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
    statusTagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.2 },
    editBtn: { padding: 7, borderRadius: 9, borderWidth: 1, marginLeft: 8 },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 15 },
    timeInfo: { flex: 1 },
    timeLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginBottom: 5, letterSpacing: 0.4 },
    timeValue: { fontSize: 12, fontWeight: '800' },
    emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(148,163,184,0.08)', justifyContent: 'center', alignItems: 'center' },
    downloadFab: { position: 'absolute', bottom: 30, right: 20, width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, maxHeight: '85%' },
    modalContentCentered: { width: '90%', borderWidth: 1 },
    modalNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
    modalFooter: { padding: 20, borderTopWidth: 1 },
    submitBtn: { backgroundColor: '#3b82f6', height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
    generateBtn: { backgroundColor: '#10B981', paddingVertical: 15, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 4, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
    label: { marginBottom: 8, fontWeight: '700', fontSize: 13, color: '#64748B' },
    input: { borderWidth: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' },
    statusSheet: { padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.4)', alignSelf: 'center', marginBottom: 12 },
    sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
    sheetItem: { paddingVertical: 15, borderBottomWidth: 1 },
    sheetText: { fontSize: 15, textAlign: 'center', textTransform: 'capitalize' },

    requestCheckoutBtn: { backgroundColor: '#6366F1', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 13, borderRadius: 16, marginTop: 15, elevation: 3, shadowColor: '#6366F1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
    requestCheckoutBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
    reqStatusBox: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14 },
    requestCard: { width: '90%', borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, alignItems: 'center' },
    modalHeaderIconWrap: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(59,130,246,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    mTitle: { fontSize: 18, fontWeight: '800' },
    modalLabel: { fontWeight: '700', fontSize: 13, color: '#64748B', marginBottom: 6 },
    disabledInput: { borderWidth: 1, height: 48, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row' },
    modalTextArea: { borderWidth: 1, borderRadius: 16, padding: 14, fontSize: 14, height: 90, textAlignVertical: 'top', marginTop: 4 },
    submitRequestBtn: { height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
});