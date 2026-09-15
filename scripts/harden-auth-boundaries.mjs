import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// Server-owned Supabase configuration + a single password-verification boundary.
{
  const path = 'server.ts';
  let s = read(path);
  s = s.replace(
    /const getSupabaseServerKey = \(req\?: any\) => \(\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\|\s*process\.env\.SUPABASE_ANON_KEY \|\|\s*process\.env\.VITE_SUPABASE_ANON_KEY \|\|\s*process\.env\.SUPABASE_KEY \|\|\s*\(req\?\.headers\?\.\['x-supabase-key'\] as string\)\s*\);/,
    `const getSupabaseServerKey = (_req?: any) => (\n  process.env.SUPABASE_SERVICE_ROLE_KEY ||\n  process.env.SUPABASE_ANON_KEY ||\n  process.env.SUPABASE_KEY\n);`
  );
  s = s.replace(
    /let supabaseUrl = process\.env\.SUPABASE_URL \|\| process\.env\.VITE_SUPABASE_URL \|\| \(req\?\.headers\?\.\['x-supabase-url'\] as string\);/,
    `let supabaseUrl = process.env.SUPABASE_URL;`
  );

  if (!s.includes("app.post('/api/auth/login'")) {
    const anchor = "  app.use('/api/auth/webauthn', createWebAuthnRouter(getSupabaseAdmin, db, schema.webauthnCredentials));";
    if (!s.includes(anchor)) throw new Error('WebAuthn route anchor not found');
    const route = `${anchor}\n\n  // Password login: credentials are verified by Supabase Auth on the server.\n  // Public profile rows, cached browser users and biometric flags are never authentication proof.\n  app.post('/api/auth/login', rateLimit('login', 10, 60_000), async (req, res) => {\n    try {\n      const email = normalizeEmail(req.body?.email);\n      const password = String(req.body?.password || '');\n      const isAdminPortal = Boolean(req.body?.isAdminPortal);\n      if (!email || password.length < 4) return res.status(400).json({ success: false, error: 'Identifiants invalides.' });\n      if (req.body?.isBiometric) return res.status(400).json({ success: false, error: 'La biométrie doit utiliser la vérification WebAuthn dédiée.' });\n\n      const authClient = getSupabaseAdmin();\n      if (!authClient) return res.status(503).json({ success: false, error: 'Service d’authentification indisponible.' });\n      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });\n      if (authError || !authData?.user?.id || !authData?.session?.access_token) {\n        return res.status(401).json({ success: false, error: 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.' });\n      }\n\n      const { data: profile, error: profileError } = await authClient.from('users').select('*').eq('uid', authData.user.id).limit(1).maybeSingle();\n      const resolvedProfile = profile || (await authClient.from('users').select('*').eq('email', email).limit(1).maybeSingle()).data;\n      if (profileError && !resolvedProfile) return res.status(401).json({ success: false, error: 'Profil EDUCO introuvable.' });\n      const user = mapSupabaseUser(resolvedProfile);\n      if (!user || user.status === 'Inactif' || user.status === 'inactive') return res.status(403).json({ success: false, error: 'Ce compte est inactif.' });\n\n      const isAdmin = user.role === 'Admin' || user.role === 'Co-admin';\n      if (isAdmin && !isAdminPortal) return res.status(403).json({ success: false, error: 'Utilisez le portail d’administration dédié.' });\n      if (isAdminPortal && !isAdmin) return res.status(403).json({ success: false, error: 'Ce portail est réservé aux administrateurs.' });\n\n      const token = createLocalSessionToken(user);\n      if (!token) return res.status(503).json({ success: false, error: 'Impossible de créer une session EDUCO sécurisée.' });\n      return res.json({ success: true, user, token });\n    } catch (error: any) {\n      console.error('Secure login error:', error);\n      return res.status(500).json({ success: false, error: 'Service d’authentification indisponible.' });\n    }\n  });`;
    s = s.replace(anchor, route);
  }
  write(path, s);
}

