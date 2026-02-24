import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/RegisterSubjectBased'; // UPDATED: Using new subject-based registration
import TwoFactorSetup from './pages/TwoFactorSetup';
import Profile from './pages/Profile';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import CollegeAdminDashboard from './pages/CollegeAdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import HODDashboard from './pages/HODDashboard';
import PaperTemplates from './pages/PaperTemplates';
import ExtractTemplateFromPDF from './pages/ExtractTemplateFromPDF';
import MyExaminers from './pages/MyExaminers';
import PDFLibrary from './pages/PDFLibrary'; // Re-enabled with simple text extraction
import SMESelection from './pages/SMESelection';
import SMEPapers from './pages/SMEPapers';
import ModeratorCategorization from './pages/ModeratorCategorization';
import ModeratorCategorizationView from './pages/ModeratorCategorizationView';
import ModeratorUsers from './pages/ModeratorUsers';
import ModeratorApprovals from './pages/ModeratorApprovals';
import QuestionVariations from './pages/QuestionVariations';
import SMEVariationReview from './pages/SMEVariationReview';
import SubQuestionVariations from './pages/SubQuestionVariations';
import SMESubQuestionReview from './pages/SMESubQuestionReview';
import SuperAdminReports from './pages/SuperAdminReports';
import Moderators from './pages/Moderators';
import EduLabPDFManagement from './pages/EduLabPDFManagement';
import PrivateRoute from './components/PrivateRoute';
import './App.css';
import { AuthContext } from './context/AuthContext';

function HomeRedirect() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  if (!user) return <Navigate to="/login" />;

  if (user.role === 'super_admin') return <Navigate to="/super-admin" />;
  if (user.role === 'moderator') return <Navigate to="/moderator" />;
  if (user.role === 'subject_matter_expert') return <Navigate to="/subject-matter-expert" />;
  if (user.role === 'examiner') return <Navigate to="/examiner" />;

  return <Navigate to="/login" />;
}

function MainLayout() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const authPages = ['/login', '/register'];
  const showSidebar = user && !authPages.includes(location.pathname);

  return (
    <>
      <Navbar />
      <Sidebar />
      <div className={`main-content ${showSidebar ? 'with-sidebar' : ''}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/2fa-setup" element={
            <PrivateRoute>
              <TwoFactorSetup />
            </PrivateRoute>
          } />

          <Route path="/2fa-security" element={
            <PrivateRoute>
              <TwoFactorSetup />
            </PrivateRoute>
          } />

          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />

          {/* PDF Library - Simple text extraction, no embeddings */}
          <Route path="/pdf-library" element={
            <PrivateRoute>
              <PDFLibrary />
            </PrivateRoute>
          } />

          <Route path="/super-admin" element={
            <PrivateRoute role="super_admin">
              <SuperAdminDashboard />
            </PrivateRoute>
          } />

          <Route path="/super-admin/moderators" element={
            <PrivateRoute role="super_admin">
              <Moderators />
            </PrivateRoute>
          } />

          <Route path="/super-admin/reports" element={
            <PrivateRoute role="super_admin">
              <SuperAdminReports />
            </PrivateRoute>
          }/>

          <Route path="/super-admin/edulab-pdfs" element={
            <PrivateRoute role="super_admin">
              <EduLabPDFManagement />
            </PrivateRoute>
          }/>

          <Route path="/moderator" element={
            <PrivateRoute role="moderator">
              <CollegeAdminDashboard />
            </PrivateRoute>
          } />

          <Route path="/examiner" element={
            <PrivateRoute role="examiner">
              <FacultyDashboard />
            </PrivateRoute>
          } />

          <Route path="/examiner/create" element={
            <PrivateRoute role="examiner">
              <FacultyDashboard />
            </PrivateRoute>
          } />

          <Route path="/examiner/papers" element={
            <PrivateRoute role="examiner">
              <FacultyDashboard />
            </PrivateRoute>
          } />

          <Route path="/examiner/view/:paperId" element={
            <PrivateRoute role="examiner">
              <FacultyDashboard />
            </PrivateRoute>
          } />

          <Route path="/examiner/variations/:paper_id" element={
            <PrivateRoute role="examiner">
              <QuestionVariations />
            </PrivateRoute>
          } />

          <Route path="/examiner/papers/:paper_id/sub-questions" element={
            <PrivateRoute role="examiner">
              <SubQuestionVariations />
            </PrivateRoute>
          } />

          <Route path="/paper-templates" element={
            <PrivateRoute role="examiner">
              <PaperTemplates />
            </PrivateRoute>
          } />

          <Route path="/extract-template" element={
            <PrivateRoute role="examiner">
              <ExtractTemplateFromPDF />
            </PrivateRoute>
          } />

          <Route path="/subject-matter-expert" element={
            <PrivateRoute role="subject_matter_expert">
              <HODDashboard />
            </PrivateRoute>
          } />

          <Route path="/sme-selection" element={
            <PrivateRoute role="subject_matter_expert">
              <SMESelection />
            </PrivateRoute>
          } />

          <Route path="/sme-papers" element={
            <PrivateRoute role="subject_matter_expert">
              <SMEPapers />
            </PrivateRoute>
          } />

          <Route path="/sme-papers/view/:paperId" element={
            <PrivateRoute role="subject_matter_expert">
              <SMEPapers />
            </PrivateRoute>
          } />

          <Route path="/sme/variation-reviews" element={
            <PrivateRoute role="subject_matter_expert">
              <SMEVariationReview />
            </PrivateRoute>
          } />

          <Route path="/sme/sub-question-reviews" element={
            <PrivateRoute role="subject_matter_expert">
              <SMESubQuestionReview />
            </PrivateRoute>
          } />

          <Route path="/moderator-categorization" element={
            <PrivateRoute role="moderator">
              <ModeratorCategorization />
            </PrivateRoute>
          } />

          <Route path="/moderator-categorization/view/:paperId" element={
            <PrivateRoute role="moderator">
              <ModeratorCategorization />
            </PrivateRoute>
          } />

          <Route path="/moderator-categorization/view/:paperId/category/:categoryKey" element={
            <PrivateRoute role="moderator">
              <ModeratorCategorizationView />
            </PrivateRoute>
          } />

          <Route path="/moderator/users" element={
            <PrivateRoute role="moderator">
              <ModeratorUsers />
            </PrivateRoute>
          } />

          <Route path="/moderator/approvals" element={
            <PrivateRoute role="moderator">
              <ModeratorApprovals />
            </PrivateRoute>
          } />

          <Route path="/my-examiners" element={
            <PrivateRoute role="subject_matter_expert">
              <MyExaminers />
            </PrivateRoute>
          } />

          <Route path="/" element={<HomeRedirect />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <div className="app">
              <MainLayout />
            </div>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
