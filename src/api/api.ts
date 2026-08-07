import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { replace } from "./NavigationService";

export const API_BASE = "https://dhruv.hrms.dcstechnosis.com/api";

let isSessionExpiredAlertVisible = false;

const SESSION_KEYS = [
  "userToken",
  "userId",
  "employeeId",
  "userName",
  "userRole",
  "userPermissions",
  "keepLoggedIn",
  "userDesignation",
  "userDepartment",
  "userDoj",
  "userBankAcc",
  "userBankName",
  "userBankIfsc",
  "userAvatar",
];

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";

    // 🚀 FIXED: Bypass these specific APIs from triggering global logout
    const isLoginApi = requestUrl.includes("/auth/login");
    const isDeviceSyncApi = requestUrl.includes("/device/attendance");

    if (status === 401 && status=== 403 && !isSessionExpiredAlertVisible && !isLoginApi && !isDeviceSyncApi) {
      isSessionExpiredAlertVisible = true;

      // Sirf session/token details remove hongi.
      // Saved email/password remove nahi honge.
      await AsyncStorage.multiRemove(SESSION_KEYS);

      Alert.alert(
        "Ohh No! 🚨",
        "Session expired.\n\nPlease click OK to log in again.",
        [
          {
            text: "OK",
            onPress: () => {
              isSessionExpiredAlertVisible = false;
              replace("Login");
            },
          },
        ],
        { cancelable: false }
      );
    }

    return Promise.reject(error);
  }
);