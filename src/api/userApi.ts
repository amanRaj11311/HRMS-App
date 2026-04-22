import apiClient from './apiClient';

export const getUserProfile = () => {
  return apiClient.get('/employee/profile');
};

export const updateProfile = (data: any) => {
  return apiClient.post('/employee/update-profile', data);
};