// Browser API requests carry only a proven bearer token.
{
  const path = 'src/services/api.ts';
  let s = read(path);
  if (/async function getAuthHeaders\(\) \{[\s\S]*?x-supabase-key/.test(s)) {
    s = s.replace(
      /async function getAuthHeaders\(\) \{[\s\S]*?\n\}\n\nasync function safeJson/,
      `async function getAuthHeaders() {\n  const token = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n  return {\n    'Content-Type': 'application/json',\n    ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})\n  };\n}\n\nasync function safeJson`
    );
  }
  write(path, s);
}

// Restore cached identity only after backend token validation and remove unproved login fallbacks.
{
  const path = 'App.tsx';
  let s = read(path);
  if (s.includes('// Check stored local user or fetch from backend API')) {
    s = s.replace(
      /\s*\/\/ Check stored local user or fetch from backend API[\s\S]*?\n\s*const userResult = await getCurrentUser\(\);/,
      `\n        // Cached users are never trusted as authentication proof.\n        const storedToken = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n        if (!storedToken) {\n          localStorage.removeItem('EDUCO_CURRENT_USER');\n          sessionStorage.removeItem('EDUCO_SESSION_ACTIVE');\n          setCurrentUser(null);\n          return;\n        }\n\n        const userResult = await getCurrentUser();`
    );
  }
  if (/const handleLogin = async[\s\S]*?users\.find/.test(s)) {
    s = s.replace(
      /\n  const handleLogin = async \(email: string, password: string, isBiometric: boolean = false\) => \{[\s\S]*?\n  \};\n\n  const handleLogout/,
      `\n  const handleLogin = async (email: string, password: string, isBiometric: boolean = false) => {\n    const trimmedEmail = (email || '').trim();\n    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) return { success: false, error: 'Veuillez saisir une adresse email valide.' };\n    if (!isBiometric && (!password || password.trim().length < 4)) return { success: false, error: 'Le mot de passe doit contenir au moins 4 caractères.' };\n    try {\n      const isAdminPortal = activePage === 'AdminSpecialLogin';\n      let loggedUser: any = null;\n      let provenToken = localStorage.getItem('EDUCO_USER_TOKEN') || '';\n      if (isBiometric) {\n        if (!provenToken) return { success: false, error: 'Preuve biométrique absente ou expirée.' };\n        const verified = await getCurrentUser();\n        if (!verified?.user || String(verified.user.email || '').toLowerCase() !== trimmedEmail.toLowerCase()) {\n          localStorage.removeItem('EDUCO_USER_TOKEN');\n          localStorage.removeItem('EDUCO_CURRENT_USER');\n          return { success: false, error: 'La session biométrique n’a pas pu être validée.' };\n        }\n        loggedUser = verified.user;\n      } else {\n        const loginRes = await fetch(getApiUrl('/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: trimmedEmail, password, isAdminPortal }) });\n        const data = await loginRes.json().catch(() => null);\n        if (!loginRes.ok || !data?.success || !data?.user || !data?.token) return { success: false, error: data?.error || 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.' };\n        loggedUser = data.user; provenToken = data.token;\n      }\n      if ((loggedUser.role === 'Admin' || loggedUser.role === 'Co-admin') && !isAdminPortal) return { success: false, error: \"Accès refusé : utilisez le portail d’administration dédié.\" };\n      if (isAdminPortal && loggedUser.role !== 'Admin' && loggedUser.role !== 'Co-admin') return { success: false, error: \"Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs.\" };\n      if (loggedUser.role === 'Admin') loggedUser = { ...loggedUser, schoolId: null, school_id: null, schoolName: 'EDUCO APP' };\n      localStorage.setItem('EDUCO_USER_TOKEN', provenToken); localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(loggedUser)); sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');\n      setInactivityNotice(null); if (!otpVerified) setPendingOtpUser(loggedUser); else setCurrentUser(loggedUser); setActivePage('Tableau de bord');\n      if (!isBiometric && isWebAuthnSupported() && loggedUser.email) fetchUserDevices(loggedUser.email).then(devs => { if (devs.length === 0) setPasskeyPromptUser({ email: loggedUser.email, userId: loggedUser.uid || String(loggedUser.id), name: loggedUser.name }); }).catch(() => {});\n      return { success: true };\n    } catch (error: any) { return { success: false, error: error?.message || 'Une erreur inattendue est survenue.' }; }\n  };\n\n  const handleLogout`
    );
  }
  write(path, s);
}

console.log('Authentication boundaries hardened.');
