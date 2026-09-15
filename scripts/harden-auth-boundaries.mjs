import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const replaceOnce = (source, pattern, replacement, label) => {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Hardening pattern not found: ${label}`);
  return next;
};

// 1) Supabase configuration must be server-owned. Never trust request headers.
{
  const path = 'server.ts';
  let s = read(path);
  s = replaceOnce(s,
    /const getSupabaseServerKey = \(req\?: any\) => \(\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\|\s*process\.env\.SUPABASE_ANON_KEY \|\|\s*process\.env\.VITE_SUPABASE_ANON_KEY \|\|\s*process\.env\.SUPABASE_KEY \|\|\s*\(req\?\.headers\?\.\['x-supabase-key'\] as string\)\s*\);/,
    `const getSupabaseServerKey = (_req?: any) => (\n  process.env.SUPABASE_SERVICE_ROLE_KEY ||\n  process.env.SUPABASE_ANON_KEY ||\n  process.env.SUPABASE_KEY\n);`,
    'server Supabase key headers');
  s = replaceOnce(s,
    /let supabaseUrl = process\.env\.SUPABASE_URL \|\| process\.env\.VITE_SUPABASE_URL \|\| \(req\?\.headers\?\.\['x-supabase-url'\] as string\);/,
    `let supabaseUrl = process.env.SUPABASE_URL;`,
    'server Supabase URL headers');
  write(path, s);
}

// 2) Browser API requests may carry only a proven session token, never Supabase config or uid/email identity fallbacks.
{
  const path = 'src/services/api.ts';
  let s = read(path);
  s = replaceOnce(s,
    /async function getAuthHeaders\(\) \{[\s\S]*?\n\}\n\nasync function safeJson/,
    `async function getAuthHeaders() {\n  const token = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n  return {\n    'Content-Type': 'application/json',\n    ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})\n  };\n}\n\nasync function safeJson`,
    'client auth headers');
  write(path, s);
}

// 3) Restore only sessions the backend can validate. Cached profile data is display cache, never proof of identity.
// 4) Password login accepts only the backend proof. WebAuthn accepts only the signed token returned by /login/verify.
{
  const path = 'App.tsx';
  let s = read(path);
  s = replaceOnce(s,
    /\s*\/\/ Check stored local user or fetch from backend API[\s\S]*?\n\s*const userResult = await getCurrentUser\(\);/,
    `\n        // Cached users are never trusted as authentication proof.\n        const storedToken = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n        if (!storedToken) {\n          localStorage.removeItem('EDUCO_CURRENT_USER');\n          sessionStorage.removeItem('EDUCO_SESSION_ACTIVE');\n          setCurrentUser(null);\n          return;\n        }\n\n        const userResult = await getCurrentUser();`,
    'session restore validation');
  s = replaceOnce(s,
    /\n  const handleLogin = async \(email: string, password: string, isBiometric: boolean = false\) => \{[\s\S]*?\n  \};\n\n  const handleLogout/,
    `\n  const handleLogin = async (email: string, password: string, isBiometric: boolean = false) => {\n    const trimmedEmail = (email || '').trim();\n    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {\n      return { success: false, error: 'Veuillez saisir une adresse email valide.' };\n    }\n    if (!isBiometric && (!password || password.trim().length < 4)) {\n      return { success: false, error: 'Le mot de passe doit contenir au moins 4 caractères.' };\n    }\n\n    try {\n      const isAdminPortal = activePage === 'AdminSpecialLogin';\n      let loggedUser: any = null;\n      let provenToken = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n\n      if (isBiometric) {\n        // loginWithWebAuthn has already verified the assertion server-side and stored its signed token.\n        if (!provenToken) return { success: false, error: 'Preuve biométrique absente ou expirée.' };\n        const verified = await getCurrentUser();\n        if (!verified?.user || String(verified.user.email || '').toLowerCase() !== trimmedEmail.toLowerCase()) {\n          localStorage.removeItem('EDUCO_USER_TOKEN');\n          localStorage.removeItem('EDUCO_CURRENT_USER');\n          return { success: false, error: 'La session biométrique n’a pas pu être validée.' };\n        }\n        loggedUser = verified.user;\n      } else {\n        const loginRes = await fetch(getApiUrl('/api/auth/login'), {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({ email: trimmedEmail, password, isAdminPortal })\n        });\n        const data = await loginRes.json().catch(() => null);\n        if (!loginRes.ok || !data?.success || !data?.user || !data?.token) {\n          return { success: false, error: data?.error || 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.' };\n        }\n        loggedUser = data.user;\n        provenToken = data.token;\n      }\n\n      if ((loggedUser.role === 'Admin' || loggedUser.role === 'Co-admin') && !isAdminPortal) {\n        return { success: false, error: \"Accès refusé : utilisez le portail d’administration dédié.\" };\n      }\n      if (isAdminPortal && loggedUser.role !== 'Admin' && loggedUser.role !== 'Co-admin') {\n        return { success: false, error: \"Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs.\" };\n      }\n\n      if (loggedUser.role === 'Admin') loggedUser = { ...loggedUser, schoolId: null, school_id: null, schoolName: 'EDUCO APP' };\n      localStorage.setItem('EDUCO_USER_TOKEN', provenToken);\n      localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(loggedUser));\n      sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');\n      setInactivityNotice(null);\n      if (!otpVerified) setPendingOtpUser(loggedUser); else setCurrentUser(loggedUser);\n      setActivePage('Tableau de bord');\n\n      if (!isBiometric && isWebAuthnSupported() && loggedUser.email) {\n        fetchUserDevices(loggedUser.email).then(devs => {\n          if (devs.length === 0) setPasskeyPromptUser({ email: loggedUser.email, userId: loggedUser.uid || String(loggedUser.id), name: loggedUser.name });\n        }).catch(() => {});\n      }\n      return { success: true };\n    } catch (error: any) {\n      return { success: false, error: error?.message || 'Une erreur inattendue est survenue.' };\n    }\n  };\n\n  const handleLogout`,
    'login proof boundary');
  write(path, s);
}

console.log('Authentication boundaries hardened.');
