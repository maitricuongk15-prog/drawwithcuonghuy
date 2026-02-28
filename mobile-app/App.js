import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ConfirmDialog, ToastStack } from './src/components/FeedbackUI';
import { AuthScreen } from './src/components/screens/AuthScreen';
import { DrawingScreen } from './src/components/screens/DrawingScreen';
import { ProjectsScreen } from './src/components/screens/ProjectsScreen';
import { useAuth } from './src/hooks/useAuth';
import { useDrawing } from './src/hooks/useDrawing';
import { useFeedback } from './src/hooks/useFeedback';
import { useProjects } from './src/hooks/useProjects';
import { styles } from './src/styles/appStyles';
import { exportDrawingAsPng } from './src/utils/exportPng';

export default function App() {
  const feedback = useFeedback();
  const drawing = useDrawing({
    notify: feedback.showToast,
    requestConfirm: feedback.showConfirm,
  });
  const auth = useAuth({
    onLoginSuccess: drawing.connectSocket,
    onLogout: () => {
      drawing.disconnectSocket();
      drawing.resetDrawingState();
    },
    notify: feedback.showToast,
    requestConfirm: feedback.showConfirm,
  });
  const projectManager = useProjects({
    currentUser: auth.currentUser,
    notify: feedback.showToast,
  });

  const {
    projects,
    loadingProjects,
    creatingProject,
    joiningProject,
    deletingProjectId,
    loadProjects,
    createNewProject,
    joinByInvite,
    deleteProjectByOwner,
  } = projectManager;

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPassword, setNewProjectPassword] = useState('');
  const [joinInviteValue, setJoinInviteValue] = useState('');
  const [joinProjectPassword, setJoinProjectPassword] = useState('');
  const canvasContainerRef = useRef(null);

  const handleExportPng = useCallback(async () => {
    try {
      await exportDrawingAsPng({
        isWeb: Platform.OS === 'web',
        drawing,
        canvasContainerRef,
        notify: feedback.showToast,
        fallbackSave: drawing.handleSave,
      });
    } catch (error) {
      feedback.showToast({ type: 'error', message: 'Cannot save PNG. Please try again.' });
    }
  }, [drawing, feedback]);

  useEffect(() => {
    if (auth.isAuthenticated && !drawing.currentProject) {
      loadProjects();
    }
  }, [auth.isAuthenticated, drawing.currentProject?.id, loadProjects]);

  const handleCreateProject = async () => {
    const created = await createNewProject(newProjectName, newProjectPassword);
    if (!created) {
      return;
    }
    setNewProjectName('');
    setNewProjectPassword('');
    drawing.joinProject(created);
  };

  const handleJoinProject = async () => {
    const joined = await joinByInvite(joinInviteValue, joinProjectPassword);
    if (!joined) {
      return;
    }
    setJoinInviteValue('');
    setJoinProjectPassword('');
    drawing.joinProject(joined);
  };

  const handleDeleteProject = (project) => {
    if (!project?.isOwner) {
      return;
    }

    feedback.showConfirm({
      title: 'Delete project',
      message: `Delete "${project.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const deleted = await deleteProjectByOwner(project.id);
        if (deleted && String(drawing.currentProject?.id || '') === String(project.id)) {
          drawing.leaveProject();
        }
      },
    });
  };

  let content = null;

  if (!auth.isAuthenticated) {
    content = <AuthScreen auth={auth} styles={styles} />;
  } else if (!drawing.currentProject) {
    content = (
      <ProjectsScreen
        auth={auth}
        drawing={drawing}
        projects={projects}
        loadingProjects={loadingProjects}
        creatingProject={creatingProject}
        joiningProject={joiningProject}
        deletingProjectId={deletingProjectId}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        newProjectPassword={newProjectPassword}
        setNewProjectPassword={setNewProjectPassword}
        joinInviteValue={joinInviteValue}
        setJoinInviteValue={setJoinInviteValue}
        joinProjectPassword={joinProjectPassword}
        setJoinProjectPassword={setJoinProjectPassword}
        onRefresh={loadProjects}
        onCreateProject={handleCreateProject}
        onJoinProject={handleJoinProject}
        onDeleteProject={handleDeleteProject}
        styles={styles}
      />
    );
  } else {
    content = (
      <DrawingScreen
        auth={auth}
        drawing={drawing}
        styles={styles}
        canvasContainerRef={canvasContainerRef}
        onExportPng={handleExportPng}
      />
    );
  }

  return (
    <>
      {content}
      <ToastStack toasts={feedback.toasts} onClose={feedback.removeToast} />
      <ConfirmDialog
        visible={feedback.confirmDialog.visible}
        title={feedback.confirmDialog.title}
        message={feedback.confirmDialog.message}
        confirmText={feedback.confirmDialog.confirmText}
        cancelText={feedback.confirmDialog.cancelText}
        onCancel={feedback.closeConfirm}
        onConfirm={feedback.confirm}
      />
    </>
  );
}
