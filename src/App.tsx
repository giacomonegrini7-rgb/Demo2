import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { I18nProvider } from './i18n';
import { FlowProvider, useFlow } from './state/flow';
import { PublicLayout } from './components/Layout';
import Landing from './pages/Landing';
import Preferences from './pages/Preferences';
import Results from './pages/Results';
import Detail from './pages/Detail';
import { Outcome, Summary, Transfer } from './pages/Purchase';
import Survey from './pages/Survey';
import { EmailStep, NotFound, Privacy, Thanks } from './pages/Closing';

// L'area creator è caricata solo quando serve: il bundle pubblico non la include.
const AdminApp = lazy(() => import('./admin/AdminApp'));

function PublicApp() {
  const { state, setLocale } = useFlow();
  return (
    <I18nProvider locale={state.locale} setLocale={setLocale}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="search" element={<Preferences />} />
          <Route path="offers" element={<Results />} />
          <Route path="offers/:destinationId" element={<Detail />} />
          <Route path="checkout" element={<Summary />} />
          <Route path="transfer" element={<Transfer />} />
          <Route path="outcome" element={<Outcome />} />
          <Route path="feedback/email" element={<EmailStep />} />
          <Route path="feedback/:step" element={<Survey />} />
          <Route path="thanks" element={<Thanks />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={<p className="p-8 text-muted">Caricamento…</p>}><AdminApp /></Suspense>} />
        <Route path="*" element={<FlowProvider><PublicApp /></FlowProvider>} />
      </Routes>
    </BrowserRouter>
  );
}
