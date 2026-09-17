import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LockKeyhole, LogOut, ShieldAlert } from 'lucide-react';
import LegacyApp from '../App';
import InstitutionAccessPortal from './InstitutionAccessPortal';
import GovernmentDashboard from './GovernmentDashboard';
import {
  accessContextLabel,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig';
import {
  canRoleAccessInstitutionContext,
  clearInstitutionAccessContext,
  readInstitutionAccessContext,
  saveInstitutionAccessContext,
} from '../src/institutional/accessContext';
import { getStoredSupabaseConfig, getSupabaseClient } from '../src/lib/supabase';

type SessionSnapshot = {
  sessionActive: boolean;
  otpVerified: boolean;
  context: InstitutionAccessContext | null;
  user: { name?: string; role?: string; email?: string } | null;
};

const readUser = () => {
  try {
    const raw = localStorage.getItem('EDUCO_CURRENT_USER');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readSnapshot = (): SessionSnapshot => ({
  sessionActive: sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true',
  otpVerified: sessionStorage.getItem('otpVerified') === 'true',
  context: readInstitutionAccessContext(),
  user: readUser(),
});

const InstitutionalEntryApp: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => readSnapshot());

  const syncSnapshot = useCallback(() => {
    const next = readSnapshot();
    setSnapshot((previous) => {
      const previousSerialized = JSON.stringify(previous);
      const nextSerialized = JSON.stringify(next);
      return previousSerialized === nextSerialized ? previous : next;
    });
  }, []);

  useEffect(() => {
    syncSnapshot();
    const timer = window.setInterval(syncSnapshot, 600);
    const syncOnFocus = () => syncSnapshot();
    window.addEventListener('focus', syncOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', syncOnFocus);
    };
  }, [syncSnapshot]);

  const selectContext = useCallback((context: InstitutionAccessContext) => {
    saveInstitutionAccessContext(context);
    setSnapshot(readSnapshot());
  }, []);

  const changeSpace = useCallback(() => {
    clearInstitutionAccessContext();
    setSnapshot(readSnapshot());
  }, []);

  const secureLogout = useCallback(async () => {
    try {
      const { url } = getStoredSupabaseConfig();
      if (url && !url.includes('demo-educo.supabase.co') && !url.includes('your-project.supabase.co')) {
        await getSupabaseClient().auth.signOut().catch(() => undefined);
      }
    } catch {
      // The local session is still cleared below when the remote provider is unavailable.
    }

    localStorage.removeItem('EDUCO_CURRENT_USER');
    localStorage.removeItem('EDUCO_USER_TOKEN');
    sessionStorage.removeItem('EDUCO_SESSION_ACTIVE');
    sessionStorage.removeItem('otpVerified');
    clearInstitutionAccessContext();
    setSnapshot(readSnapshot());
  }, []);

  const isGovernmentWorkspace = useMemo(
    () => snapshot.context?.sector === 'STATE' && snapshot.sessionActive && snapshot.otpVerified,
    [snapshot.context, snapshot.sessionActive, snapshot.otpVerified],
  );

  // Existing authenticated sessions remain untouched. This keeps current EDUCO
  // school users compatible even if they logged in before the institutional portal existed.
  if (snapshot.sessionActive && !snapshot.context) {
    return <LegacyApp />;
  }

  if (!snapshot.sessionActive && !snapshot.context) {
    return <InstitutionAccessPortal onSelect={selectContext} />;
  }

  if (isGovernmentWorkspace && snapshot.context) {
    const allowed = canRoleAccessInstitutionContext(snapshot.user?.role, snapshot.context);
    if (!allowed) {
      return (
        <AccessDenied
          context={snapshot.context}
          role={snapshot.user?.role}
          onChangeSpace={changeSpace}
          onLogout={secureLogout}
        />
      );
    }

    return (
      <GovernmentDashboard
        context={snapshot.context}
        user={snapshot.user || {}}
        onLogout={secureLogout}
        onChangeSpace={changeSpace}
      />
    );
  }

  // School/university users and government users who are still in password/OTP
  // authentication continue through the original App and all its existing flows.
  return (
    <div className="relative min-h-screen">
      {!snapshot.sessionActive && snapshot.context && (
        <AccessContextBanner context={snapshot.context} onChangeSpace={changeSpace} />
      )}
      <LegacyApp />
    </div>
  );
};

const AccessContextBanner = ({
  context,
  onChangeSpace,
}: {
  context: InstitutionAccessContext;
  onChangeSpace: () => void;
}) => (
  <div className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-3">
    <div className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg shadow-slate-300/30 backdrop-blur sm:px-4">
      <LockKeyhole className="h-4 w-4 shrink-0 text-blue-600" />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Espace sélectionné</div>
        <div className="truncate text-xs font-black text-slate-800 sm:text-sm">{accessContextLabel(context)}</div>
      </div>
      <button type="button" onClick={onChangeSpace} className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-black text-slate-600 transition hover:bg-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Changer
      </button>
    </div>
  </div>
);

const AccessDenied = ({
  context,
  role,
  onChangeSpace,
  onLogout,
}: {
  context: InstitutionAccessContext;
  role?: string;
  onChangeSpace: () => void;
  onLogout: () => void | Promise<void>;
}) => (
  <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
    <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert className="h-8 w-8" /></div>
      <h1 className="mt-5 text-2xl font-black text-slate-950">Accès institutionnel non autorisé</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Le compte connecté ne possède pas le rôle requis pour <strong>{accessContextLabel(context)}</strong>. La sélection visuelle d’une structure ne donne jamais de permission supplémentaire.
      </p>
      {role && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">Rôle du compte : {role}</div>}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onChangeSpace} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />Changer d’espace</button>
        <button type="button" onClick={() => onLogout()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F4A59] px-4 py-3 text-sm font-black text-white hover:bg-[#173b47]"><LogOut className="h-4 w-4" />Se déconnecter</button>
      </div>
    </section>
  </main>
);

export default InstitutionalEntryApp;
