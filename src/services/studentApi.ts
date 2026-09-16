import { saveUserToDb as saveLegacyUserToDb } from './apiLegacy';
import { getApiUrl } from '../lib/apiConfig';

const isNewStudent = (user: any) => {
  if (user?.id != null) return false;
  const role = String(user?.role || '').trim().toLowerCase();
  return role === 'élève' || role === 'eleve' || role === 'student';
};

export async function saveUserToDb(user: any) {
  if (!isNewStudent(user)) return saveLegacyUserToDb(user);

  const token = localStorage.getItem('EDUCO_USER_TOKEN') || '';
  const response = await fetch(getApiUrl('/api/enrollments/students'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...user,
      // UserForm historically calls the main account number `contact`.
      // The enrollment API stores it in users.phone, which is the unique
      // number used by phone + password + OTP authentication.
      phone: user?.phone || user?.contact || null,
    }),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || data?.error) {
    throw new Error(data?.error || 'Impossible de finaliser l’inscription de l’élève.');
  }
  return data;
}
