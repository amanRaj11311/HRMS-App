import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";
const EMAIL_KEY = "saved_email";
const PASSWORD_KEY = "saved_password";
const REMEMBER_KEY = "remember_login";

export const saveToken = async (token) => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const clearTokenOnly = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

export const saveLoginCredentials = async (email, password) => {
  await SecureStore.setItemAsync(EMAIL_KEY, email);
  await SecureStore.setItemAsync(PASSWORD_KEY, password);
  await SecureStore.setItemAsync(REMEMBER_KEY, "true");
};

export const getSavedLoginCredentials = async () => {
  const remember = await SecureStore.getItemAsync(REMEMBER_KEY);

  if (remember !== "true") {
    return null;
  }

  const email = await SecureStore.getItemAsync(EMAIL_KEY);
  const password = await SecureStore.getItemAsync(PASSWORD_KEY);

  return {
    email: email || "",
    password: password || "",
  };
};

export const clearLoginCredentials = async () => {
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await SecureStore.deleteItemAsync(REMEMBER_KEY);
};

export const logoutCompletely = async () => {
  await clearTokenOnly();
  await clearLoginCredentials();
};