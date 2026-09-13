import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import {
  BailleurLayout,
  LocataireLayout,
  AdminLayout,
  FiscalLayout,
} from '@/components/layouts/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { NotFound } from '@/components/common/NotFound';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyOTPPage } from '@/pages/auth/VerifyOTPPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import {
  LocataireDashboard,
  AdminDashboard,
  FiscalDashboard,
  PlaceholderPage,
} from '@/pages/dashboard/PlaceholderPages';
import { ROUTES } from '@/config/routes';
import { APP_CONFIG } from '@/config/app.config';

const BailleurDashboard = lazy(() =>
  import('@/pages/bailleur/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const PropertiesListPage = lazy(() =>
  import('@/pages/bailleur/properties/ListPage').then((m) => ({ default: m.PropertiesListPage })),
);
const PropertyDetailPage = lazy(() =>
  import('@/pages/bailleur/properties/DetailPage').then((m) => ({ default: m.PropertyDetailPage })),
);
const PropertyFormPage = lazy(() =>
  import('@/pages/bailleur/properties/FormPage').then((m) => ({ default: m.PropertyFormPage })),
);
const TenantsListPage = lazy(() =>
  import('@/pages/bailleur/tenants/ListPage').then((m) => ({ default: m.TenantsListPage })),
);
const TenantDetailPage = lazy(() =>
  import('@/pages/bailleur/tenants/DetailPage').then((m) => ({ default: m.TenantDetailPage })),
);

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">Accès non autorisé</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[var(--color-kinshasa-blue)] to-[var(--color-kinshasa-blue-dark)] px-4 text-white">
      <div className="max-w-2xl text-center">
        <h1 className="font-heading text-4xl font-bold sm:text-5xl">{APP_CONFIG.name}</h1>
        <p className="mt-4 text-lg text-blue-100">{APP_CONFIG.tagline}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={ROUTES.LOGIN}
            className="rounded-lg bg-[var(--color-kinshasa-gold)] px-6 py-3 font-medium text-[var(--color-kinshasa-blue-dark)] hover:opacity-90"
          >
            Se connecter
          </a>
          <a
            href={ROUTES.REGISTER}
            className="rounded-lg border border-white/30 px-6 py-3 font-medium hover:bg-white/10"
          >
            S&apos;inscrire
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Helmet>
        <title>{APP_CONFIG.name}</title>
        <meta name="description" content={APP_CONFIG.tagline} />
      </Helmet>

      <Routes>
        {/* Public routes */}
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY} element={<VerifyOTPPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        </Route>
        <Route path={ROUTES.UNAUTHORIZED} element={<UnauthorizedPage />} />

        {/* Bailleur routes */}
        <Route element={<ProtectedRoute allowedRoles={['bailleur', 'gestionnaire', 'agence']} />}>
          <Route element={<BailleurLayout />}>
            <Route
              path={ROUTES.BAILLEUR.DASHBOARD}
              element={<Suspense fallback={<PageLoader />}><BailleurDashboard /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.PROPERTIES}
              element={<Suspense fallback={<PageLoader />}><PropertiesListPage /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.PROPERTY_NEW}
              element={<Suspense fallback={<PageLoader />}><PropertyFormPage /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.PROPERTY_EDIT}
              element={<Suspense fallback={<PageLoader />}><PropertyFormPage /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.PROPERTY_DETAIL}
              element={<Suspense fallback={<PageLoader />}><PropertyDetailPage /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.TENANTS}
              element={<Suspense fallback={<PageLoader />}><TenantsListPage /></Suspense>}
            />
            <Route
              path={ROUTES.BAILLEUR.TENANT_DETAIL}
              element={<Suspense fallback={<PageLoader />}><TenantDetailPage /></Suspense>}
            />
            <Route path={ROUTES.BAILLEUR.CONTRACTS} element={<PlaceholderPage title="Contrats" />} />
            <Route path={ROUTES.BAILLEUR.PAYMENTS} element={<PlaceholderPage title="Paiements" />} />
            <Route path={ROUTES.BAILLEUR.RECEIPTS} element={<PlaceholderPage title="Reçus" />} />
            <Route path={ROUTES.BAILLEUR.TAXES} element={<PlaceholderPage title="Fiscalité" />} />
            <Route path={ROUTES.BAILLEUR.REPORTS} element={<PlaceholderPage title="Rapports" />} />
            <Route path={ROUTES.BAILLEUR.PROFILE} element={<PlaceholderPage title="Profil" />} />
            <Route path={ROUTES.BAILLEUR.ROOT} element={<Navigate to={ROUTES.BAILLEUR.DASHBOARD} replace />} />
          </Route>
        </Route>

        {/* Locataire routes */}
        <Route element={<ProtectedRoute allowedRoles={['locataire']} />}>
          <Route element={<LocataireLayout />}>
            <Route path={ROUTES.LOCATAIRE.HOME} element={<LocataireDashboard />} />
            <Route path={ROUTES.LOCATAIRE.CONTRACTS} element={<PlaceholderPage title="Mes contrats" />} />
            <Route path={ROUTES.LOCATAIRE.PAYMENTS} element={<PlaceholderPage title="Mes paiements" />} />
            <Route path={ROUTES.LOCATAIRE.RECEIPTS} element={<PlaceholderPage title="Mes reçus" />} />
            <Route path={ROUTES.LOCATAIRE.NOTIFICATIONS} element={<PlaceholderPage title="Notifications" />} />
            <Route path={ROUTES.LOCATAIRE.PROFILE} element={<PlaceholderPage title="Profil" />} />
            <Route path={ROUTES.LOCATAIRE.ROOT} element={<Navigate to={ROUTES.LOCATAIRE.HOME} replace />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
            <Route path={ROUTES.ADMIN.TAXPAYERS} element={<PlaceholderPage title="Contribuables" />} />
            <Route path={ROUTES.ADMIN.DECLARATIONS} element={<PlaceholderPage title="Déclarations" />} />
            <Route path={ROUTES.ADMIN.REVENUE} element={<PlaceholderPage title="Recettes" />} />
            <Route path={ROUTES.ADMIN.CONTROLS} element={<PlaceholderPage title="Contrôles" />} />
            <Route path={ROUTES.ADMIN.REPORTS} element={<PlaceholderPage title="Rapports" />} />
            <Route path={ROUTES.ADMIN.SETTINGS} element={<PlaceholderPage title="Paramètres" />} />
            <Route path={ROUTES.ADMIN.ROOT} element={<Navigate to={ROUTES.ADMIN.DASHBOARD} replace />} />
          </Route>
        </Route>

        {/* Fiscal routes */}
        <Route element={<ProtectedRoute allowedRoles={['agent_fiscal']} />}>
          <Route element={<FiscalLayout />}>
            <Route path={ROUTES.FISCAL.DASHBOARD} element={<FiscalDashboard />} />
            <Route path={ROUTES.FISCAL.DECLARATIONS} element={<PlaceholderPage title="Déclarations" />} />
            <Route path={ROUTES.FISCAL.REVENUE} element={<PlaceholderPage title="Recettes" />} />
            <Route path={ROUTES.FISCAL.RECONCILIATION} element={<PlaceholderPage title="Rapprochements" />} />
            <Route path={ROUTES.FISCAL.CONTROLS} element={<PlaceholderPage title="Contrôles" />} />
            <Route path={ROUTES.FISCAL.ROOT} element={<Navigate to={ROUTES.FISCAL.DASHBOARD} replace />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
